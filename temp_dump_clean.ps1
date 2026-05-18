$env:PGPASSWORD = 'atlas'
$dumpPath = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\db\backups\atlas_desktop_seed.dump"

Write-Output "=== Creating clean dump WITHOUT WorldClim rasters ==="

# Exclure les tables raster WorldClim et DSM du dump
$pgDumpArgs = @(
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-h', '127.0.0.1',
    '-p', '5433',
    '-U', 'atlas',
    '-d', 'atlas_clean',
    '-n', 'atlas',
    '--exclude-table', 'atlas.worldclim_prec',
    '--exclude-table', 'atlas.worldclim_bio',
    '--exclude-table', 'atlas.dsm_cop30',
    '-f', $dumpPath
)

& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" @pgDumpArgs
if ($LASTEXITCODE -ne 0) {
    Write-Output "Error: pg_dump failed"
    exit 1
}

$f = Get-Item $dumpPath
$size = [math]::Round($f.Length/1MB, 2)
$hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash

Write-Output "Dump created: $size MB"
Write-Output "SHA256: $hash"

# Generate manifest
$manifestPath = "$dumpPath.json"
python "C:\PROJET_ATLAS_MASTER\atlas_reclone\scripts\generate_seed_manifest.py" $dumpPath --db-name atlas_clean --out $manifestPath

Write-Output "=== DONE ==="