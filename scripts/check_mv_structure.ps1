Write-Host "=== Structure de mailles_geotechnique_stats ===" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mailles_geotechnique_stats' ORDER BY ordinal_position LIMIT 20;"

Write-Host "`n=== Structure de mailles_geotechnique_stats_wgs84 (actuelle) ===" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mailles_geotechnique_stats_wgs84' ORDER BY ordinal_position LIMIT 20;"
