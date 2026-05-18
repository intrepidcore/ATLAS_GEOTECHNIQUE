$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Trouver TOUTES les tables avec des données numériques qui pourraient être des mesures
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'atlas'
  AND data_type IN ('numeric', 'double precision', 'real')
  AND table_name LIKE '%essai%'
ORDER BY table_name, ordinal_position;

-- Vérifier le contenu de chaque table
SELECT 'atlas.essais' as tbl, COUNT(*) as n FROM atlas.essais
UNION ALL SELECT 'atlas.essais_geotechniques', COUNT(*) FROM atlas.essais_geotechniques;

-- Tester une vue qui pourrait avoir les données
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'atlas'
  AND table_name LIKE '%v_essai%' OR table_name LIKE '%sondage%';"