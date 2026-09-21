-- Migration 098 : Seed permissions pour exports Colab
-- Idempotent, conforme à ON_ERROR_STOP=1 côté exécution.

BEGIN;

INSERT INTO atlas.permissions (id, resource, action, description)
VALUES
  ('colab.export.read', 'colab.export', 'read', 'Lire les exports (jobs, historique, téléchargement)'),
  ('colab.export.create', 'colab.export', 'create', 'Créer un export'),
  ('colab.export.schedule', 'colab.export', 'schedule', 'Planifier des exports (Phase 3)')
ON CONFLICT (id) DO NOTHING;

COMMIT;
