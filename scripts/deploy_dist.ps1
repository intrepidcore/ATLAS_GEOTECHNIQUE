# Script de déploiement rapide du dist dans le conteneur Nginx

Write-Host "=== Déploiement du dist dans le conteneur UI ===" -ForegroundColor Cyan

# 1. Vider le répertoire Nginx
Write-Host "`n1. Nettoyage du répertoire Nginx..." -ForegroundColor Yellow
docker exec atlas-ui rm -rf /usr/share/nginx/html/*

# 2. Copier les nouveaux fichiers
Write-Host "`n2. Copie des fichiers dist..." -ForegroundColor Yellow
docker cp ui/dist/. atlas-ui:/usr/share/nginx/html/

# 3. Vérifier les assets
Write-Host "`n3. Vérification des assets..." -ForegroundColor Yellow
docker exec atlas-ui ls -lh /usr/share/nginx/html/assets

# 4. Chercher les logs [WZ] dans le JS
Write-Host "`n4. Recherche des logs [WZ] dans le JS..." -ForegroundColor Yellow
docker exec atlas-ui sh -c "grep -o '\[WZ\]' /usr/share/nginx/html/assets/*.js | head -10"

Write-Host "`n✅ Déploiement terminé !" -ForegroundColor Green
Write-Host "Rafraîchissez le navigateur avec Ctrl+Shift+R" -ForegroundColor Cyan
