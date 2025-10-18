# ============================================================================
# Atlas Géotechnique du Togo - Script de Démarrage Amélioré v1.3.0
# ============================================================================
# Usage: .\start-dev-improved.ps1 [-Verbose] [-NoBrowser] [-SkipDbCheck]
# ============================================================================

param(
    [switch]$SkipDbCheck,
    [switch]$Verbose,
    [switch]$NoBrowser,
    [switch]$CleanBuild
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Variables globales
$script:BackendProcess = $null
$script:FrontendProcess = $null
$script:BackendReady = $false
$script:FrontendReady = $false

# Couleurs
$symbols = @{
    Success = "✅"; Error = "❌"; Warning = "⚠️"; Info = "ℹ️"
    Rocket = "🚀"; Database = "📊"; Backend = "🔥"; Frontend = "🎨"
    Browser = "🌐"; Logs = "📜"; Stop = "🛑"; Build = "🔨"
}

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "`n$Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "  $($symbols.Success) $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "  $($symbols.Error) $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  $($symbols.Warning) $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $($symbols.Info) $Message" -ForegroundColor Gray
}

function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$MaxAttempts = 30,
        [string]$Name
    )
    
    Write-Info "Attente de $Name..."
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "$Name prêt (tentative $i/$MaxAttempts)"
                return $true
            }
        } catch {
            Write-Host "." -NoNewline -ForegroundColor Gray
            Start-Sleep -Seconds 1
        }
    }
    Write-Host ""
    Write-Warning "$Name n'a pas répondu après $MaxAttempts secondes"
    return $false
}

function Stop-Services {
    Write-Step "$($symbols.Stop) Arrêt des services..." "Red"
    
    if ($script:BackendProcess -and !$script:BackendProcess.HasExited) {
        Write-Info "Arrêt du backend..."
        Stop-Process -Id $script:BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    if ($script:FrontendProcess -and !$script:FrontendProcess.HasExited) {
        Write-Info "Arrêt du frontend..."
        Stop-Process -Id $script:FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    # Tuer les processus sur les ports si nécessaire
    $ports = @(8000, 5173, 5174)
    foreach ($port in $ports) {
        $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                     Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $processes) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Success "Services arrêtés"
}

# Gestionnaire de Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-Services
}

# ============================================================================
# HEADER
# ============================================================================

Clear-Host
Write-Host "`n$($symbols.Rocket) Atlas Géotechnique v1.3.0 - Démarrage Développement" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. VÉRIFICATIONS
# ============================================================================

Write-Step "$($symbols.Info) Vérification des prérequis..." "Yellow"

# Rust
try {
    $rustVersion = cargo --version 2>&1 | Out-String
    Write-Success "Rust: $($rustVersion.Trim())"
} catch {
    Write-Error "Rust non trouvé. Installer depuis https://rustup.rs/"
    exit 1
}

# Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-Error "Node.js non trouvé. Installer depuis https://nodejs.org/"
    exit 1
}

# Base de données
if (-not $SkipDbCheck) {
    Write-Step "$($symbols.Database) Vérification de la base de données..." "Yellow"
    
    $dbRunning = docker ps --filter "name=atlas-db" --filter "status=running" --format "{{.Names}}" 2>$null
    if ($dbRunning) {
        Write-Success "Base de données Docker active"
    } else {
        Write-Warning "Base de données non détectée"
        Write-Info "Lancement de la base de données..."
        docker compose up db -d 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Base de données démarrée"
            Start-Sleep -Seconds 5
        } else {
            Write-Warning "Impossible de démarrer Docker. Assurez-vous que PostgreSQL est installé."
        }
    }
}

# ============================================================================
# 2. COMPILATION ET LANCEMENT BACKEND
# ============================================================================

Write-Step "$($symbols.Backend) Préparation du backend..." "Cyan"

# Vérifier .env
if (-not (Test-Path "services/api-geo/.env")) {
    if (Test-Path "services/api-geo/.env.example") {
        Write-Info "Copie de .env.example vers .env"
        Copy-Item "services/api-geo/.env.example" "services/api-geo/.env"
    } else {
        Write-Error "Fichier .env manquant dans services/api-geo/"
        exit 1
    }
}

# Compilation
if ($CleanBuild) {
    Write-Info "Nettoyage et compilation complète..."
    Push-Location "services/api-geo"
    cargo clean | Out-Null
    Pop-Location
}

Write-Info "Compilation du backend..."
Push-Location "services/api-geo"

$compileOutput = cargo build --release 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erreur de compilation du backend"
    Write-Host $compileOutput -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Success "Backend compilé avec succès"

# Lancement
Write-Info "Démarrage du backend..."

$env:RUST_LOG = if ($Verbose) { "debug" } else { "info" }

$script:BackendProcess = Start-Process -FilePath "target/release/api-geo.exe" `
    -WorkingDirectory (Get-Location) `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput "../../logs/backend.log" `
    -RedirectStandardError "../../logs/backend-error.log"

Pop-Location

if ($script:BackendProcess) {
    Write-Success "Backend démarré (PID: $($script:BackendProcess.Id))"
    
    # Attendre que le backend soit prêt
    $script:BackendReady = Wait-ForUrl -Url "http://localhost:8000/healthz" -MaxAttempts 30 -Name "Backend"
    
    if ($script:BackendReady) {
        Write-Host ""
        Write-Success "API accessible sur http://localhost:8000"
    } else {
        Write-Error "Le backend n'a pas démarré correctement"
        Write-Info "Vérifiez les logs: logs/backend-error.log"
        Stop-Services
        exit 1
    }
} else {
    Write-Error "Impossible de démarrer le backend"
    exit 1
}

# ============================================================================
# 3. LANCEMENT FRONTEND
# ============================================================================

Write-Step "$($symbols.Frontend) Préparation du frontend..." "Cyan"

# Vérifier node_modules
if (-not (Test-Path "ui/node_modules")) {
    Write-Info "Installation des dépendances npm..."
    Push-Location "ui"
    npm install --silent
    Pop-Location
    Write-Success "Dépendances installées"
}

# Lancement
Write-Info "Démarrage du frontend..."

Push-Location "ui"

$script:FrontendProcess = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory (Get-Location) `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput "../logs/frontend.log" `
    -RedirectStandardError "../logs/frontend-error.log"

Pop-Location

if ($script:FrontendProcess) {
    Write-Success "Frontend démarré (PID: $($script:FrontendProcess.Id))"
    
    # Attendre que le frontend soit prêt (essayer les deux ports)
    $frontendUrl = "http://localhost:5173"
    $script:FrontendReady = Wait-ForUrl -Url $frontendUrl -MaxAttempts 20 -Name "Frontend"
    
    if (-not $script:FrontendReady) {
        $frontendUrl = "http://localhost:5174"
        $script:FrontendReady = Wait-ForUrl -Url $frontendUrl -MaxAttempts 5 -Name "Frontend (port alternatif)"
    }
    
    if ($script:FrontendReady) {
        Write-Host ""
        Write-Success "UI accessible sur $frontendUrl"
    } else {
        Write-Warning "Le frontend n'a pas répondu"
        Write-Info "Vérifiez les logs: logs/frontend-error.log"
    }
} else {
    Write-Error "Impossible de démarrer le frontend"
}

# ============================================================================
# 4. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "$($symbols.Success) ENVIRONNEMENT PRÊT - Atlas v1.3.0" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs d'Accès:" -ForegroundColor Cyan
Write-Host "  ┌─────────────────────────────────────────────────────────┐" -ForegroundColor Gray
Write-Host "  │ Frontend UI    : $frontendUrl                │" -ForegroundColor White
Write-Host "  │ Backend API    : http://localhost:8000/                │" -ForegroundColor White
Write-Host "  │ API Health     : http://localhost:8000/healthz         │" -ForegroundColor White
Write-Host "  │ API Version    : http://localhost:8000/version         │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────────────────────┘" -ForegroundColor Gray

Write-Host "`n📂 Logs:" -ForegroundColor Cyan
Write-Host "  • Backend      : logs/backend.log" -ForegroundColor Gray
Write-Host "  • Backend Err  : logs/backend-error.log" -ForegroundColor Gray
Write-Host "  • Frontend     : logs/frontend.log" -ForegroundColor Gray
Write-Host "  • Frontend Err : logs/frontend-error.log" -ForegroundColor Gray

Write-Host "`n🔧 Commandes:" -ForegroundColor Yellow
Write-Host "  Arrêter tout   : Ctrl+C" -ForegroundColor Gray
Write-Host "  Logs Backend   : Get-Content logs/backend.log -Wait" -ForegroundColor Gray
Write-Host "  Logs Frontend  : Get-Content logs/frontend.log -Wait" -ForegroundColor Gray

Write-Host "`n$($symbols.Info) Nouvelles Fonctionnalités v1.3.0:" -ForegroundColor Magenta
Write-Host "  ✨ Historique d'édition avec export CSV" -ForegroundColor Gray
Write-Host "  ✨ Chargement paresseux par bbox" -ForegroundColor Gray
Write-Host "  ✨ Vues thématiques (densité, SPT-N, qc)" -ForegroundColor Gray
Write-Host "  ✨ Comparaison mailles voisines" -ForegroundColor Gray
Write-Host "  ✨ Exports professionnels (GeoPackage, PDF)" -ForegroundColor Gray

# Ouvrir le navigateur
if (-not $NoBrowser -and $script:FrontendReady) {
    Write-Host "`n$($symbols.Browser) Ouverture du navigateur..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process $frontendUrl
}

Write-Host "`n$($symbols.Warning) Appuyez sur Ctrl+C pour arrêter tous les services" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 5. MONITORING
# ============================================================================

Write-Host "`n$($symbols.Logs) Monitoring des services (Ctrl+C pour quitter)..." -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

try {
    while ($true) {
        # Vérifier que les processus sont toujours actifs
        if ($script:BackendProcess -and $script:BackendProcess.HasExited) {
            Write-Host "`n$($symbols.Error) Backend a crashé ! (Code: $($script:BackendProcess.ExitCode))" -ForegroundColor Red
            Write-Info "Consultez logs/backend-error.log pour plus de détails"
            break
        }
        
        if ($script:FrontendProcess -and $script:FrontendProcess.HasExited) {
            Write-Host "`n$($symbols.Error) Frontend a crashé ! (Code: $($script:FrontendProcess.ExitCode))" -ForegroundColor Red
            Write-Info "Consultez logs/frontend-error.log pour plus de détails"
            break
        }
        
        # Afficher un point toutes les 5 secondes pour montrer que le script est actif
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
} catch {
    Write-Host "`n$($symbols.Info) Interruption détectée" -ForegroundColor Cyan
} finally {
    Stop-Services
    Write-Host "`n$($symbols.Success) Services arrêtés proprement" -ForegroundColor Green
    Write-Host "=" * 80 -ForegroundColor Gray
    Write-Host "Merci d'avoir utilisé Atlas v1.3.0 !" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Gray
}
