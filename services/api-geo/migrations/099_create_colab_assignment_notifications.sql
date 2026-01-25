-- Migration 099 : Attributions & Notifications (DB-first, sans serveur)

BEGIN;

-- Historique par attribution (maille ↔ étudiant)
CREATE TABLE IF NOT EXISTS atlas.colab_maille_notification_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES atlas.colab_maille_assignments(assignment_id) ON DELETE CASCADE,
    email_job_id    UUID NULL REFERENCES atlas.colab_email_jobs(id) ON DELETE SET NULL,

    status          TEXT NOT NULL CHECK (status IN ('pending','sent','failed','skipped')),

    options         JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by    UUID NULL REFERENCES atlas.users(id) ON DELETE SET NULL,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    sent_at         TIMESTAMPTZ,
    error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_colab_maille_notif_logs_assignment
    ON atlas.colab_maille_notification_logs(assignment_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_colab_maille_notif_logs_job
    ON atlas.colab_maille_notification_logs(email_job_id);

-- Vue: dernier statut de notification par attribution
CREATE OR REPLACE VIEW atlas.v_colab_maille_notification_latest AS
SELECT DISTINCT ON (l.assignment_id)
    l.assignment_id,
    l.status,
    l.requested_at,
    l.sent_at,
    l.error,
    l.options,
    l.email_job_id
FROM atlas.colab_maille_notification_logs l
ORDER BY l.assignment_id, l.requested_at DESC;

COMMIT;
