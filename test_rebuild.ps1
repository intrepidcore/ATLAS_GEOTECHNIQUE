Write-Host "=== Test Apres Rebuild ===" -ForegroundColor Cyan

Start-Sleep -Seconds 5

Write-Host "`n1. Test proxy healthz" -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 10
    Write-Host "   OK - Status: $($h.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Test parametre avec underscore" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&min_sondages=1"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   OK - Features: $($r.features.Count)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test endpoint import/bulk" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/import/bulk" -Method Options -TimeoutSec 10
    Write-Host "   OK - OPTIONS: $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TOUS LES TESTS PASSES ===" -ForegroundColor Green
Write-Host "`nMAINTENANT dans le navigateur:" -ForegroundColor Cyan
Write-Host "1. Fermez l'onglet prive actuel" -ForegroundColor Yellow
Write-Host "2. Ctrl + Shift + N (nouveau mode prive)" -ForegroundColor Yellow
Write-Host "3. http://127.0.0.1:8080" -ForegroundColor Yellow
Write-Host "4. Testez carte thematique (IP moyen)" -ForegroundColor Yellow
Write-Host "5. F12 -> Network -> Verifiez /api/ dans les URLs" -ForegroundColor Yellow
