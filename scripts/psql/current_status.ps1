$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check current DSM values
SELECT 
    COUNT(altitude_mean) as altitude,
    COUNT(dem_slope_mean_deg) as slope,
    COUNT(dem_tpi_mean) as tpi,
    COUNT(dem_hand_mean) as hand,
    COUNT(distance_river_m) as river
FROM atlas.mailles;

-- Check climate data
SELECT 
    COUNT(prec_annual) as prec,
    COUNT(bio12) as bio12,
    COUNT(bio15) as bio15,
    COUNT(bio4) as bio4,
    COUNT(bio17) as bio17,
    COUNT(prec_dry) as prec_dry,
    COUNT(prec_wet) as prec_wet
FROM atlas.maille_climate_features;
"