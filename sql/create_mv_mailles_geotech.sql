-- ============================================================================
-- CRÉER VUE MATÉRIALISÉE MAILLES GÉOTECHNIQUES
-- ============================================================================

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

-- Index
CREATE INDEX idx_mv_mailles_geotech_code ON mv_mailles_geotech(code);
CREATE INDEX idx_mv_mailles_geotech_geom ON mv_mailles_geotech USING GIST(geom);
CREATE INDEX idx_mv_mailles_geotech_has_data ON mv_mailles_geotech(has_data);

-- Vérifier
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;
