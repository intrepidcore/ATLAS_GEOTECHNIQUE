$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas' AND table_name = 'unites_pedologiques'
ORDER BY column_name;
"