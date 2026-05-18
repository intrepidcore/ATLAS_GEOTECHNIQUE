$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT parameter_id, COUNT(*) as n, ROUND(AVG(value)::numeric, 2) as moy, ROUND(STDDEV(value)::numeric, 2) as std
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan' AND COALESCE(is_superseded, false) = false
GROUP BY parameter_id
ORDER BY parameter_id;

SELECT r.parameter_id, r.method, r.status, r.meta->>'regression_r2' as r2, r.meta->>'n_terrain_samples' as n_samples
FROM atlas.ai_interpolation_runs r
WHERE r.method = 'regression_kriging_scorpan'
ORDER BY r.created_at DESC
LIMIT 5;"