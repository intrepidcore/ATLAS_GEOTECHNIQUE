# Script d'import du DSM COP30 dans PostGIS
# Modele Numerique de Surface - Copernicus DEM GLO-30
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
Write-Host "Base de donnees: $DB_NAME" -ForegroundColor Gray

# Verifier que le fichier existe
$fullPath = Join-Path $PSScriptRoot $RasterPath
if (-not (Test-Path $fullPath)) {
    Write-Host "Erreur: Raster introuvable: $fullPath" -ForegroundColor Red
    exit 1
}

Write-Host "Raster source: $fullPath" -ForegroundColor Gray

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

# Generer le SQL d'import avec raster2pgsql
Write-Host "Generation du SQL d'import..." -ForegroundColor Gray
Write-Host "  Options: tuilage 256x256, index spatial, contraintes" -ForegroundColor Gray

$sqlFile = Join-Path $PSScriptRoot "temp_dsm_import.sql"

# Utiliser raster2pgsql en local pour generer le SQL
raster2pgsql -s 25231 -I -C -M -t 256x256 -F "${TEMP_DIR}/dsm.tif" atlas.dsm_cop30 > $sqlFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la generation du SQL" -ForegroundColor Red
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    exit 1
}

# Importer le SQL dans PostgreSQL
Write-Host "Import dans PostgreSQL..." -ForegroundColor Gray
Write-Host "  (Cela peut prendre plusieurs minutes selon la taille du raster)" -ForegroundColor Yellow

Get-Content $sqlFile | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "DSM importe avec succes" -ForegroundColor Green
} else {
    Write-Host "Erreur lors de l'import SQL" -ForegroundColor Red
    Remove-Item $sqlFile -ErrorAction SilentlyContinue
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    exit 1
}

# Nettoyage
Write-Host "`nNettoyage..." -ForegroundColor Gray
Remove-Item $sqlFile -ErrorAction SilentlyContinue
docker exec $CONTAINER_NAME rm -rf $TEMP_DIR

# Verification
Write-Host "`n=== Verification de l'import ===" -ForegroundColor Cyan
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as nb_tuiles, ST_SRID(rast) as srid FROM atlas.dsm_cop30 GROUP BY ST_SRID(rast);"

Write-Host "`nImport DSM termine !" -ForegroundColor Green
Write-Host "Prochaine etape: Tester les vues d'agregation par maille" -ForegroundColor Yellow
