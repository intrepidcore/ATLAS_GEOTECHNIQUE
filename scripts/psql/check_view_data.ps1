$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT maille_code, dem_altitude, dem_slope, dem_tpi, dem_hand, distance_river_m, prec_annual, lon, lat
FROM atlas.v_scorpan_features
LIMIT 3;
"