-- ÉTAPE 1 : Assainir le spatial

-- Vérifier SRID
SELECT 'SRID adm3:' AS info, Find_SRID('public','adm3','geom') AS srid
UNION ALL
SELECT 'SRID mailles:', Find_SRID('public','mailles','geom');

-- Géométries invalides ?
SELECT 'ADM3 invalides:' AS info, COUNT(*)::text AS count FROM adm3 WHERE NOT ST_IsValid(geom)
UNION ALL
SELECT 'Mailles invalides:', COUNT(*)::text FROM mailles WHERE NOT ST_IsValid(geom);

-- Rendre valides si nécessaire
UPDATE adm3 SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
UPDATE mailles SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);

-- Index spatiaux
CREATE INDEX IF NOT EXISTS idx_adm3_geom ON adm3 USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_mailles_geom ON mailles USING GIST(geom);

SELECT 'Spatial OK' AS status;
