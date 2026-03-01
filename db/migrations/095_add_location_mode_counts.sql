-- Migration 095: Ajouter compteurs de sondages par mode de localisation
-- Permet de distinguer visuellement les mailles avec localisation exacte vs random

BEGIN;

-- ============================================================================
-- Créer une vue enrichie avec compteurs exact/random
-- ============================================================================

-- Vue qui ajoute les compteurs de localisation à mv_mailles_geotech
CREATE OR REPLACE VIEW atlas.v_mailles_with_location_counts AS
WITH location_counts AS (
    SELECT 
        m.code,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('exact', 'gps', 'manual')
        ) AS n_sondages_exact,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('adm_random_cell', 'adm3', 'adm2', 'adm1', 'random')
        ) AS n_sondages_random
    FROM atlas.mailles m
    LEFT JOIN atlas.sondages s 
        ON ST_Contains(m.geom, ST_Transform(s.geom, 25231))
        AND s.deleted_at IS NULL
        AND s.geom IS NOT NULL
    GROUP BY m.code
)
SELECT 
    mv.*,
    COALESCE(lc.n_sondages_exact, 0)::int AS n_sondages_exact,
    COALESCE(lc.n_sondages_random, 0)::int AS n_sondages_random
FROM atlas.mv_mailles_geotech mv
LEFT JOIN location_counts lc ON lc.code = mv.code;

-- ============================================================================
-- Mettre à jour la vue de compatibilité API
-- ============================================================================

DROP VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;

CREATE OR REPLACE VIEW mailles_geotechnique_stats_wgs84 AS
SELECT 
    id,
    code,
    geom_4326 AS geom,
    geom_simplified,
    adm1_name,
    adm2_name,
    adm3_name,
    n_sondages,
    n_sondages_exact,
    n_sondages_random,
    n_echantillons,
    n_essais_total AS n_essais_geo,
    has_data,
    has_exact_location,
    has_random_location,
    -- Atterberg
    wl_avg, wp_avg, ip_avg, ip_stddev, ip_min, ip_max,
    -- VBS
    vbs_avg, vbs_stddev, vbs_min, vbs_max,
    -- Proctor
    gamma_d_max_avg, gamma_d_max_min AS gamma_d_max_stddev,
    w_opt_avg, w_opt_min AS w_opt_stddev,
    -- Gonflement
    eg_avg, eg_stddev, eg_min, eg_max,
    -- Granulo
    passant_80um_avg, passant_2mm_avg, passant_20mm_avg,
    -- Comptages par classe
    n_vbs_insensible, n_vbs_peu_sensible, n_vbs_sensible,
    n_vbs_moyen_argileux, n_vbs_argileux, n_vbs_tres_argileux,
    n_eg_negligeable, n_eg_faible, n_eg_moyen, n_eg_fort, n_eg_tres_fort
FROM atlas.v_mailles_with_location_counts;

COMMIT;

-- Commentaires
COMMENT ON VIEW atlas.v_mailles_with_location_counts IS 
'Vue enrichie de mv_mailles_geotech avec compteurs de localisation exact/random';

COMMENT ON VIEW mailles_geotechnique_stats_wgs84 IS 
'Vue de compatibilité API avec compteurs de localisation pour le frontend';
