BEGIN;

-- ============================================================================
-- Colab: Email Jobs (Notifier les étudiants de leurs mailles en BBox)
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_email_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type        TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed')),
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    error           TEXT,
    params          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_colab_email_jobs_status_created
    ON atlas.colab_email_jobs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS atlas.colab_email_job_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES atlas.colab_email_jobs(id) ON DELETE CASCADE,
    level       TEXT NOT NULL CHECK (level IN ('info','warn','error')),
    message     TEXT NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_email_job_logs_job
    ON atlas.colab_email_job_logs(job_id, created_at DESC);

-- Permissions RBAC
INSERT INTO atlas.permissions (id, resource, action, description)
VALUES
  ('colab.notify.create', 'colab.notify', 'create', 'Déclencher une notification email (mailles/BBox)'),
  ('colab.notify.read',   'colab.notify', 'read',   'Lire le statut des jobs de notification email')
ON CONFLICT (id) DO NOTHING;

COMMIT;
