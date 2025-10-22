# Test de la solution finale

Write-Host "=== Test Solution 127.0.0.1 ===" -ForegroundColor Cyan

Write-Host "`n1. Test API Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/healthz" -TimeoutSec 10
    Write-Host "   OK - Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test Endpoint Thematique" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8001/thematic/data?parameter=ip_avg&min_sondages=3"
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   OK - Features: $($response.features.Count)" -ForegroundColor Green
    Write-Host "   Min: $($response.statistics.min)" -ForegroundColor Gray
    Write-Host "   Max: $($response.statistics.max)" -ForegroundColor Gray
    Write-Host "   Moyenne: $($response.statistics.mean)" -ForegroundColor Gray
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Test UI accessible" -ForegroundColor Yellow
try {
    $ui = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($ui.StatusCode -eq 200) {
        Write-Host "   OK - UI accessible (HTTP 200)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== TOUS LES TESTS PASSES ===" -ForegroundColor Green
Write-Host "`nProchaines etapes:" -ForegroundColor Cyan
Write-Host "1. Ouvrir dans le navigateur: http://127.0.0.1:8080"
Write-Host "2. Cliquer sur l'icone carte (bas droite)"
Write-Host "3. Selectionner: Categorie=Atterberg, Parametre=IP moyen"
Write-Host "4. Cliquer Appliquer"
Write-Host "5. Verifier que les mailles sont colorees en vert"
Write-Host "`nATTENTION: Utiliser 127.0.0.1 et NON localhost !" -ForegroundColor Yellow

$open = Read-Host "`nOuvrir le navigateur maintenant? (O/N)"
if ($open -eq "O" -or $open -eq "o") {
    Start-Process "http://127.0.0.1:8080"
    Write-Host "`nNavigateur ouvert. Testez la carte thematique !" -ForegroundColor Green
}
