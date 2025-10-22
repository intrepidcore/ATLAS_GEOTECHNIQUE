Write-Host "=== Nettoyage Cache ===" -ForegroundColor Cyan

Write-Host "`nFermez TOUS les onglets Atlas dans votre navigateur" -ForegroundColor Yellow
Write-Host "Puis appuyez sur Entree..." -ForegroundColor Yellow
Read-Host

Write-Host "`nOuverture en mode prive..." -ForegroundColor Green

# Essayer Edge
if (Get-Command msedge -ErrorAction SilentlyContinue) {
    Start-Process "msedge.exe" -ArgumentList "--inprivate http://127.0.0.1:8080"
    Write-Host "Edge ouvert en mode prive" -ForegroundColor Green
}
# Essayer Chrome
elseif (Get-Command chrome -ErrorAction SilentlyContinue) {
    Start-Process "chrome.exe" -ArgumentList "--incognito http://127.0.0.1:8080"
    Write-Host "Chrome ouvert en mode prive" -ForegroundColor Green
}
else {
    Write-Host "Ouvrez manuellement en mode prive (Ctrl+Shift+N):" -ForegroundColor Yellow
    Write-Host "http://127.0.0.1:8080" -ForegroundColor Cyan
}

Write-Host "`nDans le navigateur prive:" -ForegroundColor Cyan
Write-Host "1. Tester carte thematique (IP moyen)" -ForegroundColor White
Write-Host "2. Verifier F12 -> Network -> Request URL commence par /api/" -ForegroundColor White
