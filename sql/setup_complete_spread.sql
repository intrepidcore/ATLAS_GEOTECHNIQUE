-- ============================================================================
-- SETUP COMPLET SYSTÈME SPREAD
-- ============================================================================

-- 1) Vue union sondages (réel + spread)
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

-- 2) Vue matérialisée mailles géotechniques
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

-- 3) Appliquer spread pour Davie
SELECT geocode_adm3_spread(id, 'TG030805') 
FROM sondages 
WHERE (meta->>'adm3_code') = 'TG030805';

-- 4) Refresh
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- 5) Vérifier
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;

SELECT COUNT(*) AS associations_spread FROM v_maille_sondages_all WHERE source = 'spread';
