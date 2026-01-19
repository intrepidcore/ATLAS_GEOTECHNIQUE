-- ============================================================================
-- Migration 106: Refonte Grille V2 (2km topologie parfaite + reconstruction 28km)
-- Objectifs:
--  - Régénérer les géométries 2km à partir des codes (Iso-Code) avec ST_MakeEnvelope
--  - Reconstruire maille_28km comme agrégation stricte des 2km (14x14) via ST_Union
--  - Conserver les codes 2km existants et les UUID (PK) de atlas.mailles
--  - Recalculer les liens id_m28 sur atlas.mailles et atlas.sondages
-- ============================================================================

BEGIN;

-- 0) Pré-requis: extensions utiles
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 1) Snapshot legacy (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='mailles_legacy'
  ) THEN
    CREATE TABLE atlas.mailles_legacy AS
    SELECT * FROM atlas.mailles;

    ALTER TABLE atlas.mailles_legacy ADD PRIMARY KEY (id);
    CREATE UNIQUE INDEX mailles_legacy_code_key ON atlas.mailles_legacy(code);
    CREATE INDEX mailles_legacy_geom_idx ON atlas.mailles_legacy USING GIST (geom);
  END IF;
END $$;

-- 2) Table paramètres (idempotent)
CREATE TABLE IF NOT EXISTS atlas.grid_refonte_v2_params (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  x0 double precision NOT NULL,
  y0 double precision NOT NULL,
  tol_snap double precision NOT NULL DEFAULT 0.01
);

-- 3) Calcul X0/Y0 (mode) depuis la legacy
-- NB: on se base sur le format TG-XXXX-YYYY-01
WITH parsed AS (
  SELECT
    code,
    geom,
    CAST(split_part(code, '-', 2) AS int) AS ix,
    CAST(split_part(code, '-', 3) AS int) AS iy
  FROM atlas.mailles_legacy
  WHERE code LIKE 'TG-%-%-01'
),
origins AS (
  SELECT
    mode() WITHIN GROUP (ORDER BY (ST_XMin(geom) - (ix * 2000.0))) AS x0,
    mode() WITHIN GROUP (ORDER BY (ST_YMin(geom) - (iy * 2000.0))) AS y0
  FROM parsed
)
INSERT INTO atlas.grid_refonte_v2_params (x0, y0)
SELECT o.x0, o.y0
FROM origins o
WHERE NOT EXISTS (
  SELECT 1 FROM atlas.grid_refonte_v2_params
);

-- 4) Régénération 2km (MAJ in-place pour préserver UUID + FK)
WITH p AS (
  SELECT x0, y0 FROM atlas.grid_refonte_v2_params ORDER BY id DESC LIMIT 1
),
parsed AS (
  SELECT
    id,
    code,
    CAST(split_part(code, '-', 2) AS int) AS ix,
    CAST(split_part(code, '-', 3) AS int) AS iy
  FROM atlas.mailles
  WHERE code LIKE 'TG-%-%-01'
),
envelopes AS (
  SELECT
    m.id,
    ST_MakeEnvelope(
      p.x0 + (m.ix * 2000.0),
      p.y0 + (m.iy * 2000.0),
      p.x0 + (m.ix * 2000.0) + 2000.0,
      p.y0 + (m.iy * 2000.0) + 2000.0,
      25231
    )::geometry(Polygon,25231) AS geom_new
  FROM parsed m
  CROSS JOIN p
)
UPDATE atlas.mailles m
SET geom = e.geom_new
FROM envelopes e
WHERE m.id = e.id;

-- 5) Reconstruction 28km bottom-up (14x14) depuis les codes 2km
-- On drop temporairement les FK pour permettre TRUNCATE/REBUILD
ALTER TABLE atlas.mailles  DROP CONSTRAINT IF EXISTS fk_mailles_maille28km;
ALTER TABLE atlas.sondages DROP CONSTRAINT IF EXISTS fk_sondage_maille28km;

TRUNCATE TABLE atlas.maille_28km RESTART IDENTITY;

-- On reconstruit les blocs 14x14 par coordonnées calculées (grille parfaite)
WITH p AS (
  SELECT x0, y0 FROM atlas.grid_refonte_v2_params ORDER BY id DESC LIMIT 1
),
parsed AS (
  SELECT
    CAST(split_part(code, '-', 2) AS int) AS ix,
    CAST(split_part(code, '-', 3) AS int) AS iy
  FROM atlas.mailles
  WHERE code LIKE 'TG-%-%-01'
),
blocks AS (
  SELECT DISTINCT
    FLOOR(ix / 14.0)::int AS col28,
    FLOOR(iy / 14.0)::int AS row28
  FROM parsed
),
envelopes AS (
  SELECT
    ST_MakeEnvelope(
      p.x0 + (b.col28 * 28000.0),
      p.y0 + (b.row28 * 28000.0),
      p.x0 + (b.col28 * 28000.0) + 28000.0,
      p.y0 + (b.row28 * 28000.0) + 28000.0,
      25231
    )::geometry(Polygon,25231) AS geom
  FROM blocks b
  CROSS JOIN p
)
INSERT INTO atlas.maille_28km (geom)
SELECT geom
FROM envelopes;

-- Filtrage par boundary_togo (si disponible) ou adm0_raw (fallback)
DO $$
DECLARE
  v_has_boundary boolean;
  v_boundary_count int;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='boundary_togo'
  ) INTO v_has_boundary;

  IF v_has_boundary THEN
    SELECT COUNT(*) INTO v_boundary_count FROM atlas.boundary_togo;
    IF v_boundary_count > 0 THEN
      DELETE FROM atlas.maille_28km m
      WHERE NOT EXISTS (
        SELECT 1 FROM atlas.boundary_togo b
        WHERE ST_Intersects(m.geom, b.geom)
      );
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm0_raw') THEN
      SELECT COUNT(*) INTO v_boundary_count FROM public.adm0_raw;
      IF v_boundary_count > 0 THEN
        DELETE FROM atlas.maille_28km m
        WHERE NOT EXISTS (
          SELECT 1 FROM public.adm0_raw a
          WHERE ST_Intersects(m.geom, ST_Transform(a.geom, 25231))
        );
      END IF;
    END IF;
  END IF;
END $$;

-- Re-attribuer code_m28 (ordre stable S->N puis O->E)
WITH numbered AS (
  SELECT id_m28, ROW_NUMBER() OVER (ORDER BY ST_YMin(geom), ST_XMin(geom)) AS rn
  FROM atlas.maille_28km
)
UPDATE atlas.maille_28km m
SET code_m28 = n.rn
FROM numbered n
WHERE m.id_m28 = n.id_m28;

-- Remplir code_lisible (compatible migration 102)
UPDATE atlas.maille_28km
SET code_lisible = 'TG-28KM-' || LPAD(code_m28::text, 3, '0')
WHERE code_lisible IS NULL OR code_lisible = '';

-- Profils + PK
WITH bounds AS (
  SELECT MIN(ST_YMin(geom)) AS ymin
  FROM atlas.maille_28km
),
profil_calc AS (
  SELECT
    id_m28,
    FLOOR((ST_YMin(geom) - b.ymin) / 28000.0)::int AS profil_row
  FROM atlas.maille_28km m
  CROSS JOIN bounds b
)
UPDATE atlas.maille_28km m
SET profil_num = p.profil_row + 1
FROM profil_calc p
WHERE m.id_m28 = p.id_m28;

UPDATE atlas.maille_28km
SET
  pk_min_km = 28.0 * (profil_num - 1),
  pk_max_km = 28.0 * profil_num;

-- Reset des liens avant recréation des FK (les anciens id_m28 ne sont plus valides après rebuild)
UPDATE atlas.mailles SET id_m28 = NULL;
UPDATE atlas.sondages SET id_m28 = NULL;

-- 6) Recréer contraintes FK
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS id_m28 integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mailles_maille28km') THEN
    ALTER TABLE atlas.mailles
      ADD CONSTRAINT fk_mailles_maille28km
      FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);
  END IF;
END $$;

ALTER TABLE atlas.sondages ADD COLUMN IF NOT EXISTS id_m28 integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sondage_maille28km') THEN
    ALTER TABLE atlas.sondages
      ADD CONSTRAINT fk_sondage_maille28km
      FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS mailles_id_m28_idx ON atlas.mailles(id_m28);
CREATE INDEX IF NOT EXISTS sondage_id_m28_idx ON atlas.sondages(id_m28);

-- 7) Re-link mailles (2km -> 28km) + sondages
UPDATE atlas.mailles m2
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE ST_Intersects(ST_Centroid(m2.geom), m28.geom);

-- Sondages via grid_code d'abord
UPDATE atlas.sondages s
SET id_m28 = m2.id_m28
FROM atlas.mailles m2
WHERE s.grid_code = m2.code
  AND m2.id_m28 IS NOT NULL;

-- Fallback spatial (si besoin)
UPDATE atlas.sondages s
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE s.id_m28 IS NULL
  AND s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom);

-- 8) (Optionnel) table de logs de mapping old_code -> new_code
CREATE TABLE IF NOT EXISTS atlas.migration_mailles_logs (
  old_code text,
  new_code text,
  coverage_pct double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO atlas.migration_mailles_logs (old_code, new_code, coverage_pct)
SELECT
  l.code AS old_code,
  n.code AS new_code,
  (ST_Area(ST_Intersection(l.geom, n.geom)) / NULLIF(ST_Area(l.geom), 0)) * 100.0 AS coverage_pct
FROM atlas.mailles_legacy l
LEFT JOIN atlas.mailles n
  ON ST_Intersects(ST_Centroid(l.geom), n.geom)
WHERE NOT EXISTS (
  SELECT 1 FROM atlas.migration_mailles_logs
  WHERE migration_mailles_logs.old_code = l.code
);

COMMIT;
