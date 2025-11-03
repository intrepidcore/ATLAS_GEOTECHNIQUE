-- ============================================================================
-- FIX: Recréer la MV avec colonnes ADM (version corrigée)
-- ============================================================================

BEGIN;

-- 1. Vérifier la structure de mailles_geotechnique_stats (source)
\echo '=== Structure source ==='
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'mailles_geotechnique_stats'
ORDER BY ordinal_position
LIMIT 10;

-- 2. Supprimer l'ancienne MV
DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;

-- 3. Recréer la MV SANS dupliquer geom
-- Hypothèse: mailles_geotechnique_stats n'a PAS de colonne geom
CREATE MATERIALIZED VIEW mailles_geotechnique_stats_wgs84 AS
SELECT 
  s.*,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  ST_Transform(m.geom, 4326) AS geom,
  ST_Simplify(ST_Transform(m.geom, 4326), 0.001) AS geom_simplified
FROM mailles_geotechnique_stats s
JOIN mailles m ON m.code = s.code;

-- 4. Créer les index
CREATE INDEX idx_mv_wgs84_code ON mailles_geotechnique_stats_wgs84(code);
CREATE INDEX idx_mv_wgs84_geom ON mailles_geotechnique_stats_wgs84 USING GIST(geom);
CREATE INDEX idx_mv_wgs84_geom_simplified ON mailles_geotechnique_stats_wgs84 USING GIST(geom_simplified);
CREATE INDEX idx_mv_wgs84_adm1 ON mailles_geotechnique_stats_wgs84(adm1_name) WHERE adm1_name IS NOT NULL;
CREATE INDEX idx_mv_wgs84_adm2 ON mailles_geotechnique_stats_wgs84(adm2_name) WHERE adm2_name IS NOT NULL;
CREATE INDEX idx_mv_wgs84_adm3 ON mailles_geotechnique_stats_wgs84(adm3_name) WHERE adm3_name IS NOT NULL;

-- 5. Vérifier
\echo '=== Vérification post-création ==='
SELECT 
  COUNT(*) as total,
  COUNT(adm1_name) as avec_adm1,
  COUNT(geom) as avec_geom
FROM mailles_geotechnique_stats_wgs84;

COMMIT;
