-- compute_dsm_features_full.sql - Run as postgres user
-- Step 1: Create slope raster (one-time, takes ~5-10 min)
SET search_path = atlas, public;

-- Create slope raster table (only once)
CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
SELECT ST_Slope(rast, 1, '32BF') as rast
FROM atlas.dsm_cop30;

-- Step 2: Extract slope values for all mailles
-- Run in batches of 10000
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

-- Repeat for remaining batches
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

-- Verify
SELECT COUNT(dem_slope_mean_deg) as slope_computed, 
       ROUND(AVG(dem_slope_mean_deg), 2) as slope_moy,
       ROUND(MIN(dem_slope_mean_deg), 2) as slope_min,
       ROUND(MAX(dem_slope_mean_deg), 2) as slope_max
FROM atlas.mailles;