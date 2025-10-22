Write-Host "=== Verification Colonnes MV ===" -ForegroundColor Cyan

Write-Host "`n1. Colonnes de l'ancienne MV (mailles_geotechnique_stats):" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "\d mailles_geotechnique_stats"

Write-Host "`n2. Colonnes de la nouvelle MV WGS84:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "\d mailles_geotechnique_stats_wgs84"

Write-Host "`n3. Liste des vues materialisees:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT matviewname, ispopulated FROM pg_matviews WHERE schemaname = 'public';"
