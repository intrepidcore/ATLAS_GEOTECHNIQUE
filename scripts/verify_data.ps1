# Vérification complète des données importées
Write-Host "=== VÉRIFICATION DONNÉES GÉOTECHNIQUES ===" -ForegroundColor Cyan

Write-Host "`n1. SONDAGES"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT code, source, location_mode FROM sondages WHERE deleted_at IS NULL ORDER BY source, code"

Write-Host "`n2. ESSAIS GÉOTECHNIQUES (Atterberg, VBS, Proctor)"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, eg.wl, eg.wp, eg.ip, eg.vbs, eg.gamma_d_max, eg.w_opt FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE eg.deleted_at IS NULL ORDER BY s.code, eg.depth_m LIMIT 20"

Write-Host "`n3. ESSAIS PHYSIQUES (Densités, Teneur eau)"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, ep.densite_apparente_gcm3, ep.densite_absolue_gcm3, ep.teneur_eau_pct FROM essais_physiques ep JOIN essais_geotechniques eg ON eg.id = ep.essai_id JOIN sondages s ON s.id = eg.sondage_id WHERE ep.deleted_at IS NULL ORDER BY s.code, eg.depth_m LIMIT 20"

Write-Host "`n4. CLASSIFICATIONS (AASHTO, USCS)"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, ec.systeme, ec.classe FROM essais_classif ec JOIN essais_geotechniques eg ON eg.id = ec.essai_id JOIN sondages s ON s.id = eg.sondage_id WHERE ec.deleted_at IS NULL ORDER BY s.code, eg.depth_m, ec.systeme LIMIT 20"

Write-Host "`n5. GRANULOMÉTRIE (Points de courbe)"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing, gp.methode FROM granulometrie_points gp JOIN essais_geotechniques eg ON eg.id = gp.essai_id JOIN sondages s ON s.id = eg.sondage_id WHERE gp.deleted_at IS NULL ORDER BY s.code, eg.depth_m, gp.sieve_mm DESC LIMIT 30"

Write-Host "`n6. STATISTIQUES GLOBALES"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT 'Sondages' as table_name, COUNT(*) as count FROM sondages WHERE deleted_at IS NULL UNION ALL SELECT 'Essais géotechniques', COUNT(*) FROM essais_geotechniques WHERE deleted_at IS NULL UNION ALL SELECT 'Essais physiques', COUNT(*) FROM essais_physiques WHERE deleted_at IS NULL UNION ALL SELECT 'Classifications', COUNT(*) FROM essais_classif WHERE deleted_at IS NULL UNION ALL SELECT 'Points granulo', COUNT(*) FROM granulometrie_points WHERE deleted_at IS NULL"

Write-Host "`n=== FIN VÉRIFICATION ===" -ForegroundColor Green
