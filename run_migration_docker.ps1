# ============================================================================
# Script PowerShell : Exécution de la migration via Docker
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🔧 Début de la migration des types de colonnes sondages..." -ForegroundColor Cyan

# Vérifier que Docker est en cours d'exécution
try {
    docker ps | Out-Null
} catch {
    Write-Host "❌ Docker n'est pas en cours d'exécution!" -ForegroundColor Red
    exit 1
}

# Vérifier que le conteneur atlas-db existe
$container = docker ps -a --filter "name=atlas-db" --format "{{.Names}}"
if (-not $container) {
    Write-Host "❌ Le conteneur atlas-db n'existe pas!" -ForegroundColor Red
    Write-Host "Démarrez-le avec: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le conteneur est en cours d'exécution
$containerStatus = docker ps --filter "name=atlas-db" --format "{{.Status}}"
if (-not $containerStatus) {
    Write-Host "⚠️  Le conteneur atlas-db est arrêté. Démarrage..." -ForegroundColor Yellow
    docker-compose up -d db
    Start-Sleep -Seconds 5
}

Write-Host "✅ Conteneur atlas-db prêt" -ForegroundColor Green

# Copier le fichier SQL dans le conteneur
Write-Host "📄 Copie du fichier de migration dans le conteneur..." -ForegroundColor Yellow
docker cp "migrations\fix_sondages_types.sql" atlas-db:/tmp/fix_sondages_types.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la copie du fichier" -ForegroundColor Red
    exit 1
}

# Exécuter la migration
Write-Host "⏳ Exécution de la migration..." -ForegroundColor Yellow
docker exec -i atlas-db psql -U atlas -d atlas_clean -f /tmp/fix_sondages_types.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration exécutée avec succès!" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de l'exécution de la migration (code: $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Nettoyer le fichier temporaire
docker exec atlas-db rm /tmp/fix_sondages_types.sql

Write-Host ""
Write-Host "📊 Vérification des données après migration..." -ForegroundColor Cyan

# Vérifier les types de colonnes
Write-Host ""
Write-Host "Types de colonnes:" -ForegroundColor Yellow
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\d sondages"

# Statistiques
Write-Host ""
Write-Host "Statistiques:" -ForegroundColor Yellow
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) as total_sondages, COUNT(id) as id_non_null, COUNT(adm3_id) as adm3_id_non_null, COUNT(date) as date_non_null, COUNT(geom) as geom_non_null, COUNT(*) FILTER (WHERE is_geocoded = true) as geocoded_count FROM sondages;"

# Vue matérialisée
Write-Host ""
Write-Host "Vue matérialisée:" -ForegroundColor Yellow
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) as total_mailles, SUM(nb_sondages_real) as total_sondages_in_mailles, COUNT(*) FILTER (WHERE has_data = true) as mailles_with_data FROM mv_mailles_geotech;"

Write-Host ""
Write-Host "🎉 Migration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Redémarrer le serveur API: docker-compose restart api" -ForegroundColor White
Write-Host "  2. Vérifier les logs: docker-compose logs -f api" -ForegroundColor White
Write-Host "  3. Tester les APIs:" -ForegroundColor White
Write-Host "     curl http://localhost:8000/sondages/stats" -ForegroundColor Gray
Write-Host "     curl http://localhost:8000/sondages?limit=5" -ForegroundColor Gray
Write-Host "  4. Tester l'UI: http://localhost:5173" -ForegroundColor White
