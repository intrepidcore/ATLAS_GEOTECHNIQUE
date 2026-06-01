$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check v_echantillons_essais
SELECT COUNT(*) as total FROM atlas.v_echantillons_essais;

-- Check available parameters
SELECT DISTINCT parameter FROM atlas.v_echantillons_essais ORDER BY parameter;

-- Check horizons
SELECT DISTINCT horizon FROM atlas.v_echantillons_essais ORDER BY horizon;

-- Sample
SELECT parameter, horizon, COUNT(*) as n, ROUND(AVG(value), 2) as moy FROM atlas.v_echantillons_essais GROUP BY parameter, horizon ORDER BY parameter, horizon;
"