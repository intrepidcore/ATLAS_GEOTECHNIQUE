-- Vérifier le contenu réel de mv_mailles_geotech
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE has_data = true) AS avec_has_data_true,
  COUNT(*) FILTER (WHERE n_sondages > 0) AS avec_n_sondages,
  SUM(n_sondages) AS sum_sondages,
  SUM(n_essais) AS sum_essais
FROM mv_mailles_geotech;

-- Voir quelques exemples
SELECT code, n_sondages, n_essais, has_data 
FROM mv_mailles_geotech 
WHERE n_sondages > 0 
LIMIT 10;

-- Vérifier les associations dans la vue
SELECT COUNT(*) FROM v_maille_sondages_all;
