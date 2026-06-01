-- Add DSM columns to mailles table
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS altitude_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_slope_mean_deg numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_tpi_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_hand_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN dsm_features_ok boolean DEFAULT false;

-- Compute altitude_mean for all mailles (batch by 5000)
UPDATE atlas.mailles m
SET altitude_mean = sub.alt_moy
FROM (
  SELECT
    m.id,
    AVG(ST_Value(r.rast, ST_Centroid(m.geom))) as alt_moy
  FROM atlas.mailles m
  CROSS JOIN LATERAL ST_SetSRID(ST_MakePoint(
    ST_X(ST_Centroid(m.geom)),
    ST_Y(ST_Centroid(m.geom))
  ), 25231) as pt
  JOIN dsm_cop30 r ON ST_Intersects(r.rast, ST_Buffer(pt, 100))
  WHERE m.altitude_mean IS NULL
  GROUP BY m.id
  LIMIT 5000
) sub
WHERE m.id = sub.id
RETURNING m.id;

-- Make sure all are processed
DO $$
DECLARE
  total_updated integer := 0;
BEGIN
  LOOP
    UPDATE atlas.mailles m
    SET altitude_mean = sub.alt_moy
    FROM (
      SELECT
        m.id,
        AVG(ST_Value(r.rast, ST_Centroid(m.geom))) as alt_moy
      FROM atlas.mailles m
      CROSS JOIN LATERAL ST_SetSRID(ST_MakePoint(
        ST_X(ST_Centroid(m.geom)),
        ST_Y(ST_Centroid(m.geom))
      ), 25231) as pt
      JOIN dsm_cop30 r ON ST_Intersects(r.rast, ST_Buffer(pt, 100))
      WHERE m.altitude_mean IS NULL
      GROUP BY m.id
      LIMIT 5000
    ) sub
    WHERE m.id = sub.id;

    GET DIAGNOSTICS total_updated = ROW_COUNT;
    IF total_updated = 0 THEN
      EXIT;
    END IF;
    RAISE NOTICE 'Updated % mailles', total_updated;
  END LOOP;
END $$;