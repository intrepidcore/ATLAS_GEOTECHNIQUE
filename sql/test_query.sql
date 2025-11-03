-- Test de la requête exacte utilisée par l'API
SELECT 
    code,
    n_sondages as value,
    n_sondages,
    n_essais_geo
FROM mailles_geotechnique_stats
WHERE n_sondages IS NOT NULL
LIMIT 5;
