-- =============================================================================
-- DSM SLOPE COMPUTATION - Scientific Method
-- Method: ST_Slope on DSM raster (standard terrain analysis)
-- Output: dem_slope_mean_deg (degrees, 0-90)
-- =============================================================================
SET search_path = atlas, public;

-- Step A: Create slope raster from DSM (one-time operation ~5-10 min)
-- This creates a new raster where each pixel = slope in degrees
CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
SELECT ST_Slope(rast, 1, '32BF') as rast
FROM atlas.dsm_cop30;

-- Step B: Extract slope values at maille centroids (batch 1 of 3)
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

-- Step C: Batch 2
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

-- Step D: Batch 3 (remaining)
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
) sub
WHERE m.id = sub.id;

-- Verification
SELECT 
  COUNT(dem_slope_mean_deg) as computed,
  ROUND(AVG(dem_slope_mean_deg), 2) as mean_deg,
  ROUND(MIN(dem_slope_mean_deg), 2) as min_deg,
  ROUND(MAX(dem_slope_mean_deg), 2) as max_deg
FROM atlas.mailles;