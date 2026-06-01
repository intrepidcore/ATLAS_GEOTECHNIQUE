-- Compute altitude_mean at centroids only (faster)
SET search_path = atlas, public;

DO $$
DECLARE
  batch_size int := 5000;
  updated int := 0;
  total int := 0;
  pt geometry;
BEGIN
  LOOP
    -- Get batch of mailles without altitude
    FOR m_id, m_code, pt IN
      SELECT id, code, ST_Transform(ST_Centroid(geom), 25231)
      FROM atlas.mailles
      WHERE altitude_mean IS NULL
      ORDER BY code
      LIMIT batch_size
    LOOP
      -- Compute mean from all intersecting raster tiles
      UPDATE atlas.mailles
      SET altitude_mean = (
        SELECT ROUND(AVG(ST_Value(r.rast, pt))::numeric, 2)
        FROM atlas.dsm_cop30 r
        WHERE ST_Intersects(r.rast, pt)
      )
      WHERE id = m_id;

      updated := updated + 1;
    END LOOP;

    total := total + updated;
    RAISE NOTICE 'Batch: % updated, total: %', updated, total;

    IF updated < batch_size THEN
      EXIT;
    END IF;

    updated := 0;
  END LOOP;

  RAISE NOTICE 'FINAL: % mailles with altitude_mean', total;
END $$;

-- Update flag
UPDATE atlas.mailles SET dsm_features_ok = true WHERE altitude_mean IS NOT NULL;

-- Verify
SELECT
  COUNT(*) as total,
  COUNT(altitude_mean) as computed,
  ROUND(AVG(altitude_mean), 1) as moy,
  ROUND(MIN(altitude_mean), 1) as min,
  ROUND(MAX(altitude_mean), 1) as max
FROM atlas.mailles;