Write-Host "=== Test API Direct ===" -ForegroundColor Cyan

Write-Host "`n1. Test avec min_sondages=1" -ForegroundColor Yellow
$url1 = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&min_sondages=1"
try {
    $r1 = Invoke-RestMethod -Uri $url1 -TimeoutSec 15
    Write-Host "   Features: $($r1.features.Count)" -ForegroundColor Cyan
    if ($r1.features.Count -gt 0) {
        Write-Host "   OK" -ForegroundColor Green
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Test SANS min_sondages" -ForegroundColor Yellow
$url2 = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg"
try {
    $r2 = Invoke-RestMethod -Uri $url2 -TimeoutSec 15
    Write-Host "   Features: $($r2.features.Count)" -ForegroundColor Cyan
    if ($r2.features.Count -gt 0) {
        Write-Host "   OK" -ForegroundColor Green
        $f = $r2.features[0]
        Write-Host "   Exemple - Valeur: $($f.properties.value), N: $($f.properties.n_sondages)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test avec ip_avg" -ForegroundColor Yellow
$url3 = "http://127.0.0.1:8080/api/thematic/data?parameter=ip_avg"
try {
    $r3 = Invoke-RestMethod -Uri $url3 -TimeoutSec 15
    Write-Host "   Features: $($r3.features.Count)" -ForegroundColor Cyan
    if ($r3.features.Count -gt 0) {
        Write-Host "   OK" -ForegroundColor Green
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Logs API (erreurs eventuelles)" -ForegroundColor Yellow
docker compose logs api-geo --tail=5 2>&1 | Select-String "ERROR|WARN|thematic"
