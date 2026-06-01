$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check unites_geologiques
SELECT COUNT(*) as geol_count FROM atlas.unites_geologiques;

-- Check unites_pedologiques  
SELECT COUNT(*) as pedo_count FROM atlas.unites_pedologiques;

-- Check if there's a geol/pedo code in mailles
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'mailles'
AND column_name LIKE '%geol%' OR column_name LIKE '%pedo%' OR column_name LIKE '%soil%'
ORDER BY column_name;
"