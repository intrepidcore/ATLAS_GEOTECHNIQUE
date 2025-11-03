Write-Host "=== Structure de la vue mailles_geotechnique_stats ===" -ForegroundColor Cyan

Write-Host "`nColonnes de la vue:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "\d mailles_geotechnique_stats"

Write-Host "`n`nExemple de donnees (1 ligne):" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT code, passant_80um_avg, ip_avg, n_sondages FROM mailles_geotechnique_stats WHERE passant_80um_avg IS NOT NULL LIMIT 1;"
