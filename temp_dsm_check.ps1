$env:PGPASSWORD = 'atlas'
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Check current user and table ownership
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT current_user;"

& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT tableowner, tablename
FROM pg_tables
WHERE schemaname = 'atlas'
  AND tablename = 'ai_context_features_maille';"

# Check DSM raster
& $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT rid, ST_Width(rast) as width, ST_Height(rast) as height,
       ST_SRID(rast) as srid
FROM atlas.dsm_cop30 LIMIT 1;"