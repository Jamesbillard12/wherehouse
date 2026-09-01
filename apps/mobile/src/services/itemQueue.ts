import { createRemoteClient } from '@wherehouse/api-client'
import * as FileSystem from 'expo-file-system/legacy'

import type { ItemDraft, ItemLocationChoice, ItemUpdateDraft } from '../types/itemDraft'
import { database } from './database'
import type { PairedServer } from './pairing'

type PendingRow = { local_id: string; payload: string; remote_item_id: string | null }
type SyncResult = { failed: number; synced: number }

const creationSyncs = new Map<string, Promise<SyncResult>>()
const updateSyncs = new Map<string, Promise<SyncResult>>()

export async function queueItem(householdId: string, draft: ItemDraft): Promise<void> {
  const db = await database()
  await db.runAsync(
    'INSERT OR REPLACE INTO pending_items (local_id, household_id, payload, remote_item_id, created_at, last_error) VALUES (?, ?, ?, NULL, ?, NULL)',
    draft.localId,
    householdId,
    JSON.stringify(draft),
    draft.createdAt,
  )
  if (draft.location) await rememberLocation(householdId, draft.location)
}

export async function pendingItemCount(householdId: string): Promise<number> {
  const db = await database()
  const created = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM pending_items WHERE household_id = ?', householdId)
  const updated = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM pending_item_updates WHERE household_id = ?', householdId)
  return (created?.count ?? 0) + (updated?.count ?? 0)
}

export async function queueItemUpdate(householdId: string, draft: ItemUpdateDraft): Promise<void> {
  const db = await database()
  await db.runAsync('INSERT OR REPLACE INTO pending_item_updates (item_id, household_id, payload, updated_at, last_error) VALUES (?, ?, ?, ?, NULL)', draft.itemId, householdId, JSON.stringify(draft), draft.updatedAt)
  if (draft.location) await rememberLocation(householdId, draft.location)
}

export async function recentLocations(householdId: string): Promise<ItemLocationChoice[]> {
  const db = await database()
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM recent_item_locations WHERE household_id = ? ORDER BY used_at DESC LIMIT 4', householdId)
  return rows.map((row) => JSON.parse(row.payload) as ItemLocationChoice)
}

async function rememberLocation(householdId: string, location: ItemLocationChoice): Promise<void> {
  const db = await database()
  await db.runAsync(
    'INSERT OR REPLACE INTO recent_item_locations (household_id, location_key, payload, used_at) VALUES (?, ?, ?, ?)',
    householdId,
    `${location.kind}:${location.id}`,
    JSON.stringify(location),
    new Date().toISOString(),
  )
}

export function syncPendingItems(server: PairedServer): Promise<SyncResult> {
  const existing = creationSyncs.get(server.householdId)
  if (existing) return existing
  const sync = syncPendingItemsOnce(server).finally(() => creationSyncs.delete(server.householdId))
  creationSyncs.set(server.householdId, sync)
  return sync
}

async function syncPendingItemsOnce(server: PairedServer): Promise<SyncResult> {
  const db = await database()
  const rows = await db.getAllAsync<PendingRow>('SELECT local_id, payload, remote_item_id FROM pending_items WHERE household_id = ? ORDER BY created_at', server.householdId)
  const client = createRemoteClient(server.baseUrl, server.accessToken)
  let synced = 0
  let failed = 0
  for (const row of rows) {
    const draft = JSON.parse(row.payload) as ItemDraft
    try {
      let itemId = row.remote_item_id
      if (!itemId) {
        const metadata = [draft.category ? `Category: ${draft.category}` : '', draft.condition ? `Condition: ${draft.condition}` : '', draft.tags?.length ? `Tags: ${draft.tags.join(', ')}` : '', draft.notes ?? ''].filter(Boolean).join('\n')
        const item = await client.createItem(server.householdId, {
          client_operation_id: draft.localId,
          name: draft.name,
          identifier_type: 'none',
          quantity: draft.quantity,
          unit: draft.unit,
          manufacturer: draft.manufacturer,
          notes: metadata || undefined,
        })
        itemId = item.id
        await db.runAsync('UPDATE pending_items SET remote_item_id = ? WHERE local_id = ?', itemId, row.local_id)
      }
      if (draft.location) {
        await client.placeItem(itemId, {
          [`${draft.location.kind}_id`]: draft.location.id,
          ...(draft.location.kind === 'container' ? { relationship_type: 'in' as const } : {}),
        })
      }
      if (draft.photoUri) {
        const response = await fetch(draft.photoUri)
        await client.uploadItemImage(itemId, await response.blob(), draft.photoMimeType)
      }
      await db.runAsync('DELETE FROM pending_items WHERE local_id = ?', row.local_id)
      if (draft.photoUri) await FileSystem.deleteAsync(draft.photoUri, { idempotent: true })
      synced += 1
    } catch (reason) {
      failed += 1
      await db.runAsync('UPDATE pending_items SET last_error = ? WHERE local_id = ?', reason instanceof Error ? reason.message : 'Sync failed', row.local_id)
    }
  }
  return { failed, synced }
}

export function syncPendingItemUpdates(server: PairedServer): Promise<SyncResult> {
  const existing = updateSyncs.get(server.householdId)
  if (existing) return existing
  const sync = syncPendingItemUpdatesOnce(server).finally(() => updateSyncs.delete(server.householdId))
  updateSyncs.set(server.householdId, sync)
  return sync
}

async function syncPendingItemUpdatesOnce(server: PairedServer): Promise<SyncResult> {
  const db = await database()
  const rows = await db.getAllAsync<{ item_id: string; payload: string }>('SELECT item_id, payload FROM pending_item_updates WHERE household_id = ? ORDER BY updated_at', server.householdId)
  const client = createRemoteClient(server.baseUrl, server.accessToken)
  let synced = 0
  let failed = 0
  for (const row of rows) {
    const draft = JSON.parse(row.payload) as ItemUpdateDraft
    try {
      await client.updateItem(row.item_id, { name: draft.name, identifier_type: draft.identifierType, description: draft.description, quantity: draft.quantity, unit: draft.unit, manufacturer: draft.manufacturer, model: draft.model, serial_number: draft.serialNumber, notes: draft.notes })
      if (draft.location) await client.placeItem(row.item_id, { [`${draft.location.kind}_id`]: draft.location.id, ...(draft.location.kind === 'container' ? { relationship_type: 'in' as const } : {}) })
      if (draft.photoUri) {
        const response = await fetch(draft.photoUri)
        await client.uploadItemImage(row.item_id, await response.blob(), draft.photoMimeType)
        await FileSystem.deleteAsync(draft.photoUri, { idempotent: true })
      }
      await db.runAsync('DELETE FROM pending_item_updates WHERE item_id = ?', row.item_id)
      synced += 1
    } catch (reason) {
      failed += 1
      await db.runAsync('UPDATE pending_item_updates SET last_error = ? WHERE item_id = ?', reason instanceof Error ? reason.message : 'Sync failed', row.item_id)
    }
  }
  return { failed, synced }
}
