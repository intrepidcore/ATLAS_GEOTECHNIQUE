# ============================================================================
# Test CORS Configuration
# ============================================================================
# Description: Teste la configuration CORS de l'API Atlas
# Usage: .\test-cors.ps1
# ============================================================================

param(
    [string]$ApiUrl = "http://127.0.0.1:8000",
    [string]$Origin = "http://localhost:8080"
)

Write-Host "🔍 Test de la configuration CORS" -ForegroundColor Cyan
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host "Origin: $Origin" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# Test 1: Requête OPTIONS (pré-vol)
# ============================================================================

Write-Host "📋 Test 1: Requête OPTIONS (pré-vol)" -ForegroundColor Yellow

try {
    $headers = @{
        "Origin" = $Origin
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "content-type"
    }
    
    $response = Invoke-WebRequest -Uri "$ApiUrl/coverage/mailles" `
        -Method OPTIONS `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    # Vérifier les headers CORS
    $corsHeaders = @(
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Credentials"
    )
    
    foreach ($header in $corsHeaders) {
        if ($response.Headers[$header]) {
            Write-Host "   $header : $($response.Headers[$header])" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $header : MANQUANT" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================================================
# Test 2: Requête GET réelle
# ============================================================================

Write-Host "📋 Test 2: Requête GET avec Origin" -ForegroundColor Yellow

try {
    $headers = @{
        "Origin" = $Origin
    }
    
    $response = Invoke-WebRequest -Uri "$ApiUrl/coverage/mailles" `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "   Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Access-Control-Allow-Origin: MANQUANT" -ForegroundColor Red
    }
    
    if ($response.Headers["Access-Control-Allow-Credentials"]) {
        Write-Host "   Access-Control-Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================================================
# Test 3: Test avec 127.0.0.1:8080
# ============================================================================

Write-Host "📋 Test 3: Requête avec Origin 127.0.0.1:8080" -ForegroundColor Yellow

try {
    $headers = @{
        "Origin" = "http://127.0.0.1:8080"
    }
    
    $response = Invoke-WebRequest -Uri "$ApiUrl/coverage/mailles" `
        -Method GET `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "   Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Access-Control-Allow-Origin: MANQUANT" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================================================
# Test 4: Healthcheck
# ============================================================================

Write-Host "📋 Test 4: Healthcheck" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/healthz" `
        -Method GET `
        -UseBasicParsing `
        -ErrorAction Stop
    
    $health = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Tests CORS terminés" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Commandes curl équivalentes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "# Test OPTIONS (pré-vol)" -ForegroundColor Gray
Write-Host "curl -i -X OPTIONS $ApiUrl/coverage/mailles \\" -ForegroundColor White
Write-Host "  -H 'Origin: $Origin' \\" -ForegroundColor White
Write-Host "  -H 'Access-Control-Request-Method: GET'" -ForegroundColor White
Write-Host ""
Write-Host "# Test GET" -ForegroundColor Gray
Write-Host "curl -i $ApiUrl/coverage/mailles \\" -ForegroundColor White
Write-Host "  -H 'Origin: $Origin'" -ForegroundColor White
