# =====================================================================
# Script QA - Exécution et archivage des validations
# Usage: .\scripts\run_qa_validation.ps1
# =====================================================================

$ErrorActionPreference = "Stop"

# Configuration
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$QA_DIR = "sql\qa"
$RESULTS_DIR = "$QA_DIR\results"
$SQL_FILE = "$QA_DIR\recap_full_validation.sql"
$OUTPUT_FILE = "$RESULTS_DIR\validation_$TIMESTAMP.txt"

# Créer le répertoire de résultats s'il n'existe pas
if (-not (Test-Path $RESULTS_DIR)) {
    New-Item -ItemType Directory -Path $RESULTS_DIR | Out-Null
    Write-Host "📁 Création du répertoire $RESULTS_DIR" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🔍 LANCEMENT DE LA VALIDATION QA" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "Fichier SQL: $SQL_FILE" -ForegroundColor Cyan
Write-Host "Résultat:    $OUTPUT_FILE" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SQL_FILE)) {
    Write-Host "❌ ERREUR: Fichier SQL introuvable: $SQL_FILE" -ForegroundColor Red
    exit 1
}

# Exécuter la validation et capturer la sortie
try {
    Write-Host "⏳ Exécution en cours..." -ForegroundColor Yellow
    
    $result = Get-Content $SQL_FILE | docker exec -i atlas-db psql -U atlas -d atlas_clean 2>&1
    
    # Sauvegarder dans le fichier
    $result | Out-File -FilePath $OUTPUT_FILE -Encoding UTF8
    
    # Afficher à l'écran
    Write-Host ""
    Write-Host "📊 RÉSULTATS DE LA VALIDATION" -ForegroundColor Green
    Write-Host "=============================" -ForegroundColor Green
    Write-Host ""
    $result | ForEach-Object { Write-Host $_ }
    
    Write-Host ""
    Write-Host "✅ Validation terminée!" -ForegroundColor Green
    Write-Host "📄 Résultats sauvegardés dans: $OUTPUT_FILE" -ForegroundColor Cyan
    
    # Analyser les résultats pour détecter des FAIL
    $failCount = ($result | Select-String -Pattern "❌ FAIL" -AllMatches).Matches.Count
    $passCount = ($result | Select-String -Pattern "✅ PASS" -AllMatches).Matches.Count
    $warnCount = ($result | Select-String -Pattern "⚠️  WARNING" -AllMatches).Matches.Count
    
    Write-Host ""
    Write-Host "📈 RÉSUMÉ:" -ForegroundColor Cyan
    Write-Host "  ✅ PASS:    $passCount" -ForegroundColor Green
    Write-Host "  ⚠️  WARNING: $warnCount" -ForegroundColor Yellow
    Write-Host "  ❌ FAIL:    $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
    
    if ($failCount -gt 0) {
        Write-Host ""
        Write-Host "⚠️  ATTENTION: Des échecs ont été détectés. Consultez le fichier de résultats." -ForegroundColor Yellow
        exit 1
    } elseif ($warnCount -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Des avertissements ont été détectés (anomalies à documenter dans meta)." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "🎉 TOUTES LES VALIDATIONS SONT PASSÉES!" -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERREUR lors de l'exécution:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
