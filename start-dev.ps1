# Script de lancement complet pour développement local
# Lance le backend ET le frontend en parallèle

Write-Host "🚀 Démarrage de l'environnement de développement Atlas..." -ForegroundColor Cyan

# Vérifier que la DB est démarrée
Write-Host "`n📊 Vérification de la base de données..." -ForegroundColor Yellow
$dbRunning = docker ps --filter "name=atlas-db" --filter "status=running" --format "{{.Names}}"
if (-not $dbRunning) {
    Write-Host "❌ La base de données n'est pas démarrée. Lancement..." -ForegroundColor Red
    docker compose up db -d
    Write-Host "⏳ Attente de la DB (10s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host "`n✅ Base de données prête !" -ForegroundColor Green

# Lancer le backend en arrière-plan
Write-Host "`n🔥 Lancement du backend (API Rust)..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    Set-Location "C:\PROJET_ATLAS_MASTER\atlas\services\api-geo"
    
    # Charger .env
    if (Test-Path .env) {
        Get-Content .env | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    cargo run --release 2>&1
}

Write-Host "   Backend démarré (Job ID: $($backendJob.Id))" -ForegroundColor Gray

# Attendre que le backend soit prêt
Write-Host "   Attente du backend (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Lancer le frontend en arrière-plan
Write-Host "`n🎨 Lancement du frontend (UI Vite)..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "C:\PROJET_ATLAS_MASTER\atlas\ui"
    npm run dev 2>&1
}

Write-Host "   Frontend démarré (Job ID: $($frontendJob.Id))" -ForegroundColor Gray
Start-Sleep -Seconds 5

# Afficher les URLs
Write-Host "`n✅ Environnement prêt !" -ForegroundColor Green
Write-Host "`n📍 URLs d'accès:" -ForegroundColor Cyan
Write-Host "   Frontend UI : http://localhost:5173/" -ForegroundColor White
Write-Host "   Backend API : http://localhost:8000/" -ForegroundColor White
Write-Host "   Database    : localhost:5432" -ForegroundColor White

Write-Host "`n📋 Commandes utiles:" -ForegroundColor Yellow
Write-Host "   Voir logs backend  : Receive-Job -Id $($backendJob.Id) -Keep" -ForegroundColor Gray
Write-Host "   Voir logs frontend : Receive-Job -Id $($frontendJob.Id) -Keep" -ForegroundColor Gray
Write-Host "   Arrêter tout       : Stop-Job -Id $($backendJob.Id),$($frontendJob.Id); Remove-Job -Id $($backendJob.Id),$($frontendJob.Id)" -ForegroundColor Gray

Write-Host "`n🌐 Ouvre ton navigateur sur http://localhost:5173/" -ForegroundColor Green
Write-Host "`n⚠️  Appuie sur Ctrl+C pour arrêter (puis exécute la commande Stop-Job ci-dessus)" -ForegroundColor Yellow

# Garder le script actif et afficher les logs
Write-Host "`n📜 Logs en temps réel (Ctrl+C pour quitter):" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

try {
    while ($true) {
        $backendOutput = Receive-Job -Id $backendJob.Id
        $frontendOutput = Receive-Job -Id $frontendJob.Id
        
        if ($backendOutput) {
            Write-Host "[BACKEND] $backendOutput" -ForegroundColor Blue
        }
        if ($frontendOutput) {
            Write-Host "[FRONTEND] $frontendOutput" -ForegroundColor Magenta
        }
        
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "`n🛑 Arrêt des services..." -ForegroundColor Red
    Stop-Job -Id $backendJob.Id, $frontendJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $backendJob.Id, $frontendJob.Id -ErrorAction SilentlyContinue
    Write-Host "✅ Services arrêtés" -ForegroundColor Green
}
