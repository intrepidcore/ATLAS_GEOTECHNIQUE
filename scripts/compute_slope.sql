-- Compute approximate slope from DSM (using neighborhood analysis)
SET search_path = atlas, public;

-- First create a slope raster by computing gradient
-- We'll use ST_MapAlgebra with a simple kernel
-- For now, let's compute slope from altitude differences at centroids

-- Simple approach: compute slope from neighboring points
UPDATE atlas.mailles m
SET dem_slope_mean_deg = sub.slope
FROM (
  SELECT
    m.id,
    -- Calculate slope from neighboring centroids (approximation)
    DEGREES(
      ATAN(
        (MAX(n.alt) - MIN(n.alt))::float /
        NULLIF(ST_Distance(
          ST_Centroid(ST_Transform(m.geom, 25231)),
          ST_Centroid(ST_Transform(n.geom, 25231))
        ), 0)
      , 0)
    ) as slope
  FROM atlas.mailles m
  JOIN atlas.mailles n ON
    ST_DWithin(
      ST_Centroid(ST_Transform(m.geom, 25231)),
      ST_Centroid(ST_Transform(n.geom, 25231)),
      500
    )
  WHERE m.altitude_mean IS NOT NULL
    AND n.altitude_mean IS NOT NULL
  GROUP BY m.id
) sub
WHERE m.id = sub.id;

SELECT COUNT(dem_slope_mean_deg) as slope_computed FROM atlas.mailles;