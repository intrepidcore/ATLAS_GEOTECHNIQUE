-- Créer une nouvelle vue v_thematic_ai_rk directement depuis ai_interpolation_values

CREATE OR REPLACE VIEW atlas.v_thematic_ai_rk AS
SELECT 
    m.code,
    m.geom,
    m.adm2_name,
    a2.adm1_name,
    0 as n_sondages,
    0 as n_essais_geo,
    -- RK values (pivot from ai_interpolation_values)
    MAX(CASE WHEN v.parameter_id = 'vbs_rk_h1' THEN v.value END) as vbs_rk_h1,
    MAX(CASE WHEN v.parameter_id = 'vbs_rk_h2' THEN v.value END) as vbs_rk_h2,
    MAX(CASE WHEN v.parameter_id = 'vbs_rk_h3' THEN v.value END) as vbs_rk_h3,
    MAX(CASE WHEN v.parameter_id = 'ip_rk_h1' THEN v.value END) as ip_rk_h1,
    MAX(CASE WHEN v.parameter_id = 'ip_rk_h2' THEN v.value END) as ip_rk_h2,
    MAX(CASE WHEN v.parameter_id = 'ip_rk_h3' THEN v.value END) as ip_rk_h3,
    MAX(CASE WHEN v.parameter_id = 'wl_rk_h1' THEN v.value END) as wl_rk_h1,
    MAX(CASE WHEN v.parameter_id = 'wl_rk_h2' THEN v.value END) as wl_rk_h2,
    MAX(CASE WHEN v.parameter_id = 'wl_rk_h3' THEN v.value END) as wl_rk_h3,
    MAX(CASE WHEN v.parameter_id = 'wp_rk_h1' THEN v.value END) as wp_rk_h1,
    MAX(CASE WHEN v.parameter_id = 'wp_rk_h2' THEN v.value END) as wp_rk_h2,
    MAX(CASE WHEN v.parameter_id = 'wp_rk_h3' THEN v.value END) as wp_rk_h3,
    MAX(CASE WHEN v.parameter_id = 'eg_rk_h1' THEN v.value END) as eg_rk_h1,
    MAX(CASE WHEN v.parameter_id = 'eg_rk_h2' THEN v.value END) as eg_rk_h2,
    MAX(CASE WHEN v.parameter_id = 'eg_rk_h3' THEN v.value END) as eg_rk_h3
FROM atlas.mailles m
LEFT JOIN atlas.adm2_tg a2 ON a2.name = m.adm2_name
LEFT JOIN atlas.ai_interpolation_values v ON v.maille_id = m.id 
    AND v.method = 'regression_kriging_scorpan'
    AND COALESCE(v.is_superseded, false) = false
GROUP BY m.code, m.geom, m.adm2_name, a2.adm1_name;

-- Test
SELECT COUNT(*) as total, COUNT(vbs_rk_h1) as vbs_count, COUNT(eg_rk_h1) as eg_count 
FROM atlas.v_thematic_ai_rk;