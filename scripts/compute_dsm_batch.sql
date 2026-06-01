-- Compute altitude_mean using ST_Intersection (faster for vector/raster)
-- Process in batches of 5000

DO $$
DECLARE
  batch_size int := 5000;
  updated int := 0;
  total int := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT m.id, m.code, ST_Transform(m.geom, 25231) as geom_25231
      FROM atlas.mailles m
      WHERE m.altitude_mean IS NULL
      ORDER BY m.code
      LIMIT batch_size
    )
    UPDATE atlas.mailles m
    SET altitude_mean = sub.alt
    FROM (
      SELECT
        b.id,
        ROUND((ST_SummaryStats(ST_Clip(r.rast, b.geom_25231), true)).mean::numeric, 2) as alt
      FROM batch b
      JOIN dsm_cop30 r ON ST_Intersects(r.rast, b.geom_25231)
      GROUP BY b.id
    ) sub
    WHERE m.id = sub.id;

    GET DIAGNOSTICS updated = ROW_COUNT;
    total := total + updated;
    RAISE NOTICE 'Batch processed: % mailles, total: %', updated, total;

    IF updated < batch_size THEN
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE 'FINAL: % mailles updated with altitude_mean', total;
END $$;

-- Update dsm_features_ok flag
UPDATE atlas.mailles SET dsm_features_ok = true WHERE altitude_mean IS NOT NULL;

-- Verify
SELECT
  COUNT(*) as total,
  COUNT(altitude_mean) as computed,
  ROUND(AVG(altitude_mean), 1) as moy,
  ROUND(MIN(altitude_mean), 1) as min,
  ROUND(MAX(altitude_mean), 1) as max
FROM atlas.mailles;