$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check maille_climate_features columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'maille_climate_features'
ORDER BY column_name;

-- Check row count
SELECT COUNT(*) as climate_features_count FROM atlas.maille_climate_features;

-- Sample data
SELECT * FROM atlas.maille_climate_features LIMIT 3;
"