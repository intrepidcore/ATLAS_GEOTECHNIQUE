-- Recréer mv_mailles_geotech comme matview, puis la vue

-- Supprimer avec CASCADE (dépendances)
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech CASCADE;

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
SELECT * FROM atlas.v_mailles_with_location_counts;

-- Rafraîchir la matview
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

-- Créer mailles_geotechnique_stats_wgs84
CREATE VIEW atlas.mailles_geotechnique_stats_wgs84 AS
SELECT 
    mv.id,
    mv.code,
    mv.geom,
    mv.geom_4326,
    mv.geom_simplified,
    mv.adm1_name,
    mv.adm2_name,
    mv.adm3_name,
    COALESCE(mv.n_sondages, 0) as n_sondages,
    COALESCE(mv.n_sondages_exact, 0) as n_sondages_exact,
    COALESCE(mv.n_sondages_random, 0) as n_sondages_random,
    COALESCE(mv.n_echantillons, 0) as n_echantillons,
    COALESCE(mv.n_essais_total, 0) as n_essais_geo,
    mv.has_data,
    mv.has_exact_location,
    mv.has_random_location,
    mv.wl_avg,
    mv.wp_avg,
    mv.ip_avg,
    mv.ip_stddev,
    mv.ip_min,
    mv.ip_max,
    mv.vbs_avg,
    mv.vbs_stddev,
    mv.vbs_min,
    mv.vbs_max,
    mv.gamma_d_max_avg,
    mv.gamma_d_max_min as gamma_d_max_stddev,
    mv.w_opt_avg,
    mv.w_opt_min as w_opt_stddev,
    mv.eg_avg,
    mv.eg_stddev,
    mv.eg_min,
    mv.eg_max,
    mv.passant_80um_avg,
    mv.passant_2mm_avg,
    mv.passant_20mm_avg,
    COALESCE(mv.n_vbs_insensible, 0) as n_vbs_insensible,
    COALESCE(mv.n_vbs_peu_sensible, 0) as n_vbs_peu_sensible,
    COALESCE(mv.n_vbs_sensible, 0) as n_vbs_sensible,
    COALESCE(mv.n_vbs_moyen_argileux, 0) as n_vbs_moyen_argileux,
    COALESCE(mv.n_vbs_argileux, 0) as n_vbs_argileux,
    COALESCE(mv.n_vbs_tres_argileux, 0) as n_vbs_tres_argileux,
    COALESCE(mv.n_eg_negligeable, 0) as n_eg_negligeable,
    COALESCE(mv.n_eg_faible, 0) as n_eg_faible,
    COALESCE(mv.n_eg_moyen, 0) as n_eg_moyen,
    COALESCE(mv.n_eg_fort, 0) as n_eg_fort,
    COALESCE(mv.n_eg_tres_fort, 0) as n_eg_tres_fort,
    m.vbs_rk_h1,
    m.vbs_rk_h2,
    m.vbs_rk_h3,
    m.ip_rk_h1,
    m.ip_rk_h2,
    m.ip_rk_h3,
    m.wl_rk_h1,
    m.wl_rk_h2,
    m.wl_rk_h3,
    m.wp_rk_h1,
    m.wp_rk_h2,
    m.wp_rk_h3,
    m.eg_rk_h1,
    m.eg_rk_h2,
    m.eg_rk_h3
FROM atlas.mv_mailles_geotech mv
LEFT JOIN atlas.mailles m ON m.code = mv.code;

-- Vérification
SELECT 'total' as test, COUNT(*) as cnt FROM atlas.mailles_geotechnique_stats_wgs84
UNION ALL
SELECT 'vbs_rk_h1', COUNT(vbs_rk_h1) FROM atlas.mailles_geotechnique_stats_wgs84
UNION ALL
SELECT 'n_essais_total', COUNT(n_essais_geo) FROM atlas.mailles_geotechnique_stats_wgs84;