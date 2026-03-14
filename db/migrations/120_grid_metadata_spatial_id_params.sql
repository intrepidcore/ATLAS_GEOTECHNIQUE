-- ============================================================================
-- MIGRATION 120 : enrichir grid_metadata avec paramètres spatial_id (reproductibilité)
-- ============================================================================

BEGIN;

ALTER TABLE atlas.grid_metadata
  ADD COLUMN IF NOT EXISTS spatial_id_algo text,
  ADD COLUMN IF NOT EXISTS spatial_id_params jsonb;

UPDATE atlas.grid_metadata
SET
  spatial_id_algo = 'geohash',
  spatial_id_params = jsonb_build_object(
    'prefix', 'TG5-',
    'precision_primary', 8,
    'precision_collision_retry', 9,
    'collision_fallback', 'md5(code)[0:4]',
    'centroid', true,
    'source_srid', 25231,
    'target_srid', 4326
  )
WHERE version = 'TG_GRID_V2'
  AND (spatial_id_algo IS NULL OR spatial_id_params IS NULL);

COMMIT;
