$env:PGPASSWORD = 'postgres'

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpPath = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\db\backups\atlas_desktop_seed_v1.3.0_$timestamp.dump"

Write-Host "Creating dump: $dumpPath"

& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -F c -b -v -f $dumpPath

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $dumpPath).Length / 1MB
    $size = [math]::Round($size, 2)
    Write-Host "Dump created successfully: $size MB"
    
    # Calculate SHA256
    $sha256 = (Get-FileHash $dumpPath -Algorithm SHA256).Hash
    Write-Host "SHA256: $sha256"
    
    # Update manifest
    $manifest = @{
        version = "1.3.0"
        timestamp = $timestamp
        size_mb = $size
        sha256 = $sha256
        invariants = @{
            "INV-001" = "29407 mailles"
            "INV-002" = "Climate > 29000"
            "INV-003" = "DSM features > 29000"
            "INV-004" = "RK values > 350000"
        }
        rk_params = 12
        rk_values = 352884
    } | ConvertTo-Json -Depth 3
    
    $manifestPath = "$dumpPath.json"
    $manifest | Out-File -FilePath $manifestPath -Encoding UTF8
    Write-Host "Manifest: $manifestPath"
} else {
    Write-Host "Dump failed!"
}