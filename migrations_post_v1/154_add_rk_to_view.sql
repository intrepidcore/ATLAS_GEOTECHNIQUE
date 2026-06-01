-- Recréer v_thematic_ai_geotech avec les colonnes RK
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
    -- Colonnes RK depuis ai_interpolation_values
    vbs_rk.value AS vbs_rk_h1,
    vbs_rk2.value AS vbs_rk_h2,
    vbs_rk3.value AS vbs_rk_h3,
    ip_rk.value AS ip_rk_h1,
    ip_rk2.value AS ip_rk_h2,
    ip_rk3.value AS ip_rk_h3,
    wl_rk.value AS wl_rk_h1,
    wl_rk2.value AS wl_rk_h2,
    wl_rk3.value AS wl_rk_h3,
    wp_rk.value AS wp_rk_h1,
    wp_rk2.value AS wp_rk_h2,
    wp_rk3.value AS wp_rk_h3,
    eg_rk.value AS eg_rk_h1,
    eg_rk2.value AS eg_rk_h2,
    eg_rk3.value AS eg_rk_h3
FROM atlas.mailles m
LEFT JOIN atlas.adm2_tg a2 ON a2.name = m.adm2_name
LEFT JOIN atlas.v_maille_features_ai vf ON vf.maille_id = m.id
LEFT JOIN atlas.maille_geotech_infer i ON i.maille_id = m.id
LEFT JOIN atlas.maille_geotech_interpolation k ON k.maille_id = m.id
LEFT JOIN atlas.maille_geotech_foundation f ON f.maille_id = m.id
-- RK depuis ai_interpolation_values ( Latest non-superseded)
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'vbs_rk_h1' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) vbs_rk ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'vbs_rk_h2' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) vbs_rk2 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'vbs_rk_h3' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) vbs_rk3 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'ip_rk_h1' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) ip_rk ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'ip_rk_h2' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) ip_rk2 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'ip_rk_h3' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) ip_rk3 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wl_rk_h1' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wl_rk ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wl_rk_h2' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wl_rk2 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wl_rk_h3' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wl_rk3 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wp_rk_h1' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wp_rk ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wp_rk_h2' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wp_rk2 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'wp_rk_h3' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) wp_rk3 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'eg_rk_h1' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) eg_rk ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'eg_rk_h2' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) eg_rk2 ON true
LEFT JOIN LATERAL (
    SELECT value FROM atlas.ai_interpolation_values
    WHERE maille_id = m.id AND parameter_id = 'eg_rk_h3' 
    AND COALESCE(is_superseded, false) = false
    ORDER BY created_at DESC LIMIT 1
) eg_rk3 ON true;

-- Vérification
SELECT 'vbs_rk_h1' as col, COUNT(vbs_rk_h1) as cnt FROM atlas.v_thematic_ai_geotech
UNION ALL
SELECT 'eg_rk_h1', COUNT(eg_rk_h1) FROM atlas.v_thematic_ai_geotech;