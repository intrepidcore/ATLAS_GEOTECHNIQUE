-- Migration 098 : Scheduling Phase 3 pour exports Colab Studio

BEGIN;

CREATE TABLE IF NOT EXISTS atlas.colab_export_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    description TEXT,

    -- Quoi exporter
    source TEXT NOT NULL CHECK (source IN (
        'missions', 'students', 'supervisors', 'documents', 'logs',
        'missions_students_supervisors', 'missions_documents', 'students_missions', 'logs_missions'
    )),
    format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'xlsx', 'pdf', 'geojson')),
    filters JSONB NOT NULL DEFAULT '{}',
    template_id UUID NULL REFERENCES atlas.colab_export_templates(id) ON DELETE SET NULL,

    -- Quand
    cron TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,

    -- Destination(s) : Phase 3 (email/S3/webhook)
    destinations JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Statut
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_export_schedules_active ON atlas.colab_export_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_colab_export_schedules_next_run ON atlas.colab_export_schedules(next_run_at);

COMMIT;
