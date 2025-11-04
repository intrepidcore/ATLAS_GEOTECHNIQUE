-- ============================================================================
-- IMPORT MANUEL: bleu (Tableau récapitulatif VBS)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-BLEU-RECAP
-- Type: Données complémentaires - VBS pour localités existantes
-- Note: Mise à jour des essais existants
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-BLEU-RECAP';

-- ============================================================================
-- MISE À JOUR: VBS pour les localités existantes
-- ============================================================================

-- Anié (AKONDOR) - Valeurs très fortes
UPDATE essais_geotechniques eg
SET vbs = CASE 
  WHEN eg.depth_m = 1.0 THEN 16.65
  WHEN eg.depth_m = 1.5 THEN 18.07
  WHEN eg.depth_m = 2.0 THEN 9.47
  ELSE eg.vbs
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"vbs_source": "bleu.xlsx", "vbs_interpretation": "Très forte"}'::jsonb
FROM sondages s
WHERE s.code = 'AKONDOR-ANIE' AND eg.sondage_id = s.id;

-- Nyamassila (AKONDOR)
UPDATE essais_geotechniques eg
SET vbs = CASE 
  WHEN eg.depth_m = 1.0 THEN 8.0
  WHEN eg.depth_m = 1.5 THEN 4.8
  WHEN eg.depth_m = 2.0 THEN 7.33
  ELSE eg.vbs
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"vbs_source": "bleu.xlsx", "vbs_interpretation": "Forte/Moyen"}'::jsonb
FROM sondages s
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.sondage_id = s.id;

-- Badomé (ANYO)
UPDATE essais_geotechniques eg
SET vbs = CASE 
  WHEN eg.depth_m = 1.0 THEN 5.71
  WHEN eg.depth_m = 1.5 THEN 6.96
  WHEN eg.depth_m = 2.0 THEN 7.79
  ELSE eg.vbs
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"vbs_source": "bleu.xlsx", "vbs_interpretation": "Moyen/Forte"}'::jsonb
FROM sondages s
WHERE s.code = 'ANYO-BADOME' AND eg.sondage_id = s.id;

-- ============================================================================
-- AUDITS
-- ============================================================================

SELECT 'BLEU-RECAP' AS projet,
       COUNT(*) AS essais_mis_a_jour
FROM essais_geotechniques
WHERE meta->>'vbs_source' = 'bleu.xlsx';

COMMIT;
