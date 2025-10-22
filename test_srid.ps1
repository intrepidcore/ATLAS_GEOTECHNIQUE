Write-Host "=== Test SRID ===" -ForegroundColor Cyan

Write-Host "`n1. SRID de la geometrie:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT ST_SRID(geom) FROM mailles LIMIT 1;"

Write-Host "`n2. Test ST_Transform direct:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT ST_AsText(ST_Transform(geom, 4326)) FROM mailles LIMIT 1;"

Write-Host "`n3. Test avec ST_AsGeoJSON sans transform:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT ST_AsGeoJSON(geom)::text FROM mailles WHERE code = 'TG-0510-0225-01';"

Write-Host "`n4. Verifier si SRID 25231 existe:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT srid, auth_name, auth_srid, srtext FROM spatial_ref_sys WHERE srid = 25231;"
