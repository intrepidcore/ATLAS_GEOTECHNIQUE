# ============================================================================
# Atlas v1.4.0 - Arrêt de tous les services
# ============================================================================
# Ce script arrête proprement tous les services (Docker + processus locaux)
# ============================================================================

Write-Host "`n🛑 Arrêt de tous les services Atlas..." -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

# ============================================================================
# 1. ARRÊT DES CONTENEURS DOCKER
# ============================================================================

Write-Host "`n🐳 Arrêt des conteneurs Docker..." -ForegroundColor Yellow

$runningContainers = docker compose ps --services --filter "status=running" 2>$null
if ($runningContainers) {
    Write-Host "  ℹ️  Conteneurs en cours: $($runningContainers -join ', ')" -ForegroundColor Cyan
    docker compose down 2>&1 | Out-Null
    Write-Host "  ✅ Conteneurs Docker arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun conteneur Docker en cours" -ForegroundColor Gray
}

# ============================================================================
# 2. ARRÊT DES PROCESSUS LOCAUX
# ============================================================================

Write-Host "`n🔥 Arrêt des processus locaux..." -ForegroundColor Yellow

# Arrêter api-geo.exe (Cargo local)
$cargoProcess = Get-Process -Name "api-geo" -ErrorAction SilentlyContinue
if ($cargoProcess) {
    Write-Host "  🛑 Arrêt de api-geo.exe (Cargo)..." -ForegroundColor Cyan
    Stop-Process -Name "api-geo" -Force -ErrorAction SilentlyContinue
    Write-Host "  ✅ api-geo.exe arrêté" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun processus api-geo.exe en cours" -ForegroundColor Gray
}

# Arrêter les processus Node (Vite)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*npm*dev*"
}
if ($nodeProcesses) {
    Write-Host "  🛑 Arrêt des processus Vite/Node..." -ForegroundColor Cyan
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  ✅ Processus Node arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun processus Vite/Node en cours" -ForegroundColor Gray
}

# ============================================================================
# 3. VÉRIFICATION DES PORTS
# ============================================================================

Write-Host "`n🔍 Vérification des ports..." -ForegroundColor Yellow

$ports = @(5173, 5174, 8000, 8001, 5432)
$portsInUse = @()

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $portsInUse += $port
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host "  ⚠️  Ports encore utilisés: $($portsInUse -join ', ')" -ForegroundColor Yellow
    Write-Host "  💡 Utilisez 'Get-NetTCPConnection -LocalPort <PORT>' pour identifier le processus" -ForegroundColor Cyan
} else {
    Write-Host "  ✅ Tous les ports sont libérés" -ForegroundColor Green
}

# ============================================================================
# 4. RÉSUMÉ
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ TOUS LES SERVICES ARRÊTÉS" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`n💡 Pour redémarrer:" -ForegroundColor Cyan
Write-Host "  • Mode Docker : .\quick-start.ps1" -ForegroundColor Gray
Write-Host "  • Rebuild Docker : .\quick-start.ps1 -RebuildDocker" -ForegroundColor Gray

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Gray
