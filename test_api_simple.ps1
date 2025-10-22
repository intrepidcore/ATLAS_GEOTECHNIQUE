# Test API Simple - Sans caractères spéciaux

Write-Host "Test 1: API Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -TimeoutSec 10
    Write-Host "OK - Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest 2: Endpoint Thematique" -ForegroundColor Yellow
try {
    $url = "http://localhost:8001/thematic/data?parameter=ip_avg&min_sondages=3"
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "OK - Features: $($response.features.Count)" -ForegroundColor Green
    Write-Host "Min: $($response.statistics.min)" -ForegroundColor Gray
    Write-Host "Max: $($response.statistics.max)" -ForegroundColor Gray
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest 3: Port 8001 accessible" -ForegroundColor Yellow
$test = Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) {
    Write-Host "OK - Port 8001 ouvert" -ForegroundColor Green
} else {
    Write-Host "ERREUR - Port 8001 ferme" -ForegroundColor Red
}
