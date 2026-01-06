# Script d'import du DSM COP30 dans PostGIS
# Execution complete dans le conteneur Docker

param(
    [string]$RasterPath = "..\ressource\DSM\rasters_COP30\dsm_cop30_25231.tif"
)

$CONTAINER_NAME = "atlas-db"
$DB_NAME = "atlas_clean"
$DB_USER = "atlas"
$TEMP_DIR = "/tmp/import_dsm"

Write-Host "=== Import DSM COP30 dans PostGIS ===" -ForegroundColor Cyan
Write-Host "Conteneur: $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "Base de donnees: $DB_NAME" -ForegroundColor Gray

# Verifier que le fichier existe
$fullPath = Join-Path $PSScriptRoot $RasterPath
if (-not (Test-Path $fullPath)) {
    Write-Host "Erreur: Raster introuvable: $fullPath" -ForegroundColor Red
    exit 1
}

Write-Host "Raster source: $fullPath" -ForegroundColor Gray
$fileSize = (Get-Item $fullPath).Length / 1MB
Write-Host "Taille: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray

# Creer le repertoire temporaire dans le conteneur
Write-Host "`nPreparation du conteneur..." -ForegroundColor Gray
docker exec $CONTAINER_NAME mkdir -p $TEMP_DIR

# Copier le raster dans le conteneur
Write-Host "Copie du raster dans le conteneur..." -ForegroundColor Gray
docker cp $fullPath "${CONTAINER_NAME}:${TEMP_DIR}/dsm.tif"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la copie du fichier" -ForegroundColor Red
    exit 1
}

Write-Host "Copie terminee" -ForegroundColor Green

# Generer et importer le raster directement dans le conteneur
Write-Host "`nImport du raster dans PostgreSQL..." -ForegroundColor Gray
Write-Host "  Options: tuilage 256x256, index spatial, contraintes" -ForegroundColor Gray
Write-Host "  (Cela peut prendre plusieurs minutes)" -ForegroundColor Yellow

docker exec $CONTAINER_NAME bash -c "raster2pgsql -s 25231 -I -C -M -t 256x256 -F ${TEMP_DIR}/dsm.tif atlas.dsm_cop30 | psql -U $DB_USER -d $DB_NAME"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDSM importe avec succes !" -ForegroundColor Green
} else {
    Write-Host "`nErreur lors de l'import" -ForegroundColor Red
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    exit 1
}

# Nettoyage
Write-Host "`nNettoyage..." -ForegroundColor Gray
docker exec $CONTAINER_NAME rm -rf $TEMP_DIR

# Verification
Write-Host "`n=== Verification de l'import ===" -ForegroundColor Cyan
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as nb_tuiles, ST_SRID(rast) as srid FROM atlas.dsm_cop30 GROUP BY ST_SRID(rast);"

Write-Host "`n=== Test des vues DSM ===" -ForegroundColor Cyan
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as mailles_avec_dsm FROM atlas.v_maille_dsm_2km_flat WHERE altitude_mean IS NOT NULL;"

Write-Host "`nImport DSM termine !" -ForegroundColor Green
Write-Host "Prochaine etape: Tester l'endpoint API /coverage/mailles-dsm" -ForegroundColor Yellow
