# Ouvrir Atlas en mode privé (pas de cache)

Write-Host "Ouverture d'Atlas en mode navigation privee..." -ForegroundColor Cyan

# Détecter le navigateur par défaut
$edge = Get-Command msedge -ErrorAction SilentlyContinue
$chrome = Get-Command chrome -ErrorAction SilentlyContinue

if ($edge) {
    Write-Host "Utilisation de Microsoft Edge" -ForegroundColor Green
    Start-Process msedge -ArgumentList "-inprivate http://127.0.0.1:8080"
} elseif ($chrome) {
    Write-Host "Utilisation de Google Chrome" -ForegroundColor Green
    Start-Process chrome -ArgumentList "--incognito http://127.0.0.1:8080"
} else {
    Write-Host "Navigateur non detecte. Ouvrez manuellement:" -ForegroundColor Yellow
    Write-Host "http://127.0.0.1:8080" -ForegroundColor Cyan
    Write-Host "`nEn mode prive (Ctrl+Shift+N)" -ForegroundColor Yellow
}

Write-Host "`nMode prive = Pas de cache = Garantie de voir la nouvelle version !" -ForegroundColor Green
