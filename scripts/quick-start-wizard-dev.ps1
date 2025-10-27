# ============================================================================
# Atlas - Mode Développement Wizard (Vite HMR)
# ============================================================================
# Frontend en mode dev (HMR) + Backend Docker
# Idéal pour développer le wizard avec rechargement instantané
# ============================================================================

Write-Host "`n🚀 Démarrage Atlas - Mode Dev Wizard" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. BACKEND DOCKER
# ============================================================================

Write-Host "`n🐳 Démarrage du backend Docker..." -ForegroundColor Yellow

# Arrêter les conteneurs existants
docker compose down 2>&1 | Out-Null

# Démarrer DB + API
Write-Host "  🚀 Lancement de docker compose up..." -ForegroundColor Cyan
docker compose up -d db api-geo

Write-Host "  ⏳ Attente du démarrage (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

$apiHealthy = docker compose ps api-geo --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($apiHealthy) {
    Write-Host "  ✅ Backend Docker opérationnel" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Backend en cours de démarrage..." -ForegroundColor Yellow
}

# ============================================================================
# 2. FRONTEND VITE (Mode Dev avec HMR)
# ============================================================================

Write-Host "`n🎨 Démarrage du frontend Vite (HMR)..." -ForegroundColor Yellow

# Vérifier node_modules
if (-not (Test-Path "ui\node_modules")) {
    Write-Host "  📦 Installation des dépendances npm..." -ForegroundColor Cyan
    Push-Location ui
    npm install
    Pop-Location
}

# Démarrer Vite dans une nouvelle fenêtre
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    @"
Write-Host '🎨 Frontend Atlas - Mode Développement' -ForegroundColor Cyan
Write-Host '=' * 80 -ForegroundColor Gray
Write-Host 'ℹ️  Hot Module Replacement (HMR): Activé' -ForegroundColor Yellow
Write-Host 'ℹ️  Modifications .ts/.html/.css rechargées automatiquement' -ForegroundColor Yellow
Write-Host 'ℹ️  Backend API: http://localhost:8080' -ForegroundColor Cyan
Write-Host '=' * 80 -ForegroundColor Gray
Write-Host ''
cd 'C:\PROJET_ATLAS_MASTER\atlas\ui'
npm run dev
"@
) -WindowStyle Normal

Write-Host "  ✅ Frontend Vite en cours de démarrage..." -ForegroundColor Green
Start-Sleep -Seconds 5

# ============================================================================
# 3. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ MODE DÉVELOPPEMENT WIZARD ACTIVÉ" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs:" -ForegroundColor Cyan
Write-Host "  • Frontend Dev : http://localhost:5173/ (Vite HMR)" -ForegroundColor White
Write-Host "  • Backend API  : http://localhost:8080/ (Docker)" -ForegroundColor White
Write-Host "  • Database     : localhost:5432 (Docker)" -ForegroundColor Gray

Write-Host "`n✨ Workflow de Développement:" -ForegroundColor Cyan
Write-Host "  1. Modifiez les fichiers TypeScript dans ui/src/" -ForegroundColor Gray
Write-Host "  2. Le navigateur se recharge automatiquement (HMR)" -ForegroundColor Green
Write-Host "  3. Les logs [WZ] apparaissent dans la console navigateur" -ForegroundColor Gray
Write-Host "  4. Testez l'import XLSX en temps réel" -ForegroundColor Gray

Write-Host "`n🔧 Commandes Utiles:" -ForegroundColor Yellow
Write-Host "  • Logs backend : docker compose logs -f api-geo" -ForegroundColor Gray
Write-Host "  • Rebuild backend : docker compose build api-geo --no-cache" -ForegroundColor Gray
Write-Host "  • Arrêter : docker compose down + fermez la fenêtre Vite" -ForegroundColor Gray

Write-Host "`n⚠️  Pour passer en mode production:" -ForegroundColor Yellow
Write-Host "  1. Fermez la fenêtre Vite (Ctrl+C)" -ForegroundColor Gray
Write-Host "  2. cd ui && npm run build" -ForegroundColor Gray
Write-Host "  3. powershell -File ..\deploy_dist.ps1" -ForegroundColor Gray

Write-Host "`n🌐 Ouverture du navigateur..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "=" * 80 -ForegroundColor Gray
