BEGIN;

ALTER TABLE atlas.maille_geotech_infer
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE atlas.maille_geotech_infer
  ADD COLUMN IF NOT EXISTS source_details jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE atlas.maille_geotech_infer
SET source_type = COALESCE(source_type, 'derived_rga_from_rules')
WHERE source_type IS NULL;

ALTER TABLE atlas.maille_geotech_infer
  ALTER COLUMN source_type SET DEFAULT 'derived_rga_from_rules';

COMMIT;

