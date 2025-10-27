# ============================================================================
# Clone Database V2 - Avec copie correcte des données
# ============================================================================

param(
    [string]$SourceDb = "atlas",
    [string]$TargetDb = "atlas_clean"
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Clone de la base de données PostgreSQL" -ForegroundColor Cyan
Write-Host "Source: $SourceDb → Cible: $TargetDb" -ForegroundColor Gray
Write-Host ""

# Tables géotechniques à vider (données uniquement, pas le schéma)
$geotechTables = @(
    "sondages",
    "essais_geotechniques",
    "granulometrie_points",
    "classifications",
    "imports",
    "import_items",
    "import_logs",
    "import_mapping_profiles",
    "test_type_defaults"
)

# Tables référentielles à copier
$refTables = @(
    "mailles",
    "grid",
    "adm0_raw",
    "adm1",
    "adm1_tg",
    "adm2",
    "adm2_tg",
    "adm3",
    "adm3_tg",
    "country_tg",
    "ref_types_essais",
    "spatial_ref_sys"
)

Write-Host "📊 Configuration:" -ForegroundColor Yellow
Write-Host "   Tables géotech à vider: $($geotechTables.Count)" -ForegroundColor Gray
Write-Host "   Tables référentielles à copier: $($refTables.Count)" -ForegroundColor Gray
Write-Host ""

# Étape 1: Vérifier que la base source existe
Write-Host "1️⃣ Vérification de la base source..." -ForegroundColor Yellow
try {
    $result = docker compose exec -T db psql -U atlas -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$SourceDb';"
    if ($result.Trim() -ne "1") {
        throw "Base '$SourceDb' introuvable"
    }
    Write-Host "   ✅ Base source trouvée" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

# Étape 2: Supprimer la base cible si elle existe
Write-Host ""
Write-Host "2️⃣ Nettoyage de la base cible..." -ForegroundColor Yellow
$checkTarget = docker compose exec -T db psql -U atlas -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$TargetDb';"
if ($checkTarget.Trim() -eq "1") {
    Write-Host "   ⚠️  La base '$TargetDb' existe, suppression..." -ForegroundColor Yellow
    
    # Terminer les connexions actives
    docker compose exec -T db psql -U atlas -d postgres -c @"
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$TargetDb' AND pid <> pg_backend_pid();
"@ | Out-Null
    
    Start-Sleep -Seconds 1
    docker compose exec -T db psql -U atlas -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;" | Out-Null
    Write-Host "   ✅ Base supprimée" -ForegroundColor Green
}

# Étape 3: Créer la base cible avec template
Write-Host ""
Write-Host "3️⃣ Création de la base cible..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d postgres -c "CREATE DATABASE $TargetDb WITH OWNER atlas TEMPLATE template0 ENCODING 'UTF8';" | Out-Null
Write-Host "   ✅ Base '$TargetDb' créée" -ForegroundColor Green

# Étape 4: Activer PostGIS
Write-Host ""
Write-Host "4️⃣ Activation des extensions..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d $TargetDb -c "CREATE EXTENSION IF NOT EXISTS postgis;" | Out-Null
docker compose exec -T db psql -U atlas -d $TargetDb -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;" | Out-Null
Write-Host "   ✅ PostGIS activé" -ForegroundColor Green

# Étape 5: Dump et restore du schéma complet
Write-Host ""
Write-Host "5️⃣ Copie du schéma complet..." -ForegroundColor Yellow
$tempDump = "/tmp/atlas_full_dump_$(Get-Date -Format 'yyyyMMddHHmmss').sql"

# Dump avec pg_dump (schéma + données)
docker compose exec -T db pg_dump -U atlas -d $SourceDb -f $tempDump | Out-Null
Write-Host "   ✅ Dump créé: $tempDump" -ForegroundColor Green

# Restore dans la base cible
Write-Host "   📥 Restore en cours..." -ForegroundColor Gray
docker compose exec -T db psql -U atlas -d $TargetDb -f $tempDump 2>&1 | Out-Null
Write-Host "   ✅ Schéma et données restaurés" -ForegroundColor Green

# Étape 6: Vider les tables géotechniques
Write-Host ""
Write-Host "6️⃣ Vidage des tables géotechniques..." -ForegroundColor Yellow
$videdCount = 0
foreach ($table in $geotechTables) {
    try {
        # Vérifier si la table existe
        $exists = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='$table';"
        
        if ($exists.Trim() -eq "1") {
            # Compter avant
            $countBefore = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM $table;"
            
            # Vider la table
            docker compose exec -T db psql -U atlas -d $TargetDb -c "TRUNCATE TABLE $table CASCADE;" 2>&1 | Out-Null
            
            Write-Host "   ✅ $table ($countBefore → 0 lignes)" -ForegroundColor Green
            $videdCount++
        } else {
            Write-Host "   ⏭️  $table (n'existe pas)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   ⚠️  $table (erreur: $_)" -ForegroundColor Yellow
    }
}
Write-Host "   📊 Tables vidées: $videdCount" -ForegroundColor Cyan

# Étape 7: Vérifications
Write-Host ""
Write-Host "7️⃣ Vérifications..." -ForegroundColor Yellow

# Sondages (doit être 0)
$sondagesCount = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM sondages;"
$sondagesOk = $sondagesCount.Trim() -eq "0"
Write-Host "   Sondages: $($sondagesCount.Trim()) " -NoNewline
Write-Host $(if ($sondagesOk) { "✅" } else { "❌" }) -ForegroundColor $(if ($sondagesOk) { "Green" } else { "Red" })

# Mailles (doit être > 0)
$maillesCount = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM mailles;"
$maillesOk = [int]$maillesCount.Trim() -gt 0
Write-Host "   Mailles: $($maillesCount.Trim()) " -NoNewline
Write-Host $(if ($maillesOk) { "✅" } else { "❌" }) -ForegroundColor $(if ($maillesOk) { "Green" } else { "Red" })

# ADM1 (doit être > 0)
$adm1Count = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM adm1;"
$adm1Ok = [int]$adm1Count.Trim() -gt 0
Write-Host "   ADM1: $($adm1Count.Trim()) " -NoNewline
Write-Host $(if ($adm1Ok) { "✅" } else { "❌" }) -ForegroundColor $(if ($adm1Ok) { "Green" } else { "Red" })

# ADM2 (doit être > 0)
$adm2Count = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM adm2;"
$adm2Ok = [int]$adm2Count.Trim() -gt 0
Write-Host "   ADM2: $($adm2Count.Trim()) " -NoNewline
Write-Host $(if ($adm2Ok) { "✅" } else { "❌" }) -ForegroundColor $(if ($adm2Ok) { "Green" } else { "Red" })

# ADM3 (doit être > 0)
$adm3Count = docker compose exec -T db psql -U atlas -d $TargetDb -tAc "SELECT COUNT(*) FROM adm3;"
$adm3Ok = [int]$adm3Count.Trim() -gt 0
Write-Host "   ADM3: $($adm3Count.Trim()) " -NoNewline
Write-Host $(if ($adm3Ok) { "✅" } else { "❌" }) -ForegroundColor $(if ($adm3Ok) { "Green" } else { "Red" })

# Étape 8: Refresh de la vue matérialisée (si elle existe)
Write-Host ""
Write-Host "8️⃣ Refresh des vues matérialisées..." -ForegroundColor Yellow
try {
    docker compose exec -T db psql -U atlas -d $TargetDb -c "REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;" 2>&1 | Out-Null
    Write-Host "   ✅ Vue mailles_geotechnique_stats rafraîchie" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Vue mailles_geotechnique_stats non trouvée (normal)" -ForegroundColor Yellow
}

# Étape 9: Nettoyage
Write-Host ""
Write-Host "9️⃣ Nettoyage..." -ForegroundColor Yellow
docker compose exec -T db rm -f $tempDump 2>&1 | Out-Null
Write-Host "   ✅ Fichiers temporaires supprimés" -ForegroundColor Green

# Résumé final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Clone terminé avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Yellow
Write-Host "   Base source: $SourceDb" -ForegroundColor White
Write-Host "   Base cible: $TargetDb" -ForegroundColor White
Write-Host "   Tables géotech vidées: $videdCount" -ForegroundColor White
Write-Host "   Sondages: $($sondagesCount.Trim())" -ForegroundColor White
Write-Host "   Mailles: $($maillesCount.Trim())" -ForegroundColor White
Write-Host "   ADM (total): $([int]$adm1Count.Trim() + [int]$adm2Count.Trim() + [int]$adm3Count.Trim())" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Prochaines étapes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Modifier le fichier .env:" -ForegroundColor White
Write-Host "   DATABASE_URL=postgres://atlas:atlas@db:5432/$TargetDb" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Redémarrer l'API:" -ForegroundColor White
Write-Host "   docker compose restart api-geo" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Vérifier l'UI:" -ForegroundColor White
Write-Host "   http://localhost:8080" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Importer vos données:" -ForegroundColor White
Write-Host "   python scripts/02_import_excel.py --file data.xlsx --dsn 'postgresql://atlas:atlas@localhost:5432/$TargetDb'" -ForegroundColor Gray
Write-Host ""
