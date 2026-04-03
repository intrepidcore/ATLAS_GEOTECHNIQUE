BEGIN;

CREATE TABLE IF NOT EXISTS atlas.ai_plot_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  plot_type text NOT NULL,
  parameter_id text,
  horizon_label text,
  run_id uuid,
  svg text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_plot_cache_plot_type
  ON atlas.ai_plot_cache(plot_type, parameter_id, horizon_label);

COMMIT;

