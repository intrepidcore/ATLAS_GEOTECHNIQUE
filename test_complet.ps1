Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "ATLAS v1.5.0.3 - TEST COMPLET" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

Write-Host "`n1. Verification des services" -ForegroundColor Yellow
$services = docker compose ps --format json | ConvertFrom-Json
foreach ($s in $services) {
    if ($s.Health -eq "healthy" -or $s.State -eq "running") {
        Write-Host "   OK - $($s.Service)" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR - $($s.Service) : $($s.State)" -ForegroundColor Red
    }
}

Write-Host "`n2. Test proxy Nginx" -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/healthz" -TimeoutSec 5
    Write-Host "   OK - Proxy fonctionne : $($h.status)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR - Proxy : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test parametres thematiques" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&min_sondages=1"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
    $count = $r.features.Count
    Write-Host "   OK - Parametre avec underscore : $count features" -ForegroundColor Green
} catch {
    $msg = $_.Exception.Message
    Write-Host "   ERREUR - Thematique : $msg" -ForegroundColor Red
}

Write-Host "`n4. Test endpoint import/bulk" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/import/bulk" -Method Options -TimeoutSec 10
    Write-Host "   OK - Import bulk : $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ERREUR - Import : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Verification build UI" -ForegroundColor Yellow
$check = docker compose exec ui sh -c "grep -o 'http://127.0.0.1:8001' /usr/share/nginx/html/assets/*.js 2>/dev/null"
if ($check) {
    Write-Host "   ERREUR - UI utilise encore http://127.0.0.1:8001" -ForegroundColor Red
    Write-Host "   Action : Rebuild UI avec --no-cache" -ForegroundColor Yellow
} else {
    Write-Host "   OK - UI utilise /api" -ForegroundColor Green
}

Write-Host "`n6. Test logs recents" -ForegroundColor Yellow
$logs = docker compose logs ui --tail=5 2>&1 | Select-String "/api/"
if ($logs) {
    Write-Host "   OK - Requetes /api/ detectees dans les logs" -ForegroundColor Green
} else {
    Write-Host "   Info - Aucune requete /api/ recente" -ForegroundColor Cyan
    Write-Host "   (Normal si vous n'avez pas encore teste dans le navigateur)" -ForegroundColor Gray
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "TESTS AUTOMATIQUES TERMINES" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green

Write-Host "`nPROCHAINE ETAPE : Test dans le navigateur" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ctrl + Shift + N (mode prive)" -ForegroundColor White
Write-Host "2. http://127.0.0.1:8080" -ForegroundColor White
Write-Host "3. F12 -> Network" -ForegroundColor White
Write-Host "4. Tester carte thematique (IP moyen)" -ForegroundColor White
Write-Host "5. Verifier : Request URL commence par /api/" -ForegroundColor White
Write-Host ""
Write-Host "Documentation : .\TEST_NAVIGATEUR.md" -ForegroundColor Yellow
Write-Host ""
