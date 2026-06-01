$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check if dsm_slope table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'atlas' AND table_name = 'dsm_slope';

-- If exists, count rows
SELECT COUNT(*) as slope_tiles FROM atlas.dsm_slope;
"