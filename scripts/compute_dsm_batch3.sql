SET search_path = atlas, public;

-- Batch 3: remaining ~9407
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
) sub
WHERE m.id = sub.maille_id;

-- Final verification
SELECT
  COUNT(*) as total,
  COUNT(altitude_mean) as computed,
  ROUND(AVG(altitude_mean), 1) as moy,
  ROUND(MIN(altitude_mean), 1) as min,
  ROUND(MAX(altitude_mean), 1) as max
FROM atlas.mailles;

-- Update dsm_features_ok
UPDATE atlas.mailles SET dsm_features_ok = true WHERE altitude_mean IS NOT NULL;