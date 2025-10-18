# Script pour tuer TOUS les processus Atlas

Write-Host "🛑 Arrêt de tous les processus Atlas..." -ForegroundColor Yellow

# Arrêter tous les api-geo
$apiProcesses = Get-Process -Name "api-geo" -ErrorAction SilentlyContinue
if ($apiProcesses) {
    $apiProcesses | Stop-Process -Force
    Write-Host "  ✅ $($apiProcesses.Count) processus api-geo arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun processus api-geo trouvé" -ForegroundColor Gray
}

# Arrêter tous les node/vite
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "  ✅ $($nodeProcesses.Count) processus node arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun processus node trouvé" -ForegroundColor Gray
}

# Arrêter tous les jobs PowerShell
$jobs = Get-Job -ErrorAction SilentlyContinue
if ($jobs) {
    $jobs | Stop-Job
    $jobs | Remove-Job
    Write-Host "  ✅ $($jobs.Count) jobs PowerShell arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Aucun job PowerShell trouvé" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Tous les processus ont été arrêtés" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Pour redémarrer proprement, utilisez:" -ForegroundColor White
Write-Host "   .\quick-start.ps1" -ForegroundColor Cyan
