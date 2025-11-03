-- DIAGNOSTIC SIMPLE

-- 1) Données brutes
SELECT 
  (SELECT COUNT(*) FROM sondages) AS sondages,
  (SELECT COUNT(*) FROM echantillons) AS echantillons,
  (SELECT COUNT(*) FROM essais_atterberg) AS atterberg,
  (SELECT COUNT(*) FROM essais_vbs) AS vbs;

-- 2) Sondages avec géométrie
SELECT 
  COUNT(*) AS total_sondages,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- 3) Vues matérialisées
SELECT matviewname, pg_size_pretty(pg_total_relation_size('public.'||matviewname)) AS size
FROM pg_matviews 
WHERE matviewname LIKE '%maille%' OR matviewname LIKE '%geotech%'
ORDER BY matviewname;

-- 4) Colonnes de mv_mailles_geotech
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mv_mailles_geotech' 
ORDER BY ordinal_position;
