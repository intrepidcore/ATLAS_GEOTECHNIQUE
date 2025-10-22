Write-Host "=== Verification Detaillee MV ===" -ForegroundColor Cyan

Write-Host "`n1. Colonnes ancienne MV (via SQL):" -ForegroundColor Yellow
$query1 = @'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'mailles_geotechnique_stats'
ORDER BY ordinal_position;
'@
docker compose exec db psql -U atlas -d atlas -c $query1

Write-Host "`n2. Colonnes nouvelle MV WGS84 (via SQL):" -ForegroundColor Yellow
$query2 = @'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'mailles_geotechnique_stats_wgs84'
ORDER BY ordinal_position;
'@
docker compose exec db psql -U atlas -d atlas -c $query2

Write-Host "`n3. Test SELECT sur ancienne MV:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT code, passant_80um_avg FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL LIMIT 1;"

Write-Host "`n4. Test SELECT sur nouvelle MV WGS84:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT code, passant_80um_avg, ST_SRID(geom) as srid FROM mailles_geotechnique_stats_wgs84 WHERE passant_80um_avg IS NOT NULL LIMIT 1;"
