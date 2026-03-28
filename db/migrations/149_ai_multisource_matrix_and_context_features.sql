BEGIN;

CREATE TABLE IF NOT EXISTS atlas.ai_parameter_catalog (
    parameter_id text PRIMARY KEY,
    category text NOT NULL,
    source text NOT NULL CHECK (source IN ('base', 'interpolation', 'ia')),
    unit text,
    interpolation_enabled boolean NOT NULL DEFAULT false,
    prediction_enabled boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO atlas.ai_parameter_catalog (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled)
VALUES
('vbs_avg', 'argilosite', 'base', 'g/100g', true, true),
('ip_avg', 'argilosite', 'base', '%', true, true),
('wl_avg', 'argilosite', 'base', '%', false, true),
('wp_avg', 'argilosite', 'base', '%', false, true),
('eg_avg', 'gonflement', 'base', '%', true, true),
('gamma_d_max_avg', 'compacite', 'base', 't/m3', false, true),
('w_opt_avg', 'compacite', 'base', '%', false, true),
('passant_80um_avg', 'granulometrie', 'base', '%', true, true),
('passant_2mm_avg', 'granulometrie', 'base', '%', false, true),
('passant_20mm_avg', 'granulometrie', 'base', '%', false, true),
('kriging_vbs', 'argilosite', 'interpolation', 'g/100g', true, false),
('kriging_ip', 'argilosite', 'interpolation', '%', true, false),
('ai_rga_score_infer', 'ia', 'ia', 'score', false, true),
('ai_portance_kpa_infer', 'ia', 'ia', 'kPa', false, true),
('ag_safety_factor', 'fondation', 'ia', 'FS', false, true),
('ag_cout_millions', 'fondation', 'ia', 'M FCFA', false, true)
ON CONFLICT (parameter_id) DO UPDATE SET
    category = EXCLUDED.category,
    source = EXCLUDED.source,
    unit = EXCLUDED.unit,
    interpolation_enabled = EXCLUDED.interpolation_enabled,
    prediction_enabled = EXCLUDED.prediction_enabled,
    is_active = true,
    updated_at = now();

CREATE TABLE IF NOT EXISTS atlas.ai_interpolation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type text NOT NULL DEFAULT 'kriging',
    parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
    method text NOT NULL DEFAULT 'kriging_gp_global_v1',
    model_version text,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'finished', 'failed')),
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_interpolation_runs_param_created
    ON atlas.ai_interpolation_runs(parameter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS atlas.ai_prediction_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type text NOT NULL DEFAULT 'supervised_multitarget',
    target_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
    model_version text,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'finished', 'failed')),
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_runs_target_created
    ON atlas.ai_prediction_runs(target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS atlas.ai_context_features_maille (
    maille_code text PRIMARY KEY,
    geol_code text,
    geol_label text,
    pedo_code text,
    pedo_label text,
    risque_gonflement text,
    risque_score numeric(6,3),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION atlas.risque_to_score(risque text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE lower(coalesce($1, ''))
        WHEN 'faible' THEN 0.20
        WHEN 'moyen' THEN 0.50
        WHEN 'fort' THEN 0.80
        WHEN 'tres_fort' THEN 1.00
        ELSE NULL
    END;
$$;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_context_features_maille()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    INSERT INTO atlas.ai_context_features_maille (
        maille_code, geol_code, geol_label, pedo_code, pedo_label, risque_gonflement, risque_score, updated_at
    )
    SELECT
        m.code AS maille_code,
        g.code AS geol_code,
        g.libelle AS geol_label,
        p.code AS pedo_code,
        p.libelle AS pedo_label,
        rg.risque_gonflement,
        atlas.risque_to_score(rg.risque_gonflement) AS risque_score,
        now() AS updated_at
    FROM atlas.mailles m
    LEFT JOIN LATERAL (
        SELECT ug.code, ug.libelle
        FROM atlas.unites_geologiques ug
        WHERE ug.geom IS NOT NULL
          AND ST_Intersects(m.geom, ug.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, ug.geom)) DESC NULLS LAST
        LIMIT 1
    ) g ON true
    LEFT JOIN LATERAL (
        SELECT up.code, up.libelle
        FROM atlas.unites_pedologiques up
        WHERE up.geom IS NOT NULL
          AND ST_Intersects(m.geom, up.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, up.geom)) DESC NULLS LAST
        LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
        SELECT r.risque_gonflement
        FROM atlas.risque_gonflement r
        WHERE r.geom IS NOT NULL
          AND ST_Intersects(m.geom, r.geom)
        ORDER BY ST_Area(ST_Intersection(m.geom, r.geom)) DESC NULLS LAST
        LIMIT 1
    ) rg ON true
    ON CONFLICT (maille_code) DO UPDATE SET
        geol_code = EXCLUDED.geol_code,
        geol_label = EXCLUDED.geol_label,
        pedo_code = EXCLUDED.pedo_code,
        pedo_label = EXCLUDED.pedo_label,
        risque_gonflement = EXCLUDED.risque_gonflement,
        risque_score = EXCLUDED.risque_score,
        updated_at = EXCLUDED.updated_at;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

SELECT atlas.refresh_ai_context_features_maille();

CREATE OR REPLACE VIEW atlas.v_ai_training_matrix_multitarget AS
SELECT
    m.code AS maille_code,
    af.n_sondages,
    af.dsm_altitude_mean AS altitude_mean,
    af.dsm_altitude_stddev AS altitude_stddev,
    af.dsm_altitude_range AS altitude_range,
    af.pct_in_lama,
    cf.geol_code,
    cf.pedo_code,
    cf.risque_gonflement,
    cf.risque_score,
    s.vbs_avg,
    s.ip_avg,
    s.wl_avg,
    s.wp_avg,
    s.eg_avg,
    s.gamma_d_max_avg,
    s.w_opt_avg,
    s.passant_80um_avg,
    s.passant_2mm_avg,
    s.passant_20mm_avg
FROM atlas.mailles m
LEFT JOIN atlas.ai_maille_features_fast af ON af.maille_code = m.code
LEFT JOIN atlas.ai_context_features_maille cf ON cf.maille_code = m.code
LEFT JOIN mailles_geotechnique_stats_wgs84 s ON s.code = m.code;

CREATE OR REPLACE VIEW atlas.v_ai_interpolation_plan AS
SELECT
    category,
    parameter_id,
    unit,
    interpolation_enabled,
    CASE WHEN interpolation_enabled THEN 'kriging_gp_global_v1' ELSE NULL END AS method
FROM atlas.ai_parameter_catalog
WHERE is_active = true
  AND source IN ('base', 'interpolation')
  AND interpolation_enabled = true
ORDER BY category, parameter_id;

CREATE OR REPLACE VIEW atlas.v_ai_prediction_plan AS
SELECT
    category,
    parameter_id,
    unit,
    prediction_enabled,
    CASE WHEN prediction_enabled THEN 'supervised_multitarget_v1' ELSE NULL END AS model_kind
FROM atlas.ai_parameter_catalog
WHERE is_active = true
  AND source IN ('base', 'ia')
  AND prediction_enabled = true
ORDER BY category, parameter_id;

COMMIT;
