
-- Check atlas.mailles geometry type and bounds to confirm it's 2km grid
SELECT 
    ST_SRID(geom) as srid, 
    SQRT(ST_Area(geom)) as side_length_approx,
    count(*) 
FROM atlas.mailles 
GROUP BY ST_SRID(geom), SQRT(ST_Area(geom)) 
LIMIT 5;

-- Check for consolidated views
SELECT table_schema, table_name 
FROM information_schema.views 
WHERE table_name ILIKE '%consolidee%' OR table_name ILIKE '%samples%' OR table_name ILIKE '%essais%';
