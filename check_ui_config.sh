#!/bin/bash
# Vérifier quelle URL l'UI utilise réellement

echo "🔍 Vérification de la configuration UI compilée..."
echo ""

# Chercher l'URL API dans les fichiers JS compilés
echo "URL API trouvées dans le build UI :"
docker compose exec ui grep -r "localhost:8001\|127.0.0.1:8001\|8001" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -5

echo ""
echo "Variables d'environnement du conteneur UI :"
docker compose exec ui env | grep VITE

echo ""
echo "✅ Si vous voyez 'localhost:8001' → Configuration correcte"
echo "❌ Si vous voyez '127.0.0.1:8001' ou autre → Rebuild nécessaire"
