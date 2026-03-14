BEGIN;

ALTER TABLE atlas.colab_supervisors
  ADD COLUMN IF NOT EXISTS titre character varying,
  ADD COLUMN IF NOT EXISTS departement character varying;

COMMIT;
