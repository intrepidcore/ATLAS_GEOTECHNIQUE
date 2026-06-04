-- Migration 101 : Extension ai_job_queue pour pipeline L1–L4
-- Idempotente (IF NOT EXISTS / IF EXISTS)
-- Date : 2026-06-04

-- Ajouter les colonnes manquantes pour le suivi des jobs ML
ALTER TABLE atlas.ai_job_queue
    ADD COLUMN IF NOT EXISTS logs          TEXT,
    ADD COLUMN IF NOT EXISTS progress_pct  INTEGER CHECK (progress_pct BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS requested_by  TEXT;

-- Index pour le polling par statut (utilisé par get_job_status et le worker)
CREATE INDEX IF NOT EXISTS idx_ai_job_queue_status_requested
    ON atlas.ai_job_queue (status, requested_at ASC);

-- Vue utilitaire pour le panneau Expert Scientifique
CREATE OR REPLACE VIEW atlas.v_ai_jobs_recent AS
SELECT
    id,
    parameter_id,
    job_type,
    status,
    payload,
    logs,
    progress_pct,
    requested_by,
    requested_at,
    started_at,
    finished_at,
    error_message,
    EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - COALESCE(started_at, requested_at)))::int AS duration_seconds
FROM atlas.ai_job_queue
ORDER BY requested_at DESC;
