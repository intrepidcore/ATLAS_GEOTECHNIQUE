BEGIN;

CREATE TABLE IF NOT EXISTS atlas.pedological_drift_priors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
  horizon_label text NOT NULL,
  depth_m double precision NOT NULL,
  type_sol text NOT NULL,
  drift_value double precision NOT NULL,
  n_points integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  source_label text NULL
);

CREATE INDEX IF NOT EXISTS idx_pedological_drift_priors_param_horizon
  ON atlas.pedological_drift_priors(parameter_id, horizon_label, computed_at DESC);

INSERT INTO atlas.ai_parameter_catalog (
  parameter_id, category, source, unit,
  interpolation_enabled, prediction_enabled, is_active,
  source_table, source_column, domain_type_pref, drift_strategy,
  physical_min, physical_max, depth_stratified, is_derived, derived_from
)
VALUES
  ('eg_ked_h1', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE,
   'essais_potentiel_gonflement', 'cg', 'pedologie', 'pedological_prior_residual_kriging',
   0, 20, TRUE, FALSE, '{}'::text[]),
  ('eg_ked_h2', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE,
   'essais_potentiel_gonflement', 'cg', 'pedologie', 'pedological_prior_residual_kriging',
   0, 20, TRUE, FALSE, '{}'::text[]),
  ('eg_ked_h3', 'geotech', 'interpolation', '%', TRUE, FALSE, TRUE,
   'essais_potentiel_gonflement', 'cg', 'pedologie', 'pedological_prior_residual_kriging',
   0, 20, TRUE, FALSE, '{}'::text[])
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
