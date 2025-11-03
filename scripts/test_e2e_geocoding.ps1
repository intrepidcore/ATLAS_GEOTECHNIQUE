# ============================================================================
# TESTS E2E GÉOCODAGE
# ============================================================================

$API_URL = "http://localhost:8000"

Write-Host "="*80 -ForegroundColor Cyan
Write-Host "TESTS E2E GÉOCODAGE" -ForegroundColor Cyan
Write-Host "="*80 -ForegroundColor Cyan

$allPassed = $true

# Test 1: Stats accessibles
Write-Host "`n📊 Test 1: GET /geocode/stats" -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$API_URL/geocode/stats" -Method GET
    if ($stats.total -ge 0) {
        Write-Host "  ✅ PASS - Stats récupérées" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL - Stats invalides" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Test 2: Liste suggestions
Write-Host "`n📋 Test 2: GET /geocode/suggestions" -ForegroundColor Yellow
try {
    $suggestions = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions" -Method GET
    if ($suggestions -is [Array]) {
        Write-Host "  ✅ PASS - $($suggestions.Count) suggestions" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL - Format invalide" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Test 3: Filtres
Write-Host "`n🔍 Test 3: Filtres (status, limit)" -ForegroundColor Yellow
try {
    $pending = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions?status=pending&limit=5" -Method GET
    Write-Host "  ✅ PASS - Filtres fonctionnels" -ForegroundColor Green
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Test 4: Accept/Reject (si suggestions pending)
Write-Host "`n✅ Test 4: Accept/Reject" -ForegroundColor Yellow
try {
    $pending = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions?status=pending&limit=1" -Method GET
    if ($pending.Count -gt 0) {
        $id = $pending[0].id
        
        # Accept
        $result = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions/$id/accept" -Method POST
        if ($result.status -eq 'accepted') {
            Write-Host "  ✅ PASS - Accept fonctionnel" -ForegroundColor Green
            
            # Reject (remettre en pending)
            $result = Invoke-RestMethod -Uri "$API_URL/geocode/suggestions/$id/reject" -Method POST
            if ($result.status -eq 'rejected') {
                Write-Host "  ✅ PASS - Reject fonctionnel" -ForegroundColor Green
            } else {
                Write-Host "  ❌ FAIL - Reject échoué" -ForegroundColor Red
                $allPassed = $false
            }
        } else {
            Write-Host "  ❌ FAIL - Accept échoué" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "  ⊘ SKIP - Aucune suggestion pending" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Test 5: Apply accepted
Write-Host "`n🚀 Test 5: POST /geocode/apply-accepted" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$API_URL/geocode/apply-accepted" -Method POST
    if ($result.PSObject.Properties['applied_count'] -and $result.PSObject.Properties['refreshed']) {
        Write-Host "  ✅ PASS - Apply fonctionnel (applied: $($result.applied_count))" -ForegroundColor Green
    } else {
        Write-Host "  ❌ FAIL - Format réponse invalide" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Test 6: Performance (temps de réponse)
Write-Host "`n⚡ Test 6: Performance" -ForegroundColor Yellow
$start = Get-Date
try {
    $stats = Invoke-RestMethod -Uri "$API_URL/geocode/stats" -Method GET
    $duration = (Get-Date) - $start
    if ($duration.TotalMilliseconds -lt 500) {
        Write-Host "  ✅ PASS - Temps de réponse: $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  WARN - Temps de réponse élevé: $($duration.TotalMilliseconds)ms" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ FAIL - $_" -ForegroundColor Red
    $allPassed = $false
}

# Résumé
Write-Host "`n="*80 -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ TOUS LES TESTS PASSÉS" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ CERTAINS TESTS ONT ÉCHOUÉ" -ForegroundColor Red
    exit 1
}
