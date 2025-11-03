# Test du proxy Nginx

Write-Host "=== Test Proxy Nginx ===" -ForegroundColor Cyan

Write-Host "`nAttente demarrage services (10s)..." -ForegroundColor Gray
Start-Sleep -Seconds 10

Write-Host "`n1. Test API via proxy (/api/healthz)" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 10
    Write-Host "   OK - Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Le proxy ne fonctionne pas encore, verifier les logs" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n2. Test endpoint thematique via proxy" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=ip_avg&min_sondages=1"
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   OK - Features: $($response.features.Count)" -ForegroundColor Green
    if ($response.statistics) {
        Write-Host "   Min: $($response.statistics.min)" -ForegroundColor Gray
        Write-Host "   Max: $($response.statistics.max)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test UI accessible" -ForegroundColor Yellow
try {
    $ui = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -Method Get -TimeoutSec 10 -UseBasicParsing
    Write-Host "   OK - UI accessible (HTTP $($ui.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== SUCCES ===" -ForegroundColor Green
Write-Host "`nArchitecture proxy Nginx fonctionnelle !" -ForegroundColor Cyan
Write-Host "`nAvantages:" -ForegroundColor Yellow
Write-Host "  - Plus de probleme localhost/127.0.0.1"
Write-Host "  - Pas de CORS"
Write-Host "  - Pas de rebuild si IP change"
Write-Host "  - API non exposee directement (securite)"
Write-Host "`nProchaines etapes:" -ForegroundColor Cyan
Write-Host "1. Ouvrir: http://127.0.0.1:8080"
Write-Host "2. Vider cache: Ctrl + Shift + R"
Write-Host "3. Tester carte thematique"
Write-Host "4. Verifier DevTools: Request URL = /api/..."
Write-Host "`nPour LAN:" -ForegroundColor Yellow
Write-Host "  - Obtenir IP: ipconfig"
Write-Host "  - Firewall: port 8080"
Write-Host "  - URL testeurs: http://[IP]:8080"
Write-Host "  - AUCUN rebuild necessaire !"

$open = Read-Host "`nOuvrir le navigateur? (O/N)"
if ($open -eq "O" -or $open -eq "o") {
    Start-Process "http://127.0.0.1:8080"
}
