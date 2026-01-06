# Script d'import des couches de contexte dans PostGIS
# Géologie, Pédologie, Risque de gonflement
# SRID cible: 25231 (UTM Zone 31N)
#
# IMPORTANT: Ce script importe les données depuis ressource/ vers les tables:
#   - atlas.unites_geologiques
#   - atlas.unites_pedologiques
#   - atlas.risque_gonflement
#
# Structure attendue par l'API (voir db/migrations/090_create_context_layers.sql):
#   - ogc_fid (PK, auto-généré par ogr2ogr)
#   - code, libelle, description, geom
#
# STRATÉGIE: Copie les fichiers dans le conteneur Docker puis utilise ogr2ogr depuis le conteneur
# pour éviter les problèmes d'authentification PostgreSQL

$CONTAINER_NAME = "atlas-db"
$DB_NAME = "atlas_clean"
$DB_USER = "atlas"
$TEMP_DIR = "/tmp/import_layers"

Write-Host "=== Import des couches de contexte dans PostGIS ===" -ForegroundColor Cyan
Write-Host "Conteneur: $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "Base de données: $DB_NAME" -ForegroundColor Gray

# Créer le répertoire temporaire dans le conteneur
Write-Host "`nCréation du répertoire temporaire dans le conteneur..." -ForegroundColor Gray
docker exec $CONTAINER_NAME mkdir -p $TEMP_DIR

# 1. Géologie
Write-Host "`n[1/3] Import de la géologie..." -ForegroundColor Yellow
$geolFile = Join-Path $PSScriptRoot "..\ressource\GEOLOGIQUE\unites_geologique_V2.gpkg"
if (Test-Path $geolFile) {
    Write-Host "  Copie du fichier dans le conteneur..." -ForegroundColor Gray
    docker cp $geolFile "${CONTAINER_NAME}:${TEMP_DIR}/geologie.gpkg"
    
    Write-Host "  Import avec ogr2ogr..." -ForegroundColor Gray
    docker exec $CONTAINER_NAME ogr2ogr `
        -f PostgreSQL "PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER" `
        "${TEMP_DIR}/geologie.gpkg" `
        -nln atlas.unites_geologiques `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Géologie importée" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Erreur lors de l'import de la géologie" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Fichier géologie introuvable: $geolFile" -ForegroundColor Red
}

# 2. Pédologie
Write-Host "`n[2/3] Import de la pédologie..." -ForegroundColor Yellow
$pedoFile = Join-Path $PSScriptRoot "..\ressource\PEDOLOGIE\unites_pedologique_V2.gpkg"
if (Test-Path $pedoFile) {
    Write-Host "  Copie du fichier dans le conteneur..." -ForegroundColor Gray
    docker cp $pedoFile "${CONTAINER_NAME}:${TEMP_DIR}/pedologie.gpkg"
    
    Write-Host "  Import avec ogr2ogr..." -ForegroundColor Gray
    docker exec $CONTAINER_NAME ogr2ogr `
        -f PostgreSQL "PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER" `
        "${TEMP_DIR}/pedologie.gpkg" `
        -nln atlas.unites_pedologiques `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Pédologie importée" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Erreur lors de l'import de la pédologie" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Fichier pédologie introuvable: $pedoFile" -ForegroundColor Red
}

# 3. Risque de gonflement
Write-Host "`n[3/3] Import du risque de gonflement..." -ForegroundColor Yellow
$risqueFile = Join-Path $PSScriptRoot "..\ressource\RISQUE_GONFLEMENT\carte_risque_gonflement.gpkg"
if (Test-Path $risqueFile) {
    Write-Host "  Copie du fichier dans le conteneur..." -ForegroundColor Gray
    docker cp $risqueFile "${CONTAINER_NAME}:${TEMP_DIR}/risque.gpkg"
    
    Write-Host "  Import avec ogr2ogr..." -ForegroundColor Gray
    docker exec $CONTAINER_NAME ogr2ogr `
        -f PostgreSQL "PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER" `
        "${TEMP_DIR}/risque.gpkg" `
        -nln atlas.risque_gonflement `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Risque de gonflement importé" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Erreur lors de l'import du risque" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Fichier risque introuvable: $risqueFile" -ForegroundColor Red
}

# Nettoyage du répertoire temporaire
Write-Host "`nNettoyage..." -ForegroundColor Gray
docker exec $CONTAINER_NAME rm -rf $TEMP_DIR

Write-Host "`n=== Vérification des imports ===" -ForegroundColor Cyan
$verifySQL = @"
SELECT 'geologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_geologiques GROUP BY 1,2
UNION ALL
SELECT 'pedologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_pedologiques GROUP BY 1,2
UNION ALL
SELECT 'risque_gonflement' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.risque_gonflement GROUP BY 1,2;
"@

docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$verifySQL"

Write-Host ""
Write-Host "Import terminé !" -ForegroundColor Green
