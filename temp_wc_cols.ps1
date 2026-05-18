$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT column_name FROM information_schema.columns WHERE table_name = 'worldclim_prec';
SELECT column_name FROM information_schema.columns WHERE table_name = 'worldclim_bio';
SELECT filename FROM atlas.worldclim_prec LIMIT 3;
SELECT filename FROM atlas.worldclim_bio LIMIT 3;"