$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conname LIKE '%status%';"