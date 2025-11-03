Write-Host "=== Verification JOIN ===" -ForegroundColor Cyan

Write-Host "`n1. Exemple de codes dans mailles_geotechnique_stats:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL LIMIT 3;"

Write-Host "`n2. Exemple de codes dans table mailles:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT code FROM mailles WHERE geom IS NOT NULL LIMIT 3;"

Write-Host "`n3. Test JOIN:" -ForegroundColor Yellow
$query = @'
SELECT 
    s.code,
    m.code as m_code,
    ST_GeometryType(m.geom) as geom_type
FROM mailles_geotechnique_stats s
JOIN mailles m ON m.code = s.code
WHERE s.passant_80um_avg IS NOT NULL
LIMIT 3;
'@
docker compose exec db psql -U atlas -d atlas -c $query

Write-Host "`n4. Verifier si mailles a des geom non-NULL:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles WHERE geom IS NOT NULL;"

Write-Host "`n5. Verifier structure table mailles:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "\d mailles" | Select-Object -First 20
