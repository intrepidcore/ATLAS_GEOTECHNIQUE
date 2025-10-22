# ============================================================================
# Atlas v1.5.0.3 - Démarrage Production (Docker Complet)
# ============================================================================
# Architecture Production:
#    - UI: Nginx avec proxy vers API (Port 8080)
#    - API: Rust via proxy Nginx interne (pas exposé)
#    - DB: PostgreSQL/PostGIS (Port 5432)
# ============================================================================

param(
    [switch]$Rebuild,
    [switch]$CleanStart
)

Write-Host "`n🚀 Démarrage Atlas v1.5.0.3 (Production)" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. ARRÊT DES SERVICES EXISTANTS
# ============================================================================

if ($CleanStart) {
    Write-Host "`n🛑 Arrêt des services existants..." -ForegroundColor Yellow
    docker compose down 2>&1 | Out-Null
    Write-Host "  ✅ Services arrêtés" -ForegroundColor Green
}

# ============================================================================
# 2. BUILD SI NÉCESSAIRE
# ============================================================================

if ($Rebuild) {
    Write-Host "`n🔨 Rebuild des images..." -ForegroundColor Yellow
    
    Write-Host "  • Build API..." -ForegroundColor Cyan
    docker compose build api-geo 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ API build OK" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Erreur build API" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  • Build UI..." -ForegroundColor Cyan
    docker compose build ui 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ UI build OK" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Erreur build UI" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# 3. DÉMARRAGE DES SERVICES
# ============================================================================

Write-Host "`n🚀 Démarrage des services..." -ForegroundColor Yellow

docker compose up -d

Write-Host "  ⏳ Attente du démarrage (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# ============================================================================
# 4. VÉRIFICATION
# ============================================================================

Write-Host "`n🔍 Vérification des services..." -ForegroundColor Yellow

# Vérifier DB
$dbHealthy = docker compose ps db --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($dbHealthy) {
    Write-Host "  ✅ Database: OK" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Database: En cours..." -ForegroundColor Yellow
}

# Vérifier API
$apiHealthy = docker compose ps api-geo --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($apiHealthy) {
    Write-Host "  ✅ API: OK" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  API: En cours..." -ForegroundColor Yellow
}

# Vérifier UI
$uiRunning = docker compose ps ui --format json 2>$null | ConvertFrom-Json | Where-Object { $_.State -eq "running" }
if ($uiRunning) {
    Write-Host "  ✅ UI: OK" -ForegroundColor Green
} else {
    Write-Host "  ❌ UI: Erreur" -ForegroundColor Red
}

# Test proxy
Write-Host "`n🧪 Test du proxy..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 10
    if ($health.status -eq "ok") {
        Write-Host "  ✅ Proxy Nginx: OK" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  Proxy: Attente..." -ForegroundColor Yellow
}

# ============================================================================
# 5. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ ATLAS v1.5.0.3 DÉMARRÉ" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n📍 URLs:" -ForegroundColor Cyan
Write-Host "  • Application : http://127.0.0.1:8080" -ForegroundColor White
Write-Host "  • API (proxy)  : http://127.0.0.1:8080/api/" -ForegroundColor Gray
Write-Host "  • Database     : localhost:5432" -ForegroundColor Gray

Write-Host "`n🏗️  Architecture:" -ForegroundColor Cyan
Write-Host "  • UI (Nginx) → Port 8080" -ForegroundColor White
Write-Host "    ├─ / → UI statique" -ForegroundColor Gray
Write-Host "    └─ /api/ → Proxy vers API" -ForegroundColor Gray
Write-Host "  • API (Rust) → Réseau Docker interne" -ForegroundColor White
Write-Host "  • DB (PostgreSQL) → Port 5432" -ForegroundColor White

Write-Host "`n✨ Avantages v1.5.0.3:" -ForegroundColor Cyan
Write-Host "  ✅ Plus de problème localhost/127.0.0.1" -ForegroundColor Green
Write-Host "  ✅ Pas de CORS" -ForegroundColor Green
Write-Host "  ✅ Pas de rebuild si IP change" -ForegroundColor Green
Write-Host "  ✅ API non exposée directement" -ForegroundColor Green

Write-Host "`n⚠️  IMPORTANT - Cache Navigateur:" -ForegroundColor Yellow
Write-Host "  Si vous voyez 'Failed to fetch':" -ForegroundColor White
Write-Host "  1. Ctrl + Shift + R (vider cache)" -ForegroundColor Gray
Write-Host "  2. OU mode privé: Ctrl + Shift + N" -ForegroundColor Gray

Write-Host "`n🌐 Ouverture du navigateur..." -ForegroundColor Green
Start-Sleep -Seconds 2

# Ouvrir en mode privé pour éviter le cache
try {
    Start-Process "msedge.exe" -ArgumentList "--inprivate http://127.0.0.1:8080"
    Write-Host "  ✅ Edge ouvert en mode privé" -ForegroundColor Green
} catch {
    Start-Process "http://127.0.0.1:8080"
    Write-Host "  ℹ️  Navigateur ouvert (pensez à vider le cache)" -ForegroundColor Cyan
}

Write-Host "`n🔧 Commandes Utiles:" -ForegroundColor Yellow
Write-Host "  • Rebuild tout   : .\production-start.ps1 -Rebuild" -ForegroundColor Gray
Write-Host "  • Clean start    : .\production-start.ps1 -CleanStart -Rebuild" -ForegroundColor Gray
Write-Host "  • Logs API       : docker compose logs -f api-geo" -ForegroundColor Gray
Write-Host "  • Logs UI        : docker compose logs -f ui" -ForegroundColor Gray
Write-Host "  • Status         : docker compose ps" -ForegroundColor Gray
Write-Host "  • Arreter        : docker compose down" -ForegroundColor Gray

Write-Host "`n📊 Tests:" -ForegroundColor Yellow
Write-Host "  • Carte thematique: IP moyen -> Appliquer" -ForegroundColor Gray
Write-Host "  • DevTools (F12): Request URL doit commencer par /api/" -ForegroundColor Gray

Write-Host "`n🌐 Pour LAN:" -ForegroundColor Yellow
Write-Host "  1. Obtenir IP: ipconfig" -ForegroundColor Gray
Write-Host "  2. Firewall: New-NetFirewallRule -DisplayName 'Atlas' -LocalPort 8080 -Protocol TCP -Action Allow" -ForegroundColor Gray
Write-Host "  3. URL testeurs: http://[IP]:8080" -ForegroundColor Gray
Write-Host "  4. AUCUN rebuild necessaire!" -ForegroundColor Green

Write-Host ""
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host "Atlas v1.5.0.3 est pret!" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host ""
