BEGIN;

CREATE TABLE IF NOT EXISTS atlas.sync_state (
    id               SERIAL PRIMARY KEY,
    sync_type         TEXT NOT NULL CHECK (sync_type IN (
                         'update_check',
                         'pull_reference',
                         'push_terrain',
                         'snapshot',
                         'patch_apply'
                     )),
    direction         TEXT NOT NULL CHECK (direction IN ('inbound','outbound','local')),
    bundle_id         TEXT UNIQUE,
    bundle_sha256     TEXT,
    bundle_version    TEXT,
    started_at        TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','success','failed','skipped')),
    records_affected  INTEGER DEFAULT 0,
    error_message     TEXT,
    notes             TEXT
);

CREATE TABLE IF NOT EXISTS atlas.update_check_log (
    id                  SERIAL PRIMARY KEY,
    checked_at           TIMESTAMPTZ DEFAULT NOW(),
    current_version      TEXT NOT NULL,
    remote_version       TEXT,
    update_available     BOOLEAN DEFAULT FALSE,
    min_schema_required  INTEGER,
    current_schema_version INTEGER,
    schema_compatible    BOOLEAN,
    check_duration_ms    INTEGER,
    error               TEXT,
    update_url           TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_state_type_status
    ON atlas.sync_state(sync_type, status);

CREATE INDEX IF NOT EXISTS idx_update_check_log_date
    ON atlas.update_check_log(checked_at DESC);

COMMIT;
