-- Vérifier les données
SELECT COUNT(*) as total_mailles FROM mailles_geotechnique_stats;
SELECT COUNT(*) as mailles_avec_essais FROM mailles_geotechnique_stats WHERE n_essais_geo > 0;
SELECT COUNT(*) as mailles_avec_ip FROM mailles_geotechnique_stats WHERE ip_avg IS NOT NULL;

-- Voir quelques exemples
SELECT code, n_sondages, n_essais_geo, ip_avg, vbs_avg, eg_avg 
FROM mailles_geotechnique_stats 
WHERE n_essais_geo > 0 
LIMIT 5;

-- Colonnes disponibles
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'mailles_geotechnique_stats' 
ORDER BY ordinal_position;
