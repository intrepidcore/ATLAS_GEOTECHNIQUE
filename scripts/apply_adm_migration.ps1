Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  MIGRATION ADM TAGS - Étiquetage des mailles" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

Write-Host "`n[ETAPE 1] Vérification tables ADM existantes" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'adm%' ORDER BY table_name;"

Write-Host "`n[ETAPE 2] Application de la migration" -ForegroundColor Yellow
Write-Host "Ajout colonnes ADM + étiquetage + index..." -ForegroundColor Gray
Get-Content migration_adm_tags.sql | docker compose exec -T db psql -U atlas -d atlas

Write-Host "`n[ETAPE 3] Vérification post-migration" -ForegroundColor Yellow
Write-Host "Distribution des mailles par région:" -ForegroundColor Gray
docker compose exec db psql -U atlas -d atlas -c "SELECT adm1_name, COUNT(*) as n_mailles FROM mailles WHERE adm1_name IS NOT NULL GROUP BY adm1_name ORDER BY n_mailles DESC;"

Write-Host "`n============================================================================" -ForegroundColor Green
Write-Host "  MIGRATION TERMINEE" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green

Write-Host "`nProchaine étape: Modifier l'API pour utiliser les filtres ADM" -ForegroundColor Cyan
