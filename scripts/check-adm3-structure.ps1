# Vérifier la structure de la table adm3
Write-Host "📋 Structure de la table adm3:" -ForegroundColor Cyan
Write-Host ""

docker compose exec -T db psql -U atlas -d atlas_clean -c "\d adm3"

Write-Host ""
Write-Host "🔍 Recherche des ADM3 correspondants:" -ForegroundColor Cyan
Write-Host ""

$query = @"
SELECT name_3, name_2, name_1 
FROM adm3 
WHERE unaccent(lower(name_3)) LIKE ANY (ARRAY[
  unaccent(lower('%keve%')),
  unaccent(lower('%assah%')),
  unaccent(lower('%badja%'))
])
ORDER BY name_3;
"@

docker compose exec -T db psql -U atlas -d atlas_clean -c $query
