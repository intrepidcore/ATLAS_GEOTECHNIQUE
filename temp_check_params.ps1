$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT DISTINCT parameter_id FROM atlas.ai_interpolation_values
WHERE method = 'ked' AND COALESCE(is_superseded,false) = false
ORDER BY parameter_id LIMIT 20;"