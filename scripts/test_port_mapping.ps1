# test_port_mapping.ps1

Write-Host "=== Test Port Mapping Docker ===" -ForegroundColor Cyan

# Test 1: Depuis le conteneur
Write-Host "`n1. Test depuis le conteneur:" -ForegroundColor Yellow
$test1 = docker compose exec api-geo curl -sS http://localhost:8000/healthz 2>&1
Write-Host $test1

# Test 2: Port ouvert
Write-Host "`n2. Test port 8001 ouvert:" -ForegroundColor Yellow
$port = Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue
Write-Host "Port 8001: $($port.TcpTestSucceeded)"

# Test 3: HTTP depuis Windows (localhost)
Write-Host "`n3. Test HTTP localhost:8001:" -ForegroundColor Yellow
try {
    $r1 = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -TimeoutSec 5
    Write-Host "OK: $($r1.status)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: HTTP depuis Windows (127.0.0.1)
Write-Host "`n4. Test HTTP 127.0.0.1:8001:" -ForegroundColor Yellow
try {
    $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/healthz" -TimeoutSec 5
    Write-Host "OK: $($r2.status)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: IP du conteneur
Write-Host "`n5. IP du conteneur:" -ForegroundColor Yellow
$ip = docker inspect atlas-api-geo --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
Write-Host "IP: $ip"

if ($ip) {
    Write-Host "`n6. Test HTTP via IP conteneur:" -ForegroundColor Yellow
    try {
        $r3 = Invoke-RestMethod -Uri "http://${ip}:8000/healthz" -TimeoutSec 5
        Write-Host "OK: $($r3.status)" -ForegroundColor Green
    } catch {
        Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Résumé ===" -ForegroundColor Cyan
Write-Host "Si Test 1 OK mais Test 3/4 KO → Problème port mapping Docker"
Write-Host "Si Test 3 KO mais Test 4 OK → Utiliser 127.0.0.1 au lieu de localhost"
Write-Host "Si Test 6 OK → Docker fonctionne, problème de port forwarding"
Write-Host "`nSOLUTION RECOMMANDÉE:"
Write-Host "1. Redémarrer Docker Desktop"
Write-Host "2. Puis: docker compose down && docker compose up -d"
Write-Host "3. Ou utiliser 127.0.0.1 au lieu de localhost dans .env"
