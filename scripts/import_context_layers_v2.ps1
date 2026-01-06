# Script d'import des couches de contexte dans PostGIS
# Géologie, Pédologie, Risque de gonflement
# SRID cible: 25231 (UTM Zone 31N)
#
# STRATÉGIE: Convertir GPKG -> SQL en local, puis importer le SQL dans le conteneur
# Nécessite: ogr2ogr installé en local (via OSGeo4W ou QGIS)

$CONTAINER_NAME = "atlas-db"
$DB_NAME = "atlas_clean"
$DB_USER = "atlas"
$TEMP_DIR = "temp_import"

Write-Host "=== Import des couches de contexte dans PostGIS ===" -ForegroundColor Cyan
Write-Host "Conteneur: $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "Base de données: $DB_NAME" -ForegroundColor Gray

# Créer le répertoire temporaire local
if (-not (Test-Path $TEMP_DIR)) {
    New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
}

# Fonction pour importer une couche
function Import-Layer {
    param(
        [string]$LayerName,
        [string]$SourceFile,
        [string]$TargetTable
    )
    
    Write-Host "`n[$LayerName] Import..." -ForegroundColor Yellow
    
    if (-not (Test-Path $SourceFile)) {
        Write-Host "  ✗ Fichier introuvable: $SourceFile" -ForegroundColor Red
        return $false
    }
    
    $sqlFile = Join-Path $TEMP_DIR "${LayerName}.sql"
    
    # Convertir GPKG -> SQL avec ogr2ogr
    Write-Host "  Conversion GPKG -> SQL..." -ForegroundColor Gray
    ogr2ogr -f "PGDump" $sqlFile $SourceFile `
        -lco SCHEMA=atlas `
        -lco CREATE_SCHEMA=OFF `
        -lco DROP_TABLE=IF_EXISTS `
        -nln $TargetTable `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Erreur lors de la conversion" -ForegroundColor Red
        return $false
    }
    
    # Importer le SQL dans le conteneur
    Write-Host "  Import dans PostgreSQL..." -ForegroundColor Gray
    Get-Content $sqlFile | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $LayerName importée" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  ✗ Erreur lors de l'import SQL" -ForegroundColor Red
        return $false
    }
}

# Import des 3 couches
$geolFile = Join-Path $PSScriptRoot "..\ressource\GEOLOGIQUE\unites_geologique_V2.gpkg"
$pedoFile = Join-Path $PSScriptRoot "..\ressource\PEDOLOGIE\unites_pedologique_V2.gpkg"
$risqueFile = Join-Path $PSScriptRoot "..\ressource\RISQUE_GONFLEMENT\carte_risque_gonflement.gpkg"

$results = @{
    "Géologie" = Import-Layer "geologie" $geolFile "unites_geologiques"
    "Pédologie" = Import-Layer "pedologie" $pedoFile "unites_pedologiques"
    "Risque" = Import-Layer "risque" $risqueFile "risque_gonflement"
}

# Nettoyage
Write-Host "`nNettoyage des fichiers temporaires..." -ForegroundColor Gray
Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

# Vérification
Write-Host "`n=== Vérification des imports ===" -ForegroundColor Cyan
$verifySQL = @"
SELECT 'geologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_geologiques GROUP BY 1,2
UNION ALL
SELECT 'pedologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_pedologiques GROUP BY 1,2
UNION ALL
SELECT 'risque_gonflement' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.risque_gonflement GROUP BY 1,2;
"@

docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$verifySQL"

# Résumé
Write-Host "`n=== Résumé ===" -ForegroundColor Cyan
foreach ($layer in $results.Keys) {
    $status = if ($results[$layer]) { "✓" } else { "✗" }
    $color = if ($results[$layer]) { "Green" } else { "Red" }
    Write-Host "$status $layer" -ForegroundColor $color
}

Write-Host "`nImport terminé !" -ForegroundColor Green
