$env:PGPASSWORD = 'atlas'

# Use a simpler approach with a temp function
$query = @"
-- Create temp table with centroid points
CREATE TEMP TABLE IF NOT EXISTS temp_points AS
SELECT m.code, ST_Transform(ST_Centroid(m.geom), 4326) as pt FROM atlas.mailles m;

-- Compute prec_dry: minimum of all 12 monthly bands
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.dry_val
FROM (
    SELECT 
        p.code,
        LEAST(
            (SELECT ST_Value(r.rast, 1, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 2, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 3, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 4, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 5, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 6, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 7, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 8, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 9, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 10, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 11, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 12, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1)
        ) as dry_val
    FROM temp_points p
    JOIN atlas.maille_climate_features cf ON cf.maille_code = p.code
    WHERE cf.prec_dry IS NULL
    LIMIT 10000
) sub
WHERE cf.maille_code = sub.code;

SELECT 'Batch1 done' as status;
"@

Write-Host "Running batch 1..."
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query"

$query2 = @"
-- Batch 2
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.dry_val
FROM (
    SELECT 
        p.code,
        LEAST(
            (SELECT ST_Value(r.rast, 1, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 2, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 3, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 4, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 5, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 6, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 7, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 8, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 9, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 10, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 11, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 12, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1)
        ) as dry_val
    FROM temp_points p
    JOIN atlas.maille_climate_features cf ON cf.maille_code = p.code
    WHERE cf.prec_dry IS NULL
    LIMIT 10000
) sub
WHERE cf.maille_code = sub.code;
"@

Write-Host "Running batch 2..."
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query2"

$query3 = @"
-- Batch 3 (remaining)
UPDATE atlas.maille_climate_features cf
SET prec_dry = sub.dry_val
FROM (
    SELECT 
        p.code,
        LEAST(
            (SELECT ST_Value(r.rast, 1, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 2, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 3, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 4, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 5, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 6, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 7, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 8, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 9, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 10, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 11, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1),
            (SELECT ST_Value(r.rast, 12, p.pt) FROM worldclim_prec r WHERE ST_Intersects(r.rast, p.pt) LIMIT 1)
        ) as dry_val
    FROM temp_points p
    JOIN atlas.maille_climate_features cf ON cf.maille_code = p.code
    WHERE cf.prec_dry IS NULL
) sub
WHERE cf.maille_code = sub.code;
"@

Write-Host "Running batch 3..."
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "$query3"

# Verify
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "SELECT COUNT(prec_dry), COUNT(prec_wet) FROM atlas.maille_climate_features;"