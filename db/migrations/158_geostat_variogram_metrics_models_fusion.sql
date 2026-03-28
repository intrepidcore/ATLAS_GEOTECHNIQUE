BEGIN;

-- =============================================================================
-- Métriques variogramme normalisées (audit) + registre modèles ONNX + fusion
-- multi-domaines (domaine primaire au centroïde)
-- =============================================================================

ALTER TABLE atlas.ai_variograms
    ADD COLUMN IF NOT EXISTS loo_rmse double precision,
    ADD COLUMN IF NOT EXISTS block_cv_rmse double precision,
    ADD COLUMN IF NOT EXISTS spatial_kfold_rmse double precision;

COMMENT ON COLUMN atlas.ai_variograms.loo_rmse IS 'RMSE leave-one-out (PyKrige), même run que fit_quality';
COMMENT ON COLUMN atlas.ai_variograms.block_cv_rmse IS 'RMSE validation par blocs spatiaux (KMeans)';
COMMENT ON COLUMN atlas.ai_variograms.spatial_kfold_rmse IS 'RMSE moyen spatial k-fold (blocs rotations)';

-- Registre des artefacts ML exportés (ONNX, ordre des features, métriques d’entraînement)
CREATE TABLE IF NOT EXISTS atlas.ai_models_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_key text NOT NULL,
    version text NOT NULL,
    framework text NOT NULL DEFAULT 'catboost_onnx',
    onnx_uri text,
    feature_order jsonb NOT NULL DEFAULT '[]'::jsonb,
    training_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    training_sql_fingerprint text,
    notes text,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (model_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_registry_key_active
    ON atlas.ai_models_registry (model_key) WHERE is_active;

COMMENT ON TABLE atlas.ai_models_registry IS
  'Versions de modèles exportés (ONNX, etc.) pour inférence api-infer et reproductibilité.';

-- Domaine de krigeage « primaire » pour chaque maille : centroïde dans l’unité ;
-- priorité géologie > pédologie > risque ; à surface égale ou proche, plus petite emprise.
CREATE OR REPLACE VIEW atlas.v_maille_primary_kriging_domain AS
WITH ctr AS (
    SELECT m.id AS maille_id, ST_PointOnSurface(m.geom) AS g
    FROM atlas.mailles m
    WHERE m.geom IS NOT NULL
),
cand AS (
    SELECT
        c.maille_id,
        d.id AS primary_kriging_domain_id,
        d.domain_type,
        ST_Area(d.geom)::double precision AS area_m2
    FROM ctr c
    INNER JOIN atlas.kriging_domains d
        ON d.is_active
       AND ST_Contains(d.geom, c.g)
),
ranked AS (
    SELECT
        maille_id,
        primary_kriging_domain_id,
        ROW_NUMBER() OVER (
            PARTITION BY maille_id
            ORDER BY
                CASE domain_type
                    WHEN 'geologie' THEN 1
                    WHEN 'pedologie' THEN 2
                    WHEN 'risque_gonflement' THEN 3
                    ELSE 4
                END,
                area_m2 ASC NULLS LAST
        ) AS rn
    FROM cand
)
SELECT maille_id, primary_kriging_domain_id
FROM ranked
WHERE rn = 1;

COMMENT ON VIEW atlas.v_maille_primary_kriging_domain IS
  'Une maille peut intersecter plusieurs kriging_domains ; on retient géologie puis pédologie puis risque, avec la plus petite surface (unité la plus spécifique).';

-- Recréer v_latest : priorité méthode RK > OK ordinaire > correspondance domaine primaire > récence
DROP VIEW IF EXISTS atlas.v_thematic_ai_geotech;
DROP VIEW IF EXISTS atlas.v_latest_ai_interpolation;

CREATE OR REPLACE VIEW atlas.v_latest_ai_interpolation AS
WITH ranked AS (
    SELECT
        iv.id,
        iv.maille_id,
        iv.zone_id,
        iv.kriging_domain_id,
        iv.parameter_id,
        iv.value,
        iv.variance,
        iv.confidence,
        iv.method,
        iv.variogram_id,
        iv.run_id,
        iv.created_at,
        ROW_NUMBER() OVER (
            PARTITION BY iv.maille_id, iv.parameter_id
            ORDER BY
                CASE
                    WHEN iv.method IN (
                        'regression_kriging_catboost',
                        'regression_kriging_pykrige_catboost'
                    ) THEN 0
                    WHEN iv.method LIKE 'regression_kriging%' THEN 0
                    ELSE 1
                END,
                CASE
                    WHEN iv.kriging_domain_id IS NULL THEN 1
                    WHEN iv.kriging_domain_id = mp.primary_kriging_domain_id THEN 0
                    ELSE 1
                END,
                iv.created_at DESC
        ) AS rn
    FROM atlas.ai_interpolation_values iv
    LEFT JOIN atlas.v_maille_primary_kriging_domain mp ON mp.maille_id = iv.maille_id
)
SELECT
    id,
    maille_id,
    zone_id,
    kriging_domain_id,
    parameter_id,
    value,
    variance,
    confidence,
    method,
    variogram_id,
    run_id,
    created_at
FROM ranked
WHERE rn = 1;

COMMENT ON VIEW atlas.v_latest_ai_interpolation IS
  'Dernière valeur utile par maille×paramètre : priorité régression-kriging (ML+résidus), puis domaine primaire au centroïde, puis timestamp.';

CREATE OR REPLACE VIEW atlas.v_thematic_ai_geotech AS
SELECT
    m.code,
    ST_Transform(m.geom, 4326) AS geom,
    a2.adm1_name AS adm1_name,
    m.adm2_name,
    NULL::text AS adm3_name,
    COALESCE(vf.n_sondages, 0)::int AS n_sondages,
    COALESCE(vf.n_sondages, 0)::int AS n_essais_geo,
    i.rga_score AS ai_rga_score_infer,
    i.bearing_capacity_kpa AS ai_portance_kpa_infer,
    COALESCE(ip_ai.value, k.ip_interpolated) AS kriging_ip,
    COALESCE(vbs_ai.value, k.vbs_interpolated) AS kriging_vbs,
    f.safety_factor AS ag_safety_factor,
    (f.estimated_cost_fcfa / 1000000.0) AS ag_cout_millions
FROM atlas.mailles m
LEFT JOIN adm2_tg a2 ON a2.name = m.adm2_name
LEFT JOIN atlas.v_maille_features_ai vf ON vf.maille_id = m.id
LEFT JOIN atlas.maille_geotech_infer i ON i.maille_id = m.id
LEFT JOIN atlas.maille_geotech_interpolation k ON k.maille_id = m.id
LEFT JOIN atlas.maille_geotech_foundation f ON f.maille_id = m.id
LEFT JOIN LATERAL (
    SELECT v.value
    FROM atlas.v_latest_ai_interpolation v
    WHERE v.maille_id = m.id
      AND v.parameter_id IN ('kriging_ip', 'ip_avg')
    ORDER BY CASE WHEN v.parameter_id = 'kriging_ip' THEN 0 ELSE 1 END, v.created_at DESC
    LIMIT 1
) ip_ai ON TRUE
LEFT JOIN LATERAL (
    SELECT v.value
    FROM atlas.v_latest_ai_interpolation v
    WHERE v.maille_id = m.id
      AND v.parameter_id IN ('kriging_vbs', 'vbs_avg')
    ORDER BY CASE WHEN v.parameter_id = 'kriging_vbs' THEN 0 ELSE 1 END, v.created_at DESC
    LIMIT 1
) vbs_ai ON TRUE;

COMMENT ON VIEW atlas.v_thematic_ai_geotech IS
  'Couches carte : kriging_ip / kriging_vbs depuis v_latest_ai_interpolation (fusion RK + domaine), sinon legacy.';

COMMIT;
