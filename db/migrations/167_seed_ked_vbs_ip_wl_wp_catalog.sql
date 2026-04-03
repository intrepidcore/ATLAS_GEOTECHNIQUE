BEGIN;

-- Seed national KED parameters for VBS/IP/WL/WP across H1/H2/H3.
-- Used as foreign keys by atlas.ai_interpolation_values and as UI/selection contracts.
INSERT INTO atlas.ai_parameter_catalog (
  parameter_id, category, source, unit,
  interpolation_enabled, prediction_enabled, is_active,
  source_table, source_column, domain_type_pref, drift_strategy,
  physical_min, physical_max, depth_stratified, is_derived, derived_from
)
VALUES
  -- VBS
  ('vbs_ked_h1', 'geotech', 'interpolation', 'g/100g', TRUE, FALSE, TRUE, 'essais_vbs', 'vbs', 'pedologie',
   'pedological_prior_residual_kriging', 0, 15, TRUE, FALSE, '{}'::text[]),
  ('vbs_ked_h2', 'geotech', 'interpolation', 'g/100g', TRUE, FALSE, TRUE, 'essais_vbs', 'vbs', 'pedologie',
   'pedological_prior_residual_kriging', 0, 15, TRUE, FALSE, '{}'::text[]),
  ('vbs_ked_h3', 'geotech', 'interpolation', 'g/100g', TRUE, FALSE, TRUE, 'essais_vbs', 'vbs', 'pedologie',
   'pedological_prior_residual_kriging', 0, 15, TRUE, FALSE, '{}'::text[]),

  -- IP
  ('ip_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'ip_generated', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('ip_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'ip_generated', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('ip_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'ip_generated', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),

  -- WL
  ('wl_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wl', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('wl_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wl', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('wl_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wl', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),

  -- WP
  ('wp_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wp', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('wp_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wp', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[]),
  ('wp_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE, 'essais_atterberg', 'wp', 'pedologie',
   'pedological_prior_residual_kriging', 0, 100, TRUE, FALSE, '{}'::text[])
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

