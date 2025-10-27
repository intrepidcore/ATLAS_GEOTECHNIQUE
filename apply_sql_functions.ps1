# Script pour appliquer les nouvelles fonctions SQL
Write-Host "Application des fonctions SQL..." -ForegroundColor Cyan

# Copier les fichiers SQL dans le conteneur
docker cp sql/fn_granulo_indices.sql atlas-db:/tmp/
docker cp sql/fn_classify_uscs.sql atlas-db:/tmp/
docker cp sql/fn_classify_aashto.sql atlas-db:/tmp/
docker cp sql/v_samples_complete.sql atlas-db:/tmp/

# Appliquer les fonctions
Write-Host "1. fn_granulo_indices..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_granulo_indices.sql

Write-Host "2. fn_classify_uscs..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_classify_uscs.sql

Write-Host "3. fn_classify_aashto..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_classify_aashto.sql

Write-Host "4. v_samples_complete..." -ForegroundColor Yellow
docker compose exec -T db psql -U atlas -d atlas -f /tmp/v_samples_complete.sql

Write-Host "✅ Fonctions SQL appliquées avec succès !" -ForegroundColor Green
