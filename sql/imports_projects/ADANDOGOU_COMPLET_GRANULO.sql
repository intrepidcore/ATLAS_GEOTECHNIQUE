-- ============================================================================
-- IMPORT COMPLET: ADANDOGOU Afiwa Pamela PAS TERMINE
-- ============================================================================
-- Inclut: Sondages, Essais, Granulométrie COMPLÈTE, Physiques, Classifications
-- Date: 2025-11-03
-- Batch: MD-20251103-ADANDOGOU-FULL

-- ============================================================================
-- GRANULOMÉTRIE: ASSAHOUM (Kévé) - 1m
-- ============================================================================

-- AGT (tamisage) - 1m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 100), (20, 100), (12.5, 99.92), (10, 99.92), (8, 99.78),
  (6.3, 99.46), (5, 98.99), (4, 98.56), (3.15, 98.09), (2.5, 97.26),
  (2, 96.08), (1.6, 94.05), (1.25, 91.62), (1, 88.57), (0.8, 84.98),
  (0.63, 78.47), (0.5, 73.84), (0.4, 68.26), (0.315, 61.99), (0.25, 56.74),
  (0.2, 51.07), (0.16, 47.26), (0.125, 44.74), (0.1, 43.76), (0.08, 43.3)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- AGS (sédimentométrie) - 1m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (0.0714, 39.8), (0.0506, 36.19), (0.0364, 27.41), (0.0231, 23.17),
  (0.0163, 19.36), (0.0115, 15.49), (0.00822, 14.5), (0.0058, 13.51), (0.0034, 13)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: ASSAHOUM - 1.5m
-- ============================================================================

-- AGT - 1.5m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 100), (20, 100), (100, 99.47), (12.5, 99.1), (10, 98.07),
  (8, 97.25), (6.3, 94.48), (5, 90.23), (4, 86.15), (3.15, 81.63),
  (2.5, 76.53), (2, 72.89), (1.6, 69.22), (1.25, 66.65), (1, 60.2),
  (0.8, 59.78), (0.63, 54.6), (0.5, 50.33), (0.4, 46.6), (0.315, 422.43),
  (0.25, 39.15), (0.2, 34.47), (0.16, 30.27), (0.125, 27.88), (0.1, 26.56), (0.08, 5.7)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- AGS - 1.5m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (0.0714, 22.54), (0.0506, 18.95), (0.0364, 16.11), (0.0231, 13.85),
  (0.0163, 13.5), (0.0115, 12.8), (0.00822, 12.45), (0.0058, 11.75), (0.0034, 11.37)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: ASSAHOUM - 2m
-- ============================================================================

-- AGT - 2m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 100), (20, 100), (100, 100), (12.5, 99.33), (10, 98.09),
  (8, 95.85), (6.3, 91.58), (5, 74.01), (4, 65.85), (3.15, 57.61),
  (2.5, 49.53), (2, 45.74), (1.6, 43.65), (1.25, 41.93), (1, 40.08),
  (0.8, 38.27), (0.63, 36.2), (0.5, 33.91), (0.4, 31.89), (0.315, 29.81),
  (0.25, 28.81), (0.2, 26.47), (0.16, 24.92), (0.125, 24.33), (0.1, 24.08), (0.08, 4.02)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- AGS - 2m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-ASSAHOUM' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (0.0714, 21.2), (0.0506, 14.7), (0.0364, 12.32), (0.0231, 10.87),
  (0.0163, 10.71), (0.0115, 10.63), (0.00822, 10.54), (0.0058, 10.38), (0.0034, 10.27)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: BADJA - 1m
-- ============================================================================

-- AGT - 1m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-BADJA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 100), (20, 100), (100, 100), (12.5, 100), (10, 100),
  (8, 99.63), (6.3, 99.45), (5, 99.19), (4, 98.81), (3.15, 98.25),
  (2.5, 97.2), (2, 95.98), (1.6, 93.92), (1.25, 91.4), (1, 88.23),
  (0.8, 84.69), (0.63, 79.91), (0.5, 75.68), (0.4, 72.3), (0.315, 68.18),
  (0.25, 65.04), (0.2, 59.33), (0.16, 53.7), (0.125, 51.12), (0.1, 49.85), (0.08, 48.54)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: BADJA - 1.5m
-- ============================================================================

-- AGT - 1.5m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-BADJA' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 98.63), (20, 98.63), (100, 98.24), (12.5, 97.85), (10, 96.78),
  (8, 95.62), (6.3, 94.38), (5, 92.5), (4, 90.84), (3.15, 88.13),
  (2.5, 84.46), (2, 80.54), (1.6, 76.36), (1.25, 71.68), (1, 65.82),
  (0.8, 60.98), (0.63, 55.2), (0.5, 51.28), (0.4, 47.7), (0.315, 43.45),
  (0.25, 40.45), (0.2, 33.49), (0.16, 32.88), (0.125, 31.9), (0.1, 31.09), (0.08, 30.28)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- GRANULOMÉTRIE: BADJA - 2m
-- ============================================================================

-- AGT - 2m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADANDOGOU-BADJA' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADANDOGOU-FULL'
FROM e, (VALUES
  (25, 100), (20, 100), (100, 100), (12.5, 100), (10, 99.87),
  (8, 99.66), (6.3, 99.47), (5, 99.28), (4, 98.92), (3.15, 97.94),
  (2.5, 96.97), (2, 95.21), (1.6, 92.34), (1.25, 88.85), (1, 84.42),
  (0.8, 80.29), (0.63, 74.85), (0.5, 69.91), (0.4, 66), (0.315, 61.72),
  (0.25, 57.93), (0.2, 53), (0.16, 47.81), (0.125, 45.58), (0.1, 44.46), (0.08, 43.27)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- CONTRÔLE: Vérifier granulométrie importée
-- ============================================================================

SELECT s.code, eg.depth_m, COUNT(*) as nb_points,
       MIN(gp.sieve_mm) as tamis_min, MAX(gp.sieve_mm) as tamis_max,
       gp.methode
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code LIKE 'ADANDOGOU%'
GROUP BY s.code, eg.depth_m, gp.methode
ORDER BY s.code, eg.depth_m, gp.methode;

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================
-- ADANDOGOU: 3 sondages × 3 profondeurs = 9 essais
-- Granulométrie: ~200 points (AGT + AGS)
-- Physiques: 9 essais (déjà importés)
-- Classifications: 12 (déjà importées)
-- ============================================================================
