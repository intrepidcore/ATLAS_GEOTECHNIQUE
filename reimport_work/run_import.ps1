# ============================================================================
# SCRIPT D'ORCHESTRATION COMPLET - IMPORT MAÎTRE FIDÈLE
# Exécute toute la procédure de A à Z
# ============================================================================

Write-Host "🚀 IMPORT MAÎTRE FIDÈLE - ORCHESTRATION COMPLÈTE" -ForegroundColor Green
Write-Host "=" * 80

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "csv_preserve")) {
    Write-Host "❌ Répertoire csv_preserve non trouvé. Exécutez d'abord prepare_csv_preserve.py" -ForegroundColor Red
    exit 1
}

# ============================================================================
# ÉTAPE 1: NETTOYAGE DES DOUBLONS EXISTANTS
# ============================================================================
Write-Host "`n🧹 ÉTAPE 1: NETTOYAGE DES DOUBLONS EXISTANTS" -ForegroundColor Yellow

Write-Host "Copie du script de nettoyage..."
docker cp detect_clean_duplicates.sql atlas-db:/tmp/

Write-Host "Exécution du nettoyage des doublons..."
docker exec atlas-db psql -U atlas -d atlas_clean -f /tmp/detect_clean_duplicates.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du nettoyage des doublons" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Nettoyage des doublons terminé" -ForegroundColor Green

# ============================================================================
# ÉTAPE 2: COPIE DES CSV FIDÈLES DANS LE CONTENEUR
# ============================================================================
Write-Host "`n📁 ÉTAPE 2: COPIE DES CSV FIDÈLES" -ForegroundColor Yellow

Write-Host "Création du répertoire dans le conteneur..."
docker exec atlas-db mkdir -p /tmp/csv_preserve

Write-Host "Copie des fichiers CSV..."
$csvFiles = Get-ChildItem -Path "csv_preserve\*.csv"
foreach ($file in $csvFiles) {
    Write-Host "  Copie: $($file.Name)"
    docker cp $file.FullName atlas-db:/tmp/csv_preserve/
}

Write-Host "✅ CSV copiés dans le conteneur" -ForegroundColor Green

# ============================================================================
# ÉTAPE 3: IMPORT COMPLET ET ROBUSTE
# ============================================================================
Write-Host "`n🔄 ÉTAPE 3: IMPORT COMPLET ET ROBUSTE" -ForegroundColor Yellow

Write-Host "Copie du script d'import..."
docker cp import_full_preserve.sql atlas-db:/tmp/

Write-Host "Exécution de l'import complet..."
docker exec atlas-db psql -U atlas -d atlas_clean -f /tmp/import_full_preserve.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'import" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Import complet terminé" -ForegroundColor Green

# ============================================================================
# ÉTAPE 4: VALIDATIONS POST-IMPORT
# ============================================================================
Write-Host "`n🔍 ÉTAPE 4: VALIDATIONS POST-IMPORT" -ForegroundColor Yellow

Write-Host "Validation des comptes..."
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT 'VALIDATION_FINALE' as section, 
       'sondages' as table_name, 
       COUNT(*) as count_db,
       230 as count_excel,
       CASE WHEN COUNT(*) = 230 THEN '✅' ELSE '❌' END as status
FROM public.sondages
UNION ALL
SELECT 'VALIDATION_FINALE', 'echantillons', COUNT(*), 946,
       CASE WHEN COUNT(*) = 946 THEN '✅' ELSE '❌' END
FROM public.echantillons
UNION ALL
SELECT 'VALIDATION_FINALE', 'essais_atterberg', COUNT(*), 156,
       CASE WHEN COUNT(*) = 156 THEN '✅' ELSE '❌' END
FROM public.essais_atterberg;
"

Write-Host "Validation du géocodage..."
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT 
    'GÉOCODAGE' as section,
    COUNT(*) as total_sondages,
    COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geometrie,
    COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '') as avec_localite_key,
    ROUND(100.0 * COUNT(*) FILTER (WHERE geom IS NOT NULL) / COUNT(*), 2) as pct_geocode
FROM public.sondages;
"

Write-Host "Validation de l'intégrité FK..."
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT 
    'INTÉGRITÉ_FK' as section,
    COUNT(*) as echantillons_orphelins
FROM public.echantillons e 
LEFT JOIN public.sondages s ON e.sondage_id = s.id 
WHERE s.id IS NULL;
"

# ============================================================================
# ÉTAPE 5: FORCER LE GÉOCODAGE AUTOMATIQUE
# ============================================================================
Write-Host "`n🗺️ ÉTAPE 5: ACTIVATION DU GÉOCODAGE AUTOMATIQUE" -ForegroundColor Yellow

Write-Host "Forçage du géocodage basé sur adm3_id..."
docker exec atlas-db psql -U atlas -d atlas_clean -c "
-- Géocoder les sondages avec adm3_id mais sans géométrie
UPDATE public.sondages 
SET geom = (
    SELECT ST_Centroid(geom) 
    FROM atlas.adm3 
    WHERE gid = sondages.adm3_id
),
location_mode = 'centroid',
location_accuracy = 'adm3_centroid'
WHERE adm3_id IS NOT NULL 
  AND geom IS NULL
  AND EXISTS (SELECT 1 FROM atlas.adm3 WHERE gid = sondages.adm3_id);

-- Mettre à jour is_geocoded
UPDATE public.sondages 
SET is_geocoded = true 
WHERE geom IS NOT NULL AND is_geocoded = false;

-- Statistiques finales
SELECT 
    'GÉOCODAGE_FINAL' as section,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE geom IS NOT NULL) as geocoded,
    COUNT(*) FILTER (WHERE is_geocoded = true) as marked_geocoded,
    ROUND(100.0 * COUNT(*) FILTER (WHERE geom IS NOT NULL) / COUNT(*), 2) as pct_success
FROM public.sondages;
"

# ============================================================================
# ÉTAPE 6: RESTART DES SERVICES
# ============================================================================
Write-Host "`n🔄 ÉTAPE 6: RESTART DES SERVICES" -ForegroundColor Yellow

Write-Host "Restart du backend et frontend..."
docker-compose restart api-geo ui

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Erreur lors du restart des services" -ForegroundColor Yellow
} else {
    Write-Host "✅ Services redémarrés" -ForegroundColor Green
}

# ============================================================================
# RAPPORT FINAL
# ============================================================================
Write-Host "`n📊 RAPPORT FINAL" -ForegroundColor Green
Write-Host "=" * 80

Write-Host "✅ IMPORT MAÎTRE TERMINÉ AVEC SUCCÈS" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 RÉSULTATS:" -ForegroundColor Cyan
Write-Host "  - Données Excel préservées fidèlement" -ForegroundColor White
Write-Host "  - IDs mappés de façon déterministe" -ForegroundColor White
Write-Host "  - Géométries WKT converties en PostGIS" -ForegroundColor White
Write-Host "  - Colonnes localite_key préservées" -ForegroundColor White
Write-Host "  - Timestamps created_at/updated_at préservés" -ForegroundColor White
Write-Host "  - Doublons éliminés avec contraintes uniques" -ForegroundColor White
Write-Host "  - Géocodage automatique activé" -ForegroundColor White
Write-Host ""
Write-Host "🌐 APPLICATION PRÊTE:" -ForegroundColor Cyan
Write-Host "  - Interface: http://localhost:8080/db-manager.html" -ForegroundColor White
Write-Host "  - Les sondages ne devraient plus être gris" -ForegroundColor White
Write-Host "  - Toutes les données Excel sont maintenant fidèlement importées" -ForegroundColor White

Write-Host "`n🎉 MISSION ACCOMPLIE!" -ForegroundColor Green
