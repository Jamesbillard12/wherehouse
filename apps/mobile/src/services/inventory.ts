import {
  createRemoteClient,
  type Area,
  type ContainerPlacement,
  type Item,
  type ItemPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import type { PairedServer } from './pairing'
import { database } from './database'

export type CachedInventory = {
  areas: Area[]
  containers: StorageContainer[]
  placements: ContainerPlacement[]
  items: Item[]
  itemPlacements: ItemPlacement[]
  syncedAt: string | null
  zones: Zone[]
}

const inventorySyncs = new Map<string, Promise<CachedInventory>>()

export function syncInventory(server: PairedServer): Promise<CachedInventory> {
  const existing = inventorySyncs.get(server.householdId)
  if (existing) return existing
  const sync = syncInventoryOnce(server).finally(() => inventorySyncs.delete(server.householdId))
  inventorySyncs.set(server.householdId, sync)
  return sync
}

async function syncInventoryOnce(server: PairedServer): Promise<CachedInventory> {
  const client = createRemoteClient(server.baseUrl, server.accessToken)
  const [areas, items, itemPlacements] = await Promise.all([client.listAreas(server.householdId), client.listItems(server.householdId), client.listItemPlacements(server.householdId)])
  const details = await Promise.all(
    areas.map(async (area) => {
      const [zones, containers, placements] = await Promise.all([
        client.listZones(area.id),
        client.listContainers(area.id),
        client.listContainerPlacements(area.id),
      ])
      return { zones, containers, placements }
    }),
  )
  const db = await database()
  const localRows = await db.getAllAsync<{ entity_type: string; payload: string }>(
    `SELECT cache.entity_type, cache.payload FROM inventory_cache AS cache
     JOIN pending_operations AS operation
       ON cache.entity_id = operation.operation_id
       OR cache.entity_id = 'local-placement-' || operation.operation_id
     WHERE operation.household_id = ?`,
    server.householdId,
  )
  const inventory: CachedInventory = {
    areas,
    zones: details.flatMap((detail) => detail.zones),
    containers: details.flatMap((detail) => detail.containers),
    placements: details.flatMap((detail) => detail.placements),
    items: [...items, ...localRows.filter((row) => row.entity_type === 'item').map((row) => JSON.parse(row.payload) as Item)],
    itemPlacements: [...itemPlacements, ...localRows.filter((row) => row.entity_type === 'item-placement').map((row) => JSON.parse(row.payload) as ItemPlacement)],
    syncedAt: new Date().toISOString(),
  }
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM inventory_cache WHERE household_id = ?', server.householdId)
    for (const [entityType, entries] of [
      ['area', inventory.areas],
      ['zone', inventory.zones],
      ['container', inventory.containers],
      ['placement', inventory.placements],
      ['item', inventory.items],
      ['item-placement', inventory.itemPlacements],
    ] as const) {
      for (const entry of entries) {
        await transaction.runAsync(
          'INSERT INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)',
          entityType,
          entry.id,
          server.householdId,
          JSON.stringify(entry),
        )
      }
    }
    await transaction.runAsync(
      'INSERT OR REPLACE INTO sync_metadata (household_id, synced_at) VALUES (?, ?)',
      server.householdId,
      inventory.syncedAt,
    )
  })
  return inventory
}

export async function loadCachedInventory(householdId: string): Promise<CachedInventory> {
  const db = await database()
  const rows = await db.getAllAsync<{ entity_type: string; payload: string }>(
    'SELECT entity_type, payload FROM inventory_cache WHERE household_id = ?',
    householdId,
  )
  const metadata = await db.getFirstAsync<{ synced_at: string }>(
    'SELECT synced_at FROM sync_metadata WHERE household_id = ?',
    householdId,
  )
  return {
    areas: rows.filter((row) => row.entity_type === 'area').map((row) => JSON.parse(row.payload) as Area),
    zones: rows.filter((row) => row.entity_type === 'zone').map((row) => JSON.parse(row.payload) as Zone),
    containers: rows.filter((row) => row.entity_type === 'container').map((row) => JSON.parse(row.payload) as StorageContainer),
    placements: rows.filter((row) => row.entity_type === 'placement').map((row) => JSON.parse(row.payload) as ContainerPlacement),
    items: rows.filter((row) => row.entity_type === 'item').map((row) => JSON.parse(row.payload) as Item),
    itemPlacements: rows.filter((row) => row.entity_type === 'item-placement').map((row) => JSON.parse(row.payload) as ItemPlacement),
    syncedAt: metadata?.synced_at ?? null,
  }
}

export async function clearInventoryCache(householdId: string): Promise<void> {
  const db = await database()
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM inventory_cache WHERE household_id = ?', householdId)
    await transaction.runAsync('DELETE FROM sync_metadata WHERE household_id = ?', householdId)
  })
}

export async function cacheItemUpdate(householdId: string, item: Item, placement?: ItemPlacement): Promise<void> {
  const db = await database()
  await db.runAsync('INSERT OR REPLACE INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)', 'item', item.id, householdId, JSON.stringify(item))
  if (placement) await db.runAsync('INSERT OR REPLACE INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)', 'item-placement', placement.id, householdId, JSON.stringify(placement))
}
