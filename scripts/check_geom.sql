
SELECT 
    ST_SRID(geom) as srid, 
    ST_XMin(ST_Extent(geom)) as xmin, 
    ST_YMin(ST_Extent(geom)) as ymin 
FROM atlas.mailles 
GROUP BY ST_SRID(geom);

SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name ILIKE '%adm0%' OR table_name ILIKE '%country%' OR table_name ILIKE '%togo%';

SELECT count(*) FROM public.adm0_raw;
