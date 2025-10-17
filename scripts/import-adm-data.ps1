# Script d'import des données administratives (ADM1, ADM2, ADM3) dans PostgreSQL
# Utilise shp2pgsql pour convertir les Shapefiles en SQL

Write-Host "📥 Import des données administratives du Togo..." -ForegroundColor Cyan

$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "atlas"
$DB_USER = "atlas"
$DB_PASSWORD = "atlas"

$SHP_DIR = "C:\PROJET_ATLAS_MASTER\atlas\data\shp\togo"

# Vérifier que Docker/PostgreSQL est démarré
Write-Host "`n📊 Vérification de la base de données..." -ForegroundColor Yellow
$dbRunning = docker ps --filter "name=atlas-db" --filter "status=running" --format "{{.Names}}"
if (-not $dbRunning) {
    Write-Host "❌ La base de données n'est pas démarrée. Lancement..." -ForegroundColor Red
    Set-Location "C:\PROJET_ATLAS_MASTER\atlas"
    docker compose up db -d
    Write-Host "⏳ Attente de la DB (15s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
}

Write-Host "`n✅ Base de données prête !" -ForegroundColor Green

# Fonction pour exécuter une commande SQL
function Invoke-Sql {
    param([string]$Query)
    
    $env:PGPASSWORD = $DB_PASSWORD
    docker exec atlas-db psql -U $DB_USER -d $DB_NAME -c $Query
}

# Créer les tables
Write-Host "`n📋 Création des tables ADM..." -ForegroundColor Cyan

$createTables = @"
-- Table ADM1 (Régions)
DROP TABLE IF EXISTS adm1_tg CASCADE;
CREATE TABLE adm1_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table ADM2 (Préfectures)
DROP TABLE IF EXISTS adm2_tg CASCADE;
CREATE TABLE adm2_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    adm1_name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table ADM3 (Communes)
DROP TABLE IF EXISTS adm3_tg CASCADE;
CREATE TABLE adm3_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    adm1_name TEXT NOT NULL,
    adm2_name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);
"@

Invoke-Sql $createTables

Write-Host "✅ Tables créées" -ForegroundColor Green

# Importer les Shapefiles avec ogr2ogr (via Docker GDAL officiel)
Write-Host "`n📥 Import des Shapefiles..." -ForegroundColor Cyan

# ADM1 (Régions)
Write-Host "   Importing ADM1 (Régions)..." -ForegroundColor Gray
docker run --rm `
    -v "${SHP_DIR}:/data" `
    --network atlas_atlas-net `
    ghcr.io/osgeo/gdal:alpine-normal-latest `
    ogr2ogr -f "PostgreSQL" `
    "PG:host=atlas-db port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD" `
    "/data/tgo_admbnda_adm1_inseed_itos_20210107.shp" `
    -nln adm1_temp -overwrite -lco GEOMETRY_NAME=geom -nlt PROMOTE_TO_MULTI -t_srs EPSG:4326

# ADM2 (Préfectures)
Write-Host "   Importing ADM2 (Préfectures)..." -ForegroundColor Gray
docker run --rm `
    -v "${SHP_DIR}:/data" `
    --network atlas_atlas-net `
    ghcr.io/osgeo/gdal:alpine-normal-latest `
    ogr2ogr -f "PostgreSQL" `
    "PG:host=atlas-db port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD" `
    "/data/tgo_admbnda_adm2_inseed_itos_20210107.shp" `
    -nln adm2_temp -overwrite -lco GEOMETRY_NAME=geom -nlt PROMOTE_TO_MULTI -t_srs EPSG:4326

# ADM3 (Communes)
Write-Host "   Importing ADM3 (Communes)..." -ForegroundColor Gray
docker run --rm `
    -v "${SHP_DIR}:/data" `
    --network atlas_atlas-net `
    ghcr.io/osgeo/gdal:alpine-normal-latest `
    ogr2ogr -f "PostgreSQL" `
    "PG:host=atlas-db port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD" `
    "/data/tgo_admbnda_adm3_inseed_20210107.shp" `
    -nln adm3_temp -overwrite -lco GEOMETRY_NAME=geom -nlt PROMOTE_TO_MULTI -t_srs EPSG:4326

Write-Host "✅ Shapefiles importés" -ForegroundColor Green

# Copier les données dans les tables finales
Write-Host "`n📋 Copie des données dans les tables finales..." -ForegroundColor Cyan

$copyData = @"
-- ADM1
INSERT INTO adm1_tg (code, name, geom)
SELECT 
    'ADM1-' || UPPER(REPLACE(adm1_fr, ' ', '-')),
    adm1_fr,
    geom
FROM adm1_temp;

-- ADM2
INSERT INTO adm2_tg (code, name, adm1_name, geom)
SELECT 
    'ADM2-' || UPPER(REPLACE(adm2_fr, ' ', '-')),
    adm2_fr,
    adm1_fr,
    geom
FROM adm2_temp;

-- ADM3 (avec numéro unique pour éviter les doublons)
INSERT INTO adm3_tg (code, name, adm1_name, adm2_name, geom)
SELECT 
    'ADM3-' || UPPER(REPLACE(adm2_fr, ' ', '-')) || '-' || UPPER(REPLACE(adm3_fr, ' ', '-')),
    adm3_fr,
    adm1_fr,
    adm2_fr,
    geom
FROM adm3_temp;

-- Calculer les bbox (bounding box) pour chaque entité
-- Utilise ST_XMin/YMin/XMax/YMax directement sur la géométrie
UPDATE adm1_tg SET bbox = ARRAY[
    ST_XMin(geom),
    ST_YMin(geom),
    ST_XMax(geom),
    ST_YMax(geom)
];

UPDATE adm2_tg SET bbox = ARRAY[
    ST_XMin(geom),
    ST_YMin(geom),
    ST_XMax(geom),
    ST_YMax(geom)
];

UPDATE adm3_tg SET bbox = ARRAY[
    ST_XMin(geom),
    ST_YMin(geom),
    ST_XMax(geom),
    ST_YMax(geom)
];

-- Supprimer les tables temporaires
DROP TABLE IF EXISTS adm1_temp;
DROP TABLE IF EXISTS adm2_temp;
DROP TABLE IF EXISTS adm3_temp;

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_adm1_tg_geom ON adm1_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm1_tg_name ON adm1_tg(name);

CREATE INDEX IF NOT EXISTS idx_adm2_tg_geom ON adm2_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm2_tg_name ON adm2_tg(name);
CREATE INDEX IF NOT EXISTS idx_adm2_tg_adm1 ON adm2_tg(adm1_name);

CREATE INDEX IF NOT EXISTS idx_adm3_tg_geom ON adm3_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_name ON adm3_tg(name);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_adm1 ON adm3_tg(adm1_name);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_adm2 ON adm3_tg(adm2_name);
"@

Invoke-Sql $copyData

Write-Host "✅ Données copiées et index créés" -ForegroundColor Green

# Afficher les statistiques
Write-Host "`n📊 Statistiques:" -ForegroundColor Cyan
$stats = Invoke-Sql "SELECT 'ADM1' as level, COUNT(*) as count FROM adm1_tg UNION ALL SELECT 'ADM2', COUNT(*) FROM adm2_tg UNION ALL SELECT 'ADM3', COUNT(*) FROM adm3_tg;"
Write-Host $stats

Write-Host "`n✅ Import terminé avec succès !" -ForegroundColor Green
Write-Host "`n🔍 Test rapide:" -ForegroundColor Yellow
Write-Host "   curl http://127.0.0.1:8000/adm1" -ForegroundColor Gray
