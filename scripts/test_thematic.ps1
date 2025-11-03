Write-Host "=== Test Carte Thematique ===" -ForegroundColor Cyan

Write-Host "`n1. Test requete thematique avec passant_80um_avg" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=passant_80um_avg&min_sondages=1"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   Features: $($r.features.Count)" -ForegroundColor Cyan
    
    if ($r.features.Count -gt 0) {
        Write-Host "   OK - Donnees trouvees" -ForegroundColor Green
        $firstFeature = $r.features[0]
        Write-Host "   Exemple valeur: $($firstFeature.properties.value)" -ForegroundColor Gray
    } else {
        Write-Host "   ATTENTION - Aucune feature retournee" -ForegroundColor Yellow
        Write-Host "   Cela explique l'erreur 'Aucune valeur a classifier'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Test avec ip_avg (indice de plasticite)" -ForegroundColor Yellow
try {
    $url = "http://127.0.0.1:8080/api/thematic/data?parameter=ip_avg&min_sondages=1"
    $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
    Write-Host "   Features: $($r.features.Count)" -ForegroundColor Cyan
    
    if ($r.features.Count -gt 0) {
        Write-Host "   OK - Donnees trouvees" -ForegroundColor Green
    } else {
        Write-Host "   ATTENTION - Aucune feature" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Verification vue materialisee" -ForegroundColor Yellow
Write-Host "   Rafraichissement de la vue..." -ForegroundColor Cyan
docker compose exec db psql -U atlas -d atlas -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK - Vue rafraichie" -ForegroundColor Green
} else {
    Write-Host "   ERREUR - Impossible de rafraichir la vue" -ForegroundColor Red
}

Write-Host "`n4. Comptage des donnees dans la vue" -ForegroundColor Yellow
$count = docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL;" 2>&1
Write-Host "   $count" -ForegroundColor Cyan

Write-Host "`n=== DIAGNOSTIC ===" -ForegroundColor Cyan
Write-Host "Si toutes les requetes retournent 0 features:" -ForegroundColor Yellow
Write-Host "  1. La base de donnees est vide ou" -ForegroundColor Gray
Write-Host "  2. La vue materialisee n'est pas a jour ou" -ForegroundColor Gray
Write-Host "  3. Les donnees n'ont pas les parametres geotechniques" -ForegroundColor Gray
Write-Host ""
Write-Host "Solution: Importer des donnees de test" -ForegroundColor Green
