$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT
    COUNT(*) as total,
    COUNT(dem_altitude) as with_altitude,
    COUNT(dem_slope) as with_slope,
    COUNT(prec_annual) as with_climate,
    COUNT(dsm_ok) as dsm_ok_count,
    COUNT(climate_ok) as climate_ok_count
FROM atlas.v_scorpan_features;

SELECT * FROM atlas.v_scorpan_features LIMIT 2;
"