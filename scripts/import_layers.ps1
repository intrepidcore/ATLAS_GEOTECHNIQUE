# Import des couches de contexte dans PostGIS
# Geologie, Pedologie, Risque de gonflement - SRID 25231

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

$DB_HOST = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "localhost" }
$DB_PORT = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
$DB_NAME = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "atlas" }
$DB_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "atlas" }
$DB_PASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "atlas" }

$PG_CONN = "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD"

Write-Host "=== Import couches contexte PostGIS ===" -ForegroundColor Cyan
Write-Host "DB: ${DB_HOST}:${DB_PORT}/${DB_NAME}" -ForegroundColor Gray

# 1. Geologie
Write-Host "[1/3] Geologie..." -ForegroundColor Yellow
$geolFile = Join-Path $PSScriptRoot "..\ressource\GEOLOGIQUE\unites_geologique_V2.gpkg"
if (Test-Path $geolFile) {
    ogr2ogr -f PostgreSQL $PG_CONN $geolFile -nln atlas.unites_geologiques -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -t_srs EPSG:25231 -overwrite
    Write-Host "OK Geologie" -ForegroundColor Green
} else {
    Write-Host "ERREUR: fichier introuvable" -ForegroundColor Red
}

# 2. Pedologie
Write-Host "[2/3] Pedologie..." -ForegroundColor Yellow
$pedoFile = Join-Path $PSScriptRoot "..\ressource\PEDOLOGIE\unites_pedologique_V2.gpkg"
if (Test-Path $pedoFile) {
    ogr2ogr -f PostgreSQL $PG_CONN $pedoFile -nln atlas.unites_pedologiques -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -t_srs EPSG:25231 -overwrite
    Write-Host "OK Pedologie" -ForegroundColor Green
} else {
    Write-Host "ERREUR: fichier introuvable" -ForegroundColor Red
}

# 3. Risque gonflement
Write-Host "[3/3] Risque gonflement..." -ForegroundColor Yellow
$risqueFile = Join-Path $PSScriptRoot "..\ressource\RISQUE_GONFLEMENT\carte_risque_gonflement.gpkg"
if (Test-Path $risqueFile) {
    ogr2ogr -f PostgreSQL $PG_CONN $risqueFile -nln atlas.risque_gonflement -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -t_srs EPSG:25231 -overwrite
    Write-Host "OK Risque gonflement" -ForegroundColor Green
} else {
    Write-Host "ERREUR: fichier introuvable" -ForegroundColor Red
}

Write-Host "=== Verification ===" -ForegroundColor Cyan
$verifySQL = "SELECT 'geologie' AS layer, ST_SRID(geom) AS srid, COUNT(*) AS count FROM atlas.unites_geologiques GROUP BY 1,2 UNION ALL SELECT 'pedologie', ST_SRID(geom), COUNT(*) FROM atlas.unites_pedologiques GROUP BY 1,2 UNION ALL SELECT 'risque', ST_SRID(geom), COUNT(*) FROM atlas.risque_gonflement GROUP BY 1,2;"

$env:PGPASSWORD = $DB_PASSWORD
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -c $verifySQL

Write-Host "Import termine" -ForegroundColor Green
