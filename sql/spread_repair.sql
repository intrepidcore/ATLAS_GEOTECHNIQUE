-- ============================================================================
-- PATCH ONE-SHOT : RÉPARATION COMPLÈTE SYSTÈME SPREAD
-- ============================================================================

-- ===== 0) Sanity SRID & validité des géométries =====
-- Si SRID manquant (0), on pose les SRID attendus : adm3=4326, mailles=25231
UPDATE adm3    SET geom = ST_SetSRID(geom, 4326)  WHERE ST_SRID(geom)=0;
UPDATE mailles SET geom = ST_SetSRID(geom, 25231) WHERE ST_SRID(geom)=0;

-- Corrige les géom invalides (bords auto-intersectés, etc.)
UPDATE adm3    SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE mailles SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);

-- Index spatiaux si absents (ne casse rien s'ils existent déjà)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='adm3_geom_gist') THEN
    EXECUTE 'CREATE INDEX adm3_geom_gist ON adm3 USING GIST(geom);';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='mailles_geom_gist') THEN
    EXECUTE 'CREATE INDEX mailles_geom_gist ON mailles USING GIST(geom);';
  END IF;
END$$;

ANALYZE adm3;
ANALYZE mailles;

-- ===== 1) (Re)créer la carte ADM3 → mailles =====
DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;

-- On accepte adm3.adm3_pcode
CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
WITH a AS (
  SELECT
    adm3_pcode AS adm3_code,
    geom
  FROM adm3
),
pairs AS (
  SELECT
    a.adm3_code,
    m.id   AS maille_id,
    m.code AS maille_code,
    -- Intersections en système des mailles (m.geom est en 25231)
    ST_Area( ST_Intersection( ST_Transform(a.geom, ST_SRID(m.geom)), m.geom ) ) / NULLIF(ST_Area(m.geom),0) AS overlap_ratio
  FROM a
  JOIN mailles m
    ON ST_Intersects( ST_Buffer(ST_Transform(a.geom, ST_SRID(m.geom)), 1.0), m.geom ) -- buffer 1m pour éviter les micro-lacunes
)
SELECT *
FROM pairs
WHERE overlap_ratio IS NULL OR overlap_ratio > 0.001; -- filtre doux (0.1%) sur l'emprise

CREATE INDEX ON mv_adm3_maille_map (adm3_code);
CREATE INDEX ON mv_adm3_maille_map (maille_id);
ANALYZE mv_adm3_maille_map;

-- ===== 2) Vue d'union réel ∪ spread robuste =====
DROP VIEW IF EXISTS v_maille_sondages_all CASCADE;

CREATE OR REPLACE VIEW v_maille_sondages_all AS
-- RÉEL (GPS)
SELECT
  m.id   AS maille_id,
  m.code AS maille_code,
  s.id   AS sondage_id,
  'real'::text AS source
FROM mailles m
JOIN sondages s
  ON s.geom IS NOT NULL
 AND ST_Within(s.geom, m.geom)

UNION ALL

-- SPREAD (ADM3→mailles)
SELECT
  m.id   AS maille_id,
  m.code AS maille_code,
  s.id   AS sondage_id,
  'spread'::text AS source
FROM sondages s
JOIN mv_adm3_maille_map map
  ON TRIM(UPPER(COALESCE(s.meta->>'adm3_code', ''))) = TRIM(UPPER(map.adm3_code))
JOIN mailles m
  ON m.id = map.maille_id
WHERE s.geom IS NULL
  AND COALESCE(s.loc_mode,'spread') = 'spread';  -- explicite

-- ===== 3) Agrégat minimal pour la carte (has_data) =====
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech;

CREATE MATERIALIZED VIEW mv_mailles_geotech AS
SELECT
  m.id,
  m.code,
  m.geom,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source='real')   AS nb_sondages_real,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source='spread') AS nb_sondages_spread,
  (COUNT(v.sondage_id) > 0) AS has_data
FROM mailles m
LEFT JOIN v_maille_sondages_all v ON v.maille_id = m.id
GROUP BY m.id, m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name;

CREATE UNIQUE INDEX ON mv_mailles_geotech (id);
CREATE INDEX mv_mailles_geotech_has ON mv_mailles_geotech (has_data);
ANALYZE mv_mailles_geotech;

-- ===== VÉRIFICATIONS =====
-- Davie doit exister côté mapping
SELECT 'Mailles Davie:' AS label, COUNT(*) AS count FROM mv_adm3_maille_map WHERE adm3_code='TG030805';

-- L'union doit produire > 0 lignes
SELECT 'Associations totales:' AS label, COUNT(*) AS count FROM v_maille_sondages_all;

-- La MV de couverture doit marquer des mailles avec données
SELECT
 'Résultat final:' AS label,
 COUNT(*) AS total,
 COUNT(*) FILTER (WHERE has_data) AS avec_donnees,
 SUM(nb_sondages_real)  AS sondages_real,
 SUM(nb_sondages_spread) AS sondages_spread
FROM mv_mailles_geotech;
