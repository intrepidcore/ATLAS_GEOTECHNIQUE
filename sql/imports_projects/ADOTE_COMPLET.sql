-- ============================================================================
-- ADOTE Adote emmanuel - IMPORT COMPLET
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-ADOTE
-- Localités: OGARO, Batbougou, Nanousongue
-- Données: Granulométrie uniquement (pas d'Atterberg/VBS dans le MD)

-- ============================================================================
-- CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (id, code, source, created_by_batch, created_at)
VALUES 
  (gen_random_uuid(), 'ADOTE-OGARO', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now()),
  (gen_random_uuid(), 'ADOTE-BATBOUGOU', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now()),
  (gen_random_uuid(), 'ADOTE-NANOUSONGUE', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- CRÉATION ESSAIS (profondeurs 1m, 1.5m, 2m)
-- ============================================================================

DO $$
DECLARE
    v_sondage_id uuid;
BEGIN
    -- OGARO
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADOTE-OGARO';
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, created_by_batch)
    VALUES 
      (gen_random_uuid(), v_sondage_id, 1.0, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 1.5, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 2.0, 'MD-20251103-ADOTE')
    ON CONFLICT (sondage_id, depth_m) DO NOTHING;
    
    -- BATBOUGOU
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADOTE-BATBOUGOU';
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, created_by_batch)
    VALUES 
      (gen_random_uuid(), v_sondage_id, 1.0, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 1.5, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 2.0, 'MD-20251103-ADOTE')
    ON CONFLICT (sondage_id, depth_m) DO NOTHING;
    
    -- NANOUSONGUE
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADOTE-NANOUSONGUE';
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, created_by_batch)
    VALUES 
      (gen_random_uuid(), v_sondage_id, 1.0, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 1.5, 'MD-20251103-ADOTE'),
      (gen_random_uuid(), v_sondage_id, 2.0, 'MD-20251103-ADOTE')
    ON CONFLICT (sondage_id, depth_m) DO NOTHING;
END $$;

-- ============================================================================
-- GRANULOMÉTRIE: OGARO 1m
-- ============================================================================

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 1.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 100), (8, 100), (6.3, 99.81), (2.5, 96.56), (1.25, 93.78),
  (1, 93.37), (0.8, 92.82), (0.63, 92.09), (0.4, 87.64), (0.315, 80.13), (0.25, 67.3),
  (0.16, 31.24), (0.15, 12.49), (0.1, 4.53), (0.08, 0.72)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- OGARO 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 1.5)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 100), (8, 96.48), (6.3, 92.98), (2.5, 75.08), (1.25, 69.52),
  (1, 68.88), (0.8, 68.22), (0.63, 67.46), (0.4, 63.73), (0.315, 58.04), (0.25, 48.6),
  (0.16, 22.79), (0.15, 11.13), (0.1, 3.73), (0.08, 0.74)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- OGARO 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 2.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 96.34), (8, 91.38), (6.3, 87.75), (2.5, 59.48), (1.25, 49.58),
  (1, 48.71), (0.8, 47.94), (0.63, 47.17), (0.4, 43.95), (0.315, 39.11), (0.25, 30.71),
  (0.16, 12.96), (0.15, 5.16), (0.1, 1.82), (0.08, 0.24)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: BATBOUGOU (3 profondeurs)
-- ============================================================================

-- 1m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (16, 100), (12.5, 99.26), (8, 97.63), (6.3, 96.15), (5, 94.45), (3.15, 91.54),
  (2.5, 90.52), (1, 88.88), (0.8, 88.67), (0.63, 88.49), (0.4, 87.68), (0.315, 85.26),
  (0.25, 80.02), (0.16, 49.22), (0.15, 16.77), (0.1, 6.87), (0.08, 1.73)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.5)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (16, 100), (12.5, 100), (8, 100), (6.3, 99.72), (5, 99.52), (3.15, 99.2),
  (2.5, 98.79), (1, 97.31), (0.8, 96.95), (0.63, 96.61), (0.4, 96.65), (0.315, 94.2),
  (0.25, 90.96), (0.16, 71.38), (0.15, 34.14), (0.1, 13.91), (0.08, 2.7)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 2.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (16, 100), (12.5, 100), (8, 100), (6.3, 100), (5, 99.95), (3.15, 99.63),
  (2.5, 99.5), (1, 98.51), (0.8, 97.61), (0.63, 96.59), (0.4, 94.22), (0.315, 66.09),
  (0.25, 94.22), (0.16, 66.09), (0.15, 20.74), (0.1, 9.76), (0.08, 3.41)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: NANOUSONGUE (3 profondeurs)
-- ============================================================================

-- 1m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 98.72), (12.5, 89.34), (8, 68.03), (6.3, 56.01), (4, 35.99),
  (3.15, 25.44), (2.5, 20.48), (1.25, 14.91), (1, 14.26), (0.8, 13.8), (0.63, 11.98),
  (0.4, 11.43), (0.25, 10.36), (0.1, 1.5), (0.08, 0.29)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.5)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 100), (12.5, 93.37), (8, 67.3), (6.3, 53.42), (4, 30.7),
  (3.15, 20.93), (2.5, 15.31), (1.25, 10.35), (1, 10.1), (0.8, 9.81), (0.63, 9.62),
  (0.4, 9.25), (0.25, 8.08), (0.15, 3), (0.1, 1), (0.08, 0.18)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 2.0)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 100), (12.5, 92.7), (8, 75.91), (6.3, 62.76), (4, 43.17),
  (3.15, 33.52), (2.5, 28.12), (1.25, 22.39), (1, 21.73), (0.8, 21.23), (0.63, 20.85),
  (0.4, 20.01), (0.25, 17.94), (0.15, 4.87), (0.1, 1.64), (0.08, 0.22)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- CONTRÔLE
-- ============================================================================

SELECT 'ADOTE' as projet, COUNT(*) as total_points
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'ADOTE Adote emmanuel';

-- ============================================================================
-- RÉSUMÉ: ADOTE - 3 sondages × 3 profondeurs × ~16 points = ~144 points
-- ============================================================================
