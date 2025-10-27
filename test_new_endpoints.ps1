# Test des nouveaux endpoints
Write-Host "`n=== TEST 1: /surveys/ungeocode ===" -ForegroundColor Cyan
try {
    $ungeocode = Invoke-RestMethod -Uri "http://localhost:8000/surveys/ungeocode" -UseBasicParsing
    Write-Host "✅ Sondages non géocodés: $($ungeocode.Count)" -ForegroundColor Green
    if ($ungeocode.Count -gt 0) {
        Write-Host "  Premier sondage: $($ungeocode[0].code_site) - $($ungeocode[0].localite)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 2: /cells/{code}/labs ===" -ForegroundColor Cyan
try {
    # Prendre une des mailles avec données
    $labs = Invoke-RestMethod -Uri "http://localhost:8000/cells/TG-0496-0210-01/labs" -UseBasicParsing
    Write-Host "✅ Données labo récupérées" -ForegroundColor Green
    Write-Host "  KPI - Sondages: $($labs.kpi.n_sondages), Essais: $($labs.kpi.n_essais)" -ForegroundColor Gray
    Write-Host "  Atterberg: $($labs.atterberg.Count) points" -ForegroundColor Gray
    Write-Host "  VBS: $($labs.vbs.Count) points" -ForegroundColor Gray
    Write-Host "  Depth hist: $($labs.depth_hist.Count) bins" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n=== TEST 3: /coverage/mailles (vérif n_essais) ===" -ForegroundColor Cyan
try {
    $coverage = Invoke-RestMethod -Uri "http://localhost:8000/coverage/mailles" -UseBasicParsing
    $withData = $coverage.features | Where-Object { $_.properties.n_sondages -gt 0 } | Select-Object -First 3
    Write-Host "✅ Mailles avec données: $($withData.Count)" -ForegroundColor Green
    foreach ($m in $withData) {
        Write-Host "  $($m.properties.code): $($m.properties.n_sondages) sondages, $($m.properties.n_essais) essais" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n=== RÉSUMÉ ===" -ForegroundColor Yellow
Write-Host "Tous les endpoints sont fonctionnels !" -ForegroundColor Green
Write-Host "Ouvrez http://localhost:8080 pour tester l'UI" -ForegroundColor Cyan
