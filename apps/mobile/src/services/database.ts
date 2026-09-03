import * as SQLite from 'expo-sqlite'

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null

const WORKSPACE_SCOPED_TABLES = [
  'inventory_cache',
  'sync_metadata',
  'pending_items',
  'recent_item_locations',
  'pending_item_updates',
  'pending_operations',
] as const

export async function migrateLegacyWorkspaceColumns(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  for (const table of WORKSPACE_SCOPED_TABLES) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
    if (columns.some((column) => column.name === 'household_id')) {
      await db.execAsync(`ALTER TABLE ${table} RENAME COLUMN household_id TO workspace_id`)
    }
  }
  const cacheColumns = await db.getAllAsync<{ name: string; pk: number }>(
    'PRAGMA table_info(inventory_cache)',
  )
  const primaryKey = cacheColumns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name)
  if (
    cacheColumns.length > 0 &&
    primaryKey.join(',') !== 'workspace_id,entity_type,entity_id'
  ) {
    await db.execAsync(`
      DROP INDEX IF EXISTS ix_inventory_cache_household;
      DROP INDEX IF EXISTS ix_inventory_cache_workspace;
      ALTER TABLE inventory_cache RENAME TO inventory_cache_legacy;
      CREATE TABLE inventory_cache (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (workspace_id, entity_type, entity_id)
      );
      INSERT INTO inventory_cache (entity_type, entity_id, workspace_id, payload)
        SELECT entity_type, entity_id, workspace_id, payload FROM inventory_cache_legacy;
      DROP TABLE inventory_cache_legacy;
    `)
  }
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('wherehouse.db')
  await migrateLegacyWorkspaceColumns(db)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS inventory_cache (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (workspace_id, entity_type, entity_id)
    );
    CREATE INDEX IF NOT EXISTS ix_inventory_cache_workspace
      ON inventory_cache (workspace_id, entity_type);
    CREATE TABLE IF NOT EXISTS sync_metadata (
      workspace_id TEXT PRIMARY KEY,
      synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_items (
      local_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      remote_item_id TEXT,
      created_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_pending_items_workspace
      ON pending_items (workspace_id, created_at);
    CREATE TABLE IF NOT EXISTS recent_item_locations (
      workspace_id TEXT NOT NULL,
      location_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      used_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, location_key)
    );
    CREATE TABLE IF NOT EXISTS pending_item_updates (
      item_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS pending_operations (
      operation_id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      operation_version INTEGER NOT NULL,
      workspace_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      remote_entity_id TEXT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'retryable_failed', 'permanently_failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_pending_operations_replay
      ON pending_operations (workspace_id, status, created_at);
    INSERT OR IGNORE INTO pending_operations (
      operation_id, operation_type, operation_version, workspace_id, payload,
      remote_entity_id, created_at, status, attempt_count, last_error
    ) SELECT local_id, 'item.create', 1, workspace_id, payload, remote_item_id,
      created_at, 'pending', 0, last_error FROM pending_items;
    INSERT OR IGNORE INTO pending_operations (
      operation_id, operation_type, operation_version, workspace_id, payload,
      created_at, status, attempt_count, last_error
    ) SELECT 'legacy-item-update:' || item_id, 'item.update', 0, workspace_id,
      payload, updated_at, 'permanently_failed', 0,
      'This update was saved by an older app version and needs to be reviewed while online.'
      FROM pending_item_updates;
    UPDATE pending_operations SET status = 'retryable_failed'
      WHERE status = 'in_progress';
  `)
  return db
}

export function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}
