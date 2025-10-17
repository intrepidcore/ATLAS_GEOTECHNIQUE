#!/usr/bin/env pwsh
# Déploiement ATLAS_GEOTECHNIQUE v1.0.0

$ErrorActionPreference = "Stop"

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   ATLAS_GEOTECHNIQUE v1.0.0 - Déploiement complet        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. Rebuild ETL
Write-Host "1. Rebuild ETL..." -ForegroundColor Yellow
docker compose build etl
Write-Host "  ✓ ETL rebuilt" -ForegroundColor Green

# 2. Rebuild API
Write-Host "`n2. Rebuild API..." -ForegroundColor Yellow
docker compose build api-geo
Write-Host "  ✓ API rebuilt" -ForegroundColor Green

# 3. Rebuild UI
Write-Host "`n3. Rebuild UI..." -ForegroundColor Yellow
docker compose build ui
Write-Host "  ✓ UI rebuilt" -ForegroundColor Green

# 4. Restart all services
Write-Host "`n4. Restart all services..." -ForegroundColor Yellow
docker compose down
docker compose up -d
Start-Sleep -Seconds 10
Write-Host "  ✓ Services started" -ForegroundColor Green

# 5. Load Maritime dataset (300 sondages)
Write-Host "`n5. Loading Maritime dataset (300 sondages)..." -ForegroundColor Yellow
docker compose run --rm etl etl load-maritime-dataset --truncate
Write-Host "  ✓ Dataset loaded" -ForegroundColor Green

# 6. Verify deployment
Write-Host "`n6. Verification..." -ForegroundColor Yellow

# Check services
$services = docker compose ps --format json | ConvertFrom-Json
$dbRunning = $services | Where-Object { $_.Service -eq "db" -and $_.State -eq "running" }
$apiRunning = $services | Where-Object { $_.Service -eq "api-geo" -and $_.State -eq "running" }
$uiRunning = $services | Where-Object { $_.Service -eq "ui" -and $_.State -eq "running" }

if (-not $dbRunning) {
    Write-Host "  ❌ DB not running" -ForegroundColor Red
    exit 1
}
if (-not $apiRunning) {
    Write-Host "  ❌ API not running" -ForegroundColor Red
    exit 1
}
if (-not $uiRunning) {
    Write-Host "  ❌ UI not running" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ All services running" -ForegroundColor Green

# Check API health
try {
    $health = Invoke-RestMethod http://127.0.0.1:8001/healthz
    if ($health.status -eq "ok") {
        Write-Host "  ✓ API health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ API health check failed" -ForegroundColor Red
    exit 1
}

# Check data
try {
    $fc = Invoke-RestMethod http://127.0.0.1:8001/coverage/mailles
    $withData = $fc.features | Where-Object { $_.properties.has_data -eq $true }
    Write-Host "  ✓ Grid loaded: $($fc.features.Count) mailles ($($withData.Count) with data)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to load grid data" -ForegroundColor Red
    exit 1
}

# 7. Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✓ ATLAS_GEOTECHNIQUE v1.0.0 déployé avec succès!       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  • UI:  http://127.0.0.1:8080" -ForegroundColor White
Write-Host "  • API: http://127.0.0.1:8001" -ForegroundColor White

Write-Host "`nNouvelles fonctionnalités v1.0.0:" -ForegroundColor Cyan
Write-Host "  • 300 sondages fictifs dans la région Maritime" -ForegroundColor White
Write-Host "  • Filtres multi-niveaux (région, préfecture, commune)" -ForegroundColor White
Write-Host "  • Filtres par données (avec/sans, min sondages)" -ForegroundColor White
Write-Host "  • Statistiques dynamiques filtrées" -ForegroundColor White
Write-Host "  • Export multi-format (GeoJSON, Markdown, PDF)" -ForegroundColor White
Write-Host "  • Export complet (tous formats)" -ForegroundColor White
Write-Host "  • Interface professionnelle optimisée" -ForegroundColor White

Write-Host "`nOuvrez http://127.0.0.1:8080 pour commencer!" -ForegroundColor Yellow
Start-Process "http://127.0.0.1:8080"
