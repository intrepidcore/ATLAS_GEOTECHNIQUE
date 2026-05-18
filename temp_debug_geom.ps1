$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Vérifier si les sondages ont une géométrie
SELECT code, maille_code, ST_SRID(geom) as srid, ST_IsValid(geom) as valid
FROM atlas.sondages
WHERE geom IS NOT NULL
LIMIT 5;

-- Vérifier le champ maille_code dans sondages
SELECT DISTINCT maille_code FROM atlas.sondages WHERE maille_code IS NOT NULL LIMIT 10;

-- Essayer la jointure via maille_code directement
SELECT s.code, s.maille_code, sc.geol_label
FROM atlas.sondages s
JOIN atlas.v_scorpan_features sc ON sc.maille_code = s.maille_code
WHERE s.maille_code IS NOT NULL
LIMIT 5;

-- Compter les sondages avec maille_code
SELECT COUNT(*) FROM atlas.sondages WHERE maille_code IS NOT NULL;"