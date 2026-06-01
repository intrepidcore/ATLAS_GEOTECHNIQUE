-- Script 1: Slope (calculate from altitude of neighboring cells)
-- Using ST_Slope is very heavy, use approximate method from altitude
SET search_path = atlas, public;

-- Create slope by computing gradient between cell and neighbors
UPDATE atlas.mailles m
SET dem_slope_mean_deg = sub.slope
FROM (
  SELECT
    m.id,
    DEGREES(ATAN(
      (MAX(n.altitude_mean) - MIN(altitude_mean))::float / 
      NULLIF((SELECT ST_Distance(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231)
      ) FROM atlas.mailles n WHERE n.altitude_mean IS NOT NULL AND n.id != m.id ORDER BY ST_Distance(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231)
      ) LIMIT 1), 0)
    )) as slope
  FROM atlas.mailles m
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_slope_mean_deg IS NULL
  GROUP BY m.id
  LIMIT 5000
) sub
WHERE m.id = sub.id;

-- Execute this in batches of 5000 until all done
-- For large scale, better to use ST_Slope on raster