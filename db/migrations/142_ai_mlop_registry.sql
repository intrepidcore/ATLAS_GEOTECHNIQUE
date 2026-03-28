BEGIN;

CREATE TABLE IF NOT EXISTS atlas.ai_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_target TEXT NOT NULL,
  model_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_registry_target_version
  ON atlas.ai_model_registry(model_target, model_version);

CREATE TABLE IF NOT EXISTS atlas.ai_training_jobs (
  id UUID PRIMARY KEY,
  model_target TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  logs JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_training_jobs_status ON atlas.ai_training_jobs(status, requested_at DESC);

COMMIT;
