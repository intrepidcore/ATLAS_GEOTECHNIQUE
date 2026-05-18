$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
SELECT COUNT(*) as total, COUNT(prec_annual) as prec_ok,
       ROUND(AVG(prec_annual)::numeric, 0) as moy,
       ROUND(MIN(prec_annual)::numeric, 0) as min_val,
       ROUND(MAX(prec_annual)::numeric, 0) as max_val
FROM atlas.maille_climate_features WHERE prec_annual IS NOT NULL AND prec_annual > 0;

SELECT method, COUNT(DISTINCT parameter_id) as params, COUNT(*) as values
FROM atlas.ai_interpolation_values
WHERE COALESCE(is_superseded,false) = false
GROUP BY method;"