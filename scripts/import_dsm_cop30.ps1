# Script d'import du DSM COP30 dans PostGIS
# Execution complete dans le conteneur Docker

# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

param(
    [string]$RasterPath = (Join-Path $Global:DSM_SOURCE_PATH $Global:DSM_REPROJECTED_FILE)
)

$CONTAINER_NAME = $Global:ATLAS_DB_CONTAINER
$DB_NAME = $Global:ATLAS_DB_NAME
$DB_USER = $Global:ATLAS_DB_USER
$TEMP_DIR = "/tmp/import_dsm"

Write-AtlasLog "=== Import DSM COP30 dans PostGIS ===" -Level 'Info'
Write-AtlasLog "Conteneur: $CONTAINER_NAME" -Level 'Info'
Write-AtlasLog "Base de donnees: $DB_NAME" -Level 'Info'

# Verifier que le fichier existe
$fullPath = $RasterPath
if (-not (Test-Path $fullPath)) {
    Write-AtlasLog "Raster introuvable: $fullPath" -Level 'Error'
    exit 1
}

Write-AtlasLog "Raster source: $fullPath" -Level 'Info'
$fileSize = (Get-Item $fullPath).Length / 1MB
Write-AtlasLog "Taille: $([math]::Round($fileSize, 2)) MB" -Level 'Info'

# Creer le repertoire temporaire dans le conteneur
Write-AtlasLog "Preparation du conteneur..." -Level 'Info'
Invoke-AtlasCommand "docker exec $CONTAINER_NAME mkdir -p $TEMP_DIR" -Description "Creation repertoire temporaire"

# Copier le raster dans le conteneur
Invoke-AtlasCommand "docker cp `"$fullPath`" `"${CONTAINER_NAME}:${TEMP_DIR}/dsm.tif`"" -Description "Copie raster dans conteneur"

# Generer et importer le raster directement dans le conteneur
Write-AtlasLog "Import du raster dans PostgreSQL..." -Level 'Info'
Write-AtlasLog "  Options: tuilage $($Global:DSM_TILE_SIZE)x$($Global:DSM_TILE_SIZE), index spatial, contraintes, NoData=$($Global:DSM_NODATA_VALUE)" -Level 'Info'
Write-AtlasLog "  (Cela peut prendre plusieurs minutes)" -Level 'Warning'

# -N: Set NODATA value (important pour filtrer les valeurs invalides)
$import_cmd = "docker exec $CONTAINER_NAME bash -c `"raster2pgsql -s $($Global:DSM_TARGET_SRID) -I -C -M -N $($Global:DSM_NODATA_VALUE) -t $($Global:DSM_TILE_SIZE)x$($Global:DSM_TILE_SIZE) -F ${TEMP_DIR}/dsm.tif atlas.dsm_cop30 | psql -U $DB_USER -d $DB_NAME`""

try {
    Invoke-AtlasCommand $import_cmd -Description "Import DSM avec raster2pgsql"
} catch {
    Write-AtlasLog "Nettoyage apres erreur..." -Level 'Warning'
    docker exec $CONTAINER_NAME rm -rf $TEMP_DIR
    throw
}

# Nettoyage
Write-AtlasLog "Nettoyage..." -Level 'Info'
Invoke-AtlasCommand "docker exec $CONTAINER_NAME rm -rf $TEMP_DIR" -Description "Suppression fichiers temporaires"

# Verification
Write-AtlasLog "=== Verification de l'import ===" -Level 'Info'
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as nb_tuiles, ST_SRID(rast) as srid FROM atlas.dsm_cop30 GROUP BY ST_SRID(rast);"

Write-AtlasLog "=== Test des vues DSM ===" -Level 'Info'
docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as mailles_avec_dsm FROM atlas.v_maille_dsm_2km_flat WHERE altitude_mean IS NOT NULL;"

Write-AtlasLog "Import DSM termine !" -Level 'Success'
Write-AtlasLog "Prochaine etape: Tester l'endpoint API /coverage/mailles-dsm" -Level 'Info'
