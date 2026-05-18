$ErrorActionPreference = 'Stop'
$repoRoot = "C:\PROJET_ATLAS_MASTER\atlas_reclone"
$outFile = "data\db\backups\atlas_desktop_seed.dump"
$outPath = Join-Path $repoRoot $outFile

# Parameters for atlas_clean on port 5433
$DbName = "atlas_clean"
$DbUser = "atlas"
$DbHost = "127.0.0.1"
$DbPort = 5433

# Environment for v2 contract
$env:ATLAS_SEED_ID = "atlas-seed-$(Get-Date -Format 'yyyyMMdd')-v1.3.0"
$env:ATLAS_SEED_VERSION = "1.3.0"
$env:ATLAS_SEED_ENVIRONMENT = "production"
$env:ATLAS_SEED_CLASSIFICATION = "internal"
$env:ATLAS_SEED_CREATED_BY = "opencode_scorpan_session"

Write-Host "[dump] Starting official seed dump for $DbName on port $DbPort" -ForegroundColor Cyan

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path (Split-Path $outPath -Parent) | Out-Null

# Run pg_dump
$pgDumpArgs = @(
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-h', $DbHost,
    '-p', "$DbPort",
    '-U', $DbUser,
    '-d', $DbName,
    '-n', 'atlas',
    '-f', $outPath
)

Write-Host "[dump] Running pg_dump..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" @pgDumpArgs
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed (exit=$LASTEXITCODE)"
}

if (-not (Test-Path -LiteralPath $outPath)) {
    throw "Seed dump not created: $outPath"
}

$dumpSizeMb = [math]::Round(((Get-Item -LiteralPath $outPath).Length / 1MB), 2)
Write-Host "[dump] Dump created: $dumpSizeMb MB" -ForegroundColor Green

# Generate manifest
$manifestPath = "$outPath.json"
Write-Host "[dump] Generating manifest..." -ForegroundColor Yellow
& python (Join-Path $repoRoot 'scripts\generate_seed_manifest.py') $outPath --db-name $DbName --out $manifestPath
if ($LASTEXITCODE -ne 0) {
    throw "generate_seed_manifest.py failed (exit=$LASTEXITCODE)"
}

Write-Host "[dump] Manifest created: $manifestPath" -ForegroundColor Green
Write-Host "[dump] DONE" -ForegroundColor Green