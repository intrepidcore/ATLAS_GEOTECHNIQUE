Write-Host "=== Diagnostic Failed to Fetch ===" -ForegroundColor Cyan

Write-Host "`n1. Test API via proxy" -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 5
    Write-Host "   OK - Proxy fonctionne: $($h.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR - Proxy ne repond pas: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Le proxy Nginx ne fonctionne pas correctement" -ForegroundColor Yellow
}

Write-Host "`n2. Test API directe (si port expose)" -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8001/healthz" -TimeoutSec 5
    Write-Host "   OK - API directe fonctionne: $($h.status)" -ForegroundColor Green
    Write-Host "   Note: L'API ne devrait PAS etre exposee en v1.5.0.3" -ForegroundColor Yellow
} catch {
    Write-Host "   Normal - API non exposee (architecture proxy)" -ForegroundColor Green
}

Write-Host "`n3. Verifier config UI" -ForegroundColor Yellow
Write-Host "   Ouvrez F12 -> Network dans le navigateur" -ForegroundColor Cyan
Write-Host "   Cherchez une requete qui echoue" -ForegroundColor Cyan
Write-Host "   Regardez la Request URL complete" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Si Request URL commence par:" -ForegroundColor White
Write-Host "   - /api/ ou http://127.0.0.1:8080/api/ -> OK (proxy)" -ForegroundColor Green
Write-Host "   - http://127.0.0.1:8001/ -> ERREUR (ancien build)" -ForegroundColor Red
Write-Host "   - http://localhost:8001/ -> ERREUR (ancien build)" -ForegroundColor Red

Write-Host "`n4. Verifier logs Nginx" -ForegroundColor Yellow
Write-Host "   Executez: docker compose logs ui --tail=20" -ForegroundColor Cyan

Write-Host "`n5. Verifier logs API" -ForegroundColor Yellow
Write-Host "   Executez: docker compose logs api-geo --tail=20" -ForegroundColor Cyan

Write-Host "`n=== Actions Correctives ===" -ForegroundColor Cyan
Write-Host "Si le proxy ne fonctionne pas:" -ForegroundColor Yellow
Write-Host "  1. docker compose down" -ForegroundColor Gray
Write-Host "  2. docker compose build --no-cache ui" -ForegroundColor Gray
Write-Host "  3. docker compose up -d" -ForegroundColor Gray
Write-Host "  4. Fermer navigateur et rouvrir en mode prive" -ForegroundColor Gray
