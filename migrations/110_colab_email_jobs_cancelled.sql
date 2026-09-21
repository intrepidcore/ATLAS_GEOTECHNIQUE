BEGIN;

-- Extend colab_email_jobs.status to support cancelled
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'atlas.colab_email_jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE atlas.colab_email_jobs DROP CONSTRAINT %I', c_name);
  END IF;

  EXECUTE $$
    ALTER TABLE atlas.colab_email_jobs
    ADD CONSTRAINT colab_email_jobs_status_check
    CHECK (status IN ('pending','running','completed','failed','cancelled'))
  $$;
END $$;

COMMIT;
