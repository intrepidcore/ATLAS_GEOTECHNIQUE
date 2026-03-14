param(
  [Parameter(Mandatory=$true)][string]$DumpFile
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $DumpFile)) {
  throw "ERREUR: dump introuvable: $DumpFile"
}

$manifestFile = "$DumpFile.json"
if (-not (Test-Path -LiteralPath $manifestFile)) {
  throw "ERREUR: manifest introuvable: $manifestFile"
}

$m = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json

$size = (Get-Item -LiteralPath $DumpFile).Length
if ([int64]$m.size_bytes -ne [int64]$size) {
  throw "SIZE_MISMATCH: expected=$($m.size_bytes) actual=$size"
}

$sha = (Get-FileHash -LiteralPath $DumpFile -Algorithm SHA256).Hash.ToLowerInvariant()
$expected = ([string]$m.sha256).ToLowerInvariant()
if ($sha -ne $expected) {
  throw "SHA256_MISMATCH: expected=$expected actual=$sha"
}

Write-Output "OK: sha256/size"

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if ($null -ne $pgRestore) {
  & pg_restore -l $DumpFile | Out-Null
  Write-Output "OK: pg_restore -l"
} else {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  $DOCKER_DB_CONTAINER = if ($env:DOCKER_DB_CONTAINER) { $env:DOCKER_DB_CONTAINER } else { 'atlas-db' }
  if ($null -eq $docker) {
    Write-Output "WARN: pg_restore introuvable et docker introuvable, skip pg_restore -l"
  } else {
    $visible = $false
    try {
      & docker exec -i $DOCKER_DB_CONTAINER bash -lc "test -f '$DumpFile'" | Out-Null
      if ($LASTEXITCODE -eq 0) { $visible = $true }
    } catch {
      $visible = $false
    }

    if (-not $visible) {
      Write-Output "WARN: pg_restore introuvable, fallback docker possible mais dump non visible dans le conteneur $DOCKER_DB_CONTAINER: $DumpFile"
      Write-Output "      -> copier le dump dans le conteneur (docker cp) ou utiliser un chemin monté via volume"
    } else {
      & docker exec -i $DOCKER_DB_CONTAINER pg_restore -l $DumpFile | Out-Null
      Write-Output "OK: docker pg_restore -l"
    }
  }
}
