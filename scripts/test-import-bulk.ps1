# ============================================================================
# Test Import Bulk - Script de validation end-to-end
# ============================================================================
# Ce script teste la fonctionnalité d'import bulk complète
# ============================================================================

param(
    [string]$ApiUrl = "http://localhost:8001",
    [string]$CsvFile = "..\data\test_import_mini.csv"
)

Write-Host "`n🧪 Test Import Bulk - Atlas v1.4.0" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. Vérifier que l'API est accessible
# ============================================================================

Write-Host "`n1️⃣  Vérification de l'API..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/healthz" -Method Get -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Host "  ✅ API accessible et opérationnelle" -ForegroundColor Green
    } else {
        Write-Host "  ❌ API répond mais status != ok" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ API non accessible sur $ApiUrl" -ForegroundColor Red
    Write-Host "  💡 Lancez d'abord: .\quick-start.ps1" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 2. Vérifier que le fichier CSV existe
# ============================================================================

Write-Host "`n2️⃣  Vérification du fichier CSV..." -ForegroundColor Yellow

$csvPath = Join-Path $PSScriptRoot $CsvFile
if (-not (Test-Path $csvPath)) {
    Write-Host "  ❌ Fichier CSV non trouvé: $csvPath" -ForegroundColor Red
    exit 1
}

$csvContent = Get-Content $csvPath -Raw
$lineCount = ($csvContent -split "`n").Count - 1
Write-Host "  ✅ Fichier trouvé: $csvPath" -ForegroundColor Green
Write-Host "  📊 Lignes de données: $lineCount" -ForegroundColor Cyan

# ============================================================================
# 3. Test DRY-RUN (prévisualisation)
# ============================================================================

Write-Host "`n3️⃣  Test DRY-RUN (prévisualisation)..." -ForegroundColor Yellow

# Créer le JSON de configuration
$config = @{
    format = "csv"
    mapping = @{
        structure = "long"
        localite_col = "localite"
        type_essai_col = "type"
        profondeur_col = "profondeur_m"
        valeur_col = "valeur"
        unite_col = "unite"
        date_col = "date"
        source_col = "source"
        operator_col = "operator"
        adm3_col = "adm3"
    }
    geolocation = @{
        mode = "centroid"
        seed = 42
    }
    dry_run = $true
} | ConvertTo-Json -Depth 10

# Sauvegarder la config dans un fichier temporaire
$configPath = Join-Path $env:TEMP "import_config.json"
$config | Out-File -FilePath $configPath -Encoding UTF8

try {
    Write-Host "  🔍 Envoi de la requête dry-run..." -ForegroundColor Cyan
    
    # Utiliser curl.exe pour multipart/form-data
    $result = & curl.exe -s -X POST "$ApiUrl/surveys/bulk-import/dry-run" `
        -F "file=@$csvPath" `
        -F "config=@$configPath;type=application/json"
    
    $dryRunResult = $result | ConvertFrom-Json
    
    Write-Host "  ✅ Dry-run réussi" -ForegroundColor Green
    Write-Host "  📊 Résultats:" -ForegroundColor Cyan
    Write-Host "    • Valid: $($dryRunResult.valid)" -ForegroundColor White
    Write-Host "    • Total rows: $($dryRunResult.stats.total_rows)" -ForegroundColor White
    Write-Host "    • Sondages: $($dryRunResult.stats.sondages)" -ForegroundColor White
    Write-Host "    • Essais: $($dryRunResult.stats.essais)" -ForegroundColor White
    Write-Host "    • Warnings: $($dryRunResult.stats.warnings)" -ForegroundColor Yellow
    Write-Host "    • Errors: $($dryRunResult.stats.errors)" -ForegroundColor $(if ($dryRunResult.stats.errors -gt 0) { "Red" } else { "Green" })
    
    if ($dryRunResult.stats.errors -gt 0) {
        Write-Host "`n  ⚠️  Erreurs détectées:" -ForegroundColor Red
        foreach ($error in $dryRunResult.errors) {
            Write-Host "    • Ligne $($error.row): $($error.message)" -ForegroundColor Red
        }
    }
    
    if ($dryRunResult.stats.warnings -gt 0) {
        Write-Host "`n  ⚠️  Warnings détectés:" -ForegroundColor Yellow
        foreach ($warning in $dryRunResult.warnings) {
            Write-Host "    • Ligne $($warning.row): $($warning.message)" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "  ❌ Erreur lors du dry-run: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  💡 Vérifiez les logs: docker compose logs api-geo" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 4. Test IMPORT ASYNC (import réel)
# ============================================================================

Write-Host "`n4️⃣  Test IMPORT ASYNC (import réel)..." -ForegroundColor Yellow
Write-Host "  ⚠️  Ceci va créer des données dans la base" -ForegroundColor Yellow

$response = Read-Host "  Continuer? (o/N)"
if ($response -ne "o" -and $response -ne "O") {
    Write-Host "  ℹ️  Import annulé par l'utilisateur" -ForegroundColor Cyan
    exit 0
}

try {
    Write-Host "  🚀 Lancement de l'import async..." -ForegroundColor Cyan
    
    $result = & curl.exe -s -X POST "$ApiUrl/surveys/bulk-import/async" `
        -F "file=@$csvPath" `
        -F "config=@$configPath;type=application/json"
    
    $importResult = $result | ConvertFrom-Json
    $jobId = $importResult.job_id
    
    Write-Host "  ✅ Import lancé" -ForegroundColor Green
    Write-Host "  🆔 Job ID: $jobId" -ForegroundColor Cyan
    
    # Suivre le statut
    Write-Host "`n  ⏳ Suivi du statut..." -ForegroundColor Yellow
    
    $maxAttempts = 30
    $attempt = 0
    $completed = $false
    
    while (-not $completed -and $attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 2
        $attempt++
        
        $status = Invoke-RestMethod -Uri "$ApiUrl/surveys/bulk-import/status/$jobId" -Method Get
        
        Write-Host "    [$attempt/$maxAttempts] Status: $($status.status) - Progress: $($status.progress)%" -ForegroundColor Cyan
        
        if ($status.status -eq "succeeded" -or $status.status -eq "failed" -or $status.status -eq "partial") {
            $completed = $true
            
            if ($status.status -eq "succeeded") {
                Write-Host "`n  ✅ Import terminé avec succès!" -ForegroundColor Green
                Write-Host "  📊 Résultats finaux:" -ForegroundColor Cyan
                Write-Host "    • Sondages créés: $($status.stats.sondages)" -ForegroundColor White
                Write-Host "    • Essais créés: $($status.stats.essais)" -ForegroundColor White
                Write-Host "    • Warnings: $($status.stats.warnings)" -ForegroundColor Yellow
            } elseif ($status.status -eq "failed") {
                Write-Host "`n  ❌ Import échoué: $($status.error_message)" -ForegroundColor Red
            } else {
                Write-Host "`n  ⚠️  Import partiel (certaines lignes ont échoué)" -ForegroundColor Yellow
            }
        }
    }
    
    if (-not $completed) {
        Write-Host "`n  ⚠️  Timeout - l'import est toujours en cours" -ForegroundColor Yellow
        Write-Host "  💡 Vérifiez manuellement: curl $ApiUrl/surveys/bulk-import/status/$jobId" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "  ❌ Erreur lors de l'import: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================================================
# 5. Vérification en base de données
# ============================================================================

Write-Host "`n5️⃣  Vérification en base de données..." -ForegroundColor Yellow

try {
    # Compter les sondages
    $query = "SELECT COUNT(*) as count FROM sondages WHERE import_id IS NOT NULL"
    $result = docker exec atlas-db psql -U atlas -d atlas -t -c $query 2>$null
    
    if ($result) {
        $count = $result.Trim()
        Write-Host "  ✅ Sondages importés en base: $count" -ForegroundColor Green
    }
    
    # Compter les essais
    $query = "SELECT COUNT(*) as count FROM essais WHERE is_from_import = true"
    $result = docker exec atlas-db psql -U atlas -d atlas -t -c $query 2>$null
    
    if ($result) {
        $count = $result.Trim()
        Write-Host "  ✅ Essais importés en base: $count" -ForegroundColor Green
    }
    
} catch {
    Write-Host "  ⚠️  Impossible de vérifier la base (Docker non accessible)" -ForegroundColor Yellow
}

# ============================================================================
# 6. Télécharger le rapport
# ============================================================================

if ($jobId) {
    Write-Host "`n6️⃣  Téléchargement du rapport..." -ForegroundColor Yellow
    
    try {
        $reportPath = Join-Path $PSScriptRoot "..\logs\import_report_$jobId.csv"
        & curl.exe -s -o $reportPath "$ApiUrl/surveys/bulk-import/report/$jobId?format=csv"
        
        Write-Host "  ✅ Rapport sauvegardé: $reportPath" -ForegroundColor Green
        
    } catch {
        Write-Host "  ⚠️  Impossible de télécharger le rapport" -ForegroundColor Yellow
    }
}

# ============================================================================
# RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ TEST IMPORT BULK TERMINÉ" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  • Consultez l'interface web: http://localhost:5173" -ForegroundColor White
Write-Host "  • Vérifiez les logs: docker compose logs api-geo" -ForegroundColor White
Write-Host "  • Consultez le rapport: logs\import_report_$jobId.csv" -ForegroundColor White

Write-Host "`n🔧 Commandes utiles:" -ForegroundColor Yellow
Write-Host "  • Voir tous les imports: curl $ApiUrl/surveys/bulk-import/status" -ForegroundColor Gray
Write-Host "  • Télécharger template: curl $ApiUrl/surveys/bulk-import/templates/granulometrie" -ForegroundColor Gray
Write-Host "  • Requête SQL: docker exec atlas-db psql -U atlas -d atlas" -ForegroundColor Gray

Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Nettoyer
Remove-Item $configPath -ErrorAction SilentlyContinue
