SET search_path = atlas, public;

-- Batch 2: next 10000
UPDATE atlas.mailles m
SET altitude_mean = sub.alt
FROM (
  SELECT
    m.id as maille_id,
    ROUND(AVG(ST_Value(r.rast, ST_Centroid(ST_Transform(m.geom, 25231))))::numeric, 2) as alt
  FROM atlas.mailles m
  CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 25231) as pt
  JOIN atlas.dsm_cop30 r ON ST_Intersects(r.rast, pt)
  WHERE m.altitude_mean IS NULL
  GROUP BY m.id
  ORDER BY m.id
  LIMIT 10000
) sub
WHERE m.id = sub.maille_id;

SELECT COUNT(altitude_mean) as computed FROM atlas.mailles;