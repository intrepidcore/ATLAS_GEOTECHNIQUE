-- ============================================================================
-- REBUILD COMPLET DE TOUTES LES VUES
-- ============================================================================

-- 1) Vérifier que les tables de base existent
SELECT COUNT(*) AS mailles FROM mailles;
SELECT COUNT(*) AS adm3 FROM adm3;
SELECT COUNT(*) AS sondages FROM sondages;

-- 2) Recréer mv_adm3_maille_map
DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;
CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
SELECT 
  a.adm3_pcode AS adm3_code,
  a.adm3_fr AS adm3_name,
  m.id AS maille_id,
  m.code AS maille_code,
  ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) AS overlap_ratio
FROM adm3 a
JOIN mailles m ON ST_Intersects(a.geom, m.geom)
WHERE ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) > 0.01;

CREATE INDEX idx_adm3_maille_map_adm3 ON mv_adm3_maille_map(adm3_code);
CREATE INDEX idx_adm3_maille_map_maille ON mv_adm3_maille_map(maille_id);

-- Vérifier
SELECT COUNT(*) AS total_map FROM mv_adm3_maille_map;
SELECT COUNT(*) AS davie_mailles FROM mv_adm3_maille_map WHERE adm3_code = 'TG030805';

-- 3) Recréer v_maille_sondages_all
DROP VIEW IF EXISTS v_maille_sondages_all CASCADE;
CREATE VIEW v_maille_sondages_all AS
SELECT 
  m.id AS maille_id,
  m.code AS maille_code,
  s.id AS sondage_id,
  'real' AS source
FROM mailles m
JOIN sondages s ON s.geom IS NOT NULL 
  AND ST_Within(s.geom, m.geom)
UNION ALL
SELECT 
  m.id AS maille_id,
  m.code AS maille_code,
  s.id AS sondage_id,
  'spread' AS source
FROM mailles m
JOIN mv_adm3_maille_map map ON map.maille_id = m.id
JOIN sondages s ON s.geom IS NULL 
  AND (s.meta->>'adm3_code') = map.adm3_code
  AND COALESCE(s.loc_mode, 'spread') = 'spread';

-- Vérifier
SELECT COUNT(*) AS total_associations FROM v_maille_sondages_all;
SELECT source, COUNT(*) FROM v_maille_sondages_all GROUP BY source;

-- 4) Recréer mv_mailles_geotech
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
CREATE MATERIALIZED VIEW mv_mailles_geotech AS
SELECT 
  m.id,
  m.code,
  m.geom,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  COALESCE(agg.n_sondages, 0) AS n_sondages,
  COALESCE(agg.n_essais, 0) AS n_essais,
  COALESCE(agg.has_data, false) AS has_data
FROM mailles m
LEFT JOIN (
  SELECT 
    v.maille_code,
    COUNT(DISTINCT v.sondage_id) AS n_sondages,
    COUNT(DISTINCT e.id) AS n_essais,
    true AS has_data
  FROM v_maille_sondages_all v
  LEFT JOIN echantillons e ON e.sondage_id = v.sondage_id
  GROUP BY v.maille_code
) agg ON agg.maille_code = m.code;

CREATE INDEX idx_mv_mailles_geotech_code ON mv_mailles_geotech(code);
CREATE INDEX idx_mv_mailles_geotech_geom ON mv_mailles_geotech USING GIST(geom);
CREATE INDEX idx_mv_mailles_geotech_has_data ON mv_mailles_geotech(has_data);

-- 5) Résultat final
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;
