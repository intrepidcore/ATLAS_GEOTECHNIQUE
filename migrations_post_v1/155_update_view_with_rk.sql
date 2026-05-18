-- Modifer v_thematic_ai_geotech pour inclure les RK via UNION
-- Solution: Créer vue combinée qui a toutes les colonnes

CREATE OR REPLACE VIEW atlas.v_thematic_ai_geotech AS
SELECT 
    m.code,
    ST_Transform(m.geom, 4326) AS geom,
    a2.adm1_name,
    m.adm2_name,
    NULL::text AS adm3_name,
    COALESCE(vf.n_sondages, 0)::integer AS n_sondages,
    COALESCE(vf.n_sondages, 0)::integer AS n_essais_geo,
    i.rga_score AS ai_rga_score_infer,
    i.bearing_capacity_kpa AS ai_portance_kpa_infer,
    COALESCE(ip_ai.value, k.ip_interpolated) AS kriging_ip,
    COALESCE(vbs_ai.value, k.vbs_interpolated) AS kriging_vbs,
    f.safety_factor AS ag_safety_factor,
    (f.estimated_cost_fcfa / 1000000.0) AS ag_cout_millions,
    rk.vbs_rk_h1, rk.vbs_rk_h2, rk.vbs_rk_h3,
    rk.ip_rk_h1, rk.ip_rk_h2, rk.ip_rk_h3,
    rk.wl_rk_h1, rk.wl_rk_h2, rk.wl_rk_h3,
    rk.wp_rk_h1, rk.wp_rk_h2, rk.wp_rk_h3,
    rk.eg_rk_h1, rk.eg_rk_h2, rk.eg_rk_h3
FROM atlas.mailles m
LEFT JOIN atlas.adm2_tg a2 ON a2.name = m.adm2_name
LEFT JOIN atlas.v_maille_features_ai vf ON vf.maille_id = m.id
LEFT JOIN atlas.maille_geotech_infer i ON i.maille_id = m.id
LEFT JOIN atlas.maille_geotech_interpolation k ON k.maille_id = m.id
LEFT JOIN atlas.maille_geotech_foundation f ON f.maille_id = m.id
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'kriging_ip' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) ip_ai ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'kriging_vbs' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) vbs_ai ON true
LEFT JOIN atlas.v_thematic_ai_rk rk ON rk.code = m.code;

-- Vérifier
SELECT COUNT(*) as total, COUNT(vbs_rk_h1) as vbs_count FROM atlas.v_thematic_ai_geotech;