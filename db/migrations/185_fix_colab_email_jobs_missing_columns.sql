BEGIN;

-- ============================================================================
-- Fix: colab_email_jobs n'avait que la colonne id (migration 099 skippée par IF NOT EXISTS)
-- Ajoute les colonnes manquantes et crée colab_email_job_logs
-- ============================================================================

ALTER TABLE atlas.colab_email_jobs
    ADD COLUMN IF NOT EXISTS job_type    TEXT        NOT NULL DEFAULT 'maille_bbox_gmail',
    ADD COLUMN IF NOT EXISTS status      TEXT        NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','running','completed','failed','cancelled')),
    ADD COLUMN IF NOT EXISTS created_by  UUID,
    ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS error       TEXT,
    ADD COLUMN IF NOT EXISTS params      JSONB       NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_colab_email_jobs_status_created
    ON atlas.colab_email_jobs(status, created_at DESC);

-- Table de logs par job (si absente)
CREATE TABLE IF NOT EXISTS atlas.colab_email_job_logs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id     UUID        NOT NULL REFERENCES atlas.colab_email_jobs(id) ON DELETE CASCADE,
    level      TEXT        NOT NULL CHECK (level IN ('info','warn','error')),
    message    TEXT        NOT NULL,
    details    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_email_job_logs_job
    ON atlas.colab_email_job_logs(job_id, created_at DESC);

-- Permissions (idempotent)
INSERT INTO atlas.permissions (id, resource, action, description)
VALUES
  ('colab.notify.create', 'colab.notify', 'create', 'Déclencher une notification email (mailles/BBox)'),
  ('colab.notify.read',   'colab.notify', 'read',   'Lire le statut des jobs de notification email')
ON CONFLICT (id) DO NOTHING;

COMMIT;
