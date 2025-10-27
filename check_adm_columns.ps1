Write-Host "=== Verification colonnes tables ADM ===" -ForegroundColor Cyan

Write-Host "`n1. Colonnes de adm1:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'adm1' ORDER BY ordinal_position;"

Write-Host "`n2. Exemple de données adm1:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT * FROM adm1 LIMIT 1;"

Write-Host "`n3. Vérifier si les mailles sont déjà étiquetées:" -ForegroundColor Yellow
docker compose exec db psql -U atlas -d atlas -c "SELECT COUNT(*) as total, COUNT(adm1_name) as avec_adm1, COUNT(adm2_name) as avec_adm2 FROM mailles;"
