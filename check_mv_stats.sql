SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais,
    COUNT(*) FILTER (WHERE passant_80um_avg IS NOT NULL) as avec_passant_80um,
    COUNT(*) FILTER (WHERE wl_avg IS NOT NULL) as avec_wl,
    COUNT(*) FILTER (WHERE vbs_avg IS NOT NULL) as avec_vbs
FROM mailles_geotechnique_stats;

-- Quelques exemples
SELECT 
    code,
    n_sondages,
    n_essais_geo,
    ROUND(passant_80um_avg::numeric, 2) as passant_80um,
    ROUND(ip_avg::numeric, 2) as ip,
    ROUND(vbs_avg::numeric, 2) as vbs
FROM mailles_geotechnique_stats
WHERE n_sondages > 0
LIMIT 10;
