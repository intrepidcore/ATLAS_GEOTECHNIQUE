-- Vérifier la structure de la MV actuelle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'mailles_geotechnique_stats_wgs84'
ORDER BY ordinal_position;
