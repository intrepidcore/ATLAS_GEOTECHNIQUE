param(
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [string]$AdminUser = "atlas",
  [string]$SourceDb = "atlas_clean",
  [string]$TestDb = "atlas_clean_dataset_test",
  [string]$MigrationsDir = "./migrations",
  [string]$DatasetFile = "./dataset/dataset_v1.sql"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DatasetFile)) {
  throw "Dataset file not found: $DatasetFile"
}

Write-Host "Recreate test DB: $TestDb" -ForegroundColor Cyan

psql -U $AdminUser -h $PgHost -p $PgPort -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TestDb;" | Out-Null
psql -U $AdminUser -h $PgHost -p $PgPort -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $TestDb;" | Out-Null

Write-Host "Apply init migrations from $MigrationsDir" -ForegroundColor Cyan

Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name | ForEach-Object {
  Write-Host "- apply $($_.Name)" -ForegroundColor DarkGray
  psql -U $AdminUser -h $PgHost -p $PgPort -d $TestDb -v ON_ERROR_STOP=1 -f $_.FullName | Out-Null
}

Write-Host "Apply dataset SQL" -ForegroundColor Cyan
psql -U $AdminUser -h $PgHost -p $PgPort -d $TestDb -v ON_ERROR_STOP=1 -f $DatasetFile | Out-Null

Write-Host "Smoke checks" -ForegroundColor Cyan
psql -U $AdminUser -h $PgHost -p $PgPort -d $TestDb -Atc "SELECT 1;" | Out-Null

Write-Host "✅ Dataset import test OK" -ForegroundColor Green
