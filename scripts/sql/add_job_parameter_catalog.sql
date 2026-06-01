-- Migration: ajout des parameter_id simples pour la queue de jobs
-- Ces entrees representent un "groupe" de calcul pour le pipeline worker
-- Auteur: Intrepid Core Engineering / 2026-06-01

BEGIN;

INSERT INTO atlas.ai_parameter_catalog
  (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled, is_active)
VALUES
  ('vbs',  'geotechnique', 'interpolation', 'g/100g', true, true, true),
  ('ip',   'geotechnique', 'interpolation', '%',      true, true, true),
  ('wl',   'geotechnique', 'interpolation', '%',      true, true, true),
  ('wp',   'geotechnique', 'interpolation', '%',      true, true, true),
  ('eg',   'geotechnique', 'interpolation', '%',      true, true, true),
  ('all',  'geotechnique', 'interpolation', 'mixed',  true, true, true)
ON CONFLICT (parameter_id) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'Added job parameter catalog entries: vbs, ip, wl, wp, eg, all';
END $$;

COMMIT;
