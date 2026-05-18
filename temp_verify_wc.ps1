$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT 'worldclim_prec' as tbl, COUNT(*) as rows FROM atlas.worldclim_prec
UNION ALL
SELECT 'worldclim_bio', COUNT(*) FROM atlas.worldclim_bio;"