-- Migration 097 : Tables pour le système d'export avancé Colab Studio
-- Phase 1 : Jobs, logs (audit)
-- Phase 2 : Templates (plus tard)

BEGIN;

-- Table : jobs d'export
CREATE TABLE IF NOT EXISTS atlas.colab_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN (
        'missions', 'students', 'supervisors', 'documents', 'logs',
        'missions_students_supervisors', 'missions_documents', 'students_missions', 'logs_missions'
    )),
    format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'xlsx', 'pdf', 'geojson')),
    filters JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    file_path TEXT,
    file_size BIGINT,
    error TEXT
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_colab_export_jobs_created_by ON atlas.colab_export_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_colab_export_jobs_status ON atlas.colab_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_colab_export_jobs_created_at ON atlas.colab_export_jobs(created_at DESC);

-- Table : logs d'audit (obligatoire pour traçabilité)
CREATE TABLE IF NOT EXISTS atlas.colab_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES atlas.colab_export_jobs(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'started', 'completed', 'failed', 'downloaded')),
    actor TEXT NOT NULL, -- user_id ou username
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB -- optionnel : filtres utilisés, format, etc.
);

-- Index pour audit
CREATE INDEX IF NOT EXISTS idx_colab_export_logs_job_id ON atlas.colab_export_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_colab_export_logs_actor ON atlas.colab_export_logs(actor);
CREATE INDEX IF NOT EXISTS idx_colab_export_logs_timestamp ON atlas.colab_export_logs(timestamp DESC);

-- Table pour Phase 2 : templates (créée maintenant pour éviter migration plus tard)
CREATE TABLE IF NOT EXISTS atlas.colab_export_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    source TEXT NOT NULL CHECK (source IN (
        'missions', 'students', 'supervisors', 'documents', 'logs',
        'missions_students_supervisors', 'missions_documents', 'students_missions', 'logs_missions'
    )),
    format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'xlsx', 'pdf', 'geojson')),
    template_sql TEXT, -- requête SQL (si applicable)
    template_handlebars TEXT, -- template de présentation (Handlebars)
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_colab_export_templates_source ON atlas.colab_export_templates(source);
CREATE INDEX IF NOT EXISTS idx_colab_export_templates_format ON atlas.colab_export_templates(format);
CREATE INDEX IF NOT EXISTS idx_colab_export_templates_active ON atlas.colab_export_templates(is_active);

-- Permissions (RBAC) : à insérer dans la table des permissions si existante
-- Pour l'instant, on documente les permissions requises
-- colab.export.read : lire les jobs, historique, télécharger
-- colab.export.create : créer un export
-- colab.export.schedule : programmer des exports récurrents (Phase 3)
-- colab.export.admin : gérer les templates, supprimer des jobs (admin)

COMMIT;

-- Tests de validation
-- \d atlas.colab_export_jobs
-- \d atlas.colab_export_logs
-- \d atlas.colab_export_templates
-- SELECT COUNT(*) FROM atlas.colab_export_jobs; -- doit être 0
-- SELECT COUNT(*) FROM atlas.colab_export_logs; -- doit être 0
-- SELECT COUNT(*) FROM atlas.colab_export_templates; -- doit être 0
