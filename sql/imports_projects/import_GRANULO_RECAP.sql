-- ============================================================================
-- IMPORT MANUEL: Granulométrie (Tableau récapitulatif)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-GRANULO-RECAP
-- Type: Données complémentaires - Passant à 0.08mm pour ~80 localités
-- Note: Mise à jour des essais existants ou création si nécessaire
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-GRANULO-RECAP';

-- ============================================================================
-- MISE À JOUR: Ajout du point 0.08mm pour les localités existantes
-- ============================================================================

-- Anié (déjà importé dans AKONDOR)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 63.74, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- Nyamassila (déjà importé dans AKONDOR)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 39.71, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- Badomé (déjà importé dans ANYO)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 38.5, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- Tchamba (déjà importé dans OUDJABITI)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 39.88, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- Alibi (déjà importé dans OUDJABITI)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 58.98, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- Yade (déjà importé dans NGOAPO-GOLLO)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, 0.08, 57.05, 'tamisage', 'MD-20251103-GRANULO-RECAP',
       '{"source": "Granulométrie.xlsx", "note": "Valeur récapitulative"}'::jsonb
FROM e
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = COALESCE(granulometrie_points.meta, '{}'::jsonb) || EXCLUDED.meta;

-- ============================================================================
-- AUDITS
-- ============================================================================

SELECT 'GRANULO-RECAP' AS projet, 
       COUNT(*) AS points_mis_a_jour
FROM granulometrie_points
WHERE created_by_batch = 'MD-20251103-GRANULO-RECAP'
   OR meta->>'source' = 'Granulométrie.xlsx';

COMMIT;
