-- Compute slope using ST_Slope on DSM raster
SET search_path = atlas, public;

-- Create slope raster from DSM (scale=1 for percentage)
-- ST_Slope returns slope in degrees
CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
SELECT ST_Slope(rast, 1, '32BF') as rast
FROM atlas.dsm_cop30;

-- Extract slope values at centroids
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

SELECT
  COUNT(dem_slope_mean_deg) as computed,
  ROUND(AVG(dem_slope_mean_deg), 2) as moy,
  ROUND(MIN(dem_slope_mean_deg), 2) as min,
  ROUND(MAX(dem_slope_mean_deg), 2) as max
FROM atlas.mailles;