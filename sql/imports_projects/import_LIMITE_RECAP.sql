-- ============================================================================
-- IMPORT MANUEL: limite (Tableau récapitulatif Atterberg)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-LIMITE-RECAP
-- Type: Données complémentaires - Limites Atterberg pour localités existantes
-- Note: Mise à jour des essais existants
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-LIMITE-RECAP';

-- ============================================================================
-- MISE À JOUR: Atterberg pour les localités existantes
-- ============================================================================

-- Anié (AKONDOR) - Mise à jour avec valeurs du récap
UPDATE essais_geotechniques eg
SET wl = CASE 
  WHEN eg.depth_m = 1.0 THEN 61.56
  WHEN eg.depth_m = 1.5 THEN 55.08
  WHEN eg.depth_m = 2.0 THEN 54.19
  ELSE eg.wl
END,
wp = CASE 
  WHEN eg.depth_m = 1.0 THEN 24.11
  WHEN eg.depth_m = 1.5 THEN 21.07
  WHEN eg.depth_m = 2.0 THEN 17.5
  ELSE eg.wp
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"atterberg_source": "limite.xlsx", "wl_interpretation": "Elevé"}'::jsonb
FROM sondages s
WHERE s.code = 'AKONDOR-ANIE' AND eg.sondage_id = s.id;

-- Nyamassila (AKONDOR)
UPDATE essais_geotechniques eg
SET wl = CASE 
  WHEN eg.depth_m = 1.0 THEN 52.59
  WHEN eg.depth_m = 1.5 THEN 53.48
  WHEN eg.depth_m = 2.0 THEN 52.01
  ELSE eg.wl
END,
wp = CASE 
  WHEN eg.depth_m = 1.0 THEN 25.48
  WHEN eg.depth_m = 1.5 THEN 24.23
  WHEN eg.depth_m = 2.0 THEN 21.5
  ELSE eg.wp
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"atterberg_source": "limite.xlsx", "wl_interpretation": "Elevé"}'::jsonb
FROM sondages s
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.sondage_id = s.id;

-- Badomé (ANYO)
UPDATE essais_geotechniques eg
SET wl = CASE 
  WHEN eg.depth_m = 1.0 THEN 69.96
  WHEN eg.depth_m = 1.5 THEN 37.74
  WHEN eg.depth_m = 2.0 THEN 46.5
  ELSE eg.wl
END,
wp = CASE 
  WHEN eg.depth_m = 1.0 THEN 37.0
  WHEN eg.depth_m = 1.5 THEN 19.0
  WHEN eg.depth_m = 2.0 THEN 31.0
  ELSE eg.wp
END,
meta = COALESCE(eg.meta, '{}'::jsonb) || '{"atterberg_source": "limite.xlsx", "wl_interpretation": "Elevé/Moyen"}'::jsonb
FROM sondages s
WHERE s.code = 'ANYO-BADOME' AND eg.sondage_id = s.id;

-- ============================================================================
-- AUDITS
-- ============================================================================

SELECT 'LIMITE-RECAP' AS projet,
       COUNT(*) AS essais_mis_a_jour
FROM essais_geotechniques
WHERE meta->>'atterberg_source' = 'limite.xlsx';

COMMIT;
