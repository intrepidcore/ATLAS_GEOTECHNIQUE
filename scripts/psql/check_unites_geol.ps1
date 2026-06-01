$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check unites_geologiques columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'unites_geologiques'
ORDER BY column_name;

-- Check sample
SELECT * FROM atlas.unites_geologiques LIMIT 3;

-- Also check mailles geol column
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND column_name LIKE '%geol%'
ORDER BY column_name;
"