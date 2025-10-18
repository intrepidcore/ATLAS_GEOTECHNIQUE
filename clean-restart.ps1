# Script de nettoyage et red\u00e9marrage propre d'Atlas

Write-Host "🛑 Arr\u00eat de tous les processus api-geo..." -ForegroundColor Yellow
Get-Process -Name "api-geo" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✅ Processus arr\u00eat\u00e9s" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 D\u00e9marrage du backend..." -ForegroundColor Cyan
cd services/api-geo
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cargo run --release" -WindowStyle Normal

Write-Host "✅ Backend lanc\u00e9 dans une nouvelle fen\u00eatre" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Instructions:" -ForegroundColor White
Write-Host "  1. Attendez que le backend affiche 'listening on 0.0.0.0:8000'"
Write-Host "  2. Rechargez la page http://localhost:5173 dans votre navigateur"
Write-Host "  3. La grille devrait se charger automatiquement"
Write-Host ""
Write-Host "🔗 URLs:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173"
Write-Host "  Backend:  http://localhost:8000"
Write-Host ""
