-- ============================================================================
-- MIGRATION 119 : GRILLE IMMUTABLE + SPATIAL_ID + LOOKUP COMPAT (PHASE 5 -> 10)
-- Objectifs:
--  - Rendre atlas.mailles.code immuable (trigger)
--  - Versionner la grille (atlas.grid_metadata)
--  - Ajouter un identifiant spatial stable (atlas.mailles.spatial_id)
--  - Exposer une vue lookup (atlas.mailles_lookup)
--  - Préparer un mapping legacy -> new (atlas.legacy_maille_code_map)
--
-- Notes:
--  - Le schéma existant utilise atlas.mailles.code (pas maille_code).
--  - Migration idempotente: toutes les opérations sont IF NOT EXISTS / guards.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PHASE 5 : immutabilité du code maille
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION atlas.prevent_maille_code_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'maille code immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'no_update_maille_code'
      AND n.nspname = 'atlas'
      AND c.relname = 'mailles'
  ) THEN
    EXECUTE 'CREATE TRIGGER no_update_maille_code BEFORE UPDATE ON atlas.mailles FOR EACH ROW EXECUTE FUNCTION atlas.prevent_maille_code_update()';
  END IF;
END $$;

-- (Optionnel mais sûr) garantir NOT NULL / UNIQUE
ALTER TABLE atlas.mailles
  ALTER COLUMN code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_mailles_code'
  ) THEN
    EXECUTE 'ALTER TABLE atlas.mailles ADD CONSTRAINT unique_mailles_code UNIQUE(code)';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 7 : versionner la grille
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS atlas.grid_metadata (
  version text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  srid integer,
  cell_size_m integer,
  origin_x numeric,
  origin_y numeric,
  notes text
);

-- Initialiser une version par défaut si table vide
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM atlas.grid_metadata) INTO v_exists;
  IF NOT v_exists THEN
    INSERT INTO atlas.grid_metadata (version, srid, cell_size_m, notes)
    VALUES ('TG_GRID_V2', 25231, 2000, 'Initialisé automatiquement (migration 119)');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 8 : spatial_id stable (geohash centroid en WGS84)
-- ---------------------------------------------------------------------------

ALTER TABLE atlas.mailles
  ADD COLUMN IF NOT EXISTS spatial_id text;

-- Backfill uniquement si NULL (idempotent)
UPDATE atlas.mailles
SET spatial_id =
  'TG5-' || UPPER(
    ST_GeoHash(
      ST_Transform(ST_Centroid(geom), 4326),
      8
    )
  )
WHERE spatial_id IS NULL;

-- Résoudre d'éventuelles collisions de geohash (déterministe)
-- 1) Monter à une précision 9 pour les valeurs dupliquées
WITH d AS (
  SELECT spatial_id
  FROM atlas.mailles
  WHERE spatial_id IS NOT NULL
  GROUP BY spatial_id
  HAVING COUNT(*) > 1
)
UPDATE atlas.mailles m
SET spatial_id =
  'TG5-' || UPPER(
    ST_GeoHash(
      ST_Transform(ST_Centroid(m.geom), 4326),
      9
    )
  )
WHERE m.spatial_id IN (SELECT spatial_id FROM d);

-- 2) Si collisions restantes: suffixe stable dérivé du code
WITH d AS (
  SELECT spatial_id
  FROM atlas.mailles
  WHERE spatial_id IS NOT NULL
  GROUP BY spatial_id
  HAVING COUNT(*) > 1
)
UPDATE atlas.mailles m
SET spatial_id = m.spatial_id || '-' || SUBSTR(MD5(m.code), 1, 4)
WHERE m.spatial_id IN (SELECT spatial_id FROM d);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'atlas'
      AND tablename = 'mailles'
      AND indexname = 'idx_mailles_spatial_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_mailles_spatial_id ON atlas.mailles(spatial_id)';
  END IF;
END $$;

-- On ne force pas NOT NULL pour éviter un blocage si une maille a une geom invalide.

-- ---------------------------------------------------------------------------
-- PHASE 9 : compat anciens codes / lookup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW atlas.mailles_lookup AS
SELECT id, code AS maille_code, spatial_id
FROM atlas.mailles;

-- Table persistante de mapping legacy -> new
CREATE TABLE IF NOT EXISTS atlas.legacy_maille_code_map (
  legacy_code text PRIMARY KEY,
  new_code text NOT NULL,
  new_spatial_id text,
  coverage_pct numeric,
  method text NOT NULL DEFAULT 'intersection',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Remplissage best-effort depuis atlas.v_api_legacy_lookup (migration 112)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema='atlas' AND table_name='v_api_legacy_lookup'
  ) THEN
    INSERT INTO atlas.legacy_maille_code_map (legacy_code, new_code, new_spatial_id, coverage_pct, method)
    SELECT
      v.legacy_code,
      v.new_code,
      m.spatial_id,
      v.coverage_pct,
      'intersection'
    FROM atlas.v_api_legacy_lookup v
    JOIN atlas.mailles m ON m.code = v.new_code
    WHERE v.rank = 1
      AND v.coverage_pct >= 50
    ON CONFLICT (legacy_code) DO NOTHING;
  END IF;
END $$;

COMMIT;
