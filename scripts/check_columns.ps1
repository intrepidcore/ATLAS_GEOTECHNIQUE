# Vérifier les colonnes de la table essais_geotechniques
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\d essais_geotechniques"
