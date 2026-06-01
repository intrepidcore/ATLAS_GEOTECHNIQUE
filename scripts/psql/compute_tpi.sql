-- TPI: Topographic Position Index (anneau 3km = 2 mailles)
-- TPI = elevation - mean(neighbors within 3km)
SET search_path = atlas, public;

-- Compute TPI using window function (3km radius)
UPDATE atlas.mailles m
SET dem_tpi_mean = sub.tpi
FROM (
  SELECT
    m.id,
    m.altitude_mean - AVG(n.altitude_mean) OVER (PARTITION BY m.id) as tpi
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT n.altitude_mean
    FROM atlas.mailles n
    WHERE n.altitude_mean IS NOT NULL
      AND n.id != m.id
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        3000
      )
  ) n
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_tpi_mean IS NULL
  LIMIT 10000
) sub
WHERE m.id = sub.id;

-- Repeat for remaining
UPDATE atlas.mailles m
SET dem_tpi_mean = sub.tpi
FROM (
  SELECT
    m.id,
    m.altitude_mean - AVG(n.altitude_mean) OVER (PARTITION BY m.id) as tpi
  FROM atlas.mailles m
  CROSS JOIN LATERAL (
    SELECT n.altitude_mean
    FROM atlas.mailles n
    WHERE n.altitude_mean IS NOT NULL
      AND n.id != m.id
      AND ST_DWithin(
        ST_Transform(ST_Centroid(m.geom), 25231),
        ST_Transform(ST_Centroid(n.geom), 25231),
        3000
      )
  ) n
  WHERE m.altitude_mean IS NOT NULL
    AND m.dem_tpi_mean IS NULL
) sub
WHERE m.id = sub.id;

SELECT COUNT(dem_tpi_mean) as tpi_computed FROM atlas.mailles;