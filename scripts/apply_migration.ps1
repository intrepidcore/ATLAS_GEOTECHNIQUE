Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  MIGRATION WGS84 - Solution Complete SRID" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

Write-Host "`n[ETAPE 1] Verification pre-migration" -ForegroundColor Yellow
Write-Host "Verification SRID actuel..." -ForegroundColor Gray
docker compose exec db psql -U atlas -d atlas -c "SELECT ST_SRID(geom) as srid, COUNT(*) FROM mailles GROUP BY ST_SRID(geom);"

Write-Host "`n[ETAPE 2] Application de la migration" -ForegroundColor Yellow
Write-Host "Execution du script SQL..." -ForegroundColor Gray
Get-Content migration_wgs84.sql | docker compose exec -T db psql -U atlas -d atlas

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Migration executee avec succes" -ForegroundColor Green
} else {
    Write-Host "`n❌ Erreur lors de la migration" -ForegroundColor Red
    exit 1
}

Write-Host "`n[ETAPE 3] Verification post-migration" -ForegroundColor Yellow
Write-Host "Test 1 - SRID de la MV WGS84:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT ST_SRID(geom) as srid_geom, ST_SRID(geom_simplified) as srid_simplified FROM mailles_geotechnique_stats_wgs84 LIMIT 1;"

Write-Host "`nTest 2 - Comptage features:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom, COUNT(*) FILTER (WHERE passant_80um_avg IS NOT NULL) as with_passant80 FROM mailles_geotechnique_stats_wgs84;"

Write-Host "`nTest 3 - Exemple coordonnees WGS84:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT code, ROUND(ST_X(ST_Centroid(geom))::numeric, 4) as lon, ROUND(ST_Y(ST_Centroid(geom))::numeric, 4) as lat FROM mailles_geotechnique_stats_wgs84 WHERE passant_80um_avg IS NOT NULL LIMIT 3;"

Write-Host "`n============================================================================" -ForegroundColor Green
Write-Host "  MIGRATION TERMINEE" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green

Write-Host "`nProchaine etape: Modifier l'API pour utiliser mailles_geotechnique_stats_wgs84" -ForegroundColor Yellow
