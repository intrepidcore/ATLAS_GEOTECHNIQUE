$env:PGPASSWORD = 'atlas'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

# 1A - Vérifier structure DSM
Write-Output "=== 1A: Vérifier structure DSM ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT rid, ST_Width(rast) as width, ST_Height(rast) as height,
       ST_SRID(rast) as srid, ST_PixelSize(rast) as pixsize
FROM atlas.dsm_cop30 LIMIT 1;"

# Vérifier si altitude_mean existe
Write-Output "`n=== Vérifier si altitude_mean existe ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_context_features_maille'
  AND column_name = 'altitude_mean';"

# Ajouter altitude_mean si pas existant
Write-Output "`n=== Ajouter altitude_mean si nécessaire ==="
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
ALTER TABLE atlas.ai_context_features_maille
ADD COLUMN IF NOT EXISTS altitude_mean DOUBLE PRECISION;"