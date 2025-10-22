$query = @'
SELECT 
    code,
    passant_80um_avg as value,
    n_sondages,
    n_essais_geo
FROM mailles_geotechnique_stats
WHERE passant_80um_avg IS NOT NULL
ORDER BY code
LIMIT 5;
'@

Write-Host "Test requete SQL directe:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c $query
