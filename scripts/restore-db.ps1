param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$TargetDb = 'atlas_restore'
)

$ErrorActionPreference = 'Stop'

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { 'atlas' }
$DB_PASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { 'atlas' }
$force = if ($env:FORCE_RESTORE_DROP_DB) { $env:FORCE_RESTORE_DROP_DB } else { '0' }
$DOCKER_DB_CONTAINER = if ($env:DOCKER_DB_CONTAINER) { $env:DOCKER_DB_CONTAINER } else { 'atlas-db' }

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "ERREUR: Fichier de backup introuvable: $BackupFile"
}

$manifestFile = "$BackupFile.json"
if (Test-Path -LiteralPath $manifestFile) {
  $m = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  $size = (Get-Item -LiteralPath $BackupFile).Length
  if ([int64]$m.size_bytes -ne [int64]$size) {
    throw "SIZE_MISMATCH: expected=$($m.size_bytes) actual=$size"
  }
  $sha = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
  $expected = ([string]$m.sha256).ToLowerInvariant()
  if ($sha -ne $expected) {
    throw "SHA256_MISMATCH: expected=$expected actual=$sha"
  }
  Write-Output "OK: sha256/size"
} else {
  Write-Output "WARN: manifest absent ($manifestFile), restore sans vérification hash"
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue

if ($null -eq $psql -or $null -eq $pgRestore) {
  if ($null -eq $docker) {
    throw 'ERREUR: psql/pg_restore introuvables et docker introuvable (installer PostgreSQL tools ou Docker)'
  }

  function Invoke-Psql([string]$Db, [string]$Sql) {
    & docker exec -i $DOCKER_DB_CONTAINER psql -U $DB_USER -d $Db -tAc $Sql
  }
  function Invoke-PsqlCmd([string]$Db, [string]$Sql) {
    & docker exec -i $DOCKER_DB_CONTAINER psql -U $DB_USER -d $Db -v ON_ERROR_STOP=1 -c $Sql
  }
  function Invoke-PgRestore([string]$Db) {
    $args = @('exec','-i',$DOCKER_DB_CONTAINER,'pg_restore','-U',$DB_USER,'-d',$Db,'-v',$BackupFile)
    & docker @args
  }
} else {
  $env:PGPASSWORD = $DB_PASSWORD
  function Invoke-Psql([string]$Db, [string]$Sql) {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $Db -tAc $Sql
  }
  function Invoke-PsqlCmd([string]$Db, [string]$Sql) {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $Db -v ON_ERROR_STOP=1 -c $Sql
  }
  function Invoke-PgRestore([string]$Db) {
    & pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $Db -v $BackupFile
  }
}

$exists = Invoke-Psql 'postgres' "SELECT 1 FROM pg_database WHERE datname='${TargetDb}'"
$exists = ($exists | Out-String).Trim()

if ($exists -eq '1' -and $force -ne '1') {
  throw "ERREUR: La base ${TargetDb} existe déjà. Pour forcer: `$env:FORCE_RESTORE_DROP_DB=1"
}

Write-Output "Création de la base ${TargetDb} (drop+create)..."
Invoke-PsqlCmd 'postgres' "DROP DATABASE IF EXISTS ${TargetDb};"
Invoke-PsqlCmd 'postgres' "CREATE DATABASE ${TargetDb};" | Out-Null

Write-Output 'Restauration en cours...'
Invoke-PgRestore $TargetDb

Write-Output 'Restauration terminée avec succès'
Write-Output "  Base de données: ${TargetDb}"
