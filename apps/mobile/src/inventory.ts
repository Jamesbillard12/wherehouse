import {
  createRemoteClient,
  type Area,
  type ContainerPlacement,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import * as SQLite from 'expo-sqlite'

import type { PairedServer } from './pairing'

export type CachedInventory = {
  areas: Area[]
  containers: StorageContainer[]
  placements: ContainerPlacement[]
  syncedAt: string | null
  zones: Zone[]
}

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('wherehouse.db')
  }
  const db = await databasePromise
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS inventory_cache (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      household_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    CREATE INDEX IF NOT EXISTS ix_inventory_cache_household
      ON inventory_cache (household_id, entity_type);
    CREATE TABLE IF NOT EXISTS sync_metadata (
      household_id TEXT PRIMARY KEY,
      synced_at TEXT NOT NULL
    );
  `)
  return db
}

export async function syncInventory(server: PairedServer): Promise<CachedInventory> {
  const client = createRemoteClient(server.baseUrl, server.accessToken)
  const areas = await client.listAreas(server.householdId)
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
  const inventory: CachedInventory = {
    areas,
    zones: details.flatMap((detail) => detail.zones),
    containers: details.flatMap((detail) => detail.containers),
    placements: details.flatMap((detail) => detail.placements),
    syncedAt: new Date().toISOString(),
  }
  const db = await database()
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM inventory_cache WHERE household_id = ?', server.householdId)
    for (const [entityType, entries] of [
      ['area', inventory.areas],
      ['zone', inventory.zones],
      ['container', inventory.containers],
      ['placement', inventory.placements],
    ] as const) {
      for (const entry of entries) {
        await db.runAsync(
          'INSERT INTO inventory_cache (entity_type, entity_id, household_id, payload) VALUES (?, ?, ?, ?)',
          entityType,
          entry.id,
          server.householdId,
          JSON.stringify(entry),
        )
      }
    }
    await db.runAsync(
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
    syncedAt: metadata?.synced_at ?? null,
  }
}

export async function clearInventoryCache(householdId: string): Promise<void> {
  const db = await database()
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM inventory_cache WHERE household_id = ?', householdId)
    await db.runAsync('DELETE FROM sync_metadata WHERE household_id = ?', householdId)
  })
}
