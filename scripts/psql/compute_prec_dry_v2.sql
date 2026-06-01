$env:PGPASSWORD = 'atlas'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
-- Check number of bands in worldclim_prec
SELECT ST_Numbands(rast) as n_bands FROM worldclim_prec LIMIT 1;

-- Compute prec_dry using band-based extraction
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.prec_dry
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MIN(band_val) FROM (
            SELECT ST_Value(r.rast, 1, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 2, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 3, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 4, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 5, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 6, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 7, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 8, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 9, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)) as v UNION ALL
            SELECT ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326)) as v
        ) vals WHERE v IS NOT NULL AND v > 0) as prec_dry
    FROM atlas.mailles m
    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
    JOIN worldclim_prec r ON ST_Intersects(r.rast, pt)
    WHERE cf.prec_dry IS NULL
    LIMIT 10000
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_dry IS NOT NULL;

SELECT COUNT(prec_dry) as computed FROM atlas.maille_climate_features WHERE prec_dry IS NOT NULL;
"