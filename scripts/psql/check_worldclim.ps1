$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check WorldClim tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'atlas' AND table_name LIKE '%worldclim%' OR table_name LIKE '%climate%'
ORDER BY table_name;

-- If exists, check row counts
SELECT 'worldclim_prec_01' as table_name, COUNT(*) as rows FROM worldclim_prec_01
UNION ALL SELECT 'worldclim_bio_01', COUNT(*) FROM worldclim_bio_01;
"