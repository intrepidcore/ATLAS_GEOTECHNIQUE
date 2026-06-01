$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check existing tables
SELECT table_schema, table_name FROM information_schema.tables 
WHERE table_schema = 'atlas' 
AND (table_name LIKE '%worldclim%' OR table_name LIKE '%climate%' OR table_name = 'hydrogeologie')
ORDER BY table_name;
"