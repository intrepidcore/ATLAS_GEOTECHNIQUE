import * as SQLite from 'expo-sqlite';

// Version courante du schéma local. Monte-le et ajoute une branche dans
// migrate() à chaque changement de structure — jamais de DROP silencieux.
const SCHEMA_VERSION = 1;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('atlas_mobile.db');
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY, code TEXT, title TEXT, theme TEXT, status TEXT,
        start_date TEXT, end_date TEXT, maille_id TEXT, maille_label TEXT,
        commune TEXT, region TEXT, expected_sondages INTEGER, completed_sondages INTEGER,
        percent_done REAL, synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS mission_planned_points (
        id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, numero INTEGER, label TEXT,
        lat REAL, lon REAL, confirmed_sondage_id TEXT
      );

      CREATE TABLE IF NOT EXISTS mission_map_cache (
        mission_id TEXT PRIMARY KEY, tolerance_m INTEGER,
        maille_geojson TEXT, center_lon REAL, center_lat REAL,
        bbox_min_x REAL, bbox_min_y REAL, bbox_max_x REAL, bbox_max_y REAL,
        cached_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sondages_draft (
        client_id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, planned_point_id TEXT,
        longitude REAL, latitude REAL, location_accuracy_m REAL,
        depth_m REAL, layers_count INTEGER, profile_description TEXT, notes TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        server_id TEXT, created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        client_id TEXT PRIMARY KEY, action_type TEXT NOT NULL, payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS field_logs_draft (
        client_id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, log_type TEXT NOT NULL,
        content TEXT NOT NULL, longitude REAL, latitude REAL,
        status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      );
    `);
  }

  if (current !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

export async function resetDbForTests(): Promise<void> {
  dbInstance = null;
}
