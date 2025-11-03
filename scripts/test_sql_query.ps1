Write-Host "=== Test Requete SQL ===" -ForegroundColor Cyan

Write-Host "`n1. Requete sans geom (comptage)" -ForegroundColor Yellow
$query1 = "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL;"
docker compose exec db psql -U atlas -d atlas -c $query1

Write-Host "`n2. Requete avec geom (comme l'API)" -ForegroundColor Yellow
$query2 = @"
SELECT 
    code,
    ST_AsGeoJSON(geom) as geom,
    passant_80um_avg as value,
    n_sondages,
    n_essais_geo
FROM mailles_geotechnique_stats
WHERE passant_80um_avg IS NOT NULL
LIMIT 1;
"@
docker compose exec db psql -U atlas -d atlas -c $query2

Write-Host "`n3. Test avec min_sondages >= 1" -ForegroundColor Yellow
$query3 = @"
SELECT COUNT(*) 
FROM mailles_geotechnique_stats 
WHERE passant_80um_avg IS NOT NULL 
AND n_sondages >= 1;
"@
docker compose exec db psql -U atlas -d atlas -c $query3
