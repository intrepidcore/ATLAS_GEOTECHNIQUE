$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Vérifier les colonnes de liaison entre sondages et mailles
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sondages' AND table_schema = 'atlas'
  AND column_name IN ('code', 'maille_code', 'geom');

-- Tester la jointure entre sondages et mailles pour covariables
SELECT s.code, m.code as maille_code, sc.geol_label, sc.pedo_label
FROM atlas.sondages s
JOIN atlas.mailles m ON ST_Within(s.geom, m.geom)
JOIN atlas.v_scorpan_features sc ON sc.maille_code = m.code
LIMIT 5;

-- Compter les Sondages avec covariables SCORPAN
SELECT COUNT(*) as n
FROM atlas.sondages s
JOIN atlas.mailles m ON ST_Within(s.geom, m.geom)
JOIN atlas.v_scorpan_features sc ON sc.maille_code = m.code;"