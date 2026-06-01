-- Add DSM columns to mailles table
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS altitude_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_slope_mean_deg numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_tpi_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dem_hand_mean numeric;
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS dsm_features_ok boolean DEFAULT false;

-- Compute altitude_mean using ST_SummaryStatsAgg (much faster)
UPDATE atlas.mailles m
SET altitude_mean = sub.alt_mean
FROM (
  SELECT
    m.id,
    (ST_SummaryStatsAgg(ST_Clip(r.rast, m.geom), true)).mean as alt_mean
  FROM atlas.mailles m
  JOIN dsm_cop30 r ON ST_Intersects(r.rast, m.geom)
  WHERE m.altitude_mean IS NULL
  GROUP BY m.id
) sub
WHERE m.id = sub.id;

-- Mark as done
UPDATE atlas.mailles SET dsm_features_ok = true WHERE altitude_mean IS NOT NULL;

-- Check result
SELECT
  COUNT(*) as total,
  COUNT(altitude_mean) as with_alt,
  ROUND(AVG(altitude_mean), 1) as alt_moyenne,
  ROUND(MIN(altitude_mean), 1) as alt_min,
  ROUND(MAX(altitude_mean), 1) as alt_max
FROM atlas.mailles;