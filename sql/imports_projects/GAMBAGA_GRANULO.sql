-- ============================================================================
-- GAMBAGA Inoussa - GRANULOMÉTRIE COMPLÈTE
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-GAMBAGA-GRANULO

-- ============================================================================
-- SANFATOUTE - 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 99.75), (10, 98.87), (8, 98.5),
  (6.3, 98.22), (5, 97.95), (4, 97.54), (3.15, 96.56), (2.5, 95.72), (2, 95.09),
  (1.6, 94.58), (1.25, 94.21), (1, 93.96), (0.8, 93.7), (0.63, 93.45), (0.5, 93.06),
  (0.4, 92.67), (0.315, 91.88), (0.25, 91), (0.2, 89.69), (0.16, 88.25), (0.125, 85.5),
  (0.1, 83.77), (0.08, 82.81)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (0.0696, 82.38), (0.0494, 79.33), (0.0351, 76.65), (0.0224, 71.69), (0.013, 67.1),
  (0.0076, 61.37), (0.0047, 56.4), (0.0033, 52.97), (0.0027, 51.03), (0.0024, 49.91),
  (0.0019, 48.76), (0.0014, 48)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- SANFATOUTE - 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 99.7), (8, 99.7),
  (6.3, 99.61), (5, 99.59), (4, 99.51), (3.15, 99.33), (2.5, 99.07), (2, 98.62),
  (1.6, 98.03), (1.25, 97.38), (1, 96.87), (0.8, 96.29), (0.63, 95.77), (0.5, 95.02),
  (0.4, 94.46), (0.315, 93.23), (0.25, 91.88), (0.2, 87.92), (0.16, 85.7), (0.125, 80.41),
  (0.1, 78.65), (0.08, 77.5)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (0.0696, 77.12), (0.0494, 73.7), (0.0351, 70.28), (0.0224, 65.15), (0.013, 59.33),
  (0.0076, 53.18), (0.0047, 48.05), (0.0033, 43.63), (0.0027, 41.23), (0.0024, 39.86),
  (0.0019, 38.5), (0.0014, 37.1)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- SANFATOUTE - 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 99.47), (10, 99.47), (8, 99.4),
  (6.3, 99.36), (5, 99.34), (4, 99.25), (3.15, 99.05), (2.5, 98.89), (2, 98.71),
  (1.6, 98.54), (1.25, 98.28), (1, 98.03), (0.8, 97.75), (0.63, 97.4), (0.5, 96.67),
  (0.4, 95.91), (0.315, 94.04), (0.25, 91.73), (0.2, 84.86), (0.16, 80.61), (0.125, 73.48),
  (0.1, 70.87), (0.08, 68.75)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' AND LOWER(s.code) LIKE '%sanfatoute%' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-GAMBAGA-GRANULO'
FROM e, (VALUES
  (0.0696, 65.88), (0.0494, 62.82), (0.0351, 60.02), (0.0224, 56.21), (0.013, 51.11),
  (0.0076, 46.03), (0.0047, 40.7), (0.0033, 37.13), (0.0027, 34.58), (0.0024, 33.05),
  (0.0019, 31.01), (0.0014, 28.97)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- CONTRÔLE
-- ============================================================================

SELECT s.code, eg.depth_m, COUNT(*) as nb_points,
       MIN(gp.sieve_mm) as tamis_min, MAX(gp.sieve_mm) as tamis_max
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'GAMBAGA Inoussa'
GROUP BY s.code, eg.depth_m
ORDER BY s.code, eg.depth_m;

SELECT 'GAMBAGA' as projet, COUNT(*) as total_points
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'GAMBAGA Inoussa';

-- ============================================================================
-- RÉSUMÉ: GAMBAGA Sanfatoute 3 profondeurs × ~38 points = ~114 points
-- ============================================================================
