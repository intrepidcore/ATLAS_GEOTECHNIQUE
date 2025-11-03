-- Migration 010: Import Wizard v2.3.0 - Version clean
-- Suppression et recréation complète des tables

-- Supprimer les objets existants
DROP VIEW IF EXISTS v_imports_recent CASCADE;
DROP TRIGGER IF EXISTS trigger_imports_updated_at ON imports;
DROP FUNCTION IF EXISTS update_imports_updated_at();
DROP FUNCTION IF EXISTS generate_batch_id();
DROP TABLE IF EXISTS import_errors CASCADE;
DROP TABLE IF EXISTS imports CASCADE;

-- Table principale des imports
CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  params JSONB NOT NULL DEFAULT '{}',
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Index pour recherche rapide
CREATE INDEX idx_imports_batch_id ON imports(batch_id);
CREATE INDEX idx_imports_status ON imports(status);
CREATE INDEX idx_imports_created_at ON imports(created_at DESC);
CREATE INDEX idx_imports_sha256 ON imports(sha256);

-- Table des erreurs d'import
CREATE TABLE import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  row_no INT NOT NULL,
  column_name TEXT,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  value TEXT,
  hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_import_errors_import_id ON import_errors(import_id);
CREATE INDEX idx_import_errors_severity ON import_errors(severity);

-- Ajouter colonnes batch tracking aux tables existantes (si elles n'existent pas)
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS created_by_batch TEXT;
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS updated_by_batch TEXT;
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS deleted_by_batch TEXT;
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE essais_geotechniques ADD COLUMN IF NOT EXISTS created_by_batch TEXT;
ALTER TABLE essais_geotechniques ADD COLUMN IF NOT EXISTS updated_by_batch TEXT;
ALTER TABLE essais_geotechniques ADD COLUMN IF NOT EXISTS deleted_by_batch TEXT;
ALTER TABLE essais_geotechniques ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index pour le batch tracking
CREATE INDEX IF NOT EXISTS idx_sondages_created_by_batch ON sondages(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sondages_deleted_by_batch ON sondages(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_essais_created_by_batch ON essais_geotechniques(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_essais_deleted_by_batch ON essais_geotechniques(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;

-- Fonction pour générer un batch_id
CREATE OR REPLACE FUNCTION generate_batch_id() RETURNS TEXT AS $$
BEGIN
  RETURN 'IMP-' || to_char(now(), 'YYYYMMDD-HH24MISS');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER trigger_imports_updated_at
  BEFORE UPDATE ON imports
  FOR EACH ROW
  EXECUTE FUNCTION update_imports_updated_at();

-- Vue pour les imports récents avec statistiques
CREATE OR REPLACE VIEW v_imports_recent AS
SELECT 
  i.id,
  i.batch_id,
  i.filename,
  i.status,
  i.created_at,
  i.completed_at,
  (i.stats->>'created')::int AS n_created,
  (i.stats->>'updated')::int AS n_updated,
  (i.stats->>'skipped')::int AS n_skipped,
  (i.stats->>'errors')::int AS n_errors,
  EXTRACT(EPOCH FROM (COALESCE(i.completed_at, now()) - i.created_at))::int AS duration_seconds,
  (SELECT COUNT(*) FROM import_errors WHERE import_id = i.id AND severity = 'error') AS error_count,
  (SELECT COUNT(*) FROM import_errors WHERE import_id = i.id AND severity = 'warning') AS warning_count
FROM imports i
ORDER BY i.created_at DESC
LIMIT 100;

-- Commentaires
COMMENT ON TABLE imports IS 'Table principale des imports avec batch tracking';
COMMENT ON TABLE import_errors IS 'Erreurs et avertissements détectés lors des imports';
COMMENT ON COLUMN sondages.created_by_batch IS 'Batch ID de création (pour undo)';
COMMENT ON COLUMN sondages.deleted_by_batch IS 'Batch ID de suppression (soft delete)';
COMMENT ON FUNCTION generate_batch_id() IS 'Génère un batch_id unique au format IMP-YYYYMMDD-HHMMSS';
