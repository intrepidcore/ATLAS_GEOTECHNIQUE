$env:PGPASSWORD = 'atlas'
$raster2pgsql = "C:\Program Files\PostgreSQL\17\bin\raster2pgsql.exe"
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

$precDir = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\prec"
$bioDir = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\word-clim\bio"

Write-Output "=== Loading precipitation (12 months) ==="
$precFiles = Get-ChildItem $precDir -Filter "*.tif" | Select-Object -ExpandProperty FullName
$precFilesStr = $precFiles -join " "

$proc = Start-Process -FilePath $raster2pgsql -ArgumentList "-s 4326 -I -C -M -t 100x100 -F $precFilesStr atlas.worldclim_prec" -NoNewWindow -Wait -PassThru -RedirectStandardOutput prec_out.txt -RedirectStandardError prec_err.txt

Write-Output "  Return code: $($proc.ExitCode)"
if (Test-Path prec_err.txt) {
    $err = Get-Content prec_err.txt -Raw
    if ($err) { Write-Output "  Errors: $err" }
}

# Pipe to psql
$precCmd = "$raster2pgsql -s 4326 -I -C -M -t 100x100 -F $precFilesStr atlas.worldclim_prec | $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean"
Invoke-Expression $precCmd

Write-Output "`n=== Loading bioclimatic (19 variables) ==="
$bioFiles = Get-ChildItem $bioDir -Filter "*.tif" | Select-Object -ExpandProperty FullName
$bioFilesStr = $bioFiles -join " "

$bioCmd = "$raster2pgsql -s 4326 -I -C -M -t 100x100 -F $bioFilesStr atlas.worldclim_bio | $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean"
Invoke-Expression $bioCmd

Write-Output "`n=== Verifying ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT COUNT(*) as prec_tiles FROM atlas.worldclim_prec; SELECT COUNT(*) as bio_tiles FROM atlas.worldclim_bio;"