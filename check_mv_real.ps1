Write-Host "=== Liste des vues matérialisées ===" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT schemaname, matviewname FROM pg_matviews WHERE matviewname LIKE '%mailles%';"

Write-Host "`n=== Colonnes de la MV actuelle ===" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT * FROM mailles_geotechnique_stats_wgs84 LIMIT 0;"

Write-Host "`n=== Test: La MV a-t-elle déjà geom? ===" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mailles_geotechnique_stats_wgs84' AND column_name IN ('geom', 'geom_simplified', 'adm1_name', 'adm2_name', 'adm3_name');"
