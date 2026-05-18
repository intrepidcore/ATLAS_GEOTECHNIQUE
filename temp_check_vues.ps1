$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Vérifier les vues qui ont des données
SELECT 'v_echantillons_essais' as v, COUNT(*) as n FROM atlas.v_echantillons_essais
UNION ALL SELECT 'v_essais_summary', COUNT(*) FROM atlas.v_essais_summary
UNION ALL SELECT 'sondages', COUNT(*) FROM atlas.sondages
UNION ALL SELECT 'sondages_valides_kriging', COUNT(*) FROM atlas.sondages_valides_kriging;

-- Vérifier la structure de la vue v_echantillons_essais
SELECT column_name FROM information_schema.columns WHERE table_name = 'v_echantillons_essais' ORDER BY ordinal_position;

-- Tester si on peut extraire des données de cette vue
SELECT COUNT(*) as n, COUNT(wl) as wl_ok, COUNT(vbs) as vbs_ok, COUNT(ip) as ip_ok
FROM atlas.v_echantillons_essais;"