# Test de l'API Atlas v1.5.0

Write-Host "🧪 Test de l'API Atlas Géotechnique" -ForegroundColor Cyan
Write-Host "=" * 60

# 1. Health check
Write-Host "`n1️⃣  Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/healthz" -Method Get
    Write-Host "✅ API OK: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

# 2. Test carte thématique - IP moyen
Write-Host "`n2️⃣  Test carte thématique (IP moyen)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=ip_avg&min_sondages=3" -Method Get
    Write-Host "✅ Données reçues:" -ForegroundColor Green
    Write-Host "   • Features: $($response.features.Count)"
    Write-Host "   • Min: $($response.statistics.min)"
    Write-Host "   • Max: $($response.statistics.max)"
    Write-Host "   • Moyenne: $($response.statistics.mean)"
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

# 3. Test avec alias (passant_80um_avg)
Write-Host "`n3️⃣  Test avec alias (passant_80um_avg)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=passant_80um_avg&min_sondages=3" -Method Get
    Write-Host "✅ Alias accepté - Features: $($response.features.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

# 4. Test VBS
Write-Host "`n4️⃣  Test VBS moyen..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/thematic/data?parameter=vbs_avg&min_sondages=3" -Method Get
    Write-Host "✅ VBS - Features: $($response.features.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host "`n" + ("=" * 60)
Write-Host "✅ Tests terminés !" -ForegroundColor Cyan
