$ErrorActionPreference = 'Stop'

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { 'atlas' }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { 'atlas_clean' }

$DOCKER_DB_CONTAINER = if ($env:DOCKER_DB_CONTAINER) { $env:DOCKER_DB_CONTAINER } else { 'atlas-db' }

$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($null -eq $psql) {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($null -eq $docker) {
    throw 'ERREUR: psql introuvable et docker introuvable (installer PostgreSQL tools ou Docker)'
  }

  function Invoke-Psql([string]$Sql) {
    & docker exec -i $DOCKER_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c $Sql
  }
} else {
  function Invoke-Psql([string]$Sql) {
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c $Sql
  }
}

Invoke-Psql "SELECT 1;" | Out-Null

Invoke-Psql "SELECT to_regclass('atlas.v_maille_status') IS NOT NULL AS has_v_maille_status;"
Invoke-Psql "SELECT to_regclass('atlas.v_colab_mission_attributions') IS NOT NULL AS has_v_colab_mission_attributions;"

Invoke-Psql "SELECT COUNT(*) AS n_mailles FROM atlas.mailles;"
Invoke-Psql "SELECT COUNT(*) AS n_missions FROM atlas.colab_missions WHERE deleted_at IS NULL;"

Write-Output 'OK: DB basic checks'
