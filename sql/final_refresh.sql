-- REFRESH FINAL COMPLET
REFRESH MATERIALIZED VIEW mv_mailles_geotech;

-- Vérifier résultat
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE has_data = true) AS mailles_avec_donnees,
  COUNT(*) FILTER (WHERE n_sondages > 0) AS mailles_n_sondages,
  SUM(n_sondages) AS total_sondages,
  SUM(n_essais) AS total_essais
FROM mv_mailles_geotech;

-- Voir exemples
SELECT code, n_sondages, n_essais, has_data, adm3_name
FROM mv_mailles_geotech 
WHERE n_sondages > 0 
LIMIT 10;
