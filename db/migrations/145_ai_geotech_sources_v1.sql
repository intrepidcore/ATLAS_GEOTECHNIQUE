BEGIN;

CREATE TABLE IF NOT EXISTS atlas.maille_geotech_infer (
    maille_id UUID PRIMARY KEY REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    maille_code TEXT NOT NULL UNIQUE,
    rga_score NUMERIC(6,2) NOT NULL,
    rga_class TEXT NOT NULL,
    bearing_capacity_kpa NUMERIC(8,2),
    settlement_risk_pct NUMERIC(6,2),
    confidence_score NUMERIC(6,2),
    model_version TEXT NOT NULL DEFAULT 'api-infer-v1-supervised-like',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atlas.maille_geotech_interpolation (
    maille_id UUID PRIMARY KEY REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    maille_code TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL DEFAULT 'kriging_proxy_idw',
    ip_interpolated NUMERIC(8,3),
    vbs_interpolated NUMERIC(8,3),
    eg_interpolated NUMERIC(8,3),
    support_points INTEGER NOT NULL DEFAULT 0,
    interpolation_quality NUMERIC(6,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atlas.maille_geotech_foundation (
    maille_id UUID PRIMARY KEY REFERENCES atlas.mailles(id) ON DELETE CASCADE,
    maille_code TEXT NOT NULL UNIQUE,
    strategy_code TEXT NOT NULL,
    traitement_sol TEXT NOT NULL,
    fondation_type TEXT NOT NULL,
    safety_factor NUMERIC(6,3) NOT NULL,
    estimated_cost_fcfa NUMERIC(14,2) NOT NULL,
    durability_score NUMERIC(6,2) NOT NULL,
    model_version TEXT NOT NULL DEFAULT 'api-opti-v1-genetic-inspired',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mgi_rga_class ON atlas.maille_geotech_infer(rga_class);
CREATE INDEX IF NOT EXISTS idx_mgk_quality ON atlas.maille_geotech_interpolation(interpolation_quality DESC);
CREATE INDEX IF NOT EXISTS idx_mgf_strategy ON atlas.maille_geotech_foundation(strategy_code);

CREATE OR REPLACE FUNCTION atlas.refresh_ai_geotech_sources()
RETURNS TABLE (
    infer_count BIGINT,
    interpolation_count BIGINT,
    foundation_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_infer BIGINT := 0;
    v_interp BIGINT := 0;
    v_found BIGINT := 0;
BEGIN
    INSERT INTO atlas.maille_geotech_infer (
        maille_id,
        maille_code,
        rga_score,
        rga_class,
        bearing_capacity_kpa,
        settlement_risk_pct,
        confidence_score,
        model_version,
        updated_at
    )
    SELECT
        f.maille_id,
        f.maille_code,
        ROUND(
            LEAST(
                100.0,
                GREATEST(
                    0.0,
                    (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                    + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                    + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                    + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
                )
            )::numeric,
            2
        ) AS rga_score,
        CASE
            WHEN (
                (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
            ) >= 80 THEN 'tres_fort'
            WHEN (
                (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
            ) >= 60 THEN 'fort'
            WHEN (
                (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
            ) >= 40 THEN 'moyen'
            ELSE 'faible'
        END AS rga_class,
        ROUND(GREATEST(60.0, 230.0 - (
            LEAST(
                100.0,
                GREATEST(
                    0.0,
                    (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                    + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                    + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                    + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
                )
            ) * 1.1
        ))::numeric, 2) AS bearing_capacity_kpa,
        ROUND(LEAST(100.0, GREATEST(0.0,
            150.0 / NULLIF(GREATEST(60.0, 230.0 - (
                LEAST(
                    100.0,
                    GREATEST(
                        0.0,
                        (COALESCE(f.vbs_moyen, 7.0) * 7.2)
                        + (COALESCE(f.ip_moyen, 25.0) * 1.45)
                        + (COALESCE(f.gonflement_cg_moyen, 4.0) * 2.4)
                        + CASE WHEN COALESCE(f.pct_in_lama, 0) >= 25 THEN 10 ELSE 0 END
                    )
                ) * 1.1
            )), 1) * 100.0
        ))::numeric, 2) AS settlement_risk_pct,
        ROUND(COALESCE(f.data_confidence_score, 35)::numeric, 2) AS confidence_score,
        'api-infer-v1-supervised-like' AS model_version,
        NOW() AS updated_at
    FROM atlas.v_maille_features_ai f
    ON CONFLICT (maille_id) DO UPDATE SET
        maille_code = EXCLUDED.maille_code,
        rga_score = EXCLUDED.rga_score,
        rga_class = EXCLUDED.rga_class,
        bearing_capacity_kpa = EXCLUDED.bearing_capacity_kpa,
        settlement_risk_pct = EXCLUDED.settlement_risk_pct,
        confidence_score = EXCLUDED.confidence_score,
        model_version = EXCLUDED.model_version,
        updated_at = NOW();

    GET DIAGNOSTICS v_infer = ROW_COUNT;

    INSERT INTO atlas.maille_geotech_interpolation (
        maille_id,
        maille_code,
        method,
        ip_interpolated,
        vbs_interpolated,
        eg_interpolated,
        support_points,
        interpolation_quality,
        updated_at
    )
    SELECT
        m.id AS maille_id,
        m.code AS maille_code,
        'kriging_proxy_idw' AS method,
        ROUND(AVG(nn.ip_src * nn.w_ip)::numeric, 3) AS ip_interpolated,
        ROUND(AVG(nn.vbs_src * nn.w_vbs)::numeric, 3) AS vbs_interpolated,
        ROUND(AVG(nn.eg_src * nn.w_eg)::numeric, 3) AS eg_interpolated,
        COUNT(*)::int AS support_points,
        ROUND(LEAST(100.0, COUNT(*) * 20.0)::numeric, 2) AS interpolation_quality,
        NOW()
    FROM atlas.mailles m
    JOIN LATERAL (
        SELECT
            x.ip_moyen AS ip_src,
            x.vbs_moyen AS vbs_src,
            x.gonflement_cg_moyen AS eg_src,
            1.0 / GREATEST(200.0, ST_Distance(m.geom, m2.geom)) AS base_w,
            (1.0 / GREATEST(200.0, ST_Distance(m.geom, m2.geom))) AS w_ip,
            (1.0 / GREATEST(200.0, ST_Distance(m.geom, m2.geom))) AS w_vbs,
            (1.0 / GREATEST(200.0, ST_Distance(m.geom, m2.geom))) AS w_eg
        FROM atlas.mailles m2
        JOIN atlas.v_maille_features_ai x ON x.maille_id = m2.id
        WHERE m2.id <> m.id
          AND (x.ip_moyen IS NOT NULL OR x.vbs_moyen IS NOT NULL OR x.gonflement_cg_moyen IS NOT NULL)
        ORDER BY m.geom <-> m2.geom
        LIMIT 6
    ) nn ON TRUE
    GROUP BY m.id, m.code
    ON CONFLICT (maille_id) DO UPDATE SET
        maille_code = EXCLUDED.maille_code,
        method = EXCLUDED.method,
        ip_interpolated = EXCLUDED.ip_interpolated,
        vbs_interpolated = EXCLUDED.vbs_interpolated,
        eg_interpolated = EXCLUDED.eg_interpolated,
        support_points = EXCLUDED.support_points,
        interpolation_quality = EXCLUDED.interpolation_quality,
        updated_at = NOW();

    GET DIAGNOSTICS v_interp = ROW_COUNT;

    INSERT INTO atlas.maille_geotech_foundation (
        maille_id,
        maille_code,
        strategy_code,
        traitement_sol,
        fondation_type,
        safety_factor,
        estimated_cost_fcfa,
        durability_score,
        model_version,
        updated_at
    )
    SELECT
        i.maille_id,
        i.maille_code,
        CASE
            WHEN i.rga_class = 'tres_fort' THEN 'CIMENT_RADIER'
            WHEN i.rga_class = 'fort' THEN 'CHAUX_RADIER'
            WHEN i.rga_class = 'moyen' THEN 'CHAUX_SEMELLE'
            ELSE 'AUCUN_SEMELLE'
        END AS strategy_code,
        CASE
            WHEN i.rga_class IN ('tres_fort', 'fort') THEN 'ciment_ou_chaux'
            WHEN i.rga_class = 'moyen' THEN 'chaux'
            ELSE 'aucun'
        END AS traitement_sol,
        CASE
            WHEN i.rga_class = 'tres_fort' THEN 'radier_renforce'
            WHEN i.rga_class = 'fort' THEN 'radier'
            ELSE 'semelle_superficielle'
        END AS fondation_type,
        ROUND(
            CASE
                WHEN i.rga_class = 'tres_fort' THEN 1.95
                WHEN i.rga_class = 'fort' THEN 1.70
                WHEN i.rga_class = 'moyen' THEN 1.45
                ELSE 1.25
            END::numeric,
            3
        ) AS safety_factor,
        ROUND(
            CASE
                WHEN i.rga_class = 'tres_fort' THEN 36000000
                WHEN i.rga_class = 'fort' THEN 28000000
                WHEN i.rga_class = 'moyen' THEN 18500000
                ELSE 12000000
            END::numeric,
            2
        ) AS estimated_cost_fcfa,
        ROUND(
            CASE
                WHEN i.rga_class = 'tres_fort' THEN 92
                WHEN i.rga_class = 'fort' THEN 88
                WHEN i.rga_class = 'moyen' THEN 82
                ELSE 76
            END::numeric,
            2
        ) AS durability_score,
        'api-opti-v1-genetic-inspired' AS model_version,
        NOW()
    FROM atlas.maille_geotech_infer i
    ON CONFLICT (maille_id) DO UPDATE SET
        maille_code = EXCLUDED.maille_code,
        strategy_code = EXCLUDED.strategy_code,
        traitement_sol = EXCLUDED.traitement_sol,
        fondation_type = EXCLUDED.fondation_type,
        safety_factor = EXCLUDED.safety_factor,
        estimated_cost_fcfa = EXCLUDED.estimated_cost_fcfa,
        durability_score = EXCLUDED.durability_score,
        model_version = EXCLUDED.model_version,
        updated_at = NOW();

    GET DIAGNOSTICS v_found = ROW_COUNT;

    RETURN QUERY SELECT v_infer, v_interp, v_found;
END;
$$;

DROP VIEW IF EXISTS atlas.v_thematic_ai_geotech;
CREATE VIEW atlas.v_thematic_ai_geotech AS
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
    k.ip_interpolated AS kriging_ip,
    k.vbs_interpolated AS kriging_vbs,
    f.safety_factor AS ag_safety_factor,
    (f.estimated_cost_fcfa / 1000000.0) AS ag_cout_millions
FROM atlas.mailles m
LEFT JOIN adm2_tg a2 ON a2.name = m.adm2_name
LEFT JOIN atlas.v_maille_features_ai vf ON vf.maille_id = m.id
LEFT JOIN atlas.maille_geotech_infer i ON i.maille_id = m.id
LEFT JOIN atlas.maille_geotech_interpolation k ON k.maille_id = m.id
LEFT JOIN atlas.maille_geotech_foundation f ON f.maille_id = m.id;

DROP TRIGGER IF EXISTS trg_ai_queue_after_sondage ON atlas.sondages;
CREATE OR REPLACE FUNCTION atlas.queue_ai_training_job_after_sondage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO atlas.ai_training_jobs (id, model_target, trigger_reason, status, requested_by)
    VALUES (
        gen_random_uuid(),
        'rga_predictor',
        'new_sondage_data',
        'queued',
        NULL
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_queue_after_sondage
AFTER INSERT ON atlas.sondages
FOR EACH ROW
EXECUTE FUNCTION atlas.queue_ai_training_job_after_sondage();

COMMIT;
