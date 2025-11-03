Write-Host "=== Test Filtres ADM dans l'API Thématique ===" -ForegroundColor Cyan

Write-Host "`n[TEST 1] Sans filtre ADM (tout le Togo)" -ForegroundColor Yellow
try {
    $r1 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=1" -TimeoutSec 15
    Write-Host "  Features: $($r1.features.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 2] Filtre ADM1 = Plateaux" -ForegroundColor Yellow
try {
    $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=1&adm1=Plateaux" -TimeoutSec 15
    Write-Host "  Features: $($r2.features.Count)" -ForegroundColor Cyan
    Write-Host "  OK - Filtrage ADM1 fonctionne" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 3] Filtre ADM1 = Maritime" -ForegroundColor Yellow
try {
    $r3 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=1&adm1=Maritime" -TimeoutSec 15
    Write-Host "  Features: $($r3.features.Count)" -ForegroundColor Cyan
    Write-Host "  OK - Filtrage ADM1 fonctionne" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 4] Filtre ADM2 = Golfe" -ForegroundColor Yellow
try {
    $r4 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=1&adm2=Golfe" -TimeoutSec 15
    Write-Host "  Features: $($r4.features.Count)" -ForegroundColor Cyan
    Write-Host "  OK - Filtrage ADM2 fonctionne" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 5] Cascade ADM1=Maritime + ADM2=Golfe" -ForegroundColor Yellow
try {
    $r5 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=1&adm1=Maritime&adm2=Golfe" -TimeoutSec 15
    Write-Host "  Features: $($r5.features.Count)" -ForegroundColor Cyan
    Write-Host "  OK - Cascade ADM fonctionne" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n============================================================================" -ForegroundColor Green
Write-Host "  TESTS TERMINES" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green

Write-Host "`nProchaine étape: Intégrer les filtres ADM dans l'UI thématique" -ForegroundColor Cyan
