Write-Host "=== DIAGNOSTIC COMPLET - Carte Thematique ===" -ForegroundColor Cyan

Write-Host "`n[ETAPE 1] Test sans geometrie ni filtres" -ForegroundColor Yellow
Write-Host "URL: /api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=0" -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=false&min_sondages=0" -TimeoutSec 15
    $count = $r.features.Count
    Write-Host "  Features retournees: $count" -ForegroundColor Cyan
    
    if ($count -gt 0) {
        Write-Host "  OK - La colonne existe et contient des valeurs" -ForegroundColor Green
        Write-Host "  Probleme probable: colonne geom manquante ou filtre trop strict" -ForegroundColor Yellow
    } else {
        Write-Host "  ERREUR - 0 features meme sans geometrie" -ForegroundColor Red
        Write-Host "  Probleme: nom de colonne ou alias incorrect" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERREUR API: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[ETAPE 2] Verification structure MV" -ForegroundColor Yellow

Write-Host "`n2.1 - Colonnes de la MV:" -ForegroundColor Cyan
$cols = docker compose exec db psql -U atlas -d atlas -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'mailles_geotechnique_stats' ORDER BY ordinal_position;"
if ($cols) {
    Write-Host $cols -ForegroundColor Gray
    if ($cols -match "geom") {
        Write-Host "  OK - Colonne geom presente" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR - Colonne geom ABSENTE" -ForegroundColor Red
        Write-Host "  Action: Recreer la MV avec geom (Fix B)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ERREUR - Impossible de lister les colonnes" -ForegroundColor Red
}

Write-Host "`n2.2 - Info MV:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT matviewname, ispopulated FROM pg_matviews WHERE matviewname = 'mailles_geotechnique_stats';"

Write-Host "`n2.3 - Comptage passant_80um_avg:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL;"

Write-Host "`n2.4 - Test filtre n_sondages:" -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE (n_sondages IS NULL OR n_sondages >= 0);"

Write-Host "`n[ETAPE 3] Test avec geometrie" -ForegroundColor Yellow
Write-Host "URL: /api/thematic/data?parameter=passant_80um_avg&include_geometry=true&min_sondages=0" -ForegroundColor Gray
try {
    $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&include_geometry=true&min_sondages=0" -TimeoutSec 15
    $count2 = $r2.features.Count
    Write-Host "  Features retournees: $count2" -ForegroundColor Cyan
    
    if ($count2 -gt 0) {
        Write-Host "  OK - Geometrie fonctionne" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR - 0 features avec geometrie" -ForegroundColor Red
        Write-Host "  Confirme: colonne geom manquante" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERREUR API: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[DIAGNOSTIC]" -ForegroundColor Cyan
Write-Host "Si geom absente: Appliquer Fix B (recreer MV)" -ForegroundColor Yellow
Write-Host "Si geom presente mais 0 features: Verifier logs API" -ForegroundColor Yellow
