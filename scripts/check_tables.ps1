Write-Host "=== Verification Tables ===" -ForegroundColor Cyan

Write-Host "`nTables disponibles:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "\dt"

Write-Host "`n`nRecherche table mailles ou grid:" -ForegroundColor Yellow
$tables = docker compose exec db psql -U atlas -d atlas -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename='mailles' OR tablename='grid');"
Write-Host $tables

if ($tables -match "mailles") {
    Write-Host "`nOK - Table 'mailles' existe" -ForegroundColor Green
    Write-Host "Le code utilise: JOIN mailles m ON m.code = s.code" -ForegroundColor Cyan
} elseif ($tables -match "grid") {
    Write-Host "`nATTENTION - Table 'grid' existe, pas 'mailles'" -ForegroundColor Yellow
    Write-Host "Il faut modifier le code pour utiliser: JOIN grid m ON m.code = s.code" -ForegroundColor Yellow
} else {
    Write-Host "`nERREUR - Ni 'mailles' ni 'grid' trouvees!" -ForegroundColor Red
}
