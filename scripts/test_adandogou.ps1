# Tests ADANDOGOU
Write-Host "=== TESTS ADANDOGOU ===" -ForegroundColor Cyan

Write-Host "`n1. Vérifier absence spread..."
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) as count_spread FROM sondages WHERE location_mode = 'spread'"

Write-Host "`n2. Essais géotechniques..."
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, eg.wl, eg.wp, eg.ip, eg.vbs FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA') ORDER BY s.code, eg.depth_m"

Write-Host "`n3. Essais physiques..."
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, ep.densite_apparente_gcm3, ep.densite_absolue_gcm3, ep.teneur_eau_pct FROM essais_physiques ep JOIN essais_geotechniques eg ON eg.id = ep.essai_id JOIN sondages s ON s.id = eg.sondage_id WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA') ORDER BY s.code, eg.depth_m"

Write-Host "`n4. Classifications..."
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, ec.systeme, ec.classe FROM essais_classif ec JOIN essais_geotechniques eg ON eg.id = ec.essai_id JOIN sondages s ON s.id = eg.sondage_id WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA') ORDER BY s.code, eg.depth_m, ec.systeme"

Write-Host "`n5. Cohérence IP = WL - WP..."
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, eg.wl, eg.wp, eg.ip, CASE WHEN ABS(eg.ip - (eg.wl - eg.wp)) <= 1 THEN 'OK' ELSE 'ERREUR' END as coherence FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA') AND eg.wl IS NOT NULL ORDER BY s.code, eg.depth_m"

Write-Host "`n✅ ADANDOGOU: Tests terminés" -ForegroundColor Green
