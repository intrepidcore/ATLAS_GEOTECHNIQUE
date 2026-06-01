$env:PGPASSWORD = 'postgres'
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpPath = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\db\backups\atlas_desktop_seed_v1.3.1_$timestamp.dump"

Write-Host "Creating dump: $dumpPath"

& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -F c -b -v -f $dumpPath

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $dumpPath).Length / 1MB
    $size = [math]::Round($size, 2)
    Write-Host "Dump created: $size MB"
    $sha256 = (Get-FileHash $dumpPath -Algorithm SHA256).Hash
    Write-Host "SHA256: $sha256"
    
    $manifest = @{
        version = "1.3.1"
        timestamp = $timestamp
        size_mb = $size
        sha256 = $sha256
        features = @{
            "rk_columns_in_mailles" = $true
            "eg_rk_params_in_api" = $true
            "view_rebuilt" = $true
        }
    } | ConvertTo-Json -Depth 3
    
    "$dumpPath.json" | Out-File -FilePath ($dumpPath + ".json") -Encoding UTF8
    Write-Host "Done!"
} else {
    Write-Host "Dump failed!"
}