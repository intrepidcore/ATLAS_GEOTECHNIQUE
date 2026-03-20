param(
  [string]$DbName = "atlas_clean",
  [string]$DbUser = "atlas",
  [string]$DbHost = "127.0.0.1",
  [int]$DbPort = 5432,
  [string]$OutFile = "data/db/backups/atlas_desktop_seed.dump",
  [string]$DockerDbContainer = "atlas-db",
  [string]$SeedId = "",
  [string]$SeedVersion = "",
  [string]$PostgresTargetMajor = "",
  [string]$PostgisVersion = "",
  [string]$MaxMigrationApplied = "",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outPath = Join-Path $repoRoot $OutFile

function NowUtcIso() {
  return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

function LogInfo([string]$msg) {
  Write-Host "[$(NowUtcIso)] [seed] $msg" -ForegroundColor Cyan
}

function LogOk([string]$msg) {
  Write-Host "[$(NowUtcIso)] [seed] ✅ $msg" -ForegroundColor Green
}

function LogWarn([string]$msg) {
  Write-Host "[$(NowUtcIso)] [seed] ⚠ $msg" -ForegroundColor Yellow
}

function LogErr([string]$msg) {
  Write-Host "[$(NowUtcIso)] [seed] ❌ $msg" -ForegroundColor Red
}

function Step([int]$percent, [string]$activity, [string]$status) {
  Write-Progress -Activity $activity -Status $status -PercentComplete $percent
}

New-Item -ItemType Directory -Force -Path (Split-Path $outPath -Parent) | Out-Null

if ((Test-Path -LiteralPath $outPath) -and (-not $Force)) {
  throw "Refusing to overwrite existing seed dump: $outPath (use -Force)"
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue

function Invoke-LocalPgDump {
  if ($null -eq $pgDump) {
    throw 'pg_dump introuvable'
  }
  $pgDumpArgs = @(
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-h', $DbHost,
    '-p', "$DbPort",
    '-U', $DbUser,
    '-d', $DbName,
    '-f', $outPath
  )
  & pg_dump @pgDumpArgs
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed (exit=$LASTEXITCODE)"
  }
}

function Invoke-DockerPgDump {
  if ($null -eq $docker) {
    throw 'docker introuvable'
  }
  $tmp = "/tmp/atlas_desktop_seed.dump"
  & docker exec -i $DockerDbContainer pg_dump -U $DbUser -d $DbName -Fc --no-owner --no-privileges -f $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "docker exec pg_dump failed (exit=$LASTEXITCODE)"
  }
  & docker cp "${DockerDbContainer}:${tmp}" $outPath
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp failed (exit=$LASTEXITCODE)"
  }
}

LogInfo "Seed dump target: $outPath"
Step 5 'Atlas Seed Dump (v2)' 'Pré-checks'

if (-not [string]::IsNullOrWhiteSpace($SeedId)) { $env:ATLAS_SEED_ID = $SeedId }
if (-not [string]::IsNullOrWhiteSpace($SeedVersion)) { $env:ATLAS_SEED_VERSION = $SeedVersion }
if ([string]::IsNullOrWhiteSpace($env:ATLAS_SEED_ENVIRONMENT)) { $env:ATLAS_SEED_ENVIRONMENT = 'production' }
if ([string]::IsNullOrWhiteSpace($env:ATLAS_SEED_CLASSIFICATION)) { $env:ATLAS_SEED_CLASSIFICATION = 'internal' }
if ([string]::IsNullOrWhiteSpace($env:ATLAS_SEED_CREATED_BY)) {
  $env:ATLAS_SEED_CREATED_BY = if ($env:USERNAME) { $env:USERNAME } else { 'unknown' }
}
if (-not [string]::IsNullOrWhiteSpace($PostgresTargetMajor)) { $env:ATLAS_SEED_POSTGRES_TARGET_MAJOR = $PostgresTargetMajor }
if (-not [string]::IsNullOrWhiteSpace($PostgisVersion)) { $env:ATLAS_SEED_POSTGIS_VERSION = $PostgisVersion }
if (-not [string]::IsNullOrWhiteSpace($MaxMigrationApplied)) { $env:ATLAS_SEED_MAX_MIGRATION_APPLIED = $MaxMigrationApplied }

if ($null -ne $docker) {
  try {
    Step 10 'Atlas Seed Dump (v2)' 'Pré-check invariants (Docker)'
    $m2 = (& docker exec -i $DockerDbContainer psql -U $DbUser -d $DbName -tAc "SELECT COUNT(*) FROM atlas.mailles;")
    $m28 = (& docker exec -i $DockerDbContainer psql -U $DbUser -d $DbName -tAc "SELECT COUNT(*) FROM atlas.maille_28km;")
    $m2 = ($m2 | Out-String).Trim()
    $m28 = ($m28 | Out-String).Trim()
    LogInfo "invariants: atlas.mailles.count=$m2"
    LogInfo "invariants: atlas.maille_28km.count=$m28"
  } catch {
    LogWarn 'Pré-check invariants skipped (docker exec/psql failed)'
  }
}

try {
  $gitCommit = (git -C $repoRoot rev-parse --short HEAD 2>$null)
  if ($gitCommit) { LogInfo "git_commit=$gitCommit" }
} catch {
  LogWarn 'git commit unavailable'
}

Step 15 'Atlas Seed Dump (v2)' 'Création du dump (-Fc --no-owner --no-privileges)'
try {
  if ($null -ne $pgDump) {
    Invoke-LocalPgDump
  } else {
    Invoke-DockerPgDump
  }
} catch {
  if ($null -ne $docker) {
    Invoke-DockerPgDump
  } else {
    throw
  }
}

if (-not (Test-Path -LiteralPath $outPath)) {
  throw "Seed dump not created: $outPath"
}

$dumpSizeMb = [math]::Round(((Get-Item -LiteralPath $outPath).Length / 1MB), 2)
LogOk "Dump created ($dumpSizeMb MB)"

$python = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $python) {
  throw 'python introuvable (requis pour générer le manifest)'
}

Step 55 'Atlas Seed Dump (v2)' 'Génération manifest (sha256/sha512/size + metadata)'
$manifestPath = "$outPath.json"
& python (Join-Path $repoRoot 'scripts/generate_seed_manifest.py') $outPath --db-name $DbName --out $manifestPath | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "generate_seed_manifest.py failed (exit=$LASTEXITCODE)"
}

LogOk "Manifest created: $manifestPath"

Step 70 'Atlas Seed Dump (v2)' 'Validation dump/manifest'

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts/validate-dump.ps1') -DumpFile $outPath
if ($LASTEXITCODE -ne 0) {
  throw "validate-dump.ps1 failed (exit=$LASTEXITCODE)"
}

Step 85 'Atlas Seed Dump (v2)' 'Signature (optionnelle)'
$minisign = Get-Command minisign -ErrorAction SilentlyContinue
if ($null -ne $minisign) {
  $secret = $env:ATLAS_SEED_MINISIGN_SECRET_KEY
  if (-not [string]::IsNullOrWhiteSpace($secret) -and (Test-Path -LiteralPath $secret)) {
    $sigPath = "$outPath.sig"
    & minisign -S -s $secret -m $outPath -x $sigPath | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $sigPath)) {
      LogOk "Signature created: $sigPath"
    } else {
      LogWarn 'Signature failed'
    }
  } else {
    LogWarn 'minisign present but ATLAS_SEED_MINISIGN_SECRET_KEY not set or file missing; skipping signature'
  }
} else {
  LogWarn 'minisign not available; skipping signature'
}

Step 100 'Atlas Seed Dump (v2)' 'Terminé'
Write-Progress -Activity 'Atlas Seed Dump (v2)' -Completed
LogOk 'Seed dump generation complete'

Write-Output $outPath
