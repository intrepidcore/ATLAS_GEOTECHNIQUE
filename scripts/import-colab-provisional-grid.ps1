# Import d'une grille provisoire Colab (codes TG-00xx-00yy-01) dans PostGIS
# - Objectif : charger une source géométrique de référence (shp/gpkg/geojson) afin de permettre
#   un remapping spatial reproductible vers atlas.mailles (V2)
# - Implémentation : ogr2ogr via Docker (GDAL) pour éviter les dépendances locales

param(
  [Parameter(Mandatory=$true)]
  [string]$InputPath,

  [Parameter(Mandatory=$false)]
  [string]$LayerName = "",

  [Parameter(Mandatory=$false)]
  [string]$TargetSchema = "public",

  [Parameter(Mandatory=$false)]
  [string]$TargetTable = "mailles_provisoire_colab",

  [Parameter(Mandatory=$false)]
  [int]$TargetSrid = 25231,

  [Parameter(Mandatory=$false)]
  [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

$DB_NAME = $env:POSTGRES_DB
if (-not $DB_NAME) { $DB_NAME = "atlas" }

$DB_USER = $env:POSTGRES_USER
if (-not $DB_USER) { $DB_USER = "atlas" }

$DB_PASSWORD = $env:POSTGRES_PASSWORD
if (-not $DB_PASSWORD) { $DB_PASSWORD = "atlas" }

$ContainerName = "atlas-db"

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "InputPath introuvable: $InputPath"
}

# Démarrer la DB si besoin
$dbRunning = docker ps --filter "name=$ContainerName" --filter "status=running" --format "{{.Names}}"
if (-not $dbRunning) {
  throw "Le conteneur DB '$ContainerName' n'est pas démarré. Lance docker compose up -d db."
}

$inputFull = (Resolve-Path -LiteralPath $InputPath).Path
$inputDir = Split-Path -Parent $inputFull
$inputFile = Split-Path -Leaf $inputFull

$network = "atlas_atlas-net"

# Préparer la table cible (canon : id text PK, code text, geom Polygon 25231)
# On ne force pas l'existence d'une colonne id/code côté source : l'étape de normalisation SQL sera faite ensuite.
$qualified = "$TargetSchema.$TargetTable"

$overwriteOpt = ""
if ($Overwrite) {
  $overwriteOpt = "-overwrite"
}

# ogr2ogr : on importe dans une table temp, puis on normalise ensuite en SQL (évite de dépendre du schéma source exact)
$tempTable = "${TargetTable}__raw"
$qualifiedTemp = "$TargetSchema.$tempTable"

Write-Host "📥 Import grille provisoire (raw) via ogr2ogr..." -ForegroundColor Cyan
Write-Host "  - Input: $inputFull" -ForegroundColor Gray
Write-Host "  - Target raw: $qualifiedTemp" -ForegroundColor Gray

$layerArgs = @()
if ($LayerName -and $LayerName.Trim() -ne "") {
  $layerArgs = @($LayerName)
}

# Note: -nlt PROMOTE_TO_MULTI pour gpkg/shp qui contiennent Polygon/MultiPolygon
# On transforme vers TargetSrid en sortie
$cmd = @(
  "docker", "run", "--rm",
  "-v", "${inputDir}:/data",
  "--network", $network,
  "ghcr.io/osgeo/gdal:alpine-normal-latest",
  "ogr2ogr",
  "-f", "PostgreSQL",
  "PG:host=$ContainerName port=5432 dbname=$DB_NAME user=$DB_USER password=$DB_PASSWORD",
  "/data/$inputFile"
) + $layerArgs + @(
  "-nln", $qualifiedTemp,
  $overwriteOpt,
  "-lco", "GEOMETRY_NAME=geom",
  "-nlt", "PROMOTE_TO_MULTI",
  "-t_srs", "EPSG:$TargetSrid"
)

# Filtrer l'argument vide overwriteOpt
$cmd = $cmd | Where-Object { $_ -ne "" }

& $cmd[0] $cmd[1..($cmd.Length-1)]

Write-Host "✅ Import raw terminé" -ForegroundColor Green

Write-Host "\n📋 Normalisation SQL (table canonique attendue)" -ForegroundColor Cyan
Write-Host "  - Target canon: $qualified" -ForegroundColor Gray

# On crée la table canonique si absente, puis on tente de copier code/geom depuis la table raw.
# Hypothèse minimale: la table raw contient au moins une colonne texte qui s'appelle 'code' (ou équivalent) et une géométrie.
# La normalisation doit être adaptée une fois le schéma source inspecté (\d+). Ici on fournit un squelette non destructif.
$sql = @"
BEGIN;

CREATE TABLE IF NOT EXISTS $qualified (
  id text PRIMARY KEY,
  code text,
  geom geometry(MultiPolygon, $TargetSrid)
);

-- IMPORTANT: adapter ce SELECT après inspection de $qualifiedTemp (\d+) pour pointer vers la bonne colonne code.
-- Par défaut, on tente 'code' si elle existe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = '$TargetSchema'
      AND table_name = '$tempTable'
      AND column_name = 'code'
  ) THEN
    INSERT INTO $qualified (id, code, geom)
    SELECT
      COALESCE(NULLIF(TRIM(code), ''), gen_random_uuid()::text) AS id,
      NULLIF(TRIM(code), '') AS code,
      geom::geometry(MultiPolygon, $TargetSrid)
    FROM $qualifiedTemp
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
"@

docker exec -i $ContainerName psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c $sql

Write-Host "\n🔍 Étape suivante (manuelle, nécessaire)" -ForegroundColor Yellow
Write-Host "  1) Inspecter le schéma raw: docker exec -it $ContainerName psql -U $DB_USER -d $DB_NAME -c \"\\d+ $qualifiedTemp\"" -ForegroundColor Gray
Write-Host "  2) Ajuster la normalisation (mapping colonne code, cast geom)" -ForegroundColor Gray
Write-Host "  3) Construire le mapping spatial vers atlas.mailles (intersection/coverage)" -ForegroundColor Gray
