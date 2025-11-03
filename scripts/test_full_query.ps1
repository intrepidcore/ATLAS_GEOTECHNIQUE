Write-Host "=== Test Requete Complete ===" -ForegroundColor Cyan

Write-Host "`nRequete exacte de l'API:" -ForegroundColor Yellow
$query = @'
SELECT 
    s.code,
    ST_AsGeoJSON(ST_Transform(ST_Simplify(m.geom, 2000), 4326))::text as geom,
    CAST(s.passant_80um_avg AS DOUBLE PRECISION) as value,
    s.n_sondages,
    s.n_essais_geo
FROM mailles_geotechnique_stats s
JOIN mailles m ON m.code = s.code
WHERE s.passant_80um_avg IS NOT NULL 
AND s.n_sondages >= 0 
ORDER BY s.code
LIMIT 3;
'@

docker compose exec db psql -U atlas -d atlas -c $query

Write-Host "`n`nTest sans ST_Simplify:" -ForegroundColor Yellow
$query2 = @'
SELECT 
    s.code,
    ST_AsGeoJSON(ST_Transform(m.geom, 4326))::text as geom,
    CAST(s.passant_80um_avg AS DOUBLE PRECISION) as value
FROM mailles_geotechnique_stats s
JOIN mailles m ON m.code = s.code
WHERE s.passant_80um_avg IS NOT NULL 
LIMIT 1;
'@

docker compose exec db psql -U atlas -d atlas -c $query2
