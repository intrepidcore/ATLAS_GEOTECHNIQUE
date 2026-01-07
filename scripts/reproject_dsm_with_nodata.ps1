# Script de reprojection DSM COP30 avec gestion NoData
# Definit explicitement les valeurs NoData pour eviter les valeurs aberrantes

# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

param(
    [string]$InputRaster = (Join-Path $Global:DSM_SOURCE_PATH $Global:DSM_INPUT_FILE),
    [string]$OutputRaster = (Join-Path $Global:DSM_SOURCE_PATH $Global:DSM_REPROJECTED_FILE),
    [int]$NoDataValue = $Global:DSM_NODATA_VALUE
)

Write-AtlasLog "=== Reprojection DSM COP30 avec gestion NoData ===" -Level 'Info'

$inputPath = $InputRaster
$outputPath = $OutputRaster

if (-not (Test-Path $inputPath)) {
    Write-AtlasLog "Fichier source introuvable: $inputPath" -Level 'Error'
    exit 1
}

Write-AtlasLog "Fichier source: $inputPath" -Level 'Info'
Write-AtlasLog "Fichier destination: $outputPath" -Level 'Info'
Write-AtlasLog "Valeur NoData: $NoDataValue" -Level 'Info'

# Verifier que gdalwarp est disponible
try {
    $null = gdalwarp --version
} catch {
    Write-AtlasLog "gdalwarp n'est pas disponible. Installez GDAL." -Level 'Error'
    exit 1
}

# Reprojection avec options NoData
Write-AtlasLog "Reprojection en cours..." -Level 'Info'
Write-AtlasLog "  EPSG:4326 (WGS84) -> EPSG:$($Global:DSM_TARGET_SRID) (UTM 31N Togo)" -Level 'Info'
Write-AtlasLog "  Options: compression LZW, tuilage $($Global:DSM_TILE_SIZE)x$($Global:DSM_TILE_SIZE), NoData=$NoDataValue" -Level 'Info'

$gdal_cmd = "gdalwarp -s_srs EPSG:4326 -t_srs EPSG:$($Global:DSM_TARGET_SRID) -srcnodata $NoDataValue -dstnodata $NoDataValue -co COMPRESS=LZW -co TILED=YES -co BLOCKXSIZE=$($Global:DSM_TILE_SIZE) -co BLOCKYSIZE=$($Global:DSM_TILE_SIZE) -r bilinear `"$inputPath`" `"$outputPath`""

Invoke-AtlasCommand -Command $gdal_cmd -Description "Reprojection DSM avec gdalwarp"

# Afficher les infos du raster
Write-AtlasLog "=== Informations du raster ===" -Level 'Info'
gdalinfo $outputPath | Select-String -Pattern "Size is|Pixel Size|NoData|EPSG"

Write-AtlasLog "Prochaine etape: Importer avec import_dsm_cop30.ps1" -Level 'Info'
