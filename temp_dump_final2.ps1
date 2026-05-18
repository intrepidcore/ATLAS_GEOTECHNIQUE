$env:PGPASSWORD = 'atlas'
$dumpPath = "C:\PROJET_ATLAS_MASTER\atlas_reclone\data\db\backups\atlas_desktop_seed.dump"
Write-Output "Demarrage dump final..."
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -Fc --no-owner --no-privileges -n atlas -f $dumpPath
$f = Get-Item $dumpPath
$hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
Write-Output "Dump OK: $([math]::Round($f.Length/1MB,1)) MB"
Write-Output "SHA256: $hash"
$hash | Out-File "$dumpPath.sha256"