-- Ajout du statut 'cancelled' aux jobs email Colab

BEGIN;

ALTER TABLE atlas.colab_email_jobs
  DROP CONSTRAINT IF EXISTS colab_email_jobs_status_check;

ALTER TABLE atlas.colab_email_jobs
  ADD CONSTRAINT colab_email_jobs_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));

COMMIT;
