# ============================================================================
# Atlas v1.4.0 - Démarrage Rapide avec Docker
# ============================================================================
# Ce script lance le backend (Docker) et frontend (Vite) avec gestion des conflits
# ✨ Architecture:
#    - Backend: Docker Compose (DB + API) - Port 8001
#    - Frontend: Vite avec HMR - Port 5173
# ============================================================================

param(
    [switch]$CleanBuild,
    [switch]$Verbose,
    [switch]$RebuildDocker
)

Write-Host "`n🚀 Démarrage Atlas v1.4.0 (Docker Edition)" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# Créer le dossier logs si nécessaire
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# ============================================================================
# 0. GESTION DES CONFLITS
# ============================================================================

Write-Host "`n🔍 Vérification des conflits de ports..." -ForegroundColor Yellow

# Vérifier si cargo run est en cours (port 8000)
$cargoProcess = Get-Process -Name "api-geo" -ErrorAction SilentlyContinue
if ($cargoProcess) {
    Write-Host "  ⚠️  Processus api-geo.exe détecté (Cargo local)" -ForegroundColor Yellow
    Write-Host "  🛑 Arrêt du processus pour éviter les conflits..." -ForegroundColor Cyan
    Stop-Process -Name "api-geo" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  ✅ Processus arrêté" -ForegroundColor Green
}

# Vérifier si des conteneurs Docker sont déjà en cours
$runningContainers = docker compose ps --services --filter "status=running" 2>$null
if ($runningContainers) {
    Write-Host "  ℹ️  Conteneurs Docker déjà en cours: $($runningContainers -join ', ')" -ForegroundColor Cyan
    Write-Host "  🔄 Arrêt des conteneurs existants..." -ForegroundColor Yellow
    docker compose down 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "  ✅ Conteneurs arrêtés" -ForegroundColor Green
}

# ============================================================================
# 1. BACKEND DOCKER (DB + API)
# ============================================================================

Write-Host "`n🐳 Démarrage du backend Docker..." -ForegroundColor Yellow

# Vérifier si l'image existe
$imageExists = docker images atlas-api-geo -q 2>$null
$needsBuild = $false

if (-not $imageExists) {
    Write-Host "  ℹ️  Image Docker non trouvée - Build initial nécessaire" -ForegroundColor Cyan
    $needsBuild = $true
} elseif ($RebuildDocker -or $CleanBuild) {
    Write-Host "  ℹ️  Rebuild demandé explicitement" -ForegroundColor Cyan
    $needsBuild = $true
}

# Build si nécessaire
if ($needsBuild) {
    Write-Host "  🔨 Build de l'image Docker (peut prendre 2-3 minutes)..." -ForegroundColor Cyan
    docker compose build api-geo 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Image Docker construite avec succès" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Erreur lors du build Docker" -ForegroundColor Red
        Write-Host "  💡 Vérifiez les logs ci-dessus ou lancez: docker compose build api-geo" -ForegroundColor Yellow
        exit 1
    }
}

# Démarrer les services Docker
Write-Host "  🚀 Lancement de docker compose up..." -ForegroundColor Cyan
docker compose up -d db api-geo 2>&1 | Out-Null

Write-Host "  ⏳ Attente du démarrage des services (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Vérifier que les services sont bien démarrés
$apiHealthy = docker compose ps api-geo --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($apiHealthy) {
    Write-Host "  ✅ Backend Docker opérationnel (Port 8001)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Backend en cours de démarrage... (vérifiez avec 'docker compose logs api-geo')" -ForegroundColor Yellow
}

# ============================================================================
# 2. FRONTEND (Vite avec HMR)
# ============================================================================

Write-Host "`n🎨 Démarrage du frontend Vite..." -ForegroundColor Yellow

# Vérifier si node_modules existe
$nodeModulesPath = "ui\node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  ℹ️  node_modules non trouvé - Installation des dépendances..." -ForegroundColor Cyan
    Push-Location ui
    npm install 2>&1 | Out-Null
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Dépendances npm installées" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Erreur lors de npm install - continuons quand même..." -ForegroundColor Yellow
    }
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    @"
Write-Host '🎨 Frontend Atlas v1.4.0' -ForegroundColor Cyan
Write-Host '=' * 80 -ForegroundColor Gray
Write-Host 'ℹ️  Hot Module Replacement (HMR): Activé' -ForegroundColor Yellow
Write-Host 'ℹ️  Les modifications .ts/.html/.css sont rechargées automatiquement' -ForegroundColor Yellow
Write-Host 'ℹ️  Backend API: http://localhost:8001' -ForegroundColor Cyan
Write-Host '=' * 80 -ForegroundColor Gray
Write-Host ''
cd 'c:\PROJET_ATLAS_MASTER\atlas\ui'
npm run dev
"@
) -WindowStyle Normal

Write-Host "  ✅ Frontend en cours de démarrage (fenêtre séparée)..." -ForegroundColor Green
Write-Host "  ⏳ Attente du serveur Vite (10s)..." -ForegroundColor Gray
Write-Host "  💡 Astuce: Vite recharge automatiquement les modifications (HMR)" -ForegroundColor Cyan

Start-Sleep -Seconds 10

# ============================================================================
# 3. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ ENVIRONNEMENT DÉMARRÉ (DOCKER)" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs:" -ForegroundColor Cyan
Write-Host "  • Frontend : http://localhost:5173/" -ForegroundColor White
Write-Host "  • Backend  : http://localhost:8001/ (Docker)" -ForegroundColor White
Write-Host "  • Database : localhost:5432 (Docker)" -ForegroundColor Gray

Write-Host "`n🌐 Ouverture du navigateur..." -ForegroundColor Green
Start-Sleep -Seconds 3

# Essayer le port 5173 puis 5174
try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    Start-Process "http://localhost:5173"
} catch {
    Start-Process "http://localhost:5174"
}

Write-Host "`n✨ Atlas v1.4.0 est prêt !" -ForegroundColor Cyan

Write-Host "`n📋 Workflow de Développement:" -ForegroundColor Cyan
Write-Host "  ✅ Modifiez les fichiers .rs (backend) → Rebuild Docker: docker compose build api-geo" -ForegroundColor Gray
Write-Host "  ✅ Modifiez les fichiers .ts/.html/.css (frontend) → HMR instantané" -ForegroundColor Gray
Write-Host "  ✅ Frontend: Hot reload automatique" -ForegroundColor Green
Write-Host "  ⚠️  Backend: Rebuild manuel nécessaire (Docker)" -ForegroundColor Yellow

Write-Host "`nℹ️  Architecture:" -ForegroundColor Yellow
Write-Host "  1. 🐳 Backend Docker (DB + API Rust) - Port 8001" -ForegroundColor Gray
Write-Host "  2. 🎨 Frontend Vite (fenêtre PowerShell) - Port 5173" -ForegroundColor Gray

Write-Host "`n🔧 Commandes Utiles:" -ForegroundColor Yellow
Write-Host "  • Rebuild Docker : .\quick-start.ps1 -RebuildDocker" -ForegroundColor Gray
Write-Host "  • Voir logs backend : docker compose logs -f api-geo" -ForegroundColor Gray
Write-Host "  • Arrêter tout : docker compose down + fermez la fenêtre frontend" -ForegroundColor Gray
Write-Host "  • Rebuild après modif .rs : docker compose build api-geo && docker compose up -d api-geo" -ForegroundColor Gray

Write-Host "`n⚠️  Pour arrêter:" -ForegroundColor Yellow
Write-Host "  • Frontend: Fermez la fenêtre PowerShell ou Ctrl+C" -ForegroundColor Gray
Write-Host "  • Backend: docker compose down" -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Gray
