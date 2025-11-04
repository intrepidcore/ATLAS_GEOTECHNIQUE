-- ============================================================================
-- AG TCHESSI - GRANULOMÉTRIE (AGT + AGS)
-- ============================================================================
-- Suite du fichier import_AGTCHESSI.sql
-- Exécuter APRÈS import_AGTCHESSI.sql

BEGIN;

-- ============================================================================
-- BOHOU 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 96.55), (12.5, 95.29), (10, 93.1), (8, 87.85),
  (6.3, 86.23), (5, 84.35), (4, 81.89), (3.15, 78.86), (2.5, 76.21), (2, 73.83),
  (1.6, 71.51), (1.25, 69.25), (1, 67.72), (0.8, 66.39), (0.63, 64.93), (0.5, 62.62),
  (0.4, 60.09), (0.315, 56.59), (0.25, 52.57), (0.2, 48.57), (0.16, 45.09), (0.125, 40.59),
  (0.1, 38.49), (0.08, 36.99)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0613, 32.49), (0.0454, 27.43), (0.0331, 24.06), (0.0209, 23.89), (0.0122, 22.37),
  (0.0072, 20.27), (0.0045, 18.58), (0.0032, 17.3), (0.0026, 16.01), (0.0023, 16.62),
  (0.0019, 14.79), (0.0013, 13.11)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- BOHOU 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 98.26), (16, 96.6), (12.5, 93.88), (10, 91.72), (8, 89.69),
  (6.3, 86.95), (5, 84.09), (4, 81.15), (3.15, 77.82), (2.5, 75.26), (2, 73.04),
  (1.6, 71.15), (1.25, 69.4), (1, 68.14), (0.8, 66.87), (0.63, 65.49), (0.5, 63.36),
  (0.4, 60.7), (0.315, 57.12), (0.25, 53.81), (0.2, 49.24), (0.16, 46.02), (0.125, 41.85),
  (0.1, 39.76), (0.08, 38.48)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0613, 32.91), (0.0463, 25.08), (0.0341, 19.82), (0.0222, 15.43), (0.0129, 14.55),
  (0.0075, 13.67), (0.0046, 12.34), (0.0033, 11.44), (0.0027, 10.55), (0.0023, 10.31),
  (0.0019, 10.15), (0.0014, 9.28)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- BOHOU 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 96.57), (16, 96.57), (12.5, 95.16), (10, 93.72), (8, 90.44),
  (6.3, 85.97), (5, 82.09), (4, 79.42), (3.15, 75.32), (2.5, 71.25), (2, 67.56),
  (1.6, 64.86), (1.25, 63.09), (1, 62.13), (0.8, 61.26), (0.63, 60.4), (0.5, 59.13),
  (0.4, 57.9), (0.315, 56.16), (0.25, 54.48), (0.2, 51.57), (0.16, 49.52), (0.125, 46.09),
  (0.1, 44.25), (0.08, 43.05)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.066, 37.83), (0.0485, 32.51), (0.0352, 28.25), (0.0227, 25.59), (0.0133, 23.46),
  (0.0077, 22.4), (0.0048, 19.74), (0.0034, 18.68), (0.0028, 17.09), (0.0024, 16.55),
  (0.002, 15.49), (0.0014, 13.91)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA FEING 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (10, 100), (8, 99.73), (6.3, 99.42), (5, 99.2), (4, 98.46), (3.15, 96.67),
  (2.5, 94.33), (2, 91.62), (1.6, 89.2), (1.25, 87.49), (1, 86.47), (0.8, 85.68),
  (0.63, 85.08), (0.5, 84.31), (0.4, 83.62), (0.315, 82.71), (0.25, 81.75), (0.2, 80.33),
  (0.16, 78.98), (0.125, 77.04), (0.1, 75.63), (0.08, 74.6)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0617, 66.07), (0.05, 35.2), (0.0363, 28.67), (0.023, 27.85), (0.0134, 26.22),
  (0.0077, 25.4), (0.0048, 22.14), (0.0034, 20.51), (0.0028, 19.69), (0.0024, 18.87),
  (0.002, 18.06), (0.0014, 15.61)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA FEING 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (5, 100), (4, 99.93), (3.15, 99.58), (2.5, 98.99), (2, 98.22), (1.6, 97.47),
  (1.25, 96.76), (1, 96.28), (0.8, 95.88), (0.63, 95.59), (0.5, 95.22), (0.4, 94.9),
  (0.315, 94.49), (0.25, 93.98), (0.2, 93.15), (0.16, 92.39), (0.125, 89.76), (0.1, 87.75),
  (0.08, 86.36)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0702, 82.61), (0.0513, 74.14), (0.0394, 48.95), (0.0258, 37.12), (0.0151, 32.9),
  (0.0088, 28.67), (0.0054, 25.52), (0.0039, 24.46), (0.0032, 22.34), (0.0027, 22.34),
  (0.0022, 21.29), (0.0016, 19.17)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA FEING 2m (AGT + AGS) - Données du tableau initial
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (10, 100), (8, 100), (6.3, 100), (5, 99.94), (4, 99.86), (3.15, 99.75),
  (2.5, 99.56), (2, 99.34), (1.6, 99.12), (1.25, 98.88), (1, 98.7), (0.8, 98.51),
  (0.63, 98.37), (0.5, 98.15), (0.4, 97.98), (0.315, 97.76), (0.25, 97.53), (0.2, 97.18),
  (0.16, 96.81), (0.125, 96.19), (0.1, 95.67), (0.08, 95.25)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0729, 94.44), (0.0522, 90.57), (0.0379, 82.35), (0.0262, 50.92), (0.0156, 40.04),
  (0.009, 37.61), (0.0056, 32.77), (0.004, 30.36), (0.0033, 27.94), (0.0029, 25.52),
  (0.0023, 21.89), (0.0014, 19.48)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA TCHANDE 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 99.77), (10, 99.63), (8, 99.63),
  (6.3, 99.5), (5, 99.32), (4, 99.04), (3.15, 98.7), (2.5, 98.41), (2, 98.11),
  (1.6, 97.77), (1.25, 97.56), (1, 97.34), (0.8, 97.09), (0.63, 96.56), (0.5, 95.66),
  (0.4, 93.92), (0.315, 90.86), (0.25, 80.33), (0.2, 73.23), (0.16, 65.64), (0.125, 61.08),
  (0.1, 58.4), (0.08, 55.72)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0645, 46.6), (0.051, 30.88), (0.0373, 22.42), (0.0238, 21.21), (0.0139, 21.83),
  (0.0081, 20.01), (0.005, 19.41), (0.0035, 19.17), (0.0029, 16.99), (0.0025, 16.39),
  (0.0021, 14.57), (0.0014, 12.76)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA TCHANDE 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 98.19), (16, 97.69), (12.5, 94.91), (10, 91.12), (8, 89.26),
  (6.3, 87.25), (5, 84.96), (4, 82.57), (3.15, 78.64), (2.5, 74.93), (2, 71.83),
  (1.6, 69.11), (1.25, 66.68), (1, 64.94), (0.8, 63.2), (0.63, 61.24), (0.5, 58.17),
  (0.4, 55.26), (0.315, 51.02), (0.25, 46.15), (0.2, 39.77), (0.16, 39.66), (0.125, 34.75),
  (0.1, 32.37), (0.08, 31.16)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0645, 25.95), (0.051, 21.52), (0.0373, 17.55), (0.0238, 13.26), (0.0139, 11.94),
  (0.0081, 10.94), (0.005, 10.28), (0.0035, 9.62), (0.0029, 8.96), (0.0025, 8.63),
  (0.0021, 7.64), (0.0014, 6.98)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- LAMA TCHANDE 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (25, 100), (20, 93.26), (16, 92.17), (12.5, 91.79), (10, 90.95), (8, 90.45),
  (6.3, 89.68), (5, 89.15), (4, 88.48), (3.15, 87.32), (2.5, 86.47), (2, 85.81),
  (1.6, 85.25), (1.25, 84.78), (1, 84.46), (0.8, 84.13), (0.63, 83.8), (0.5, 83.24),
  (0.4, 82.55), (0.315, 81.41), (0.25, 79.76), (0.2, 76.58), (0.16, 72.9), (0.125, 66.89),
  (0.1, 63.93), (0.08, 62.34)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AGTCHESSI'
FROM e, (VALUES
  (0.0645, 55.12), (0.051, 32.97), (0.0373, 25.1), (0.0238, 23.67), (0.0139, 20.1),
  (0.0081, 17.96), (0.005, 15.81), (0.0035, 15.53), (0.0029, 15.1), (0.0025, 14.38),
  (0.0021, 13.67), (0.0014, 12.24)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- AUDITS
-- ============================================================================

-- Vue d'ensemble
SELECT 
  s.code, 
  COUNT(DISTINCT eg.id) AS n_essais,
  COUNT(DISTINCT ep.id) AS n_phys,
  COUNT(DISTINCT ec.id) AS n_classif,
  COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'AG TCHESSI pas terminer'
GROUP BY s.code 
ORDER BY s.code;

-- Monotonicité granulo
WITH r AS (
  SELECT 
    s.code,
    eg.depth_m,
    gp.sieve_mm, 
    gp.percent_passing,
    LAG(gp.percent_passing) OVER (PARTITION BY gp.essai_id ORDER BY gp.sieve_mm DESC) AS prev_pct
  FROM granulometrie_points gp
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'AG TCHESSI pas terminer'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY delta DESC;

-- Compteurs finaux
SELECT 
  'AG TCHESSI pas terminer' AS projet,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT eg.id) AS n_essais,
  COUNT(DISTINCT ep.id) AS n_phys,
  COUNT(DISTINCT ec.id) AS n_classif,
  COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'AG TCHESSI pas terminer';

COMMIT;
