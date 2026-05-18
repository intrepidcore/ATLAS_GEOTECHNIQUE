-- Tableau comparatif définitif KED vs RK vs Terrain
-- Source: atlas.ai_interpolation_runs et atlas.ai_variograms

SELECT
  'VBS' as param,
  'H1' as horizon,
  (SELECT COUNT(*) FROM atlas.v_echantillons_essais WHERE vbs IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5) as n_terrain,
  (SELECT ROUND(AVG(vbs)::numeric, 2) FROM atlas.v_echantillons_essais WHERE vbs IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5) as terrain_moy,
  (SELECT ROUND(STDDEV(vbs)::numeric, 2) FROM atlas.v_echantillons_essais WHERE vbs IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5) as terrain_std,
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'vbs_ked_h1' AND COALESCE(is_superseded,false) = false LIMIT 1) as ked_moy,
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'vbs_rk_h1' AND COALESCE(is_superseded,false) = false LIMIT 1) as rk_moy,
  '0.50' as r2_terrain  -- From regression on terrain

UNION ALL SELECT
  'IP', 'H1',
  (SELECT COUNT(*) FROM atlas.v_echantillons_essais WHERE ip IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(AVG(ip)::numeric, 2) FROM atlas.v_echantillons_essais WHERE ip IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(STDDEV(ip)::numeric, 2) FROM atlas.v_echantillons_essais WHERE ip IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'ip_ked_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'ip_rk_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  '0.47'

UNION ALL SELECT
  'WL', 'H1',
  (SELECT COUNT(*) FROM atlas.v_echantillons_essais WHERE wl IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(AVG(wl)::numeric, 2) FROM atlas.v_echantillons_essais WHERE wl IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(STDDEV(wl)::numeric, 2) FROM atlas.v_echantillons_essais WHERE wl IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'wl_ked_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'wl_rk_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  '0.49'

UNION ALL SELECT
  'WP', 'H1',
  (SELECT COUNT(*) FROM atlas.v_echantillons_essais WHERE wp IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(AVG(wp)::numeric, 2) FROM atlas.v_echantillons_essais WHERE wp IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT ROUND(STDDEV(wp)::numeric, 2) FROM atlas.v_echantillons_essais WHERE wp IS NOT NULL AND depth_m BETWEEN 0.5 AND 1.5),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'wp_ked_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  (SELECT value FROM atlas.ai_interpolation_values WHERE parameter_id = 'wp_rk_h1' AND COALESCE(is_superseded,false) = false LIMIT 1),
  '0.46';

-- Vérification globale RK
SELECT
  method,
  COUNT(DISTINCT parameter_id) as params,
  COUNT(*) as valeurs,
  ROUND(AVG(value)::numeric, 2) as moyenne_globale
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan' AND COALESCE(is_superseded,false) = false
GROUP BY method;