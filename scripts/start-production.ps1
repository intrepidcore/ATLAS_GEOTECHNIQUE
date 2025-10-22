# Atlas v1.5.0.3 - Demarrage Production
param([switch]$Rebuild, [switch]$CleanStart)

Write-Host "`nDemarrage Atlas v1.5.0.3 (Production)" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Gray

if ($CleanStart) {
    Write-Host "`nArret des services existants..." -ForegroundColor Yellow
    docker compose down 2>&1 | Out-Null
    Write-Host "  OK - Services arretes" -ForegroundColor Green
}

if ($Rebuild) {
    Write-Host "`nRebuild des images..." -ForegroundColor Yellow
    
    Write-Host "  Build API..." -ForegroundColor Cyan
    docker compose build --no-cache api-geo 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    OK - API build" -ForegroundColor Green
    } else {
        Write-Host "    ERREUR - API build" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Build UI (avec variables VITE_API_*)..." -ForegroundColor Cyan
    docker compose build --no-cache ui 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    OK - UI build" -ForegroundColor Green
        
        # Verification que l'UI utilise bien /api
        Write-Host "  Verification config UI..." -ForegroundColor Cyan
        Start-Sleep -Seconds 2
        docker compose up -d ui 2>&1 | Out-Null
        Start-Sleep -Seconds 3
        $check = docker compose exec ui sh -c "grep -o 'http://127.0.0.1:8001' /usr/share/nginx/html/assets/*.js 2>/dev/null"
        if ($check) {
            Write-Host "    ERREUR - UI utilise encore l'ancienne URL!" -ForegroundColor Red
            Write-Host "    Verifiez que .env contient VITE_API_GEO=/api" -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "    OK - UI utilise /api" -ForegroundColor Green
        }
    } else {
        Write-Host "    ERREUR - UI build" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`nDemarrage des services..." -ForegroundColor Yellow
docker compose up -d

Write-Host "  Attente du demarrage (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

Write-Host "`nVerification des services..." -ForegroundColor Yellow

$dbHealthy = docker compose ps db --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($dbHealthy) {
    Write-Host "  OK - Database" -ForegroundColor Green
} else {
    Write-Host "  En cours - Database" -ForegroundColor Yellow
}

$apiHealthy = docker compose ps api-geo --format json 2>$null | ConvertFrom-Json | Where-Object { $_.Health -eq "healthy" }
if ($apiHealthy) {
    Write-Host "  OK - API" -ForegroundColor Green
} else {
    Write-Host "  En cours - API" -ForegroundColor Yellow
}

$uiRunning = docker compose ps ui --format json 2>$null | ConvertFrom-Json | Where-Object { $_.State -eq "running" }
if ($uiRunning) {
    Write-Host "  OK - UI" -ForegroundColor Green
} else {
    Write-Host "  ERREUR - UI" -ForegroundColor Red
}

Write-Host "`nTest du proxy..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 10
    if ($health.status -eq "ok") {
        Write-Host "  OK - Proxy Nginx" -ForegroundColor Green
    }
} catch {
    Write-Host "  En attente - Proxy" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("=" * 80) -ForegroundColor Green
Write-Host "ATLAS v1.5.0.3 DEMARRE" -ForegroundColor Green
Write-Host ("=" * 80) -ForegroundColor Green

Write-Host "`nURLs:" -ForegroundColor Cyan
Write-Host "  Application : http://127.0.0.1:8080" -ForegroundColor White
Write-Host "  API (proxy) : http://127.0.0.1:8080/api/" -ForegroundColor Gray

Write-Host "`nArchitecture:" -ForegroundColor Cyan
Write-Host "  UI (Nginx) -> Port 8080" -ForegroundColor White
Write-Host "    |- / -> UI statique" -ForegroundColor Gray
Write-Host "    |- /api/ -> Proxy vers API" -ForegroundColor Gray
Write-Host "  API (Rust) -> Reseau Docker interne" -ForegroundColor White
Write-Host "  DB (PostgreSQL) -> Port 5432" -ForegroundColor White

Write-Host "`nAvantages v1.5.0.3:" -ForegroundColor Cyan
Write-Host "  - Plus de probleme localhost/127.0.0.1" -ForegroundColor Green
Write-Host "  - Pas de CORS" -ForegroundColor Green
Write-Host "  - Pas de rebuild si IP change" -ForegroundColor Green
Write-Host "  - API non exposee directement" -ForegroundColor Green

Write-Host "`nIMPORTANT - Cache Navigateur:" -ForegroundColor Yellow
Write-Host "  Si vous voyez 'Failed to fetch':" -ForegroundColor White
Write-Host "  1. Ctrl + Shift + R (vider cache)" -ForegroundColor Gray
Write-Host "  2. OU mode prive: Ctrl + Shift + N" -ForegroundColor Gray

Write-Host "`nOuverture du navigateur..." -ForegroundColor Green
Start-Sleep -Seconds 2

try {
    Start-Process "msedge.exe" -ArgumentList "--inprivate","http://127.0.0.1:8080"
    Write-Host "  OK - Edge ouvert en mode prive" -ForegroundColor Green
} catch {
    Start-Process "http://127.0.0.1:8080"
    Write-Host "  Info - Navigateur ouvert (pensez a vider le cache)" -ForegroundColor Cyan
}

Write-Host "`nCommandes Utiles:" -ForegroundColor Yellow
Write-Host "  Rebuild tout   : .\start-production.ps1 -Rebuild" -ForegroundColor Gray
Write-Host "  Clean start    : .\start-production.ps1 -CleanStart -Rebuild" -ForegroundColor Gray
Write-Host "  Logs API       : docker compose logs -f api-geo" -ForegroundColor Gray
Write-Host "  Logs UI        : docker compose logs -f ui" -ForegroundColor Gray
Write-Host "  Status         : docker compose ps" -ForegroundColor Gray
Write-Host "  Arreter        : docker compose down" -ForegroundColor Gray

Write-Host "`nTests:" -ForegroundColor Yellow
Write-Host "  Carte thematique: IP moyen -> Appliquer" -ForegroundColor Gray
Write-Host "  DevTools (F12): Request URL doit commencer par /api/" -ForegroundColor Gray

Write-Host "`nPour LAN:" -ForegroundColor Yellow
Write-Host "  1. Obtenir IP: ipconfig" -ForegroundColor Gray
Write-Host "  2. Firewall: New-NetFirewallRule -DisplayName 'Atlas' -LocalPort 8080 -Protocol TCP -Action Allow" -ForegroundColor Gray
Write-Host "  3. URL testeurs: http://[IP]:8080" -ForegroundColor Gray
Write-Host "  4. AUCUN rebuild necessaire!" -ForegroundColor Green

Write-Host ""
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host "Atlas v1.5.0.3 est pret!" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host ""
