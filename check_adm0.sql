
SELECT 
    table_schema, table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'adm0_raw';

SELECT ST_AsText(ST_Simplify(geom, 10000)) FROM public.adm0_raw LIMIT 1;
