-- ÉTAPE 1 : Sanity SRID & validité
SELECT 'Étape 1/4 : Vérification SRID et validité...' AS status;

UPDATE adm3 SET geom = ST_SetSRID(geom, 4326) WHERE ST_SRID(geom)=0;
UPDATE mailles SET geom = ST_SetSRID(geom, 25231) WHERE ST_SRID(geom)=0;

UPDATE adm3 SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE mailles SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);

SELECT 'SRID adm3:' AS label, COUNT(*) AS count, ST_SRID(geom) AS srid FROM adm3 GROUP BY ST_SRID(geom);
SELECT 'SRID mailles:' AS label, COUNT(*) AS count, ST_SRID(geom) AS srid FROM mailles GROUP BY ST_SRID(geom);

SELECT 'Étape 1/4 : ✅ Terminée' AS status;
