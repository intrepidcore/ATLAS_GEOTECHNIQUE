BEGIN;

INSERT INTO atlas.ai_parameter_catalog (
  parameter_id, category, source, unit,
  interpolation_enabled, prediction_enabled, is_active,
  source_table, source_column, domain_type_pref, drift_strategy,
  physical_min, physical_max, depth_stratified, is_derived, derived_from
)
VALUES
  -- P4: Granulometrie KED
  ('passant_2mm_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_2mm', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('passant_2mm_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_2mm', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('passant_2mm_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_2mm', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),

  ('passant_80um_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_80um', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('passant_80um_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_80um', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('passant_80um_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'granulo_points', 'passant_80um', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),

  -- P5: IP derive (WL_ked - WP_ked)
  ('ip_derived_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'ai_interpolation_values', 'value', 'pedologie',
   'deterministic_derived', 0, 100, TRUE, TRUE, ARRAY['wl_ked_h1','wp_ked_h1']),
  ('ip_derived_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'ai_interpolation_values', 'value', 'pedologie',
   'deterministic_derived', 0, 100, TRUE, TRUE, ARRAY['wl_ked_h2','wp_ked_h2']),
  ('ip_derived_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'ai_interpolation_values', 'value', 'pedologie',
   'deterministic_derived', 0, 100, TRUE, TRUE, ARRAY['wl_ked_h3','wp_ked_h3'])
ON CONFLICT (parameter_id) DO UPDATE SET
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  unit = EXCLUDED.unit,
  interpolation_enabled = EXCLUDED.interpolation_enabled,
  prediction_enabled = EXCLUDED.prediction_enabled,
  is_active = EXCLUDED.is_active,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  domain_type_pref = EXCLUDED.domain_type_pref,
  drift_strategy = EXCLUDED.drift_strategy,
  physical_min = EXCLUDED.physical_min,
  physical_max = EXCLUDED.physical_max,
  depth_stratified = EXCLUDED.depth_stratified,
  is_derived = EXCLUDED.is_derived,
  derived_from = EXCLUDED.derived_from,
  updated_at = now();

COMMIT;

