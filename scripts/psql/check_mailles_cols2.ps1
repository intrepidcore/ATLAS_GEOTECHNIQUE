$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Exact columns in mailles
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'mailles'
ORDER BY ordinal_position;

-- Check what's in the first few rows
SELECT code, pref_code, pref_name, adm1_name, adm2_name FROM atlas.mailles LIMIT 3;
"