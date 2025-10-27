# ============================================================================
# Atlas - Démarrage Rapide (Production Docker)
# ============================================================================
# Lance tous les services Docker (DB + API + UI)
# ✨ Architecture:
#    - Backend: Docker Compose (DB + API) - Port interne 8000
#    - Frontend: Nginx (build statique) - Port 8080
#    - Tout accessible via http://localhost:8080
# ============================================================================

param(
    [switch]$RebuildUI,
    [switch]$RebuildAPI,
    [switch]$Verbose
)

Write-Host "`n🚀 Démarrage Atlas (Production Docker)" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# Créer le dossier logs si nécessaire
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# ============================================================================
# 0. GESTION DES CONFLITS
# ============================================================================

Write-Host "`n🔍 Vérification des conflits..." -ForegroundColor Yellow

# Vérifier si des conteneurs Docker sont déjà en cours
$runningContainers = docker compose ps --services --filter "status=running" 2>$null
if ($runningContainers) {
    Write-Host "  ℹ️  Conteneurs déjà en cours: $($runningContainers -join ', ')" -ForegroundColor Cyan
    Write-Host "  ℹ️  Redémarrage des services..." -ForegroundColor Yellow
} else {
    Write-Host "  ℹ️  Aucun conteneur en cours" -ForegroundColor Gray
}

# ============================================================================
# 1. REBUILD SI DEMANDÉ
# ============================================================================

if ($RebuildAPI) {
    Write-Host "`n🔨 Rebuild de l'API demandé..." -ForegroundColor Yellow
    docker compose build api-geo --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors du build API" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ API rebuildée" -ForegroundColor Green
}

if ($RebuildUI) {
    Write-Host "`n🔨 Rebuild de l'UI demandé..." -ForegroundColor Yellow
    Push-Location ui
    npm run build
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors du build UI" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ UI rebuildée" -ForegroundColor Green
}

# ============================================================================
# 2. DÉMARRAGE DES SERVICES DOCKER
# ============================================================================

Write-Host "`n🐳 Démarrage de tous les services Docker..." -ForegroundColor Yellow
docker compose up -d

Write-Host "  ⏳ Attente du démarrage (20s)..." -ForegroundColor Gray
Start-Sleep -Seconds 20

# Vérifier le statut
Write-Host "`n📊 Statut des services:" -ForegroundColor Cyan
docker compose ps

# ============================================================================
# 3. DÉPLOIEMENT DU FRONTEND (si rebuild demandé)
# ============================================================================

if ($RebuildUI) {
    Write-Host "`n📦 Déploiement du frontend dans le conteneur..." -ForegroundColor Yellow
    
    # Copier le dist dans le conteneur
    docker exec atlas-ui rm -rf /usr/share/nginx/html/*
    docker cp ui/dist/. atlas-ui:/usr/share/nginx/html/
    
    Write-Host "  ✅ Frontend déployé" -ForegroundColor Green
}

# ============================================================================
# 4. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ ATLAS DÉMARRÉ (MODE PRODUCTION)" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs:" -ForegroundColor Cyan
Write-Host "  • Application : http://localhost:8080/" -ForegroundColor White
Write-Host "  • API Backend : http://localhost:8080/api/" -ForegroundColor Gray
Write-Host "  • Database    : localhost:5432 (Docker)" -ForegroundColor Gray

Write-Host "`n🌐 Ouverture du navigateur..." -ForegroundColor Green
Start-Sleep -Seconds 2
Start-Process "http://localhost:8080"

Write-Host "`n✨ Atlas est prêt !" -ForegroundColor Cyan

Write-Host "`n📋 Workflow de Développement:" -ForegroundColor Cyan
Write-Host "  • Modif backend (.rs)  : .\scripts\quick-start.ps1 -RebuildAPI" -ForegroundColor Gray
Write-Host "  • Modif frontend (.ts) : .\scripts\quick-start.ps1 -RebuildUI" -ForegroundColor Gray
Write-Host "  • Rebuild complet      : .\scripts\quick-start.ps1 -RebuildAPI -RebuildUI" -ForegroundColor Gray

Write-Host "`nℹ️  Architecture:" -ForegroundColor Yellow
Write-Host "  1. 🐳 PostgreSQL + PostGIS (DB)" -ForegroundColor Gray
Write-Host "  2. 🦀 API Rust (api-geo) - Port interne 8000" -ForegroundColor Gray
Write-Host "  3. 🌐 Nginx (UI) - Port 8080 (proxy vers API)" -ForegroundColor Gray

Write-Host "`n🔧 Commandes Utiles:" -ForegroundColor Yellow
Write-Host "  • Logs backend : docker compose logs -f api-geo" -ForegroundColor Gray
Write-Host "  • Logs UI      : docker compose logs -f ui" -ForegroundColor Gray
Write-Host "  • Arrêter tout : docker compose down" -ForegroundColor Gray
Write-Host "  • Redémarrer   : .\scripts\quick-start.ps1" -ForegroundColor Gray

Write-Host "`n💡 Mode Développement avec HMR:" -ForegroundColor Yellow
Write-Host "  • Pour le dev actif : .\scripts\quick-start-wizard-dev.ps1" -ForegroundColor Gray
Write-Host "  • Vite HMR sur port 5173 avec rechargement instantané" -ForegroundColor Gray

Write-Host "=" * 80 -ForegroundColor Gray
