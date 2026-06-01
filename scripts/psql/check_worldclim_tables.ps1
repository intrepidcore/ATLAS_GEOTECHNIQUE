$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- List all worldclim tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'atlas' AND table_name LIKE '%worldclim%'
ORDER BY table_name;

-- Check structure of worldclim_prec
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'worldclim_prec'
ORDER BY column_name;
"