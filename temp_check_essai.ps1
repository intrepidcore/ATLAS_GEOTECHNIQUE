$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'essais' AND table_schema = 'atlas'
ORDER BY ordinal_position;"