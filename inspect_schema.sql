-- Inspection du schéma réel
-- Tables sondages
SELECT 'SONDAGES COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='sondages'
ORDER BY ordinal_position;

-- Tables essais
SELECT 'ESSAIS COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='essais'
ORDER BY ordinal_position;

-- Tables ADM1
SELECT 'ADM1 COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='adm1'
ORDER BY ordinal_position;

-- Tables ADM2
SELECT 'ADM2 COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='adm2'
ORDER BY ordinal_position;

-- Tables ADM3
SELECT 'ADM3 COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='adm3'
ORDER BY ordinal_position;

-- Tables mailles
SELECT 'MAILLES COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='mailles'
ORDER BY ordinal_position;

-- Géométries
SELECT 'GEOMETRY COLUMNS:' as info;
SELECT f_table_name, f_geometry_column, srid, type
FROM geometry_columns
WHERE f_table_schema='public'
ORDER BY f_table_name;
