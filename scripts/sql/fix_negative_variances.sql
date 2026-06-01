-- Fix: clamp variances negatives PyKrige residuelles
-- Methodes: ked_pedologie_granulo (121 valeurs), ordinary_kriging_pykrige (7 valeurs)
-- Auteur: Intrepid Core Engineering / 2026-06-01
-- Convention CONV-02 : variance PyKrige <= 0 = artefact numerique, clamp a 0

BEGIN;

UPDATE atlas.ai_interpolation_values
SET variance = 0.0
WHERE variance < 0
  AND method IN ('ked_pedologie_granulo', 'ordinary_kriging_pykrige')
  AND COALESCE(is_superseded, false) = false;

DO $$
BEGIN
  RAISE NOTICE 'Variances negatives corrigees pour granulo et ordinary_kriging';
END $$;

COMMIT;
