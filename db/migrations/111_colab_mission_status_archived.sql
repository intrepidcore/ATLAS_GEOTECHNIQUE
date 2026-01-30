BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'atlas'
      AND t.typname = 'mission_status'
      AND e.enumlabel = 'archived'
  ) THEN
    ALTER TYPE atlas.mission_status ADD VALUE 'archived';
  END IF;
END $$;

COMMIT;
