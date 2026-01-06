# Script d'import du DSM COP30 dans PostGIS
# Modèle Numérique de Surface - Copernicus DEM GLO-30
# SRID cible: 25231 (UTM Zone 31N)

param(
    [string]$RasterPath = "..\ressource\DSM\rasters_COP30\dsm_cop30_25231.tif"
)

$CONTAINER_NAME = "atlas-db"
$DB_NAME = "atlas_clean"
$DB_USER = "atlas"
$TEMP_DIR = "/tmp/import_dsm"

Write-Host "=== Import DSM COP30 dans PostGIS ===" -ForegroundColor Cyan
Write-Host "Conteneur: $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "Base de données: $DB_NAME" -ForegroundColor Gray

# Vérifier que le fichier existe
$fullPath = Join-Path $PSScriptRoot $RasterPath
if (-not (Test-Path $fullPath)) {
    Write-Host "✗ Raster introuvable: $fullPath" -ForegroundColor Red
    exit 1
}

Write-Host "Raster source: $fullPath" -ForegroundColor Gray

# Créer le répertoire temporaire dans le conteneur
Write-Host "`nPréparation du conteneur..." -ForegroundColor Gray
docker exec $CONTAINER_NAME mkdir -p $TEMP_DIR

# Copier le raster dans le conteneur
Write-Host "Copie du raster dans le conteneur..." -ForegroundColor Gray
docker cp $fullPath "${CONTAINER_NAME}:${TEMP_DIR}/dsm.tif"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erreur lors de la copie du fichier" -ForegroundColor Red
    exit 1
}

# Générer le SQL d'import avec raster2pgsql
Write-Host "Génération du SQL d'import..." -ForegroundColor Gray
Write-Host "  Options: tuilage automatique (-t auto), index spatial (-I), contraintes (-C)" -ForegroundColor Gray

$sqlFile = Join-Path $PSScriptRoot "temp_dsm_import.sql"

# Utiliser raster2pgsql en local pour générer le SQL
raster2pgsql `
    -s 25231 `
    -I -C -M `
    -t auto `
    -F `
    "${TEMP_DIR}/dsm.tif" atlas.dsm_cop30 > $sqlFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erreur lors de la génération du SQL" -ForegroundColor Red
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    exit 1
}

# Importer le SQL dans PostgreSQL
Write-Host "Import dans PostgreSQL..." -ForegroundColor Gray
Write-Host "  (Cela peut prendre plusieurs minutes selon la taille du raster)" -ForegroundColor Yellow

Get-Content $sqlFile | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ DSM importé avec succès" -ForegroundColor Green
} else {
    Write-Host "✗ Erreur lors de l'import SQL" -ForegroundColor Red
    Remove-Item $sqlFile -ErrorAction SilentlyContinue
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    exit 1
}

# Nettoyage
Write-Host "`nNettoyage..." -ForegroundColor Gray
Remove-Item $sqlFile -ErrorAction SilentlyContinue
docker exec $CONTAINER_NAME rm -rf $TEMP_DIR

# Vérification
Write-Host "`n=== Vérification de l'import ===" -ForegroundColor Cyan
$verifySQL = @"
SELECT 
    COUNT(*) as nb_tuiles,
    ST_SRID(rast) as srid,
    ST_Width(rast) as largeur_tuile,
    ST_Height(rast) as hauteur_tuile,
    ST_ScaleX(rast) as resolution_x,
    ST_ScaleY(rast) as resolution_y
FROM atlas.dsm_cop30
GROUP BY ST_SRID(rast), ST_Width(rast), ST_Height(rast), ST_ScaleX(rast), ST_ScaleY(rast);
"@

docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$verifySQL"

# Statistiques du DSM
Write-Host "`n=== Statistiques du DSM ===" -ForegroundColor Cyan
$statsSQL = @"
SELECT 
    (ST_SummaryStatsAgg(rast, 1, TRUE)).min as altitude_min,
    (ST_SummaryStatsAgg(rast, 1, TRUE)).max as altitude_max,
    (ST_SummaryStatsAgg(rast, 1, TRUE)).mean as altitude_moyenne,
    (ST_SummaryStatsAgg(rast, 1, TRUE)).stddev as ecart_type
FROM atlas.dsm_cop30;
"@

docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$statsSQL"

Write-Host "`nImport DSM terminé !" -ForegroundColor Green
Write-Host "Prochaine étape: Créer les vues d'agrégation par maille" -ForegroundColor Yellow
