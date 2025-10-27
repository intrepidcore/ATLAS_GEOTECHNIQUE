-- ============================================================================
-- CRÉER LA VUE MATÉRIALISÉE ADM3 → MAILLES
-- ============================================================================

-- Drop si existe
DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;

-- Créer la vue : association ADM3 → Mailles
CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
SELECT 
  a.adm3_pcode AS adm3_code,
  a.adm3_fr AS adm3_name,
  m.id AS maille_id,
  m.code AS maille_code,
  ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) AS overlap_ratio
FROM adm3 a
JOIN mailles m ON ST_Intersects(a.geom, m.geom)
WHERE ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) > 0.01; -- au moins 1% de recouvrement

-- Index
CREATE INDEX idx_adm3_maille_map_adm3 ON mv_adm3_maille_map(adm3_code);
CREATE INDEX idx_adm3_maille_map_maille ON mv_adm3_maille_map(maille_id);

-- Vérifier
SELECT 
  COUNT(*) AS total_associations,
  COUNT(DISTINCT adm3_code) AS distinct_adm3,
  COUNT(DISTINCT maille_id) AS distinct_mailles
FROM mv_adm3_maille_map;

-- Vérifier pour Davie
SELECT COUNT(*) AS mailles_davie 
FROM mv_adm3_maille_map 
WHERE adm3_code = 'TG030805';
