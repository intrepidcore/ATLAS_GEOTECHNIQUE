$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check worldclim rasters
SELECT 'worldclim_prec' as table_name, COUNT(*) as tiles FROM worldclim_prec
UNION ALL
SELECT 'worldclim_bio', COUNT(*) FROM worldclim_bio;

-- Check maille_climate_features
SELECT 
    COUNT(*) as total,
    COUNT(prec_annual) as prec_annual,
    COUNT(bio12) as bio12,
    COUNT(bio15) as bio15
FROM maille_climate_features;

-- Check hydrogeologie
SELECT COUNT(*) as rivers FROM hydrogeologie;

-- Check mailles columns
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND column_name IN ('altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean', 'dem_hand_mean', 'distance_river_m', 'dsm_features_ok')
ORDER BY column_name;
"