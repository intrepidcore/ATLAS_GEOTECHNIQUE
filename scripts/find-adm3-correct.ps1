# Rechercher les ADM3 correspondant aux localités
Write-Host "🔍 Recherche des ADM3 pour Kévé, Assahoun, Badja" -ForegroundColor Cyan
Write-Host ""

$query = @"
SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr 
FROM adm3 
WHERE unaccent(lower(adm3_fr)) LIKE ANY (ARRAY[
  unaccent(lower('%keve%')),
  unaccent(lower('%assah%')),
  unaccent(lower('%badja%'))
])
ORDER BY adm3_fr;
"@

docker compose exec -T db psql -U atlas -d atlas_clean -c $query

Write-Host ""
Write-Host "💡 Si aucun résultat, cherchons dans toutes les ADM3 du Togo:" -ForegroundColor Yellow
Write-Host ""

$queryAll = "SELECT adm3_pcode, adm3_fr, adm2_fr FROM adm3 ORDER BY adm3_fr LIMIT 20;"
docker compose exec -T db psql -U atlas -d atlas_clean -c $queryAll
