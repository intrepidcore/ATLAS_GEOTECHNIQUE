-- Ajouter les colonnes RK à la vue mailles_geotechnique_stats_wgs84
-- La vue est définie comme une SELECT depuis v_mailles_with_location_counts
-- Nous allons recréer la vue avec les colonnes RK

DROP VIEW IF EXISTS atlas.mailles_geotechnique_stats_wgs84 CASCADE;

CREATE VIEW atlas.mailles_geotechnique_stats_wgs84 AS
SELECT 
    m.id,
    m.code,
    m.geom_4326 AS geom,
    m.geom_simplified,
    m.adm1_name,
    m.adm2_name,
    m.adm3_name,
    m.n_sondages,
    m.n_sondages_exact,
    m.n_sondages_random,
    m.n_echantillons,
    m.n_essais_total AS n_essais_geo,
    m.has_data,
    m.has_exact_location,
    m.has_random_location,
    m.wl_avg,
    m.wp_avg,
    m.ip_avg,
    m.ip_stddev,
    m.ip_min,
    m.ip_max,
    m.vbs_avg,
    m.vbs_stddev,
    m.vbs_min,
    m.vbs_max,
    m.gamma_d_max_avg,
    m.gamma_d_max_min AS gamma_d_max_stddev,
    m.w_opt_avg,
    m.w_opt_min AS w_opt_stddev,
    m.eg_avg,
    m.eg_stddev,
    m.eg_min,
    m.eg_max,
    m.passant_80um_avg,
    m.passant_2mm_avg,
    m.passant_20mm_avg,
    m.n_vbs_insensible,
    m.n_vbs_peu_sensible,
    m.n_vbs_sensible,
    m.n_vbs_moyen_argileux,
    m.n_vbs_argileux,
    m.n_vbs_tres_argileux,
    m.n_eg_negligeable,
    m.n_eg_faible,
    m.n_eg_moyen,
    m.n_eg_fort,
    m.n_eg_tres_fort,
    -- Colonnes RK depuis la table mailles
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
FROM atlas.mailles m;

-- Créer index sur les nouvelles colonnes (uniquement sur la table, pas sur la vue)
CREATE INDEX IF NOT EXISTS idx_mailles_rk_vbs_h1 ON atlas.mailles(vbs_rk_h1);
CREATE INDEX IF NOT EXISTS idx_mailles_rk_ip_h1 ON atlas.mailles(ip_rk_h1);
CREATE INDEX IF NOT EXISTS idx_mailles_rk_wl_h1 ON atlas.mailles(wl_rk_h1);
CREATE INDEX IF NOT EXISTS idx_mailles_rk_wp_h1 ON atlas.mailles(wp_rk_h1);

-- Vérification
SELECT 'vbs_rk_h1' as col, COUNT(*) as cnt FROM atlas.mailles_geotechnique_stats_wgs84 WHERE vbs_rk_h1 IS NOT NULL
UNION ALL
SELECT 'ip_rk_h1', COUNT(*) FROM atlas.mailles_geotechnique_stats_wgs84 WHERE ip_rk_h1 IS NOT NULL;