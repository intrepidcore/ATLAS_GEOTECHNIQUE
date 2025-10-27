# ============================================================================
# Restart API with CORS Fix
# ============================================================================
# Description: Redémarre l'API avec la nouvelle configuration CORS
# Usage: .\restart-api.ps1
# ============================================================================

param(
    [switch]$Build,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

Write-Host "🔄 Redémarrage de l'API Atlas" -ForegroundColor Cyan
Write-Host ""

# Vérifier que docker compose est disponible
try {
    docker compose version | Out-Null
} catch {
    Write-Host "❌ Docker Compose non trouvé" -ForegroundColor Red
    Write-Host "   Installez Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Aller au répertoire atlas
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$atlasDir = Split-Path -Parent $scriptDir
Set-Location $atlasDir

Write-Host "📁 Répertoire: $atlasDir" -ForegroundColor Gray
Write-Host ""

# Arrêter l'API
Write-Host "⏹️  Arrêt de l'API..." -ForegroundColor Yellow
docker compose stop api-geo

# Rebuild si demandé
if ($Build) {
    Write-Host "🔨 Reconstruction de l'image..." -ForegroundColor Yellow
    docker compose build api-geo
}

# Redémarrer
Write-Host "▶️  Démarrage de l'API..." -ForegroundColor Yellow
docker compose up -d api-geo

# Attendre que l'API soit prête
Write-Host "⏳ Attente du démarrage..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Vérifier le healthcheck
$maxRetries = 10
$retryCount = 0
$apiReady = $false

while ($retryCount -lt $maxRetries -and -not $apiReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/healthz" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $apiReady = $true
            Write-Host "✅ API démarrée avec succès!" -ForegroundColor Green
        }
    } catch {
        $retryCount++
        Write-Host "   Tentative $retryCount/$maxRetries..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $apiReady) {
    Write-Host "❌ L'API n'a pas démarré correctement" -ForegroundColor Red
    Write-Host "   Vérifiez les logs: docker compose logs api-geo" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ API redémarrée avec succès" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Endpoints:" -ForegroundColor Yellow
Write-Host "   Health: http://127.0.0.1:8000/healthz" -ForegroundColor White
Write-Host "   Coverage: http://127.0.0.1:8000/coverage/mailles" -ForegroundColor White
Write-Host ""
Write-Host "🌐 UI: http://localhost:8080" -ForegroundColor Yellow
Write-Host ""

# Afficher les logs si demandé
if ($Logs) {
    Write-Host "📋 Logs de l'API:" -ForegroundColor Yellow
    Write-Host ""
    docker compose logs --tail=50 api-geo
    Write-Host ""
    Write-Host "💡 Pour suivre les logs en temps réel:" -ForegroundColor Yellow
    Write-Host "   docker compose logs -f api-geo" -ForegroundColor White
} else {
    Write-Host "💡 Pour voir les logs:" -ForegroundColor Yellow
    Write-Host "   docker compose logs api-geo" -ForegroundColor White
    Write-Host "   docker compose logs -f api-geo  # (temps réel)" -ForegroundColor White
}

Write-Host ""
Write-Host "🧪 Pour tester CORS:" -ForegroundColor Yellow
Write-Host "   .\scripts\test-cors.ps1" -ForegroundColor White
