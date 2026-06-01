-- Etat complet des modeles L1-L4 en base
-- 2026-06-01
SELECT
  CASE method
    WHEN 'ked_hierarchical_5levels'  THEN 'L1 KED_hier_5niv'
    WHEN 'ked_pedologie_eg'          THEN 'L1 KED_pedo_EG'
    WHEN 'ked_pedologie_granulo'     THEN 'L1 KED_granulo'
    WHEN 'regression_kriging_scorpan' THEN 'L2 RK_SCORPAN'
    WHEN 'ked_rk_fusion_bayesian'    THEN 'L2 Fusion_BLUP'
    WHEN 'mtgp_icm_gpflow'           THEN 'L4 MTGP_GPflow'
    ELSE method
  END AS modele,
  COUNT(DISTINCT parameter_id) AS n_params,
  COUNT(*) AS n_rows,
  ROUND(AVG(value)::numeric,3) AS mean_value,
  ROUND(AVG(variance)::numeric,3) AS mean_var,
  SUM(CASE WHEN variance < 0 THEN 1 ELSE 0 END) AS neg_var_count
FROM atlas.ai_interpolation_values
WHERE COALESCE(is_superseded,false) = false
  AND method IN (
    'ked_hierarchical_5levels',
    'ked_pedologie_eg',
    'ked_pedologie_granulo',
    'regression_kriging_scorpan',
    'ked_rk_fusion_bayesian',
    'mtgp_icm_gpflow'
  )
GROUP BY method
ORDER BY modele;
