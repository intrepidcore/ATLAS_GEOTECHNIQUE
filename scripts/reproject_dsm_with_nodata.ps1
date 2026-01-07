# Script de reprojection DSM COP30 avec gestion NoData
# Definit explicitement les valeurs NoData pour eviter les valeurs aberrantes

param(
    [string]$InputRaster = "..\ressource\DSM\rasters_COP30\output_hh.tif",
    [string]$OutputRaster = "..\ressource\DSM\rasters_COP30\dsm_cop30_25231.tif",
    [int]$NoDataValue = -9999
)

Write-Host "=== Reprojection DSM COP30 avec gestion NoData ===" -ForegroundColor Cyan

$inputPath = Join-Path $PSScriptRoot $InputRaster
$outputPath = Join-Path $PSScriptRoot $OutputRaster

if (-not (Test-Path $inputPath)) {
    Write-Host "Erreur: Fichier source introuvable: $inputPath" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier source: $inputPath" -ForegroundColor Gray
Write-Host "Fichier destination: $outputPath" -ForegroundColor Gray
Write-Host "Valeur NoData: $NoDataValue" -ForegroundColor Gray

# Verifier que gdalwarp est disponible
try {
    $null = gdalwarp --version
} catch {
    Write-Host "Erreur: gdalwarp n'est pas disponible. Installez GDAL." -ForegroundColor Red
    exit 1
}

# Reprojection avec options NoData
Write-Host "`nReprojection en cours..." -ForegroundColor Yellow
Write-Host "  EPSG:4326 (WGS84) -> EPSG:25231 (UTM 31N Togo)" -ForegroundColor Gray
Write-Host "  Options: compression LZW, tuilage, NoData=$NoDataValue" -ForegroundColor Gray

gdalwarp `
    -s_srs EPSG:4326 `
    -t_srs EPSG:25231 `
    -srcnodata $NoDataValue `
    -dstnodata $NoDataValue `
    -co "COMPRESS=LZW" `
    -co "TILED=YES" `
    -co "BLOCKXSIZE=256" `
    -co "BLOCKYSIZE=256" `
    -r bilinear `
    $inputPath `
    $outputPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nReprojection terminee avec succes !" -ForegroundColor Green
    
    # Afficher les infos du raster
    Write-Host "`n=== Informations du raster ===" -ForegroundColor Cyan
    gdalinfo $outputPath | Select-String -Pattern "Size is|Pixel Size|NoData|EPSG"
    
} else {
    Write-Host "`nErreur lors de la reprojection" -ForegroundColor Red
    exit 1
}

Write-Host "`nProchaine etape: Importer avec import_dsm_cop30.ps1" -ForegroundColor Yellow
