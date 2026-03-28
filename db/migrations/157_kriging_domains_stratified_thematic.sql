BEGIN;

-- =============================================================================
-- Domaines de krigeage stratifié (géologie / pédologie / risque) — couverture nationale
-- + vue dernière interpolation scientifique + raccord thématique carte
-- =============================================================================

CREATE TABLE IF NOT EXISTS atlas.kriging_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_type text NOT NULL CHECK (domain_type IN ('geologie', 'pedologie', 'risque_gonflement')),
    domain_code text NOT NULL,
    libelle text,
    source_feature_id integer,
    geom geometry NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (domain_type, domain_code)
);

CREATE INDEX IF NOT EXISTS idx_kriging_domains_geom
    ON atlas.kriging_domains USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_kriging_domains_type_active
    ON atlas.kriging_domains (domain_type) WHERE is_active;

COMMENT ON TABLE atlas.kriging_domains IS
  'Unités spatiales homogènes pour krigeage stratifié (variogramme / stationnarité locale). Alimenté depuis unites_geologiques, unites_pedologiques, risque_gonflement.';

-- Peupler depuis les couches contexte existantes (SRID projeté 25231, comme api-geo/layers)
INSERT INTO atlas.kriging_domains (domain_type, domain_code, libelle, source_feature_id, geom)
SELECT
    'geologie'::text,
    u.code,
    u.libelle,
    u.ogc_fid::integer,
    ST_SetSRID(ST_Multi(ST_UnaryUnion(ST_MakeValid(u.geom))), 25231)
FROM atlas.unites_geologiques u
WHERE u.geom IS NOT NULL
  AND u.code IS NOT NULL
  AND NOT ST_IsEmpty(u.geom)
ON CONFLICT (domain_type, domain_code) DO UPDATE SET
    libelle = EXCLUDED.libelle,
    source_feature_id = EXCLUDED.source_feature_id,
    geom = EXCLUDED.geom,
    is_active = true;

INSERT INTO atlas.kriging_domains (domain_type, domain_code, libelle, source_feature_id, geom)
SELECT
    'pedologie'::text,
    u.code,
    u.libelle,
    u.ogc_fid::integer,
    ST_SetSRID(ST_Multi(ST_UnaryUnion(ST_MakeValid(u.geom))), 25231)
FROM atlas.unites_pedologiques u
WHERE u.geom IS NOT NULL
  AND u.code IS NOT NULL
  AND NOT ST_IsEmpty(u.geom)
ON CONFLICT (domain_type, domain_code) DO UPDATE SET
    libelle = EXCLUDED.libelle,
    source_feature_id = EXCLUDED.source_feature_id,
    geom = EXCLUDED.geom,
    is_active = true;

INSERT INTO atlas.kriging_domains (domain_type, domain_code, libelle, source_feature_id, geom)
SELECT
    'risque_gonflement'::text,
    u.code,
    u.libelle,
    u.ogc_fid::integer,
    ST_SetSRID(ST_Multi(ST_UnaryUnion(ST_MakeValid(u.geom))), 25231)
FROM atlas.risque_gonflement u
WHERE u.geom IS NOT NULL
  AND u.code IS NOT NULL
  AND NOT ST_IsEmpty(u.geom)
ON CONFLICT (domain_type, domain_code) DO UPDATE SET
    libelle = EXCLUDED.libelle,
    source_feature_id = EXCLUDED.source_feature_id,
    geom = EXCLUDED.geom,
    is_active = true;

-- Variogrammes : autoriser exécution sans zone d'étude (domaine national homogène)
ALTER TABLE atlas.ai_variograms
    ALTER COLUMN zone_id DROP NOT NULL;

ALTER TABLE atlas.ai_variograms
    ADD COLUMN IF NOT EXISTS kriging_domain_id uuid REFERENCES atlas.kriging_domains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_variograms_kriging_domain
    ON atlas.ai_variograms (kriging_domain_id, parameter_id, created_at DESC);

ALTER TABLE atlas.ai_interpolation_runs
    ADD COLUMN IF NOT EXISTS kriging_domain_id uuid REFERENCES atlas.kriging_domains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_interp_runs_kriging_domain
    ON atlas.ai_interpolation_runs (kriging_domain_id, parameter_id, created_at DESC);

ALTER TABLE atlas.ai_interpolation_values
    ADD COLUMN IF NOT EXISTS kriging_domain_id uuid REFERENCES atlas.kriging_domains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_interp_val_kriging_domain
    ON atlas.ai_interpolation_values (kriging_domain_id, parameter_id);

-- Dernière valeur interpolée par maille × paramètre (traçabilité via run_id / created_at)
CREATE OR REPLACE VIEW atlas.v_latest_ai_interpolation AS
SELECT DISTINCT ON (maille_id, parameter_id)
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
FROM atlas.ai_interpolation_values
ORDER BY maille_id, parameter_id, created_at DESC;

COMMENT ON VIEW atlas.v_latest_ai_interpolation IS
  'Dernière sortie krigeage / interpolation persistée par maille et paramètre (timestamps). Chevauchement entre domaines : la dernière exécution l''emporte — stratégie de fusion à affiner côté pipeline.';

-- Plan batch : paramètres actifs × domaines actifs
CREATE OR REPLACE VIEW atlas.v_ai_kriging_domain_plan AS
SELECT
    d.id AS kriging_domain_id,
    d.domain_type,
    d.domain_code,
    d.libelle AS domain_libelle,
    p.parameter_id,
    p.category,
    p.unit,
    CASE WHEN p.interpolation_enabled THEN 'stratified_ordinary_kriging_v1' ELSE NULL END AS method_hint
FROM atlas.kriging_domains d
CROSS JOIN atlas.ai_parameter_catalog p
WHERE d.is_active
  AND p.interpolation_enabled = true
  AND p.is_active = true
  AND p.source IN ('base', 'interpolation');

COMMENT ON VIEW atlas.v_ai_kriging_domain_plan IS
  'Couples (kriging_domain × parameter_id) pour krigeage stratifié sur unités géologiques / pédologiques / risque.';

-- Activer interpolation catalogue pour WL / WP / granulo (colonnes présentes dans mailles_geotechnique_stats_wgs84)
INSERT INTO atlas.ai_parameter_catalog (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled)
VALUES
('wl_avg', 'argilosite', 'base', '%', true, true),
('wp_avg', 'argilosite', 'base', '%', true, true),
('passant_2mm_avg', 'granulometrie', 'base', '%', true, true),
('passant_20mm_avg', 'granulometrie', 'base', '%', true, true)
ON CONFLICT (parameter_id) DO UPDATE SET
    interpolation_enabled = true,
    prediction_enabled = EXCLUDED.prediction_enabled OR atlas.ai_parameter_catalog.prediction_enabled,
    updated_at = now();

-- Référence unités
INSERT INTO atlas.parameter_units_reference (parameter_code, canonical_unit, description) VALUES
('passant_2mm_avg', '%', 'Passant 2 mm — moyenne maille'),
('passant_20mm_avg', '%', 'Passant 20 mm — moyenne maille')
ON CONFLICT (parameter_code) DO UPDATE SET
    canonical_unit = EXCLUDED.canonical_unit,
    description = EXCLUDED.description,
    updated_at = now();

-- Thématique : priorité ai_interpolation_values (dernière exécution), repli maille_geotech_interpolation
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
  'Couches IA / krigeage carte : kriging_ip / kriging_vbs depuis v_latest_ai_interpolation si disponible, sinon legacy maille_geotech_interpolation.';

COMMIT;
