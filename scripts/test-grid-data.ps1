#!/usr/bin/env pwsh
# Script de test des mailles avec données v0.7.0

$ErrorActionPreference = "Stop"

Write-Host "`n=== Test des mailles avec données ===" -ForegroundColor Cyan

# 1. Vérifier les services
Write-Host "`n1. Vérification des services..." -ForegroundColor Yellow
$services = docker compose ps --format json | ConvertFrom-Json
$dbRunning = $services | Where-Object { $_.Service -eq "db" -and $_.State -eq "running" }
$apiRunning = $services | Where-Object { $_.Service -eq "api-geo" -and $_.State -eq "running" }

if (-not $dbRunning) {
    Write-Host "  ❌ Service db non démarré" -ForegroundColor Red
    exit 1
}
if (-not $apiRunning) {
    Write-Host "  ❌ Service api-geo non démarré" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Services OK" -ForegroundColor Green

# 2. Vérifier la base de données
Write-Host "`n2. Vérification de la base de données..." -ForegroundColor Yellow
$dbStats = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT 
  (SELECT COUNT(*) FROM mailles) AS nb_mailles,
  (SELECT COUNT(*) FROM sondages) AS nb_sondages,
  (SELECT COUNT(*) FROM essais) AS nb_essais;
" | Out-String
Write-Host "  $dbStats" -ForegroundColor White

# 3. Récupérer les mailles avec données via API
Write-Host "`n3. Récupération des mailles avec données..." -ForegroundColor Yellow
try {
    $fc = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
    $withData = $fc.features | Where-Object { $_.properties.has_data -eq $true }
    Write-Host "  ✓ $($withData.Count) mailles avec données trouvées" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Erreur API: $_" -ForegroundColor Red
    exit 1
}

# 4. Lister les mailles avec données
Write-Host "`n4. Liste des mailles avec données:" -ForegroundColor Yellow
$withData | ForEach-Object {
    $code = $_.properties.code
    $nSond = $_.properties.n_sondages
    $nEss = $_.properties.n_essais
    Write-Host "  • $code : $nSond sondages, $nEss essais" -ForegroundColor Cyan
}

# 5. Répartition par ville
Write-Host "`n5. Répartition par ville:" -ForegroundColor Yellow
$villeStats = docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT meta->>'city' AS ville, COUNT(*) AS nb_sondages 
FROM sondages 
GROUP BY ville 
ORDER BY nb_sondages DESC;
" | Out-String
Write-Host "$villeStats" -ForegroundColor White

# 6. Tester une maille spécifique
Write-Host "`n6. Test d'une maille spécifique..." -ForegroundColor Yellow
$testCode = $withData[0].properties.code
Write-Host "  Code testé: $testCode" -ForegroundColor Cyan

try {
    # GET /grid/{code}
    $grid = Invoke-RestMethod "http://127.0.0.1:8001/grid/$testCode"
    Write-Host "  ✓ GET /grid/$testCode OK" -ForegroundColor Green
    Write-Host "    - Sondages: $($grid.summary.n_sondages)" -ForegroundColor White
    Write-Host "    - Essais: $($grid.summary.n_essais)" -ForegroundColor White
    Write-Host "    - IDW (SPT_N): $($grid.stats.idw.value)" -ForegroundColor White

    # POST /grid/recompute/{code}
    $recomp = Invoke-RestMethod "http://127.0.0.1:8001/grid/recompute/$testCode" -Method POST
    Write-Host "  ✓ POST /grid/recompute/$testCode OK" -ForegroundColor Green
    Write-Host "    - IDW recalculé: $($recomp.stats.idw.value)" -ForegroundColor White

    # GET /grid/{code}/shape
    $shape = Invoke-RestMethod "http://127.0.0.1:8001/grid/$testCode/shape"
    Write-Host "  ✓ GET /grid/$testCode/shape OK" -ForegroundColor Green
    Write-Host "    - Type: $($shape.geometry.type)" -ForegroundColor White
} catch {
    Write-Host "  ❌ Erreur API: $_" -ForegroundColor Red
    exit 1
}

# 7. Recalculer toutes les mailles avec données
Write-Host "`n7. Recalcul IDW pour toutes les mailles avec données..." -ForegroundColor Yellow
$successCount = 0
$errorCount = 0

foreach ($feature in $withData) {
    $code = $feature.properties.code
    try {
        $result = Invoke-RestMethod "http://127.0.0.1:8001/grid/recompute/$code" -Method POST
        $idwValue = $result.stats.idw.value
        Write-Host "  ✓ $code : IDW = $idwValue" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "  ❌ $code : Erreur" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n  Résumé: $successCount succès, $errorCount erreurs" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })

# 8. Résumé final
Write-Host "`n=== Résumé final ===" -ForegroundColor Cyan
Write-Host "  Total mailles: $($fc.features.Count)" -ForegroundColor White
Write-Host "  Mailles avec données: $($withData.Count)" -ForegroundColor Green
Write-Host "  Taux de couverture: $([math]::Round($withData.Count / $fc.features.Count * 100, 2))%" -ForegroundColor Yellow

Write-Host "`n✓ Tests terminés avec succès!" -ForegroundColor Green
Write-Host "`nPour visualiser dans l'UI: http://127.0.0.1:8080" -ForegroundColor Cyan
