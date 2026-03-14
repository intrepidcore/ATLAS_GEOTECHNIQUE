BEGIN;

CREATE SCHEMA IF NOT EXISTS atlas;

CREATE TABLE IF NOT EXISTS atlas.desktop_seed_state (
  id SERIAL PRIMARY KEY,
  seed_sha256 TEXT NOT NULL UNIQUE,
  max_migration_applied INTEGER NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

COMMENT ON TABLE atlas.desktop_seed_state IS 'BM-12 : Table de contrôle du boot Desktop. Une ligne = un seed restauré et validé. Remplace les heuristiques basées sur l existence de tables métier.';

COMMIT;
