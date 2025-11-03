-- DIAGNOSTIC COMPLET

-- 1) Données brutes
SELECT 
  (SELECT COUNT(*) FROM sondages) AS sondages,
  (SELECT COUNT(*) FROM echantillons) AS echantillons,
  (SELECT COUNT(*) FROM essais_atterberg) AS atterberg,
  (SELECT COUNT(*) FROM essais_vbs) AS vbs,
  (SELECT COUNT(*) FROM essais_proctor) AS proctor;

-- 2) Sondages avec géométrie
SELECT 
  COUNT(*) AS total_sondages,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- 3) Vue mv_mailles_geotech
SELECT 
  COUNT(*) AS total_mailles,
  COUNT(*) FILTER (WHERE n_sondages > 0) AS mailles_avec_sondages,
  SUM(n_sondages) AS total_sondages_dans_mailles
FROM mv_mailles_geotech;

-- 4) Vérifier si la vue existe
SELECT COUNT(*) AS vue_existe 
FROM pg_matviews 
WHERE matviewname = 'mv_mailles_geotech';
