$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT parameter_id, COUNT(*) as n FROM atlas.ai_interpolation_values
WHERE method = 'ked_pedologie_ked' AND COALESCE(is_superseded,false) = false
GROUP BY parameter_id ORDER BY parameter_id;"