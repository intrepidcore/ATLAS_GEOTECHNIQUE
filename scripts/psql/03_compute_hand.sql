-- =============================================================================
-- DSM HAND COMPUTATION - Scientific Method
-- Method: HAND = elevation - minimum elevation within search radius
-- Radius: 10km (proxy for nearest drainage network)
-- Output: dem_hand_mean (meters above nearest "drainage")
-- Reference: Rennó et al. (2008) - HAND: a new terrain descriptor
-- =============================================================================
SET search_path = atlas, public;

-- Step A: Batch 1 of 3
UPDATE atlas.mailles m
SET dem_hand_mean = sub.hand
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.min_neighbor_alt)::numeric, 2) as hand
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT MIN(n.altitude_mean) as min_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      -- 10km radius (proxy for drainage network)
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        10000  -- 10km in meters
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND sub.min_neighbor_alt IS NOT NULL
    AND m.dem_hand_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Step B: Batch 2 of 3
UPDATE atlas.mailles m
SET dem_hand_mean = sub.hand
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.min_neighbor_alt)::numeric, 2) as hand
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT MIN(n.altitude_mean) as min_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        10000
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND sub.min_neighbor_alt IS NOT NULL
    AND m.dem_hand_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Step C: Batch 3 (remaining)
UPDATE atlas.mailles m
SET dem_hand_mean = sub.hand
FROM (
  SELECT
    m.id,
    ROUND((m.altitude_mean - sub.min_neighbor_alt)::numeric, 2) as hand
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT MIN(n.altitude_mean) as min_neighbor_alt
    FROM atlas.mailles n
    WHERE n.id != m.id
      AND n.altitude_mean IS NOT NULL
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        10000
      )
  ) sub
  WHERE m.altitude_mean IS NOT NULL
    AND sub.min_neighbor_alt IS NOT NULL
    AND m.dem_hand_mean IS NULL
) sub
WHERE m.id = sub.id;

-- Verification
SELECT 
  COUNT(dem_hand_mean) as computed,
  ROUND(AVG(dem_hand_mean), 2) as mean_hand,
  ROUND(MIN(dem_hand_mean), 2) as min_hand,
  ROUND(MAX(dem_hand_mean), 2) as max_hand
FROM atlas.mailles;