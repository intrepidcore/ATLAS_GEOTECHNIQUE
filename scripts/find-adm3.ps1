# Rechercher les ADM3 correspondant aux localités
Write-Host "🔍 Recherche des ADM3 pour Kévé, Assahoun, Badja" -ForegroundColor Cyan
Write-Host ""

$query = @"
SELECT code, name, adm2_name, adm1_name 
FROM adm3 
WHERE unaccent(lower(name)) LIKE ANY (ARRAY[
  unaccent(lower('%keve%')),
  unaccent(lower('%assah%')),
  unaccent(lower('%badja%'))
])
ORDER BY name;
"@

docker compose exec -T db psql -U atlas -d atlas_clean -c $query
