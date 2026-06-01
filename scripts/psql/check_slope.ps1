$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND (column_name LIKE '%slope%' OR column_name LIKE '%tpi%' OR column_name LIKE '%hand%')
ORDER BY column_name;

SELECT COUNT(*) as total_mailles FROM atlas.mailles;
SELECT COUNT(dem_slope_mean_deg) as slope_count FROM atlas.mailles;
SELECT COUNT(dem_tpi_mean) as tpi_count FROM atlas.mailles;
SELECT COUNT(dem_hand_mean) as hand_count FROM atlas.mailles;
"