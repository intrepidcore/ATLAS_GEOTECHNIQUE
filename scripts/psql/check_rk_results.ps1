$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Vérifier les paramètres RK
SELECT 
    parameter_id,
    COUNT(*) as valeurs,
    ROUND(AVG(value)::numeric, 2) as moyenne,
    ROUND(STDDEV(value)::numeric, 2) as ecart_type
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
AND COALESCE(is_superseded, false) = false
GROUP BY parameter_id
ORDER BY parameter_id;
"