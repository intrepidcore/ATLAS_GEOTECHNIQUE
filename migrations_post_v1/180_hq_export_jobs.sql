\set ON_ERROR_STOP 1
-- Migration 180 — Table hq_export_jobs (Moteur d'export serveur headless)
-- Sprint 1 — Roadmap ROADMAP_EXPORT_SERVER_HEADLESS.md
-- Intrepid Core Engineering Standards — DB-11 (atomique/idempotent)

BEGIN;

-- ── 1. Table principale hq_export_jobs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS atlas.hq_export_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Statut du job
  status         text NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  progress       int  NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

  -- Payload versionne (parametres de rendu)
  payload        jsonb NOT NULL,

  -- Resultat
  error_message  text,
  result_path    text,                     -- chemin relatif exports/hq/:id.png
  result_mime    text DEFAULT 'image/png',

  -- Contexte
  requested_by   text,                     -- token subject ou user_id
  engine         text NOT NULL DEFAULT 'puppeteer'
                   CHECK (engine IN ('puppeteer','maplibre')),
  duration_ms    int,

  -- Timestamps
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

-- ── 2. Index ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS hq_export_jobs_status_created
  ON atlas.hq_export_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS hq_export_jobs_requested_by
  ON atlas.hq_export_jobs (requested_by, created_at DESC);

-- ── 3. Trigger auto updated_at ───────────────────────────────────────────────
-- Utilise la fonction existante atlas.set_updated_at() si disponible, sinon cree-en une
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'atlas' AND p.proname = 'set_updated_at'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION atlas.set_updated_at()
      RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END;'
    $fn$;
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_hq_export_jobs_updated_at
  BEFORE UPDATE ON atlas.hq_export_jobs
  FOR EACH ROW EXECUTE FUNCTION atlas.set_updated_at();

-- ── 4. Commentaires ──────────────────────────────────────────────────────────
COMMENT ON TABLE atlas.hq_export_jobs IS
  'File d''attente pour le moteur d''export serveur headless (Puppeteer/MapLibre). '
  'Creee par migration 180 — Sprint 1 ROADMAP_EXPORT_SERVER_HEADLESS.md.';

COMMENT ON COLUMN atlas.hq_export_jobs.payload IS
  'Parametres de rendu JSON version 1.0 : thematic_id, adm_level, adm_name, grid, output, style, bbox.';

COMMENT ON COLUMN atlas.hq_export_jobs.engine IS
  'puppeteer : Phase 1 (Chrome headless, ~1-3s/carte). '
  'maplibre  : Phase 2 (GL Node natif, ~200-500ms/carte).';

COMMENT ON COLUMN atlas.hq_export_jobs.result_path IS
  'Chemin relatif depuis la racine exports/ (ex: hq/550e8400-e29b-41d4-a716-446655440000.png).';

-- ── 5. Verification ──────────────────────────────────────────────────────────
DO $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'atlas' AND table_name = 'hq_export_jobs'
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Migration 180 FAILED : table hq_export_jobs non creee';
  END IF;

  RAISE NOTICE '=== Migration 180 OK — hq_export_jobs creee ===';
END $$;

COMMIT;
