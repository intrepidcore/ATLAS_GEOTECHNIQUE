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

# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

$CONTAINER_NAME = $Global:ATLAS_DB_CONTAINER
$DB_NAME = $Global:ATLAS_DB_NAME
$DB_USER = $Global:ATLAS_DB_USER
$TEMP_DIR = "/tmp/import_layers"

Write-AtlasLog "=== Import des couches de contexte dans PostGIS ===" -Level 'Info'
Write-AtlasLog "Conteneur: $CONTAINER_NAME" -Level 'Info'
Write-AtlasLog "Base de données: $DB_NAME" -Level 'Info'

# Créer le répertoire temporaire dans le conteneur
Invoke-AtlasCommand "docker exec $CONTAINER_NAME mkdir -p $TEMP_DIR" -Description "Création répertoire temporaire"

# 1. Géologie
Write-AtlasLog "[1/3] Import de la géologie..." -Level 'Info'
$geolFile = Join-Path $Global:ATLAS_RESOURCE_PATH "GEOLOGIQUE\unites_geologique_V2.gpkg"
if (Test-Path $geolFile) {
    Invoke-AtlasCommand "docker cp `"$geolFile`" `"${CONTAINER_NAME}:${TEMP_DIR}/geologie.gpkg`"" -Description "Copie fichier géologie"
    
    $ogr2ogr_cmd = "docker exec $CONTAINER_NAME ogr2ogr -f PostgreSQL `"PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER`" `"${TEMP_DIR}/geologie.gpkg`" -nln atlas.unites_geologiques -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -lco FID=ogc_fid -t_srs EPSG:25231 -overwrite"
    Invoke-AtlasCommand $ogr2ogr_cmd -Description "Import géologie avec ogr2ogr"
} else {
    Write-AtlasLog "Fichier géologie introuvable: $geolFile" -Level 'Error'
    throw "Fichier géologie manquant"
}

# 2. Pédologie
Write-AtlasLog "[2/3] Import de la pédologie..." -Level 'Info'
$pedoFile = Join-Path $Global:ATLAS_RESOURCE_PATH "PEDOLOGIE\unites_pedologique_V2.gpkg"
if (Test-Path $pedoFile) {
    Invoke-AtlasCommand "docker cp `"$pedoFile`" `"${CONTAINER_NAME}:${TEMP_DIR}/pedologie.gpkg`"" -Description "Copie fichier pédologie"
    
    $ogr2ogr_cmd = "docker exec $CONTAINER_NAME ogr2ogr -f PostgreSQL `"PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER`" `"${TEMP_DIR}/pedologie.gpkg`" -nln atlas.unites_pedologiques -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -lco FID=ogc_fid -t_srs EPSG:25231 -overwrite"
    Invoke-AtlasCommand $ogr2ogr_cmd -Description "Import pédologie avec ogr2ogr"
} else {
    Write-AtlasLog "Fichier pédologie introuvable: $pedoFile" -Level 'Error'
    throw "Fichier pédologie manquant"
}

# 3. Risque de gonflement
Write-AtlasLog "[3/3] Import du risque de gonflement..." -Level 'Info'
$risqueFile = Join-Path $Global:ATLAS_RESOURCE_PATH "RISQUE_GONFLEMENT\carte_risque_gonflement.gpkg"
if (Test-Path $risqueFile) {
    Invoke-AtlasCommand "docker cp `"$risqueFile`" `"${CONTAINER_NAME}:${TEMP_DIR}/risque.gpkg`"" -Description "Copie fichier risque gonflement"
    
    $ogr2ogr_cmd = "docker exec $CONTAINER_NAME ogr2ogr -f PostgreSQL `"PG:host=localhost port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_USER`" `"${TEMP_DIR}/risque.gpkg`" -nln atlas.risque_gonflement -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -lco FID=ogc_fid -t_srs EPSG:25231 -overwrite"
    Invoke-AtlasCommand $ogr2ogr_cmd -Description "Import risque gonflement avec ogr2ogr"
} else {
    Write-AtlasLog "Fichier risque gonflement introuvable: $risqueFile" -Level 'Error'
    throw "Fichier risque gonflement manquant"
}

# Nettoyage du répertoire temporaire
Invoke-AtlasCommand "docker exec $CONTAINER_NAME rm -rf $TEMP_DIR" -Description "Nettoyage fichiers temporaires"

Write-AtlasLog "=== Vérification des imports ===" -Level 'Info'
$verifySQL = @"
SELECT 'geologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_geologiques GROUP BY 1,2
UNION ALL
SELECT 'pedologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_pedologiques GROUP BY 1,2
UNION ALL
SELECT 'risque_gonflement' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.risque_gonflement GROUP BY 1,2;
"@

docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$verifySQL"

Write-AtlasLog "Import terminé !" -Level 'Success'
