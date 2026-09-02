import { ApiError, createRemoteClient, type Item, type ItemPlacement } from '@wherehouse/api-client'
import * as FileSystem from 'expo-file-system/legacy'

import type { ItemDraft, ItemLocationChoice } from '../types/itemDraft'
import { database } from './database'
import type { PairedServer } from './pairing'
import { classifyQueueFailure, isSupportedItemCreate, nextRetryAt } from './queuePolicy'

type PendingRow = { attempt_count: number; operation_id: string; operation_type: string; operation_version: number; payload: string; remote_entity_id: string | null }
export type SyncResult = { failed: number; itemIds: Record<string, string>; needsAttention: number; paused: boolean; synced: number }

const syncs = new Map<string, Promise<SyncResult>>()

function optimisticItem(householdId: string, draft: ItemDraft): Item {
  return { id: draft.localId, household_id: householdId, name: draft.name, code: 'Pending sync', identifier_type: 'none', description: null, quantity: String(draft.quantity), unit: draft.unit ?? null, manufacturer: draft.manufacturer ?? null, model: null, serial_number: null, notes: draft.notes ?? null, image_path: draft.photoUri ?? null, is_archived: false, created_at: draft.createdAt, updated_at: draft.createdAt }
}

function optimisticPlacement(draft: ItemDraft): ItemPlacement | null {
  if (!draft.location) return null
  return { id: `local-placement-${draft.localId}`, item_id: draft.localId, area_id: draft.location.kind === 'area' ? draft.location.id : null, zone_id: draft.location.kind === 'zone' ? draft.location.id : null, container_id: draft.location.kind === 'container' ? draft.location.id : null, relationship_type: draft.location.kind === 'container' ? 'in' : null, created_at: draft.createdAt, updated_at: draft.createdAt }
}

export async function queueItem(householdId: string, draft: ItemDraft): Promise<void> {
  if (draft.schemaVersion !== 1) throw new Error('This item draft version is not supported.')
  const db = await database()
  const item = optimisticItem(householdId, draft)
  const placement = optimisticPlacement(draft)
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(`INSERT OR IGNORE INTO pending_operations (operation_id, operation_type, operation_version, household_id, payload, created_at, status, attempt_count) VALUES (?, 'item.create', 1, ?, ?, ?, 'pending', 0)`, draft.localId, householdId, JSON.stringify(draft), draft.createdAt)
    await transaction.runAsync('INSERT OR REPLACE INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)', 'item', item.id, householdId, JSON.stringify(item))
    if (placement) await transaction.runAsync('INSERT OR REPLACE INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)', 'item-placement', placement.id, householdId, JSON.stringify(placement))
    if (draft.location) await transaction.runAsync('INSERT OR REPLACE INTO recent_item_locations (household_id, location_key, payload, used_at) VALUES (?, ?, ?, ?)', householdId, `${draft.location.kind}:${draft.location.id}`, JSON.stringify(draft.location), new Date().toISOString())
  })
}

export async function pendingItemCount(householdId: string): Promise<number> {
  const db = await database()
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM pending_operations WHERE household_id = ? AND status != 'permanently_failed'`, householdId)
  return row?.count ?? 0
}

export async function failedItemCount(householdId: string): Promise<number> {
  const db = await database()
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM pending_operations WHERE household_id = ? AND status = 'permanently_failed'`, householdId)
  return row?.count ?? 0
}

export async function recentLocations(householdId: string): Promise<ItemLocationChoice[]> {
  const db = await database()
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM recent_item_locations WHERE household_id = ? ORDER BY used_at DESC LIMIT 4', householdId)
  return rows.map((row) => JSON.parse(row.payload) as ItemLocationChoice)
}

export function syncPendingItems(server: PairedServer): Promise<SyncResult> {
  const existing = syncs.get(server.householdId)
  if (existing) return existing
  const sync = syncPendingItemsOnce(server).finally(() => syncs.delete(server.householdId))
  syncs.set(server.householdId, sync)
  return sync
}

async function syncPendingItemsOnce(server: PairedServer): Promise<SyncResult> {
  const db = await database()
  const rows = await db.getAllAsync<PendingRow>(`SELECT operation_id, operation_type, operation_version, payload, remote_entity_id, attempt_count FROM pending_operations WHERE household_id = ? AND status IN ('pending', 'retryable_failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at, operation_id`, server.householdId, new Date().toISOString())
  const client = createRemoteClient(server.baseUrl, server.accessToken)
  const result: SyncResult = { failed: 0, itemIds: {}, needsAttention: 0, paused: false, synced: 0 }
  for (const row of rows) {
    const draft = JSON.parse(row.payload) as ItemDraft
    if (!isSupportedItemCreate(row.operation_type, row.operation_version, draft.schemaVersion)) {
      await markFailure(row.operation_id, 'Unsupported saved operation version.', false, row.attempt_count)
      result.failed += 1; result.needsAttention += 1; continue
    }
    await db.runAsync(`UPDATE pending_operations SET status = 'in_progress', attempt_count = attempt_count + 1, last_error = NULL WHERE operation_id = ?`, row.operation_id)
    try {
      let itemId = row.remote_entity_id
      if (!itemId) {
        const metadata = [draft.category ? `Category: ${draft.category}` : '', draft.condition ? `Condition: ${draft.condition}` : '', draft.tags?.length ? `Tags: ${draft.tags.join(', ')}` : '', draft.notes ?? ''].filter(Boolean).join('\n')
        const item = await client.createItem(server.householdId, { client_operation_id: row.operation_id, name: draft.name, identifier_type: 'none', quantity: draft.quantity, unit: draft.unit, manufacturer: draft.manufacturer, notes: metadata || undefined, ...(draft.location ? { placement: { [`${draft.location.kind}_id`]: draft.location.id, ...(draft.location.kind === 'container' ? { relationship_type: 'in' as const } : {}) } } : {}) })
        itemId = item.id
        await db.runAsync('UPDATE pending_operations SET remote_entity_id = ? WHERE operation_id = ?', itemId, row.operation_id)
      }
      result.itemIds[row.operation_id] = itemId
      if (draft.photoUri) {
        const response = await fetch(draft.photoUri)
        await client.uploadItemImage(itemId, await response.blob(), draft.photoMimeType)
      }
      await db.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync('DELETE FROM pending_operations WHERE operation_id = ?', row.operation_id)
        await transaction.runAsync('DELETE FROM pending_items WHERE local_id = ?', row.operation_id)
        await transaction.runAsync('DELETE FROM inventory_cache WHERE household_id = ? AND entity_id IN (?, ?)', server.householdId, row.operation_id, `local-placement-${row.operation_id}`)
      })
      if (draft.photoUri) await FileSystem.deleteAsync(draft.photoUri, { idempotent: true })
      result.synced += 1
    } catch (reason) {
      const policy = classifyQueueFailure(reason instanceof ApiError ? reason.status : undefined)
      await markFailure(row.operation_id, reason instanceof Error ? reason.message : 'Sync failed', policy.retry, row.attempt_count + 1)
      result.failed += 1
      if (!policy.retry) result.needsAttention += 1
      if (policy.pause) { result.paused = true; break }
    }
  }
  return result
}

async function markFailure(operationId: string, message: string, retry: boolean, attempt: number): Promise<void> {
  const db = await database()
  await db.runAsync('UPDATE pending_operations SET status = ?, next_attempt_at = ?, last_error = ? WHERE operation_id = ?', retry ? 'retryable_failed' : 'permanently_failed', retry ? nextRetryAt(attempt) : null, message, operationId)
}
