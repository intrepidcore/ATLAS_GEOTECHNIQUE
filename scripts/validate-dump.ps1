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

$integrity = $m.integrity
$mSizeBytes = if ($null -ne $integrity -and $null -ne $integrity.size_bytes) { $integrity.size_bytes } else { $m.size_bytes }
$mSha256 = if ($null -ne $integrity -and $null -ne $integrity.sha256) { $integrity.sha256 } else { $m.sha256 }
$mSha512 = if ($null -ne $integrity -and $null -ne $integrity.sha512) { $integrity.sha512 } else { $m.sha512 }

$size = (Get-Item -LiteralPath $DumpFile).Length
if ([int64]$mSizeBytes -ne [int64]$size) {
  throw "SIZE_MISMATCH: expected=$mSizeBytes actual=$size"
}

$sha = (Get-FileHash -LiteralPath $DumpFile -Algorithm SHA256).Hash.ToLowerInvariant()
$expected = ([string]$mSha256).ToLowerInvariant()
if ($sha -ne $expected) {
  throw "SHA256_MISMATCH: expected=$expected actual=$sha"
}

$expected512 = $mSha512
if ($null -ne $expected512 -and (-not [string]::IsNullOrWhiteSpace([string]$expected512))) {
  $sha512 = (Get-FileHash -LiteralPath $DumpFile -Algorithm SHA512).Hash.ToLowerInvariant()
  $expected512 = ([string]$expected512).ToLowerInvariant()
  if ($sha512 -ne $expected512) {
    throw "SHA512_MISMATCH: expected=$expected512 actual=$sha512"
  }
  Write-Output "OK: sha512"
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
      Write-Output "WARN: pg_restore introuvable, fallback docker possible mais dump non visible dans le conteneur ${DOCKER_DB_CONTAINER}: $DumpFile"
      Write-Output "      -> copier le dump dans le conteneur (docker cp) ou utiliser un chemin monté via volume"
    } else {
      & docker exec -i $DOCKER_DB_CONTAINER pg_restore -l $DumpFile | Out-Null
      Write-Output "OK: docker pg_restore -l"
    }
  }
}
