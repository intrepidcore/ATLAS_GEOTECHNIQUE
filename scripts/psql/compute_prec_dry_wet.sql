$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Compute prec_dry (minimum precipitation across all months)
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.prec_dry
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MIN(v) FROM (
            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as v
            FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
            UNION ALL
            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric
            FROM worldclim_prec_01 r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        ) vals WHERE v IS NOT NULL) as prec_dry
    FROM atlas.mailles m
    WHERE cf.prec_dry IS NULL
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_dry IS NOT NULL;

-- Compute prec_wet (maximum precipitation across all months)
UPDATE atlas.maille_climate_features cf
SET prec_wet = sub.prec_wet
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MAX(v) FROM (
            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as v
            FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
            UNION ALL
            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric
            FROM worldclim_prec_01 r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        ) vals WHERE v IS NOT NULL) as prec_wet
    FROM atlas.mailles m
    WHERE cf.prec_wet IS NULL
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_wet IS NOT NULL;

-- Verify
SELECT COUNT(prec_dry) as prec_dry, COUNT(prec_wet) as prec_wet FROM atlas.maille_climate_features;
"