-- Vérifier les statistiques de la vue matérialisée
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais,
    AVG(passant_80um_avg) as avg_passant_80um,
    AVG(passant_2mm_avg) as avg_passant_2mm
FROM grid_stats_geotechnical;

-- Vérifier quelques lignes avec données
SELECT 
    grid_code,
    n_sondages,
    n_essais_geo,
    ROUND(passant_80um_avg::numeric, 2) as passant_80um_avg,
    ROUND(passant_2mm_avg::numeric, 2) as passant_2mm_avg,
    ROUND(wl_avg::numeric, 2) as wl_avg,
    ROUND(vbs_avg::numeric, 2) as vbs_avg
FROM grid_stats_geotechnical
WHERE n_sondages > 0
LIMIT 10;
