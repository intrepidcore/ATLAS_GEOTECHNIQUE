Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLET - Carte Thematique WGS84" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

Write-Host "`n[TEST 1] API sans geometrie" -ForegroundColor Yellow
try {
    $r1 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=0" -TimeoutSec 15
    Write-Host "  Features: $($r1.features.Count)" -ForegroundColor Cyan
    if ($r1.features.Count -gt 0) {
        Write-Host "  OK" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 2] API avec geometrie" -ForegroundColor Yellow
try {
    $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=true&min_sondages=0" -TimeoutSec 15
    Write-Host "  Features: $($r2.features.Count)" -ForegroundColor Cyan
    if ($r2.features.Count -gt 0) {
        Write-Host "  OK" -ForegroundColor Green
        $f = $r2.features[0]
        Write-Host "  Exemple feature:" -ForegroundColor Gray
        Write-Host "    Code: $($f.properties.code)" -ForegroundColor Gray
        Write-Host "    Valeur: $($f.properties.value)" -ForegroundColor Gray
        Write-Host "    Type geom: $($f.geometry.type)" -ForegroundColor Gray
        $coords = $f.geometry.coordinates[0][0]
        Write-Host "    Coords: [$($coords[0]), $($coords[1])]" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[TEST 3] Autres parametres" -ForegroundColor Yellow
$params = @("ip_avg", "vbs_avg", "wl_avg")
foreach ($param in $params) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=$param&include_geometry=true&min_sondages=1" -TimeoutSec 15
        Write-Host "  $param : $($r.features.Count) features" -ForegroundColor Cyan
    } catch {
        Write-Host "  $param : ERREUR" -ForegroundColor Red
    }
}

Write-Host "`n[TEST 4] Verification MV WGS84" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom FROM mailles_geotechnique_stats_wgs84;"

Write-Host "`n============================================================================" -ForegroundColor Green
Write-Host "  TESTS TERMINES" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green

Write-Host "`nProchaine etape: Tester dans le navigateur" -ForegroundColor Cyan
Write-Host "1. Ctrl + Shift + N (mode prive)" -ForegroundColor White
Write-Host "2. http://127.0.0.1:8080" -ForegroundColor White
Write-Host "3. Ouvrir carte thematique (icone bas droite)" -ForegroundColor White
Write-Host "4. Selectionner 'Passant 80um (moyen)'" -ForegroundColor White
Write-Host "5. Cliquer 'Appliquer'" -ForegroundColor White
Write-Host "`nResultat attendu: Carte coloree avec 187 mailles au Togo" -ForegroundColor Yellow
