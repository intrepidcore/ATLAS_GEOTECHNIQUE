REFRESH MATERIALIZED VIEW grid_stats_geotechnical;

SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM grid_stats_geotechnical;
