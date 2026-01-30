-- Migration 100 : Ajout options JSONB sur colab_export_jobs (colonnes/presets/options PDF)

BEGIN;

ALTER TABLE atlas.colab_export_jobs
ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
