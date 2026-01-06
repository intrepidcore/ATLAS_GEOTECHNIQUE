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
# Utilise ogr2ogr avec -lco FID=ogc_fid pour créer la bonne clé primaire

# Charger les variables d'environnement
$envFile = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

$DB_HOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$DB_PORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$DB_NAME = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "atlas_clean" }
$DB_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "atlas" }
$DB_PASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "atlas" }

$PG_CONN = "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD"

Write-Host "=== Import des couches de contexte dans PostGIS ===" -ForegroundColor Cyan
Write-Host "Connexion: ${DB_HOST}:${DB_PORT}/${DB_NAME}" -ForegroundColor Gray

# 1. Géologie
Write-Host "`n[1/3] Import de la géologie..." -ForegroundColor Yellow
$geolFile = Join-Path $PSScriptRoot "..\ressource\GEOLOGIQUE\unites_geologique_V2.gpkg"
if (Test-Path $geolFile) {
    ogr2ogr -f PostgreSQL $PG_CONN `
        $geolFile `
        -nln atlas.unites_geologiques `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    Write-Host "✓ Géologie importée" -ForegroundColor Green
} else {
    Write-Host "✗ Fichier géologie introuvable: $geolFile" -ForegroundColor Red
}

# 2. Pédologie
Write-Host "`n[2/3] Import de la pédologie..." -ForegroundColor Yellow
$pedoFile = Join-Path $PSScriptRoot "..\ressource\PEDOLOGIE\unites_pedologique_V2.gpkg"
if (Test-Path $pedoFile) {
    ogr2ogr -f PostgreSQL $PG_CONN `
        $pedoFile `
        -nln atlas.unites_pedologiques `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    Write-Host "✓ Pédologie importée" -ForegroundColor Green
} else {
    Write-Host "✗ Fichier pédologie introuvable: $pedoFile" -ForegroundColor Red
}

# 3. Risque de gonflement
Write-Host "`n[3/3] Import du risque de gonflement..." -ForegroundColor Yellow
$risqueFile = Join-Path $PSScriptRoot "..\ressource\RISQUE_GONFLEMENT\carte_risque_gonflement.gpkg"
if (Test-Path $risqueFile) {
    ogr2ogr -f PostgreSQL $PG_CONN `
        $risqueFile `
        -nln atlas.risque_gonflement `
        -nlt MULTIPOLYGON `
        -lco GEOMETRY_NAME=geom `
        -lco FID=ogc_fid `
        -t_srs EPSG:25231 `
        -overwrite
    Write-Host "✓ Risque de gonflement importé" -ForegroundColor Green
} else {
    Write-Host "✗ Fichier risque introuvable: $risqueFile" -ForegroundColor Red
}

Write-Host "`n=== Vérification des imports ===" -ForegroundColor Cyan
$verifySQL = @"
SELECT 'geologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_geologiques GROUP BY 1,2
UNION ALL
SELECT 'pedologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_pedologiques GROUP BY 1,2
UNION ALL
SELECT 'risque_gonflement' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.risque_gonflement GROUP BY 1,2;
"@

$env:PGPASSWORD = $DB_PASSWORD
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -c $verifySQL

Write-Host ""
Write-Host "Import termine !" -ForegroundColor Green
