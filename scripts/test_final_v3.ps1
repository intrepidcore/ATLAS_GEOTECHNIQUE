Write-Host "=== Test Final v1.5.0.3 ===" -ForegroundColor Cyan

Start-Sleep -Seconds 5

Write-Host "`n1. Test parametre avec underscore" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&min_sondages=1"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   OK - Features: $($r.features.Count)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Test endpoint import/bulk" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/import/bulk" -Method Options -TimeoutSec 10
    Write-Host "   OK - OPTIONS repond: $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test proxy fonctionne" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 10
    Write-Host "   OK - Status: $($r.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTS TERMINES ===" -ForegroundColor Cyan
Write-Host "`nOuvrir: http://127.0.0.1:8080" -ForegroundColor Yellow
Write-Host "Vider cache: Ctrl + Shift + R" -ForegroundColor Yellow
Write-Host "Tester carte thematique + wizard import" -ForegroundColor Yellow
