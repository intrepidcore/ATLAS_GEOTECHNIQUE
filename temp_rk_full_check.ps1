$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Compter les paramètres RK
SELECT method, COUNT(DISTINCT parameter_id) as n_params, COUNT(*) as n_values
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan' AND COALESCE(is_superseded,false) = false
GROUP BY method;

-- Tableau détail RK terrain
SELECT
  v.parameter_id,
  v.n_terrain,
  v.r2_regression,
  ROUND(moyenne::numeric, 2) as moyenne,
  ROUND(ecart_type::numeric, 2) as std
FROM (
  SELECT
    r.parameter_id,
    (r.meta->>'n_terrain_samples')::int as n_terrain,
    (r.meta->>'regression_r2')::numeric as r2_regression
  FROM atlas.ai_interpolation_runs r
  WHERE r.method = 'regression_kriging_scorpan'
) v
JOIN (
  SELECT parameter_id, AVG(value) as moyenne, STDDEV(value) as ecart_type
  FROM atlas.ai_interpolation_values
  WHERE method = 'regression_kriging_scorpan' AND COALESCE(is_superseded,false) = false
  GROUP BY parameter_id
) m ON m.parameter_id = v.parameter_id
ORDER BY v.parameter_id;"