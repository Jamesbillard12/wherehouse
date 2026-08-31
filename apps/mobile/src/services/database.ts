import * as SQLite from 'expo-sqlite'

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null

export async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('wherehouse.db')
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
    CREATE TABLE IF NOT EXISTS pending_items (
      local_id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      remote_item_id TEXT,
      created_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_pending_items_household
      ON pending_items (household_id, created_at);
    CREATE TABLE IF NOT EXISTS recent_item_locations (
      household_id TEXT NOT NULL,
      location_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      used_at TEXT NOT NULL,
      PRIMARY KEY (household_id, location_key)
    );
    CREATE TABLE IF NOT EXISTS pending_item_updates (
      item_id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_error TEXT
    );
  `)
  return db
}
