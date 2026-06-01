$env:PGPASSWORD = 'atlas'

# Batch 1 - prec_dry
$query1 = @"
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.prec_dry
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MIN(band_val) FROM (
            SELECT ST_Value(r.rast, 1, ST_Transform(ST_Centroid(m.geom), 4326)) as v FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 2, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 3, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 4, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 5, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 6, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 7, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 8, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 9, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        ) vals WHERE v IS NOT NULL AND v > 0) as prec_dry
    FROM atlas.mailles m
    WHERE cf.prec_dry IS NULL
    LIMIT 10000
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_dry IS NOT NULL;
"@

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query1"
Write-Host "Batch 1 done"

# Batch 2
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query1"
Write-Host "Batch 2 done"

# Batch 3
$query2 = @"
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.prec_dry
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MIN(band_val) FROM (
            SELECT ST_Value(r.rast, 1, ST_Transform(ST_Centroid(m.geom), 4326)) as v FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 2, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 3, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 4, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 5, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 6, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 7, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 8, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 9, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        ) vals WHERE v IS NOT NULL AND v > 0) as prec_dry
    FROM atlas.mailles m
    WHERE cf.prec_dry IS NULL
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_dry IS NOT NULL;
"@

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query2"
Write-Host "Batch 3 done"

# Compute prec_wet
$query3 = @"
UPDATE atlas.maille_climate_features cf
SET prec_wet = sub.prec_wet
FROM (
    SELECT 
        m.code as maille_code,
        (SELECT MAX(band_val) FROM (
            SELECT ST_Value(r.rast, 1, ST_Transform(ST_Centroid(m.geom), 4326)) as v FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 2, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 3, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 4, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 5, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 6, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 7, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 8, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 9, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) UNION ALL
            SELECT ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326)) FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        ) vals WHERE v IS NOT NULL AND v > 0) as prec_wet
    FROM atlas.mailles m
    WHERE cf.prec_wet IS NULL
) sub
WHERE cf.maille_code = sub.maille_code AND sub.prec_wet IS NOT NULL;
"@

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query3"
Write-Host "prec_wet done"

# Verify
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT COUNT(prec_dry) as dry, COUNT(prec_wet) as wet FROM atlas.maille_climate_features;"