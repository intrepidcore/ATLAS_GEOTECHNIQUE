-- =============================================================================
-- DSM TPI COMPUTATION - Scientific Method  
-- Method: TPI = elevation - mean(elevation in annular window)
-- Window: 3 mailles radius (~6km) = annulus 3-6km (excludes center)
-- Output: dem_tpi_mean (positive = ridge, negative = valley)
-- Reference: Guisan et al. (2006) - Environmental niche models
-- =============================================================================
SET search_path = atlas, public;

-- Step A: Batch 1 of 3
UPDATE atlas.mailles m
SET dem_tpi_mean = sub.tpi
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.avg_neighbor_alt)::numeric, 2) as tpi
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT AVG(n.altitude_mean) as avg_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      -- 3 mailles ~ 6km (each maille ~2km² = ~1.4km side)
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        6000  -- 6km in meters
      )
      -- Exclude inner circle (self and immediate neighbors)
      AND NOT ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        3000  -- 3km inner radius
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_tpi_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Step B: Batch 2 of 3
UPDATE atlas.mailles m
SET dem_tpi_mean = sub.tpi
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.avg_neighbor_alt)::numeric, 2) as tpi
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT AVG(n.altitude_mean) as avg_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        6000
      )
      AND NOT ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        3000
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_tpi_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Step C: Batch 3 (remaining)
UPDATE atlas.mailles m
SET dem_tpi_mean = sub.tpi
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.avg_neighbor_alt)::numeric, 2) as tpi
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT AVG(n.altitude_mean) as avg_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        6000
      )
      AND NOT ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        3000
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_tpi_mean IS NULL
) sub
WHERE m.id = sub.id;

-- Verification
SELECT 
  COUNT(dem_tpi_mean) as computed,
  ROUND(AVG(dem_tpi_mean), 2) as mean_tpi,
  ROUND(MIN(dem_tpi_mean), 2) as min_tpi,
  ROUND(MAX(dem_tpi_mean), 2) as max_tpi
FROM atlas.mailles;