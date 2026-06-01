$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Add missing distance_river_m column
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS distance_river_m numeric;

-- Verify all DSM columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND column_name IN ('altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean', 'dem_hand_mean', 'distance_river_m', 'dsm_features_ok')
ORDER BY column_name;
"