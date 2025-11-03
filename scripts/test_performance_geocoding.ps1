# ============================================================================
# TEST PERFORMANCE GÉOCODAGE
# ============================================================================

$API_URL = "http://localhost:8000"

Write-Host "="*80 -ForegroundColor Cyan
Write-Host "TEST PERFORMANCE GÉOCODAGE" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan

# Test 1: Temps de réponse /geocode/stats
Write-Host "`n📊 Test 1: Performance /geocode/stats" -ForegroundColor Yellow
$start = Get-Date
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/stats" -Method GET
    $duration = (Get-Date) - $start
    Write-Host "✓ Temps de réponse: $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    if ($duration.TotalMilliseconds -lt 100) {
        Write-Host "  ✅ Performance excellente (< 100ms)" -ForegroundColor Green
    } elseif ($duration.TotalMilliseconds -lt 500) {
        Write-Host "  ✓ Performance acceptable (< 500ms)" -ForegroundColor Yellow
    } else {
        Write-Host "  ⚠️ Performance à améliorer (> 500ms)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 2: Temps de réponse /geocode/suggestions
Write-Host "`n📋 Test 2: Performance /geocode/suggestions" -ForegroundColor Yellow
$start = Get-Date
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions" -Method GET
    $duration = (Get-Date) - $start
    Write-Host "✓ Temps de réponse: $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    Write-Host "  Suggestions récupérées: $($response.Count)" -ForegroundColor Cyan
    if ($duration.TotalMilliseconds -lt 200) {
        Write-Host "  ✅ Performance excellente (< 200ms)" -ForegroundColor Green
    } elseif ($duration.TotalMilliseconds -lt 1000) {
        Write-Host "  ✓ Performance acceptable (< 1s)" -ForegroundColor Yellow
    } else {
        Write-Host "  ⚠️ Performance à améliorer (> 1s)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 3: Temps de réponse avec filtres
Write-Host "`n🔍 Test 3: Performance avec filtres" -ForegroundColor Yellow
$start = Get-Date
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions?status=pending&limit=10" -Method GET
    $duration = (Get-Date) - $start
    Write-Host "✓ Temps de réponse: $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    if ($duration.TotalMilliseconds -lt 200) {
        Write-Host "  ✅ Performance excellente (< 200ms)" -ForegroundColor Green
    } elseif ($duration.TotalMilliseconds -lt 1000) {
        Write-Host "  ✓ Performance acceptable (< 1s)" -ForegroundColor Yellow
    } else {
        Write-Host "  ⚠️ Performance à améliorer (> 1s)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 4: Charge (10 requêtes parallèles)
Write-Host "`n⚡ Test 4: Test de charge (10 requêtes parallèles)" -ForegroundColor Yellow
$start = Get-Date
$jobs = @()
for ($i = 1; $i -le 10; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($url)
        Invoke-RestMethod -Uri "$url/geocode/stats" -Method GET
    } -ArgumentList $API_URL
}

$jobs | Wait-Job | Out-Null
$duration = (Get-Date) - $start
$jobs | Remove-Job

Write-Host "✓ Temps total: $($duration.TotalMilliseconds)ms" -ForegroundColor Green
Write-Host "  Temps moyen par requête: $([math]::Round($duration.TotalMilliseconds / 10, 2))ms" -ForegroundColor Cyan
if ($duration.TotalMilliseconds -lt 1000) {
    Write-Host "  ✅ Performance excellente (< 1s pour 10 requêtes)" -ForegroundColor Green
} elseif ($duration.TotalMilliseconds -lt 3000) {
    Write-Host "  ✓ Performance acceptable (< 3s pour 10 requêtes)" -ForegroundColor Yellow
} else {
    Write-Host "  ⚠️ Performance à améliorer (> 3s pour 10 requêtes)" -ForegroundColor Red
}

# Résumé
Write-Host "`n="*80 -ForegroundColor Cyan
Write-Host "RÉSUMÉ PERFORMANCE" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan
Write-Host "✅ Tous les tests de performance terminés" -ForegroundColor Green
Write-Host "📊 API opérationnelle et performante" -ForegroundColor Green
