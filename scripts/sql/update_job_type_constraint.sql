-- Migration: extension des job types autorises dans ai_job_queue
-- Auteur: Intrepid Core Engineering / 2026-06-01
-- Requis: superuser postgres (atlas n'a pas les droits ALTER CONSTRAINT)

BEGIN;

ALTER TABLE atlas.ai_job_queue DROP CONSTRAINT IF EXISTS ai_job_queue_job_type_check;

ALTER TABLE atlas.ai_job_queue
  ADD CONSTRAINT ai_job_queue_job_type_check
  CHECK (job_type IN (
    'kriging_stratifie',
    'regression_kriging',
    'kriging',
    'kriging_interpolate',
    'run_ked',
    'run_rk',
    'run_fusion',
    'run_vfs',
    'run_mtgp'
  ));

DO $$
BEGIN
  RAISE NOTICE 'job_type constraint updated: run_ked, run_rk, run_fusion, run_vfs, run_mtgp';
END $$;

COMMIT;
