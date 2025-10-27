# Rechercher les ADM3 correspondant aux localités
Write-Host "🔍 Recherche des ADM3 pour Kévé, Assahoun, Badja" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Recherche 'Kévé':" -ForegroundColor Yellow
$query1 = "SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr FROM adm3 WHERE lower(adm3_fr) LIKE '%kev%' OR lower(adm3_fr) LIKE '%keve%';"
docker compose exec -T db psql -U atlas -d atlas_clean -c $query1

Write-Host ""
Write-Host "2. Recherche 'Assahoun':" -ForegroundColor Yellow
$query2 = "SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr FROM adm3 WHERE lower(adm3_fr) LIKE '%assah%';"
docker compose exec -T db psql -U atlas -d atlas_clean -c $query2

Write-Host ""
Write-Host "3. Recherche 'Badja':" -ForegroundColor Yellow
$query3 = "SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr FROM adm3 WHERE lower(adm3_fr) LIKE '%badja%' OR lower(adm3_fr) LIKE '%badj%';"
docker compose exec -T db psql -U atlas -d atlas_clean -c $query3

Write-Host ""
Write-Host "4. Recherche dans Yoto (région probable):" -ForegroundColor Yellow
$query4 = "SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr FROM adm3 WHERE adm2_fr = 'Yoto' ORDER BY adm3_fr;"
docker compose exec -T db psql -U atlas -d atlas_clean -c $query4
