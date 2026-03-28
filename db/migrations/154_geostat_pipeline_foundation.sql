BEGIN;

-- =============================================================================
-- E0 — QA données & unités (prérequis variogrammes / kriging)
-- =============================================================================

CREATE TABLE IF NOT EXISTS atlas.parameter_units_reference (
    parameter_code text PRIMARY KEY,
    canonical_unit text NOT NULL,
    description text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Aligné sur atlas.ai_parameter_catalog (149) + paramètres géostat étendus
INSERT INTO atlas.ai_parameter_catalog (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled)
VALUES
('nspt_avg', 'compacite', 'base', 'count', true, false),
('cu_avg', 'compacite', 'base', 'kPa', true, false)
ON CONFLICT (parameter_id) DO UPDATE SET
    category = EXCLUDED.category,
    source = EXCLUDED.source,
    unit = EXCLUDED.unit,
    interpolation_enabled = EXCLUDED.interpolation_enabled OR atlas.ai_parameter_catalog.interpolation_enabled,
    prediction_enabled = EXCLUDED.prediction_enabled OR atlas.ai_parameter_catalog.prediction_enabled,
    updated_at = now();

INSERT INTO atlas.parameter_units_reference (parameter_code, canonical_unit, description) VALUES
('vbs_avg', 'g/100g', 'VBS moyen maille'),
('ip_avg', '%', 'IP moyen'),
('wl_avg', '%', 'WL moyen'),
('wp_avg', '%', 'WP moyen'),
('eg_avg', '%', 'Gonflement'),
('gamma_d_max_avg', 't/m3', 'Gamma sec max (Proctor)'),
('passant_80um_avg', '%', 'Passant 80 µm'),
('kriging_vbs', 'g/100g', 'Sortie kriging VBS'),
('kriging_ip', '%', 'Sortie kriging IP'),
('nspt_avg', 'count', 'SPT — coups moyens'),
('cu_avg', 'kPa', 'Cohésion non drainée moyenne')
ON CONFLICT (parameter_code) DO UPDATE SET
  canonical_unit = EXCLUDED.canonical_unit,
  description = EXCLUDED.description,
  updated_at = now();

CREATE OR REPLACE VIEW atlas.sondages_valides_kriging AS
SELECT
    s.id AS sondage_id,
    s.maille_code,
    (s.geom IS NOT NULL AND ST_IsValid(s.geom)) AS coord_valid,
    (
        COALESCE(s.depth_m_max::double precision, s.depth_m_min::double precision, 0) > 0
        OR EXISTS (SELECT 1 FROM atlas.echantillons e WHERE e.sondage_id = s.id)
    ) AS depth_valid,
    (s.maille_code IS NOT NULL AND length(trim(s.maille_code)) > 0) AS zone_valid,
    true AS param_not_null,
    true AS unit_consistent,
    (
        s.geom IS NOT NULL AND ST_IsValid(s.geom)
        AND s.maille_code IS NOT NULL
        AND s.deleted_at IS NULL
    ) AS is_valid_for_kriging
FROM atlas.sondages s
WHERE s.deleted_at IS NULL;

COMMENT ON VIEW atlas.sondages_valides_kriging IS
  'E0.1 — Filtres qualité pour géostatistique ; affiner param_not_null / unit_consistent selon règles métier.';

CREATE TABLE IF NOT EXISTS atlas.ai_geostat_outlier_flags (
    sondage_id uuid PRIMARY KEY REFERENCES atlas.sondages(id) ON DELETE CASCADE,
    is_outlier_value boolean NOT NULL DEFAULT false,
    is_outlier_spatial boolean NOT NULL DEFAULT false,
    method text,
    score double precision,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- E2 — Variogrammes (historique : pas d’unicité stricte param×zone×modèle)
-- =============================================================================

CREATE TABLE IF NOT EXISTS atlas.ai_variograms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
    zone_id uuid NOT NULL REFERENCES atlas.zones_etude(id) ON DELETE CASCADE,
    model_type text NOT NULL,
    range_m double precision,
    sill double precision,
    nugget double precision,
    anisotropy_ratio double precision,
    anisotropy_angle_deg double precision,
    fit_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_variograms_zone_param
    ON atlas.ai_variograms(zone_id, parameter_id, created_at DESC);

-- =============================================================================
-- E3 / E4 — Runs d’interpolation + stockage EAV
-- =============================================================================
-- Table atlas.ai_interpolation_runs existe déjà (149) : on ajoute le lien zone.
ALTER TABLE atlas.ai_interpolation_runs
    ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_interp_runs_zone_param
    ON atlas.ai_interpolation_runs(zone_id, parameter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS atlas.ai_interpolation_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    maille_id uuid NOT NULL REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL,
    parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
    value double precision,
    variance double precision,
    confidence double precision,
    method text NOT NULL DEFAULT 'ordinary_kriging_v0',
    variogram_id uuid REFERENCES atlas.ai_variograms(id) ON DELETE SET NULL,
    run_id uuid REFERENCES atlas.ai_interpolation_runs(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interp_val_maille_param
    ON atlas.ai_interpolation_values(maille_id, parameter_id);
CREATE INDEX IF NOT EXISTS idx_ai_interp_val_run ON atlas.ai_interpolation_values(run_id);

-- Plan catalogue : boucle FOR parameter × zone (ne pas remplacer v_ai_interpolation_plan — utilisé par l’API)
CREATE OR REPLACE VIEW atlas.v_ai_kriging_zone_plan AS
SELECT
    p.category,
    p.parameter_id,
    p.unit,
    z.id AS zone_id,
    z.code AS zone_code,
    z.nom AS zone_nom,
    CASE WHEN p.interpolation_enabled THEN 'ordinary_kriging_v0' ELSE NULL END AS method_hint
FROM atlas.ai_parameter_catalog p
CROSS JOIN atlas.zones_etude z
WHERE p.interpolation_enabled = true
  AND p.is_active = true
  AND p.source IN ('base', 'interpolation')
  AND z.is_published = true;

COMMENT ON VIEW atlas.v_ai_kriging_zone_plan IS
  'E4 — couples (parameter_id × zone) pour kriging par zone d’étude ; v_ai_interpolation_plan reste le plan paramètres seul (API).';

-- =============================================================================
-- E5 — Validation spatiale
-- =============================================================================

CREATE TABLE IF NOT EXISTS atlas.ai_spatial_validation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_type text NOT NULL,
    parameter_id text REFERENCES atlas.ai_parameter_catalog(parameter_id),
    train_zone_code text,
    test_zone_code text,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- E1 — EDA (métadonnées + artefacts structurés)
-- =============================================================================

CREATE TABLE IF NOT EXISTS atlas.ai_geostat_eda_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL,
    parameter_id text REFERENCES atlas.ai_parameter_catalog(parameter_id),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas.ai_variogram_cloud (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL,
    parameter_id text REFERENCES atlas.ai_parameter_catalog(parameter_id),
    pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atlas.ai_spatial_trend_surface (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id uuid REFERENCES atlas.zones_etude(id) ON DELETE SET NULL,
    parameter_id text REFERENCES atlas.ai_parameter_catalog(parameter_id),
    grid_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    values_raster bytea,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- D1 — Features distance / morpho (remplissage ultérieur par scripts)
-- =============================================================================

ALTER TABLE atlas.ai_context_features_maille
    ADD COLUMN IF NOT EXISTS distance_river_m double precision,
    ADD COLUMN IF NOT EXISTS distance_fault_m double precision,
    ADD COLUMN IF NOT EXISTS distance_road_m double precision,
    ADD COLUMN IF NOT EXISTS distance_basin_axis_m double precision,
    ADD COLUMN IF NOT EXISTS dem_slope_mean_deg double precision,
    ADD COLUMN IF NOT EXISTS dem_tpi_mean double precision,
    ADD COLUMN IF NOT EXISTS dem_curvature_mean double precision,
    ADD COLUMN IF NOT EXISTS dem_flow_acc_mean double precision,
    ADD COLUMN IF NOT EXISTS dem_hand_mean double precision;

COMMENT ON COLUMN atlas.ai_context_features_maille.distance_river_m IS 'D1.1 — distance cours d’eau (m)';
COMMENT ON COLUMN atlas.ai_context_features_maille.distance_fault_m IS 'D1.1 — distance faille / structure (m)';

COMMIT;
