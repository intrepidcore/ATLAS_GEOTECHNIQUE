# Script de lancement pour développement local
# Charge les variables d'environnement depuis .env et lance le backend

Write-Host "🚀 Démarrage du backend Atlas API-GEO..." -ForegroundColor Cyan

# Vérifier que la DB est démarrée
Write-Host "📊 Vérification de la base de données..." -ForegroundColor Yellow
$dbRunning = docker ps --filter "name=atlas-db" --filter "status=running" --format "{{.Names}}"
if (-not $dbRunning) {
    Write-Host "❌ La base de données n'est pas démarrée. Lancement..." -ForegroundColor Red
    Set-Location "..\.."
    docker compose up db -d
    Write-Host "⏳ Attente de la DB (10s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Set-Location "services\api-geo"
}

# Charger les variables d'environnement depuis .env
if (Test-Path .env) {
    Write-Host "📝 Chargement de .env..." -ForegroundColor Green
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "   ✓ $name" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "⚠️  Fichier .env non trouvé. Utilisation des variables par défaut." -ForegroundColor Yellow
}

# Lancer le backend
Write-Host "`n🔥 Lancement de cargo run --release..." -ForegroundColor Cyan
cargo run --release
