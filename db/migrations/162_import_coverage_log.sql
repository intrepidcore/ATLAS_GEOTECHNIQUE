BEGIN;

-- Table de reporting de couverture des imports AMESSEFE.
-- Sert aussi au logging détaillé des matches fuzzy (P0b).
CREATE TABLE IF NOT EXISTS atlas.import_coverage_log (
  id BIGSERIAL PRIMARY KEY,

  -- Identité d'un import / run
  import_id TEXT,
  source_label TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Logging fuzzy (P0b)
  excel_localite_norm TEXT,
  db_localite_key TEXT,
  matched_db_localite_key TEXT,
  similarity DOUBLE PRECISION,
  action_suggeree TEXT,
  notes TEXT,

  -- Totaux de couverture (report ADR)
  n_sondages_before INTEGER,
  n_sondages_after INTEGER,
  n_vbs_before INTEGER,
  n_vbs_after INTEGER,
  n_ip_before INTEGER,
  n_ip_after INTEGER,
  n_wl_wp_before INTEGER,
  n_wl_wp_after INTEGER,
  n_eg_before INTEGER,
  n_eg_after INTEGER,
  n_maille_linked_before INTEGER,
  n_maille_linked_after INTEGER,
  delta_vbs INTEGER,
  delta_ip INTEGER,
  delta_eg INTEGER
);

CREATE INDEX IF NOT EXISTS idx_import_coverage_log_run_at
  ON atlas.import_coverage_log(run_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_coverage_log_excel_loc
  ON atlas.import_coverage_log(excel_localite_norm);

CREATE INDEX IF NOT EXISTS idx_import_coverage_log_db_loc
  ON atlas.import_coverage_log(db_localite_key);

CREATE INDEX IF NOT EXISTS idx_import_coverage_log_similarity
  ON atlas.import_coverage_log(similarity DESC);

COMMIT;

