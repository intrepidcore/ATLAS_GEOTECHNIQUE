Write-Host "=== Verification Build UI ===" -ForegroundColor Cyan

Write-Host "`nRecherche de l'URL API dans le JS compile..." -ForegroundColor Yellow

$result = docker compose exec ui sh -c "grep -o 'http://127.0.0.1:8001' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1"

if ($result) {
    Write-Host "  ERREUR - UI utilise encore http://127.0.0.1:8001" -ForegroundColor Red
    Write-Host "  L'UI n'a PAS ete rebuild avec /api" -ForegroundColor Red
    Write-Host ""
    Write-Host "  SOLUTION:" -ForegroundColor Yellow
    Write-Host "  1. docker compose down" -ForegroundColor Gray
    Write-Host "  2. docker compose build --no-cache ui" -ForegroundColor Gray
    Write-Host "  3. docker compose up -d" -ForegroundColor Gray
} else {
    Write-Host "  OK - Pas de reference a 8001 trouvee" -ForegroundColor Green
    Write-Host "  L'UI devrait utiliser /api" -ForegroundColor Green
}

Write-Host "`nVerification .env:" -ForegroundColor Yellow
$env = Get-Content .env | Select-String "VITE_API"
Write-Host "  $env" -ForegroundColor Cyan
