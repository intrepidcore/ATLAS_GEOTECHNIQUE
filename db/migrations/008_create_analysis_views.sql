-- Migration 008: Création des vues d'analyse globale
-- Vues pour l'analyse nationale par ADM2 (préfectures)

-- ============================================================================
-- Vue 1: Mailles avec KPI par préfecture
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_maille_kpi_adm2 AS
SELECT 
    m.id as maille_id,
    m.code as maille_code,
    m.adm2_name,
    COUNT(DISTINCT s.id) as n_sondages,
    COUNT(DISTINCT eg.id) as n_essais_eg,
    COUNT(DISTINCT vbs.id) as n_essais_vbs,
    COUNT(DISTINCT att.id) as n_essais_atterberg,
    -- KPI gonflement (depuis essais_geotechniques qui a sondage_id)
    AVG(eg.eg) as eg_avg,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg.eg) as eg_med,
    MIN(eg.eg) as eg_min,
    MAX(eg.eg) as eg_max,
    STDDEV(eg.eg) as eg_std,
    -- KPI VBS (depuis essais_vbs via echantillon_id)
    AVG(vbs.vbs) as vbs_avg,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vbs.vbs) as vbs_med,
    MIN(vbs.vbs) as vbs_min,
    MAX(vbs.vbs) as vbs_max,
    STDDEV(vbs.vbs) as vbs_std,
    -- KPI Atterberg (depuis essais_atterberg via echantillon_id, utiliser ip_generated)
    AVG(att.ip_generated) as ip_avg,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY att.ip_generated) as ip_med,
    MIN(att.ip_generated) as ip_min,
    MAX(att.ip_generated) as ip_max,
    STDDEV(att.ip_generated) as ip_std,
    AVG(att.wl) as wl_avg,
    AVG(att.wp) as wp_avg
FROM atlas.mailles m
LEFT JOIN public.sondages s ON ST_Contains(m.geom, s.geom)
LEFT JOIN public.essais_geotechniques eg ON s.id = eg.sondage_id
LEFT JOIN public.essais_vbs vbs ON eg.echantillon_id = vbs.echantillon_id
LEFT JOIN public.essais_atterberg att ON eg.echantillon_id = att.echantillon_id
GROUP BY m.id, m.code, m.adm2_name;

COMMENT ON VIEW atlas.v_maille_kpi_adm2 IS 'Vue des mailles avec KPI géotechniques agrégés par préfecture (ADM2)';

-- ============================================================================
-- Vue 2: KPI agrégés par préfecture
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_adm2_kpi AS
SELECT 
    adm2_name,
    COUNT(*) as n_mailles_total,
    COUNT(*) FILTER (WHERE n_sondages > 0) as n_mailles_avec_donnees,
    ROUND(COUNT(*) FILTER (WHERE n_sondages > 0) * 100.0 / COUNT(*), 1) as couverture_pct,
    SUM(n_sondages) as n_sondages_total,
    SUM(n_essais_eg) as n_essais_eg_total,
    SUM(n_essais_vbs) as n_essais_vbs_total,
    SUM(n_essais_atterberg) as n_essais_atterberg_total,
    -- Gonflement (EG) - statistiques robustes
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg_avg) as eg_med,
    AVG(eg_avg) as eg_avg,
    STDDEV(eg_avg) as eg_std,
    MIN(eg_avg) as eg_min,
    MAX(eg_avg) as eg_max,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY eg_avg) as eg_p10,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY eg_avg) as eg_p90,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY eg_avg) as eg_q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY eg_avg) as eg_q3,
    -- VBS - statistiques robustes
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vbs_avg) as vbs_med,
    AVG(vbs_avg) as vbs_avg,
    STDDEV(vbs_avg) as vbs_std,
    MIN(vbs_avg) as vbs_min,
    MAX(vbs_avg) as vbs_max,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY vbs_avg) as vbs_p10,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY vbs_avg) as vbs_p90,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY vbs_avg) as vbs_q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY vbs_avg) as vbs_q3,
    -- IP - statistiques robustes
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ip_avg) as ip_med,
    AVG(ip_avg) as ip_avg,
    STDDEV(ip_avg) as ip_std,
    MIN(ip_avg) as ip_min,
    MAX(ip_avg) as ip_max,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ip_avg) as ip_p10,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ip_avg) as ip_p90,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ip_avg) as ip_q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ip_avg) as ip_q3,
    -- WL et WP
    AVG(wl_avg) as wl_avg,
    AVG(wp_avg) as wp_avg
FROM atlas.v_maille_kpi_adm2
WHERE adm2_name IS NOT NULL
GROUP BY adm2_name
ORDER BY n_mailles_avec_donnees DESC;

COMMENT ON VIEW atlas.v_adm2_kpi IS 'Vue des KPI géotechniques agrégés par préfecture (ADM2) avec statistiques robustes';

-- ============================================================================
-- Vérifications
-- ============================================================================

-- Test vue mailles
SELECT COUNT(*) as n_mailles, 
       COUNT(*) FILTER (WHERE n_sondages > 0) as n_avec_donnees
FROM atlas.v_maille_kpi_adm2;

-- Test vue ADM2
SELECT COUNT(*) as n_prefectures,
       SUM(n_mailles_total) as total_mailles,
       SUM(n_sondages_total) as total_sondages
FROM atlas.v_adm2_kpi;
