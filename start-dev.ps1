# ============================================================================
# Atlas Géotechnique du Togo - Script de Démarrage v1.3.0
# ============================================================================
# Description: Lance l'environnement de développement complet
# - Base de données PostgreSQL + PostGIS
# - Backend API Rust (Axum)
# - Frontend UI TypeScript (Vite)
# ============================================================================

param(
    [switch]$SkipDbCheck,
    [switch]$SkipMigrations,
    [switch]$Verbose,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Couleurs et symboles
$symbols = @{
    Success = "✅"
    Error = "❌"
    Warning = "⚠️"
    Info = "ℹ️"
    Rocket = "🚀"
    Database = "📊"
    Backend = "🔥"
    Frontend = "🎨"
    Browser = "🌐"
    Logs = "📜"
    Stop = "🛑"
}

Write-Host "`n$($symbols.Rocket) Atlas Géotechnique v1.3.0 - Démarrage Développement" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. VÉRIFICATIONS PRÉALABLES
# ============================================================================

Write-Host "`n$($symbols.Info) Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier Rust
try {
    $rustVersion = cargo --version 2>&1
    Write-Host "  $($symbols.Success) Rust: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "  $($symbols.Error) Rust non trouvé. Installer depuis https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# Vérifier Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  $($symbols.Success) Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  $($symbols.Error) Node.js non trouvé. Installer depuis https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Vérifier Docker (optionnel)
if (-not $SkipDbCheck) {
    try {
        $dockerVersion = docker --version 2>&1
        Write-Host "  $($symbols.Success) Docker: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "  $($symbols.Warning) Docker non trouvé. Assurez-vous que PostgreSQL est installé localement." -ForegroundColor Yellow
    }
}

# ============================================================================
# 2. BASE DE DONNÉES
# ============================================================================

if (-not $SkipDbCheck) {
    Write-Host "`n$($symbols.Database) Vérification de la base de données..." -ForegroundColor Yellow
    
    # Vérifier si Docker est utilisé
    $dbRunning = docker ps --filter "name=atlas-db" --filter "status=running" --format "{{.Names}}" 2>$null
    
    if ($dbRunning) {
        Write-Host "  $($symbols.Success) Base de données Docker en cours d'exécution" -ForegroundColor Green
    } else {
        Write-Host "  $($symbols.Warning) Base de données Docker non détectée" -ForegroundColor Yellow
        
        # Vérifier PostgreSQL local
        try {
            $pgVersion = psql --version 2>&1
            Write-Host "  $($symbols.Info) PostgreSQL local détecté: $pgVersion" -ForegroundColor Cyan
        } catch {
            Write-Host "  $($symbols.Error) Aucune base de données trouvée" -ForegroundColor Red
            Write-Host "  Options:" -ForegroundColor Yellow
            Write-Host "    1. Lancer Docker: docker compose up db -d" -ForegroundColor Gray
            Write-Host "    2. Installer PostgreSQL localement" -ForegroundColor Gray
            Write-Host "    3. Utiliser -SkipDbCheck pour ignorer" -ForegroundColor Gray
            exit 1
        }
    }
    
    # Appliquer les migrations si nécessaire
    if (-not $SkipMigrations) {
        Write-Host "`n  $($symbols.Info) Vérification des migrations..." -ForegroundColor Cyan
        
        if (Test-Path "db/migrations") {
            $migrations = Get-ChildItem "db/migrations" -Filter "*.sql" | Sort-Object Name
            Write-Host "    Migrations disponibles: $($migrations.Count)" -ForegroundColor Gray
            
            # TODO: Vérifier quelles migrations ont été appliquées
            Write-Host "    $($symbols.Warning) Assurez-vous que les migrations sont à jour" -ForegroundColor Yellow
            Write-Host "    Commande: psql -d atlas_db -f db/migrations/004_optimize_indexes_v1.3.0.sql" -ForegroundColor Gray
        }
    }
    
    Write-Host "  $($symbols.Success) Base de données prête" -ForegroundColor Green
}

# ============================================================================
# 3. BACKEND API RUST
# ============================================================================

Write-Host "`n$($symbols.Backend) Lancement du backend (API Rust)..." -ForegroundColor Cyan

# Vérifier que le dossier existe
if (-not (Test-Path "services/api-geo")) {
    Write-Host "  $($symbols.Error) Dossier services/api-geo non trouvé" -ForegroundColor Red
    exit 1
}

# Vérifier le fichier .env
if (-not (Test-Path "services/api-geo/.env")) {
    Write-Host "  $($symbols.Warning) Fichier .env non trouvé" -ForegroundColor Yellow
    if (Test-Path "services/api-geo/.env.example") {
        Write-Host "  $($symbols.Info) Copie de .env.example vers .env" -ForegroundColor Cyan
        Copy-Item "services/api-geo/.env.example" "services/api-geo/.env"
    } else {
        Write-Host "  $($symbols.Error) Créez un fichier .env dans services/api-geo/" -ForegroundColor Red
        exit 1
    }
}

Write-Host "  $($symbols.Info) Compilation et démarrage..." -ForegroundColor Cyan

$backendJob = Start-Job -ScriptBlock {
    param($ProjectPath, $Verbose)
    
    Set-Location $ProjectPath
    
    # Charger les variables d'environnement
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    # Définir le niveau de log
    if ($Verbose) {
        [Environment]::SetEnvironmentVariable("RUST_LOG", "debug", "Process")
    } else {
        [Environment]::SetEnvironmentVariable("RUST_LOG", "info", "Process")
    }
    
    # Lancer cargo
    cargo run --release 2>&1
} -ArgumentList (Resolve-Path "services/api-geo").Path, $Verbose

Write-Host "  $($symbols.Success) Backend démarré (Job ID: $($backendJob.Id))" -ForegroundColor Green

# Attendre que le backend soit prêt
Write-Host "  $($symbols.Info) Attente du démarrage du serveur..." -ForegroundColor Cyan

$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/healthz" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "  $($symbols.Success) Backend prêt (tentative $($attempt + 1)/$maxAttempts)" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

if (-not $backendReady) {
    Write-Host "`n  $($symbols.Warning) Backend n'a pas répondu après $maxAttempts secondes" -ForegroundColor Yellow
    Write-Host "  Vérifiez les logs: Receive-Job -Id $($backendJob.Id) -Keep" -ForegroundColor Gray
} else {
    Write-Host "`n  $($symbols.Success) API accessible sur http://localhost:8000" -ForegroundColor Green
}

# ============================================================================
# 4. FRONTEND UI VITE
# ============================================================================

Write-Host "`n$($symbols.Frontend) Lancement du frontend (UI Vite)..." -ForegroundColor Cyan

# Vérifier que le dossier existe
if (-not (Test-Path "ui")) {
    Write-Host "  $($symbols.Error) Dossier ui/ non trouvé" -ForegroundColor Red
    exit 1
}

# Vérifier node_modules
if (-not (Test-Path "ui/node_modules")) {
    Write-Host "  $($symbols.Warning) node_modules non trouvé. Installation des dépendances..." -ForegroundColor Yellow
    Push-Location "ui"
    npm install
    Pop-Location
    Write-Host "  $($symbols.Success) Dépendances installées" -ForegroundColor Green
}

Write-Host "  $($symbols.Info) Démarrage du serveur Vite..." -ForegroundColor Cyan

$frontendJob = Start-Job -ScriptBlock {
    param($ProjectPath)
    Set-Location $ProjectPath
    npm run dev 2>&1
} -ArgumentList (Resolve-Path "ui").Path

Write-Host "  $($symbols.Success) Frontend démarré (Job ID: $($frontendJob.Id))" -ForegroundColor Green

# Attendre que le frontend soit prêt
Write-Host "  $($symbols.Info) Attente du serveur Vite..." -ForegroundColor Cyan

$maxAttempts = 20
$attempt = 0
$frontendReady = $false

while ($attempt -lt $maxAttempts -and -not $frontendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
            Write-Host "  $($symbols.Success) Frontend prêt (tentative $($attempt + 1)/$maxAttempts)" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
}

if (-not $frontendReady) {
    Write-Host "`n  $($symbols.Warning) Frontend n'a pas répondu après $maxAttempts secondes" -ForegroundColor Yellow
} else {
    Write-Host "`n  $($symbols.Success) UI accessible sur http://localhost:5173" -ForegroundColor Green
}

# ============================================================================
# 5. RÉSUMÉ ET INFORMATIONS
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "$($symbols.Success) ENVIRONNEMENT PRÊT - Atlas v1.3.0" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs d'Accès:" -ForegroundColor Cyan
Write-Host "  ┌─────────────────────────────────────────────────────────┐" -ForegroundColor Gray
Write-Host "  │ Frontend UI    : http://localhost:5173/                │" -ForegroundColor White
Write-Host "  │ Backend API    : http://localhost:8000/                │" -ForegroundColor White
Write-Host "  │ API Health     : http://localhost:8000/healthz         │" -ForegroundColor White
Write-Host "  │ API Version    : http://localhost:8000/version         │" -ForegroundColor White
Write-Host "  │ Database       : localhost:5432 (atlas_db)             │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────────────────┘" -ForegroundColor Gray

Write-Host "`n📚 Documentation:" -ForegroundColor Cyan
Write-Host "  • API Docs       : docs/API_v1.3.0.md" -ForegroundColor Gray
Write-Host "  • User Guide     : docs/GUIDE_UTILISATEUR.md" -ForegroundColor Gray
Write-Host "  • Roadmap        : docs/ROADMAP_v1.3.0.md" -ForegroundColor Gray
Write-Host "  • README         : README_v1.3.0.md" -ForegroundColor Gray

Write-Host "`n🔧 Commandes Utiles:" -ForegroundColor Yellow
Write-Host "  Logs Backend     : Receive-Job -Id $($backendJob.Id) -Keep" -ForegroundColor Gray
Write-Host "  Logs Frontend    : Receive-Job -Id $($frontendJob.Id) -Keep" -ForegroundColor Gray
Write-Host "  Arrêter Services : Stop-Job $($backendJob.Id),$($frontendJob.Id); Remove-Job $($backendJob.Id),$($frontendJob.Id)" -ForegroundColor Gray
Write-Host "  Rebuild Backend  : cd services/api-geo && cargo build --release" -ForegroundColor Gray
Write-Host "  Rebuild Frontend : cd ui && npm run build" -ForegroundColor Gray

Write-Host "`n$($symbols.Info) Nouvelles Fonctionnalités v1.3.0:" -ForegroundColor Magenta
Write-Host "  ✨ Historique d'édition avec export CSV" -ForegroundColor Gray
Write-Host "  ✨ Chargement paresseux par bbox" -ForegroundColor Gray
Write-Host "  ✨ Vues thématiques (densité, SPT-N, qc)" -ForegroundColor Gray
Write-Host "  ✨ Comparaison mailles voisines" -ForegroundColor Gray
Write-Host "  ✨ Exports professionnels (GeoPackage, PDF)" -ForegroundColor Gray
Write-Host "  ✨ Impression carte haute résolution" -ForegroundColor Gray

if (-not $NoBrowser) {
    Write-Host "`n$($symbols.Browser) Ouverture du navigateur..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5173"
}

Write-Host "`n$($symbols.Warning) Appuyez sur Ctrl+C pour arrêter tous les services" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 6. MONITORING DES LOGS
# ============================================================================

Write-Host "`n$($symbols.Logs) Logs en Temps Réel (Ctrl+C pour quitter):" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

$lastBackendOutput = ""
$lastFrontendOutput = ""

try {
    while ($true) {
        # Vérifier l'état des jobs
        $backendState = (Get-Job -Id $backendJob.Id).State
        $frontendState = (Get-Job -Id $frontendJob.Id).State
        
        if ($backendState -eq "Failed") {
            Write-Host "`n$($symbols.Error) Backend a crashé !" -ForegroundColor Red
            Receive-Job -Id $backendJob.Id
            break
        }
        
        if ($frontendState -eq "Failed") {
            Write-Host "`n$($symbols.Error) Frontend a crashé !" -ForegroundColor Red
            Receive-Job -Id $frontendJob.Id
            break
        }
        
        # Récupérer les nouveaux logs
        $backendOutput = Receive-Job -Id $backendJob.Id
        $frontendOutput = Receive-Job -Id $frontendJob.Id
        
        if ($backendOutput -and $backendOutput -ne $lastBackendOutput) {
            $backendOutput -split "`n" | ForEach-Object {
                if ($_ -match "error|ERROR") {
                    Write-Host "[BACKEND] $_" -ForegroundColor Red
                } elseif ($_ -match "warn|WARN") {
                    Write-Host "[BACKEND] $_" -ForegroundColor Yellow
                } else {
                    Write-Host "[BACKEND] $_" -ForegroundColor Blue
                }
            }
            $lastBackendOutput = $backendOutput
        }
        
        if ($frontendOutput -and $frontendOutput -ne $lastFrontendOutput) {
            $frontendOutput -split "`n" | ForEach-Object {
                if ($_ -match "error|ERROR") {
                    Write-Host "[FRONTEND] $_" -ForegroundColor Red
                } elseif ($_ -match "warn|WARN") {
                    Write-Host "[FRONTEND] $_" -ForegroundColor Yellow
                } else {
                    Write-Host "[FRONTEND] $_" -ForegroundColor Magenta
                }
            }
            $lastFrontendOutput = $frontendOutput
        }
        
        Start-Sleep -Milliseconds 500
    }
} catch {
    Write-Host "`n$($symbols.Info) Interruption détectée" -ForegroundColor Cyan
} finally {
    Write-Host "`n$($symbols.Stop) Arrêt des services..." -ForegroundColor Red
    Write-Host "  Arrêt du backend..." -ForegroundColor Gray
    Stop-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
    Write-Host "  Arrêt du frontend..." -ForegroundColor Gray
    Stop-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
    
    # Nettoyer les jobs
    Remove-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue
    
    Write-Host "`n$($symbols.Success) Services arrêtés proprement" -ForegroundColor Green
    Write-Host "=" * 80 -ForegroundColor Gray
    Write-Host "Merci d'avoir utilisé Atlas v1.3.0 !" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Gray
}
