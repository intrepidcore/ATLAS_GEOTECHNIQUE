-- Compute slope from DSM using ST_Slope function
SET search_path = atlas, public;

-- Step 1: Create slope raster table (if not exists)
CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
SELECT ST_Slope(rast, 1, '32BF') as rast
FROM atlas.dsm_cop30;

-- Step 2: Extract slope values at centroids (batch by 10000)
UPDATE atlas.mailles m
SET dem_slope_mean_deg = sub.slope
FROM (
  SELECT
    m.id,
    ROUND(ST_Value(s.rast, ST_Centroid(ST_Transform(m.geom, 25231)))::numeric, 2) as slope
  FROM atlas.mailles m
  CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 25231) as pt
  JOIN atlas.dsm_slope s ON ST_Intersects(s.rast, pt)
  WHERE m.dem_slope_mean_deg IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

SELECT 'Batch 1 done' as status, COUNT(dem_slope_mean_deg) as computed FROM atlas.mailles;