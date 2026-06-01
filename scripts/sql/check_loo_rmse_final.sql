-- Synthese finale LOO-RMSE H1 toutes methodes
-- 2026-06-01

SELECT 'KED_hier' AS method, parameter_id,
  ROUND((metrics->'loo_residual'->>'rmse')::numeric, 4) AS loo_rmse,
  ROUND((metrics->'loo_residual'->>'n')::numeric, 0) AS n_train
FROM atlas.ai_interpolation_runs r
WHERE method='ked_hierarchical_5levels' AND metrics ? 'loo_residual'
  AND parameter_id IN ('vbs_ked_h1','ip_ked_h1','wl_ked_h1','wp_ked_h1')
  AND created_at = (SELECT MAX(r2.created_at) FROM atlas.ai_interpolation_runs r2
                    WHERE r2.parameter_id=r.parameter_id AND r2.method=r.method)

UNION ALL

SELECT 'KED_eg' AS method, parameter_id,
  ROUND((metrics->'loo_residual'->>'rmse')::numeric, 4) AS loo_rmse,
  ROUND((metrics->'loo_residual'->>'n')::numeric, 0) AS n_train
FROM atlas.ai_interpolation_runs r
WHERE method='ked_pedologie_eg' AND metrics ? 'loo_residual'
  AND parameter_id='eg_ked_h1'
  AND created_at = (SELECT MAX(r2.created_at) FROM atlas.ai_interpolation_runs r2
                    WHERE r2.parameter_id=r.parameter_id AND r2.method=r.method)

UNION ALL

SELECT 'RK_SCORPAN' AS method, parameter_id,
  ROUND((metrics->>'loo_rmse')::numeric, 4) AS loo_rmse,
  (metrics->>'n_terrain_samples')::int AS n_train
FROM atlas.ai_interpolation_runs r
WHERE method='regression_kriging_scorpan'
  AND metrics->>'loo_rmse' IS NOT NULL
  AND parameter_id IN ('vbs_rk_h1','ip_rk_h1','wl_rk_h1','wp_rk_h1','eg_rk_h1')
  AND created_at = (SELECT MAX(r2.created_at) FROM atlas.ai_interpolation_runs r2
                    WHERE r2.parameter_id=r.parameter_id AND r2.method=r.method)

ORDER BY method, parameter_id;
