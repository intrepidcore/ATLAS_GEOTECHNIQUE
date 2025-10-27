# ============================================================================
# Clone Database - Exécution Immédiate
# ============================================================================

param(
    [string]$SourceDb = "atlas",
    [string]$TargetDb = "atlas_clean"
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Clone de la base de données" -ForegroundColor Cyan
Write-Host "Source: $SourceDb → Cible: $TargetDb" -ForegroundColor Gray
Write-Host ""

# Tables géotechniques à exclure (données uniquement, pas le schéma)
$geotechTables = @(
    "sondages",
    "echantillons", 
    "essais_atterberg",
    "essais_vbs",
    "essais_proctor",
    "essais_geotechniques",
    "granulo_points",
    "imports",
    "import_items",
    "import_logs",
    "import_mapping_profiles",
    "test_type_defaults"
)

Write-Host "📊 Tables géotech à vider (schéma conservé):" -ForegroundColor Yellow
$geotechTables | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
Write-Host ""

# Étape 1: Vérifier que la base source existe
Write-Host "1️⃣ Vérification de la base source..." -ForegroundColor Yellow
$checkSource = docker compose exec -T db psql -U atlas -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$SourceDb';"
if ($checkSource -ne "1") {
    Write-Host "❌ La base '$SourceDb' n'existe pas" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Base source trouvée" -ForegroundColor Green

# Étape 2: Supprimer la base cible si elle existe
Write-Host ""
Write-Host "2️⃣ Nettoyage de la base cible..." -ForegroundColor Yellow
$checkTarget = docker compose exec -T db psql -U atlas -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$TargetDb';"
if ($checkTarget -eq "1") {
    Write-Host "   ⚠️  La base '$TargetDb' existe déjà, suppression..." -ForegroundColor Yellow
    docker compose exec -T db psql -U atlas -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;" | Out-Null
    Write-Host "   ✅ Base supprimée" -ForegroundColor Green
}

# Étape 3: Créer la base cible
Write-Host ""
Write-Host "3️⃣ Création de la base cible..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d postgres -c "CREATE DATABASE $TargetDb OWNER atlas;" | Out-Null
Write-Host "   ✅ Base '$TargetDb' créée" -ForegroundColor Green

# Étape 4: Activer PostGIS
Write-Host ""
Write-Host "4️⃣ Activation de PostGIS..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d $TargetDb -c "CREATE EXTENSION IF NOT EXISTS postgis;" | Out-Null
docker compose exec -T db psql -U atlas -d $TargetDb -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;" | Out-Null
Write-Host "   ✅ PostGIS activé" -ForegroundColor Green

# Étape 5: Dump du schéma complet
Write-Host ""
Write-Host "5️⃣ Dump du schéma complet..." -ForegroundColor Yellow
$dumpFile = "atlas_schema_dump.sql"
docker compose exec -T db pg_dump -U atlas -d $SourceDb --schema-only -f /tmp/$dumpFile
Write-Host "   ✅ Schéma dumpé" -ForegroundColor Green

# Étape 6: Restore du schéma
Write-Host ""
Write-Host "6️⃣ Restore du schéma..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d $TargetDb -f /tmp/$dumpFile | Out-Null
Write-Host "   ✅ Schéma restauré" -ForegroundColor Green

# Étape 7: Copier les données des tables référentielles
Write-Host ""
Write-Host "7️⃣ Copie des données référentielles..." -ForegroundColor Yellow

# Récupérer toutes les tables
$allTables = docker compose exec -T db psql -U atlas -d $SourceDb -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
$allTablesList = $allTables -split "`n" | Where-Object { $_.Trim() -ne "" }

$copiedCount = 0
$skippedCount = 0

foreach ($table in $allTablesList) {
    $table = $table.Trim()
    if ($table -eq "") { continue }
    
    # Vérifier si c'est une table géotech
    if ($geotechTables -contains $table) {
        Write-Host "   ⏭️  $table (géotech, vide)" -ForegroundColor Gray
        $skippedCount++
    } else {
        # Copier les données
        $copyCmd = "INSERT INTO $TargetDb.public.$table SELECT * FROM $SourceDb.public.$table;"
        docker compose exec -T db psql -U atlas -d postgres -c $copyCmd 2>$null | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $count = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM $table;"
            Write-Host "   ✅ $table ($count lignes)" -ForegroundColor Green
            $copiedCount++
        }
    }
}

Write-Host ""
Write-Host "   📊 Tables copiées: $copiedCount" -ForegroundColor Green
Write-Host "   📊 Tables vidées: $skippedCount" -ForegroundColor Yellow

# Étape 8: Vérifications
Write-Host ""
Write-Host "8️⃣ Vérifications..." -ForegroundColor Yellow

# Compter les sondages (doit être 0)
$sondagesCount = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM sondages;"
Write-Host "   Sondages: $sondagesCount (attendu: 0)" -ForegroundColor $(if ($sondagesCount -eq "0") { "Green" } else { "Red" })

# Compter les mailles (doit être > 0)
$maillesCount = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM mailles;"
Write-Host "   Mailles: $maillesCount (attendu: > 0)" -ForegroundColor $(if ([int]$maillesCount -gt 0) { "Green" } else { "Red" })

# Compter les ADM (doit être > 0)
$admCount = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM adm_0;"
Write-Host "   ADM_0: $admCount (attendu: > 0)" -ForegroundColor $(if ([int]$admCount -gt 0) { "Green" } else { "Red" })

# Étape 9: Refresh de la vue matérialisée
Write-Host ""
Write-Host "9️⃣ Refresh de la vue matérialisée..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d $TargetDb -c "REFRESH MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats;" | Out-Null
Write-Host "   ✅ Vue rafraîchie" -ForegroundColor Green

# Nettoyage
Write-Host ""
Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
docker compose exec -T db rm -f /tmp/$dumpFile
Write-Host "   ✅ Fichiers temporaires supprimés" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Clone terminé avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Yellow
Write-Host "   Base source: $SourceDb" -ForegroundColor White
Write-Host "   Base cible: $TargetDb" -ForegroundColor White
Write-Host "   Tables référentielles: $copiedCount copiées" -ForegroundColor White
Write-Host "   Tables géotech: $skippedCount vidées" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Prochaine étape:" -ForegroundColor Yellow
Write-Host "   Modifier .env pour pointer vers $TargetDb" -ForegroundColor White
Write-Host "   DATABASE_URL=postgres://atlas:atlas@db:5432/$TargetDb" -ForegroundColor Gray
Write-Host ""
Write-Host "   Puis redémarrer l'API:" -ForegroundColor White
Write-Host "   docker compose restart api-geo" -ForegroundColor Gray
