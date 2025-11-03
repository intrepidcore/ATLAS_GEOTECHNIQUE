# ============================================================================
# TEST ENDPOINTS GÉOCODAGE API
# ============================================================================

$API_URL = "http://localhost:8000"

Write-Host "="*80 -ForegroundColor Cyan
Write-Host "TEST ENDPOINTS GÉOCODAGE" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan

# Test 1: GET /geocode/stats
Write-Host "`n📊 Test 1: GET /geocode/stats" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/stats" -Method GET
    Write-Host "✓ Stats récupérées:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 2: GET /geocode/suggestions (tous)
Write-Host "`n📋 Test 2: GET /geocode/suggestions" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions" -Method GET
    Write-Host "✓ $($response.Count) suggestions récupérées" -ForegroundColor Green
    $response | Select-Object -First 2 | ConvertTo-Json
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 3: GET /geocode/suggestions?status=pending
Write-Host "`n⚠️  Test 3: GET /geocode/suggestions?status=pending" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions?status=pending" -Method GET
    Write-Host "✓ $($response.Count) suggestions pending" -ForegroundColor Green
    $response | Select-Object -First 1 | ConvertTo-Json
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 4: GET /geocode/suggestions?status=accepted
Write-Host "`n✅ Test 4: GET /geocode/suggestions?status=accepted" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions?status=accepted" -Method GET
    Write-Host "✓ $($response.Count) suggestions accepted" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

# Test 5: POST /geocode/apply-accepted (DRY RUN - vérifier d'abord)
Write-Host "`n🚀 Test 5: POST /geocode/apply-accepted" -ForegroundColor Yellow
Write-Host "⚠️  Voulez-vous appliquer les suggestions accepted? (y/N)" -ForegroundColor Yellow
$confirm = Read-Host
if ($confirm -eq 'y') {
    try {
        $response = Invoke-RestMethod -Uri "$API_URL/geocode/apply-accepted" -Method POST
        Write-Host "✓ Appliqué:" -ForegroundColor Green
        $response | ConvertTo-Json
    } catch {
        Write-Host "✗ Erreur: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⊘ Test 5 ignoré" -ForegroundColor Gray
}

Write-Host "`n="*80 -ForegroundColor Cyan
Write-Host "TESTS TERMINÉS" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan
