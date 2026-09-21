import * as SQLite from 'expo-sqlite';

// Version courante du schéma local. Monte-le et ajoute une branche dans
// migrate() à chaque changement de structure — jamais de DROP silencieux.
const SCHEMA_VERSION = 4;

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

  if (current < 2) {
    await db.execAsync(`
      ALTER TABLE sondages_draft ADD COLUMN point_name TEXT;
      ALTER TABLE sondages_draft ADD COLUMN relocation_reason TEXT;
    `);
  }

  if (current < 3) {
    // Système .atlaspack (paquets opérateur hors-ligne) — cf.
    // mobile/src/services/atlaspack/. Toutes les tables utilisent des UUID
    // (générés côté serveur ou via expo-crypto côté mobile) comme clé
    // primaire, condition nécessaire à un réimport idempotent au bureau.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS atlaspack_meta (
        package_id TEXT PRIMARY KEY, operator_user_id TEXT NOT NULL, operator_email TEXT NOT NULL,
        format_version INTEGER NOT NULL, schema_version INTEGER NOT NULL,
        generated_at TEXT NOT NULL, expires_at TEXT NOT NULL, signing_key_id TEXT NOT NULL,
        password_salt_b64 TEXT NOT NULL, argon2_m_cost INTEGER NOT NULL,
        argon2_t_cost INTEGER NOT NULL, argon2_p_cost INTEGER NOT NULL, argon2_hash_len INTEGER NOT NULL,
        mission_ids TEXT NOT NULL, data_bin_path TEXT NOT NULL, mbtiles_path TEXT,
        imported_at TEXT NOT NULL, last_unlocked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY, event_type TEXT NOT NULL, occurred_at TEXT NOT NULL,
        operator_user_id TEXT, mission_id TEXT, object_type TEXT, object_id TEXT,
        old_values TEXT, new_values TEXT, metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS lab_results_draft (
        id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, sondage_id TEXT NOT NULL,
        sample_code TEXT NOT NULL, depth_top_m REAL NOT NULL, depth_bottom_m REAL NOT NULL,
        sample TEXT NOT NULL, tests TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attachments_draft (
        id TEXT PRIMARY KEY, mission_id TEXT, sondage_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'photo', file_uri TEXT NOT NULL, file_name TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'image/jpeg', caption TEXT, taken_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exports_log (
        id TEXT PRIMARY KEY, mission_ids TEXT NOT NULL, generated_at TEXT NOT NULL,
        file_uri TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'exported',
        hq_confirmed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS backups_log (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, file_uri TEXT NOT NULL,
        size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, schema_version INTEGER NOT NULL
      );
    `);
  }

  if (current < 4) {
    // Marque de remontée. Sans elle, impossible de savoir si une saisie a
    // déjà rejoint le bureau : décharger un paquet aurait effacé du travail
    // de terrain sans que personne ne s'en aperçoive.
    await db.execAsync(`
      ALTER TABLE sondages_draft ADD COLUMN exported_at TEXT;
      ALTER TABLE lab_results_draft ADD COLUMN exported_at TEXT;
      ALTER TABLE attachments_draft ADD COLUMN exported_at TEXT;
      ALTER TABLE field_logs_draft ADD COLUMN exported_at TEXT;
    `);
  }

  if (current !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

export async function resetDbForTests(): Promise<void> {
  dbInstance = null;
}
