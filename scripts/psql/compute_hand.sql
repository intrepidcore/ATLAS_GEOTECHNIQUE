-- HAND: Height Above Nearest Drainage (10km radius)
-- Proxy: difference with minimum altitude within 10km
SET search_path = atlas, public;

UPDATE atlas.mailles m
SET dem_hand_mean = sub.hand
FROM (
  SELECT
    m.id,
    m.altitude_mean - MIN(n.altitude_mean) OVER (PARTITION BY m.id) as hand
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT n.altitude_mean
    FROM atlas.mailles n
    WHERE n.altitude_mean IS NOT NULL
      AND n.id != m.id
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        10000
      )
    ORDER BY n.altitude_mean
    LIMIT 1
  ) n
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_hand_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Repeat
UPDATE atlas.mailles m
SET dem_hand_mean = sub.hand
FROM (
  SELECT
    m.id,
    m.altitude_mean - MIN(n.altitude_mean) OVER (PARTITION BY m.id) as hand
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT n.altitude_mean
    FROM atlas.mailles n
    WHERE n.altitude_mean IS NOT NULL
      AND n.id != m.id
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        10000
      )
    ORDER BY n.altitude_mean
    LIMIT 1
  ) n
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_hand_mean IS NULL
) sub
WHERE m.id = sub.id;

SELECT COUNT(dem_hand_mean) as hand_computed FROM atlas.mailles;