-- ============================================================================
-- PHASE 0 : Refresh Vues Matérialisées
-- ============================================================================

-- Refresh adm3_names (si modifications synonymes)
REFRESH MATERIALIZED VIEW CONCURRENTLY adm3_names;

-- Refresh mv_mailles_geotech (pour la carte)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;

-- Vérifier résultats
SELECT 'adm3_names' AS view_name, COUNT(*) AS count FROM adm3_names
UNION ALL
SELECT 'mv_mailles_geotech', COUNT(*) FROM mv_mailles_geotech;

-- Statistiques mailles
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE n_sondages > 0) AS mailles_avec_sondages,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;
