-- ============================================================================
-- MIGRATION 108 : RECONSTRUCTION ROBUSTE 28KM
-- Objectif : Garantir 100% de couverture en générant la 28km depuis la 2km
-- ============================================================================

BEGIN;

\echo '1. Suppression temporaire des contraintes FK vers maille_28km...'
ALTER TABLE atlas.mailles  DROP CONSTRAINT IF EXISTS fk_mailles_maille28km;
ALTER TABLE atlas.sondages DROP CONSTRAINT IF EXISTS fk_sondage_maille28km;

\echo '1bis. Suppression des vues dépendantes (conversion geom -> MultiPolygon)...'
DROP VIEW IF EXISTS atlas.v_maille_28km_map CASCADE;
DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km_clip CASCADE;
DROP VIEW IF EXISTS atlas.v_mailles_28km_clip CASCADE;
DROP VIEW IF EXISTS atlas.v_maille_28km_kpi CASCADE;
DROP VIEW IF EXISTS atlas.v_maille_dsm_28km CASCADE;
DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km CASCADE;

\echo '1ter. Alignement du type geom 28km sur MultiPolygon (ST_Union peut produire MultiPolygon)...'
ALTER TABLE atlas.maille_28km
  ALTER COLUMN geom TYPE geometry(MultiPolygon,25231)
  USING ST_Multi(geom);

\echo '2. Nettoyage de la couche 28km (incomplète)...'
TRUNCATE TABLE atlas.maille_28km RESTART IDENTITY;

\echo '3. Génération Bottom-Up stricte (28km = union des 2km enfants)...'
WITH config AS (
    SELECT
        200000::double precision AS x0,
        600000::double precision AS y0
),
-- Attribution du groupe 28km à chaque maille 2km via la position du centroid
-- (gère les valeurs négatives automatiquement)
children AS (
    SELECT
        m.id,
        m.geom,
        floor((ST_X(ST_Centroid(m.geom)) - c.x0) / 28000.0)::int AS col_28,
        floor((ST_Y(ST_Centroid(m.geom)) - c.y0) / 28000.0)::int AS row_28
    FROM atlas.mailles m
    CROSS JOIN config c
),
agg AS (
    SELECT
        col_28,
        row_28,
        ST_UnaryUnion(ST_Collect(geom))::geometry(Geometry,25231) AS geom_union
    FROM children
    GROUP BY col_28, row_28
)
INSERT INTO atlas.maille_28km (geom, pk_min_km, pk_max_km, profil_num)
SELECT
  ST_Multi(ST_CollectionExtract(ST_MakeValid(a.geom_union), 3))::geometry(MultiPolygon,25231) AS geom,
  0, 0, 0
FROM agg a
WHERE a.geom_union IS NOT NULL;

\echo '4. Recalcul des attributs 28km (codes, profils, pk)...'
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

\echo '5. Relinkage total...'

-- A. Mailles 2km -> 28km (point interne pour éviter les effets de bord)
UPDATE atlas.mailles m
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE ST_CoveredBy(ST_PointOnSurface(m.geom), m28.geom);

-- B. Sondages -> 28km via la maille 2km (plus fiable)
UPDATE atlas.sondages s
SET id_m28 = m.id_m28
FROM atlas.mailles m
WHERE s.grid_code = m.code
  AND m.id_m28 IS NOT NULL;

-- C. Sondages sans grid_code (fallback spatial)
UPDATE atlas.sondages s
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE s.id_m28 IS NULL
  AND s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom);

\echo '6. Remise en place des contraintes FK...'
ALTER TABLE atlas.mailles
  ADD CONSTRAINT fk_mailles_maille28km
  FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);

ALTER TABLE atlas.sondages
  ADD CONSTRAINT fk_sondage_maille28km
  FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);

\echo '7. Vérifications finales...'
DO $$
DECLARE
    v_orphans int;
BEGIN
    SELECT COUNT(*) INTO v_orphans FROM atlas.mailles WHERE id_m28 IS NULL;
    IF v_orphans > 0 THEN
        RAISE WARNING 'Attention : Il reste % mailles orphelines !', v_orphans;
    ELSE
        RAISE NOTICE 'Succès : 0 orphelin. Couverture complète.';
    END IF;
END $$;

\echo '8. Recréer une vue 28km de couverture minimale (compatible API)...'
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
