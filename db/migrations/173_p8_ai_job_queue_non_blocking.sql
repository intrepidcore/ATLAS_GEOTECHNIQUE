BEGIN;

ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS min_pts_stratified integer NOT NULL DEFAULT 15;

ALTER TABLE atlas.ai_parameter_catalog
  ADD COLUMN IF NOT EXISTS min_pts_rk integer NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS atlas.ai_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id text NOT NULL REFERENCES atlas.ai_parameter_catalog(parameter_id),
  job_type text NOT NULL CHECK (job_type IN ('kriging_stratifie', 'regression_kriging')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'finished', 'failed', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text
);

-- Avoid duplicate active jobs for same semantic target.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_job_queue_active_semantic
  ON atlas.ai_job_queue(parameter_id, job_type, COALESCE(payload->>'horizon', ''))
  WHERE status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION atlas.enqueue_ai_jobs_after_sondage_non_blocking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_vbs_pts integer;
  v_ip_pts integer;
  v_vbs_strat integer;
  v_vbs_rk integer;
  v_ip_strat integer;
  v_ip_rk integer;
BEGIN
  BEGIN
    SELECT min_pts_stratified, min_pts_rk
      INTO v_vbs_strat, v_vbs_rk
    FROM atlas.ai_parameter_catalog
    WHERE parameter_id = 'vbs_avg'
    LIMIT 1;

    SELECT min_pts_stratified, min_pts_rk
      INTO v_ip_strat, v_ip_rk
    FROM atlas.ai_parameter_catalog
    WHERE parameter_id = 'ip_avg'
    LIMIT 1;

    SELECT COUNT(DISTINCT s.id)
      INTO v_vbs_pts
    FROM atlas.sondages s
    JOIN atlas.echantillons e ON e.sondage_id = s.id
    JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
    WHERE s.deleted_at IS NULL
      AND ev.vbs IS NOT NULL;

    SELECT COUNT(DISTINCT s.id)
      INTO v_ip_pts
    FROM atlas.sondages s
    JOIN atlas.echantillons e ON e.sondage_id = s.id
    JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
    WHERE s.deleted_at IS NULL
      AND COALESCE(ea.ip_generated, ea.wl - ea.wp) IS NOT NULL;

    IF v_vbs_pts >= COALESCE(v_vbs_strat, 15) THEN
      INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
      VALUES ('vbs_avg', 'kriging_stratifie', jsonb_build_object('trigger', 'new_sondage', 'support_points', v_vbs_pts))
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_vbs_pts >= COALESCE(v_vbs_rk, 30) THEN
      INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
      VALUES ('vbs_avg', 'regression_kriging', jsonb_build_object('trigger', 'new_sondage', 'support_points', v_vbs_pts))
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_ip_pts >= COALESCE(v_ip_strat, 15) THEN
      INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
      VALUES ('ip_avg', 'kriging_stratifie', jsonb_build_object('trigger', 'new_sondage', 'support_points', v_ip_pts))
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_ip_pts >= COALESCE(v_ip_rk, 30) THEN
      INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
      VALUES ('ip_avg', 'regression_kriging', jsonb_build_object('trigger', 'new_sondage', 'support_points', v_ip_pts))
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Non-blocking by contract: never break import transaction.
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_ai_jobs_after_sondage ON atlas.sondages;
CREATE TRIGGER trg_enqueue_ai_jobs_after_sondage
AFTER INSERT ON atlas.sondages
FOR EACH ROW
EXECUTE FUNCTION atlas.enqueue_ai_jobs_after_sondage_non_blocking();

COMMIT;

