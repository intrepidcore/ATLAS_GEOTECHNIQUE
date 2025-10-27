# Test de l'API
Write-Host "🧪 Test de l'API..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/healthz" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✅ API Status: $($content.status)" -ForegroundColor Green
    
    # Test coverage/mailles
    $coverage = Invoke-WebRequest -Uri "http://127.0.0.1:8000/coverage/mailles" -UseBasicParsing
    $coverageData = $coverage.Content | ConvertFrom-Json
    Write-Host "✅ Mailles: $($coverageData.count) disponibles" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host "Vérifiez les logs: docker compose logs api-geo --tail=20" -ForegroundColor Yellow
}
