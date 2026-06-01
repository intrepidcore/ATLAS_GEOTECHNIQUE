$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check existing feature columns in mailles
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND column_name IN ('altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean', 'dem_hand_mean', 
                    'geol_ok', 'pedo_ok', 'vegetation_ok')
ORDER BY column_name;

-- Check maille_climate_features
SELECT COUNT(*) as climate_count FROM atlas.maille_climate_features;

-- Check other feature tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'atlas' AND table_name LIKE '%feature%' OR table_name LIKE '%pedo%' OR table_name LIKE '%geol%'
ORDER BY table_name;
"