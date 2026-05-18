$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT method, COUNT(DISTINCT parameter_id) as n_params, COUNT(*) as n_values
FROM atlas.ai_interpolation_values
WHERE COALESCE(is_superseded,false) = false
GROUP BY method;"