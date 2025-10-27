-- Diagnostic rapide
SELECT 
  (SELECT COUNT(*) FROM sondages) AS sondages,
  (SELECT COUNT(*) FROM echantillons) AS echantillons,
  (SELECT COUNT(*) FROM atterberg) AS atterberg,
  (SELECT COUNT(*) FROM vbs) AS vbs;

SELECT 
  COUNT(*) AS mailles_total,
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  COUNT(*) FILTER (WHERE has_spread) AS mailles_spread
FROM public.mailles_geotechnique_stats;

SELECT COUNT(*) AS count_mv_mailles_geotech FROM mv_mailles_geotech WHERE n_sondages > 0;
