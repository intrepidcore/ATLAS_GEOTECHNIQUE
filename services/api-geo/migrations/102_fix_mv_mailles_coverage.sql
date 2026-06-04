-- Migration 102 : Correction vue v_mailles_with_location_counts
-- Problème : le CTE location_counts calculait bien les sondages par maille
--            mais le SELECT retournait 0/false hardcodés au lieu d'utiliser lc.*
-- Impact   : has_data=false, n_sondages=0 pour toutes les mailles dans la coverage
-- Date     : 2026-06-04
-- DB       : port 5433 (atlas_clean)

-- Étape 1 : Recréer la vue en utilisant maille_code (join direct, plus fiable que ST_Contains)
CREATE OR REPLACE VIEW atlas.v_mailles_with_location_counts AS
WITH location_counts AS (
    SELECT
        s.maille_code                                                         AS code,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('exact','gps','manual')
        )                                                                     AS n_sondages_exact,
        COUNT(DISTINCT s.id) FILTER (
            WHERE s.location_mode IN ('adm_random_cell','adm3','adm2','adm1','random')
        )                                                                     AS n_sondages_random,
        COUNT(DISTINCT s.id)                                                  AS n_sondages_total
    FROM atlas.sondages s
    WHERE s.deleted_at IS NULL
      AND s.maille_code IS NOT NULL
    GROUP BY s.maille_code
)
SELECT
    mv.id,
    mv.code,
    mv.geom,
    ST_Transform(mv.geom, 4326)                                               AS geom_4326,
    ST_Simplify(mv.geom, 100::double precision)                               AS geom_simplified,
    NULL::text                                                                AS adm1_name,
    mv.adm2_name,
    NULL::text                                                                AS adm3_name,
    -- ── Compteurs sondages (correction : utilise lc au lieu de 0 hardcodé) ─
    COALESCE(lc.n_sondages_total, 0)::integer                                 AS n_sondages,
    0::integer                                                                AS n_echantillons,
    0::integer                                                                AS n_essais_atterberg,
    0::integer                                                                AS n_essais_vbs,
    0::integer                                                                AS n_essais_proctor,
    0::integer                                                                AS n_essais_gonflement,
    0::integer                                                                AS n_essais_granulo,
    0::integer                                                                AS n_essais_classif,
    0::integer                                                                AS n_essais_total,
    0                                                                         AS depth_min_m,
    0                                                                         AS depth_max_m,
    0                                                                         AS depth_mean_m,
    NULL::numeric                                                             AS wl_avg,
    NULL::numeric                                                             AS wl_min,
    NULL::numeric                                                             AS wl_max,
    NULL::numeric                                                             AS wp_avg,
    NULL::numeric                                                             AS wp_min,
    NULL::numeric                                                             AS wp_max,
    NULL::numeric                                                             AS ip_avg,
    NULL::numeric                                                             AS ip_min,
    NULL::numeric                                                             AS ip_max,
    NULL::numeric                                                             AS ip_stddev,
    NULL::numeric                                                             AS vbs_avg,
    NULL::numeric                                                             AS vbs_min,
    NULL::numeric                                                             AS vbs_max,
    NULL::numeric                                                             AS vbs_stddev,
    0                                                                         AS n_vbs_insensible,
    0                                                                         AS n_vbs_peu_sensible,
    0                                                                         AS n_vbs_sensible,
    0                                                                         AS n_vbs_moyen_argileux,
    0                                                                         AS n_vbs_argileux,
    0                                                                         AS n_vbs_tres_argileux,
    NULL::numeric                                                             AS gamma_d_max_avg,
    NULL::numeric                                                             AS gamma_d_max_min,
    NULL::numeric                                                             AS gamma_d_max_max,
    NULL::numeric                                                             AS w_opt_avg,
    NULL::numeric                                                             AS w_opt_min,
    NULL::numeric                                                             AS w_opt_max,
    NULL::numeric                                                             AS eg_avg,
    NULL::numeric                                                             AS eg_min,
    NULL::numeric                                                             AS eg_max,
    NULL::numeric                                                             AS eg_stddev,
    0                                                                         AS n_eg_negligeable,
    0                                                                         AS n_eg_faible,
    0                                                                         AS n_eg_moyen,
    0                                                                         AS n_eg_fort,
    0                                                                         AS n_eg_tres_fort,
    NULL::numeric                                                             AS passant_80um_avg,
    NULL::numeric                                                             AS passant_80um_min,
    NULL::numeric                                                             AS passant_80um_max,
    NULL::numeric                                                             AS passant_2mm_avg,
    NULL::numeric                                                             AS passant_2mm_min,
    NULL::numeric                                                             AS passant_2mm_max,
    NULL::numeric                                                             AS passant_20mm_avg,
    0                                                                         AS n_classif_hrb,
    0                                                                         AS n_classif_unified,
    0                                                                         AS n_classif_amessefe,
    -- ── Flags coverage (correction : utilise lc au lieu de false hardcodé) ─
    COALESCE(lc.n_sondages_total, 0) > 0                                      AS has_data,
    COALESCE(lc.n_sondages_exact, 0) > 0                                      AS has_exact_location,
    COALESCE(lc.n_sondages_random, 0) > 0                                     AS has_random_location,
    COALESCE(lc.n_sondages_exact, 0)::integer                                 AS n_sondages_exact,
    COALESCE(lc.n_sondages_random, 0)::integer                                AS n_sondages_random
FROM atlas.mailles mv
LEFT JOIN location_counts lc ON lc.code = mv.code;

-- Étape 2 : Rafraîchir la MV qui dépend de cette vue
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;
