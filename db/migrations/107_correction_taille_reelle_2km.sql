-- ============================================================================
-- MIGRATION 107 : CORRECTION TAILLE RÉELLE (legacy ~1.4km -> V2 vrai 2.0km)
-- Objectif : Générer une grille mathématique parfaite de 2000m x 2000m (EPSG:25231)
-- Conséquence : BREAKING CHANGE des codes mailles (migration spatiale des sondages)
-- ============================================================================

BEGIN;

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Archivage & préparation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='mailles_legacy_v1'
  ) THEN
    CREATE TABLE atlas.mailles_legacy_v1 AS
    SELECT * FROM atlas.mailles;

    ALTER TABLE atlas.mailles_legacy_v1 ADD PRIMARY KEY (id);
    CREATE UNIQUE INDEX mailles_legacy_v1_code_key ON atlas.mailles_legacy_v1(code);
    CREATE INDEX mailles_legacy_v1_geom_idx ON atlas.mailles_legacy_v1 USING GIST (geom);
  END IF;
END $$;

-- Sauvegarde de l'ancien code maille (sondages)
ALTER TABLE atlas.sondages ADD COLUMN IF NOT EXISTS legacy_grid_code text;
UPDATE atlas.sondages
SET legacy_grid_code = grid_code
WHERE legacy_grid_code IS NULL;

-- Les références colab vers mailles (IDs) ne sont plus cohérentes après refonte.
-- On neutralise les liaisons avant de toucher à atlas.mailles.
ALTER TABLE atlas.colab_missions DROP CONSTRAINT IF EXISTS colab_missions_maille_id_fkey;
ALTER TABLE atlas.colab_maille_assignments DROP CONSTRAINT IF EXISTS fk_colab_maille_assignments_maille;

UPDATE atlas.colab_missions SET maille_id = NULL;
DELETE FROM atlas.colab_maille_assignments;

-- Supprimer contraintes FK 28km pour pouvoir rebuild
ALTER TABLE atlas.mailles  DROP CONSTRAINT IF EXISTS fk_mailles_maille28km;
ALTER TABLE atlas.sondages DROP CONSTRAINT IF EXISTS fk_sondage_maille28km;

-- Des vues peuvent dépendre du type exact de maille_28km.geom (Polygon).
-- On les supprime avant conversion en MultiPolygon, puis on les recrée en fin de migration.
DROP VIEW IF EXISTS atlas.v_maille_28km_map CASCADE;
DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km_clip CASCADE;
DROP VIEW IF EXISTS atlas.v_mailles_28km_clip CASCADE;
DROP VIEW IF EXISTS atlas.v_maille_28km_kpi CASCADE;
DROP VIEW IF EXISTS atlas.v_maille_dsm_28km CASCADE;
DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km CASCADE;

-- Nettoyage 28km et reset des liens
TRUNCATE TABLE atlas.maille_28km RESTART IDENTITY;
UPDATE atlas.mailles SET id_m28 = NULL;
UPDATE atlas.sondages SET id_m28 = NULL;

-- Nettoyage de la table mailles (on conserve la structure et l'OID)
TRUNCATE TABLE atlas.mailles;

-- 2) Génération V2 : Grille 2km parfaite
-- ---------------------------------------------------------------------------
WITH config AS (
  SELECT
    200000::double precision AS x0,
    600000::double precision AS y0,
    2000::double precision AS step
),
-- Géométrie Togo en 25231
boundary AS (
  SELECT
    COALESCE(
      (SELECT ST_Transform(ST_Union(geom), 25231) FROM public.adm0_raw),
      (SELECT ST_Union(geom) FROM atlas.boundary_togo)
    ) AS geom
),
extent AS (
  SELECT
    floor((ST_XMin(b.geom) - c.x0) / c.step)::int - 2 AS i_min,
    ceil((ST_XMax(b.geom) - c.x0) / c.step)::int + 2 AS i_max,
    floor((ST_YMin(b.geom) - c.y0) / c.step)::int - 2 AS j_min,
    ceil((ST_YMax(b.geom) - c.y0) / c.step)::int + 2 AS j_max,
    c.x0, c.y0, c.step,
    b.geom AS tg
  FROM boundary b
  CROSS JOIN config c
),
grid_idx AS (
  SELECT
    i,
    j,
    e.x0, e.y0, e.step, e.tg
  FROM extent e
  CROSS JOIN generate_series(e.i_min, e.i_max) AS i
  CROSS JOIN generate_series(e.j_min, e.j_max) AS j
),
raw_grid AS (
  SELECT
    i, j,
    ST_MakeEnvelope(
      x0 + (i * step),
      y0 + (j * step),
      x0 + ((i + 1) * step),
      y0 + ((j + 1) * step),
      25231
    )::geometry(Polygon,25231) AS geom_theo,
    tg
  FROM grid_idx
),
clipped AS (
  SELECT
    i, j,
    ST_SnapToGrid(
      ST_Intersection(rg.geom_theo, rg.tg),
      0.001
    )::geometry(Geometry,25231) AS geom_clip
  FROM raw_grid rg
  WHERE ST_Intersects(rg.geom_theo, rg.tg)
),
dumped AS (
  SELECT
    c.i,
    c.j,
    (ST_Dump(ST_CollectionExtract(ST_MakeValid(c.geom_clip), 3))).geom::geometry(Polygon,25231) AS geom
  FROM clipped c
  WHERE c.geom_clip IS NOT NULL
),
polys AS (
  SELECT DISTINCT ON (i, j)
    i,
    j,
    geom
  FROM dumped
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  ORDER BY i, j, ST_Area(geom) DESC
)
INSERT INTO atlas.mailles (
  id,
  geom,
  code,
  stats,
  updated_at,
  pref_code,
  pref_name,
  adm2_name,
  id_m28,
  xmin_utm31,
  xmax_utm31,
  ymin_utm31,
  ymax_utm31,
  xc_utm31,
  yc_utm31
)
SELECT
  gen_random_uuid() AS id,
  p.geom,
  'TG-' || LPAD(p.i::text, 4, '0') || '-' || LPAD(p.j::text, 4, '0') || '-01' AS code,
  '{}'::jsonb AS stats,
  now() AS updated_at,
  NULL::text AS pref_code,
  NULL::text AS pref_name,
  NULL::text AS adm2_name,
  NULL::integer AS id_m28,
  ST_XMin(ST_Transform(p.geom, 32631)) AS xmin_utm31,
  ST_XMax(ST_Transform(p.geom, 32631)) AS xmax_utm31,
  ST_YMin(ST_Transform(p.geom, 32631)) AS ymin_utm31,
  ST_YMax(ST_Transform(p.geom, 32631)) AS ymax_utm31,
  ST_X(ST_Transform(ST_Centroid(p.geom), 32631)) AS xc_utm31,
  ST_Y(ST_Transform(ST_Centroid(p.geom), 32631)) AS yc_utm31
FROM polys p
WHERE NOT ST_IsEmpty(p.geom);

-- 3) Génération 28km (agrégation 14x14)
-- ---------------------------------------------------------------------------
WITH config AS (
  SELECT
    200000::double precision AS x0,
    600000::double precision AS y0
),
parsed AS (
  SELECT
    code,
    geom,
    CAST(split_part(code, '-', 2) AS int) AS i,
    CAST(split_part(code, '-', 3) AS int) AS j
  FROM atlas.mailles
  WHERE code LIKE 'TG-%-%-01'
),
blocks AS (
  SELECT
    FLOOR(i / 14.0)::int AS col28,
    FLOOR(j / 14.0)::int AS row28,
    ST_UnaryUnion(ST_Collect(geom))::geometry(Geometry,25231) AS geom_union
  FROM parsed
  GROUP BY FLOOR(i / 14.0)::int, FLOOR(j / 14.0)::int
),
dumped AS (
  SELECT
    b.col28,
    b.row28,
    (ST_Dump(ST_CollectionExtract(ST_MakeValid(b.geom_union), 3))).geom::geometry(Polygon,25231) AS geom
  FROM blocks b
  WHERE b.geom_union IS NOT NULL
),
polys AS (
  SELECT DISTINCT ON (col28, row28)
    col28,
    row28,
    geom
  FROM dumped
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  ORDER BY col28, row28, ST_Area(geom) DESC
)
INSERT INTO atlas.maille_28km (geom)
SELECT geom
FROM polys
WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom);

-- Filtrage : ne garder que celles qui intersectent le Togo (boundary_togo ou adm0_raw)
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

-- Codes 28km + code lisible + profils + PK
WITH ordered AS (
  SELECT id_m28, ROW_NUMBER() OVER (ORDER BY ST_YMin(geom), ST_XMin(geom)) AS rn
  FROM atlas.maille_28km
)
UPDATE atlas.maille_28km m
SET code_m28 = o.rn
FROM ordered o
WHERE m.id_m28 = o.id_m28;

UPDATE atlas.maille_28km
SET code_lisible = 'TG-28KM-' || LPAD(code_m28::text, 3, '0')
WHERE code_lisible IS NULL OR code_lisible = '';

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

-- 4) Relink
-- ---------------------------------------------------------------------------
-- 2km -> 28km
UPDATE atlas.mailles m
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE ST_Intersects(ST_PointOnSurface(m.geom), m28.geom);

-- Sondages : migration spatiale vers la nouvelle grille 2km (breaking change)
UPDATE atlas.sondages s
SET
  grid_code = m.code,
  id_m28 = m.id_m28
FROM atlas.mailles m
WHERE s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m.geom);

-- 5) Remise en place des contraintes et index
-- ---------------------------------------------------------------------------
ALTER TABLE atlas.mailles
  ADD CONSTRAINT fk_mailles_maille28km
  FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);

ALTER TABLE atlas.sondages
  ADD CONSTRAINT fk_sondage_maille28km
  FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);

ALTER TABLE atlas.colab_missions
  ADD CONSTRAINT colab_missions_maille_id_fkey
  FOREIGN KEY (maille_id) REFERENCES atlas.mailles(id) ON DELETE SET NULL;

ALTER TABLE atlas.colab_maille_assignments
  ADD CONSTRAINT fk_colab_maille_assignments_maille
  FOREIGN KEY (maille_id) REFERENCES atlas.mailles(id) ON DELETE CASCADE;

ANALYZE atlas.mailles;
ANALYZE atlas.maille_28km;

-- 6) Recréer une vue 28km de couverture minimale (compatible API)
CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km AS
SELECT
  m28.id_m28 AS id_m28,
  m28.code_m28,
  m28.code_lisible,
  ST_Transform(m28.geom, 4326) AS geom,
  COALESCE(stats.n_sondages, 0) AS n_sondages,
  COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
  COALESCE(stats.n_sondages_random, 0) AS n_sondages_random
FROM atlas.maille_28km m28
LEFT JOIN (
  SELECT
    s.id_m28,
    COUNT(*)::bigint AS n_sondages,
    SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END)::bigint AS n_sondages_exact,
    SUM(CASE WHEN s.location_mode IN ('adm_random_cell','adm_spread','random') THEN 1 ELSE 0 END)::bigint AS n_sondages_random
  FROM atlas.sondages s
  WHERE s.deleted_at IS NULL
    AND s.id_m28 IS NOT NULL
  GROUP BY s.id_m28
) stats ON stats.id_m28 = m28.id_m28;

COMMIT;
