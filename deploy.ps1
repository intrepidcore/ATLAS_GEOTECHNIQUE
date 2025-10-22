# Script de déploiement Atlas v1.5.0 pour LAN
# Usage: .\deploy.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipFirewall
)

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Atlas Géotechnique v1.5.0 - Déploiement LAN        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# 1. Obtenir l'IP
Write-Host "`n📡 Détection de l'adresse IP..." -ForegroundColor Yellow
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress

if (-not $ip) {
    Write-Host "❌ Impossible de détecter l'IP automatiquement" -ForegroundColor Red
    $ip = Read-Host "Entrez votre adresse IP manuellement"
}

Write-Host "✅ IP détectée : $ip" -ForegroundColor Green

# 2. Vérifier .env
Write-Host "`n📝 Vérification de .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Fichier .env non trouvé, création..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# Mettre à jour VITE_API_GEO dans .env
$envContent = Get-Content ".env"
$envContent = $envContent -replace "VITE_API_GEO=.*", "VITE_API_GEO=http://${ip}:8001"
$envContent | Set-Content ".env"
Write-Host "✅ .env mis à jour avec IP $ip" -ForegroundColor Green

# 3. Arrêter les services existants
Write-Host "`n🛑 Arrêt des services existants..." -ForegroundColor Yellow
docker compose down 2>$null
Write-Host "✅ Services arrêtés" -ForegroundColor Green

# 4. Build (optionnel)
if (-not $SkipBuild) {
    Write-Host "`n🔨 Build des images Docker..." -ForegroundColor Yellow
    Write-Host "   (Cela peut prendre 2-3 minutes...)" -ForegroundColor Gray
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors du build" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build terminé" -ForegroundColor Green
} else {
    Write-Host "`n⏭️  Build ignoré (--SkipBuild)" -ForegroundColor Gray
}

# 5. Démarrer les services
Write-Host "`n🚀 Démarrage des services..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du démarrage" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Services démarrés" -ForegroundColor Green

# 6. Attendre que les services soient prêts
Write-Host "`n⏳ Attente de la disponibilité des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 7. Vérifier les services
Write-Host "`n🔍 Vérification des services..." -ForegroundColor Yellow
$services = docker compose ps --format json | ConvertFrom-Json

$allHealthy = $true
foreach ($service in $services) {
    $status = $service.Health
    $name = $service.Service
    
    if ($status -eq "healthy" -or $name -eq "etl") {
        Write-Host "   ✅ $name : OK" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $name : $status" -ForegroundColor Yellow
        $allHealthy = $false
    }
}

# 8. Configurer le firewall (optionnel)
if (-not $SkipFirewall) {
    Write-Host "`n🔥 Configuration du pare-feu Windows..." -ForegroundColor Yellow
    
    # Vérifier si admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if ($isAdmin) {
        # Supprimer les règles existantes
        Remove-NetFirewallRule -DisplayName "Atlas UI" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "Atlas API" -ErrorAction SilentlyContinue
        
        # Créer les nouvelles règles
        New-NetFirewallRule -DisplayName "Atlas UI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow | Out-Null
        New-NetFirewallRule -DisplayName "Atlas API" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
        
        Write-Host "✅ Règles de pare-feu créées" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Droits administrateur requis pour configurer le pare-feu" -ForegroundColor Yellow
        Write-Host "   Exécutez manuellement :" -ForegroundColor Gray
        Write-Host "   New-NetFirewallRule -DisplayName 'Atlas UI' -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow" -ForegroundColor Gray
        Write-Host "   New-NetFirewallRule -DisplayName 'Atlas API' -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow" -ForegroundColor Gray
    }
} else {
    Write-Host "`n⏭️  Configuration pare-feu ignorée (--SkipFirewall)" -ForegroundColor Gray
}

# 9. Résumé final
Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ DÉPLOIEMENT TERMINÉ                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📊 Informations de connexion :

   🖥️  Depuis ce PC :
      • UI  : http://localhost:8080
      • API : http://localhost:8001/healthz

   🌐 Depuis le LAN (testeurs) :
      • UI  : http://${ip}:8080
      • API : http://${ip}:8001/healthz

📝 Prochaines étapes :

   1. Tester l'accès local : http://localhost:8080
   2. Tester la carte thématique (🗺️ → IP moyen)
   3. Tester depuis un autre PC : http://${ip}:8080
   4. Communiquer l'URL aux testeurs

📚 Documentation :

   • Guide de déploiement : DEPLOIEMENT_LAN.md
   • Instructions de test : INSTRUCTIONS_TEST.md
   • Changelog : CHANGELOG_v1.5.0.md

🐛 En cas de problème :

   • Logs : docker compose logs -f
   • Status : docker compose ps
   • Redémarrer : docker compose restart

"@ -ForegroundColor Cyan

# 10. Proposer d'ouvrir le navigateur
$openBrowser = Read-Host "`nOuvrir le navigateur maintenant ? (O/N)"
if ($openBrowser -eq "O" -or $openBrowser -eq "o") {
    Start-Process "http://localhost:8080"
}

Write-Host "`n🎉 Déploiement terminé avec succès !`n" -ForegroundColor Green
