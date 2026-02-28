param(
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [string]$DbName = "atlas_clean",
  [string]$DbUser = "atlas",
  [string]$Schema = "atlas",
  [string]$OutDir = "./dataset",
  [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$datasetFile = Join-Path $OutDir "dataset_v1.sql"
$manifestFile = Join-Path $OutDir "DATASET_MANIFEST.json"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Export dataset from $DbName@$PgHost:$PgPort (schema=$Schema)" -ForegroundColor Cyan

pg_dump -U $DbUser -h $PgHost -p $PgPort -d $DbName `
  --data-only `
  --column-inserts `
  --schema=$Schema `
  --file=$datasetFile

$datasetHash = (Get-FileHash -Algorithm SHA256 $datasetFile).Hash.ToLowerInvariant()

# Compute schema hash (same algorithm as api-geo) via psql output
$tmpSchema = Join-Path $env:TEMP "atlas_schema_columns.txt"
psql -U $DbUser -h $PgHost -p $PgPort -d $DbName -Atc @"
SELECT table_schema||'.'||table_name||'.'||column_name||':'||data_type||':'||coalesce(character_maximum_length::text,'')||':'||coalesce(numeric_precision::text,'')||':'||coalesce(numeric_scale::text,'')
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position;
"@ | Set-Content -Encoding ascii $tmpSchema

$schemaHash = (Get-FileHash -Algorithm SHA256 $tmpSchema).Hash.ToLowerInvariant()
Remove-Item -Force $tmpSchema

$createdAt = (Get-Date).ToString("yyyy-MM-dd")

$manifest = [ordered]@{
  version = $Version
  dataset = [ordered]@{
    file = "dataset_v1.sql"
    sha256 = $datasetHash
  }
  schema = [ordered]@{
    sha256 = $schemaHash
  }
  created_at = $createdAt
  compatible_schema = ">=1.0.0"
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $manifestFile

Write-Host "✅ Export done" -ForegroundColor Green
Write-Host "- dataset: $datasetFile" -ForegroundColor DarkGray
Write-Host "- dataset sha256: $datasetHash" -ForegroundColor DarkGray
Write-Host "- schema sha256:  $schemaHash" -ForegroundColor DarkGray
Write-Host "- manifest: $manifestFile" -ForegroundColor DarkGray
