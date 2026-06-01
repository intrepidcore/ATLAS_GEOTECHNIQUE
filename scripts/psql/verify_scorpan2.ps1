$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
GRANT ALL ON atlas.v_scorpan_features TO atlas;

SELECT
    COUNT(*) as total,
    COUNT(dem_altitude) as with_altitude,
    COUNT(dem_slope) as with_slope,
    COUNT(prec_annual) as with_climate
FROM atlas.v_scorpan_features;

SELECT maille_code, dem_altitude, prec_annual, lon, lat FROM atlas.v_scorpan_features LIMIT 3;
"