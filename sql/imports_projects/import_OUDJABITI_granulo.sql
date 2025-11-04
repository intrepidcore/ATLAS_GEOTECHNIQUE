-- ============================================================================
-- OUDJABITI - GRANULOMÉTRIE (AGT + AGS)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TCHAMBA 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 100), (6.3, 99.97),
  (5, 99.94), (4, 99.88), (3.15, 99.74), (2.5, 99.35), (2, 98.68), (1.6, 97.61), (1.25, 96.11),
  (1, 94.42), (0.8, 91.38), (0.63, 87.15), (0.5, 80.02), (0.4, 74.91), (0.315, 67.33),
  (0.25, 60.92), (0.2, 51.59), (0.16, 47.81), (0.125, 42.46), (0.1, 40.78), (0.08, 39.88)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.069, 35.21), (0.0475, 31.5), (0.0345, 26.32), (0.0215, 22.61), (0.0175, 20.39),
  (0.0073, 19.66), (0.00465, 18.91), (0.00275, 18.16), (0.00139, 17.4)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- TCHAMBA 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 100), (6.3, 99.96),
  (5, 99.87), (4, 99.83), (3.15, 99.56), (2.5, 99.1), (2, 98.21), (1.6, 97.03), (1.25, 95.45),
  (1, 93.81), (0.8, 91.12), (0.63, 87.03), (0.5, 79.49), (0.4, 75.11), (0.315, 67.42),
  (0.25, 61.09), (0.2, 55.28), (0.16, 51.28), (0.125, 47.07), (0.1, 45.57), (0.08, 44.92)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.069, 25.26), (0.0475, 20.55), (0.0345, 17.87), (0.0215, 17.19), (0.0175, 15.85),
  (0.0073, 15.17), (0.00465, 14.49), (0.00275, 13.81), (0.00139, 13.12)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- TCHAMBA 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 99.4), (10, 99.18), (8, 99.01), (6.3, 98.69),
  (5, 98.44), (4, 98.07), (3.15, 97.54), (2.5, 96.91), (2, 96.15), (1.6, 95.2), (1.25, 93.99),
  (1, 92.7), (0.8, 90.45), (0.63, 87.28), (0.5, 82.13), (0.4, 78.51), (0.315, 73.57),
  (0.25, 68.95), (0.2, 63.38), (0.16, 59.96), (0.125, 56.22), (0.1, 54.82), (0.08, 54.01)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.069, 20.56), (0.0475, 19.21), (0.0345, 18.54), (0.0215, 17.86), (0.0175, 17.19),
  (0.0073, 15.85), (0.00465, 14.5), (0.00275, 13.83)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- ALIBI 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 99.86), (6.3, 99.43),
  (5, 99.24), (4, 98.91), (3.15, 98.57), (2.5, 98.25), (2, 97.73), (1.6, 97.26), (1.25, 96.71),
  (1, 96.18), (0.8, 95.44), (0.63, 94.35), (0.5, 91.97), (0.4, 90.01), (0.315, 84.86),
  (0.25, 78.58), (0.2, 69.14), (0.16, 65.82), (0.125, 61.34), (0.1, 59.77), (0.08, 58.98)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.066, 52.13), (0.046, 36.73), (0.033, 32.2), (0.02, 27.66), (0.012, 24.04),
  (0.0071, 23.14), (0.0046, 23.13), (0.00275, 22.22), (0.00139, 18.57)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- ALIBI 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 99.72), (8, 99.61), (6.3, 99.4),
  (5, 99.06), (4, 98.55), (3.15, 97.98), (2.5, 97.52), (2, 97.04), (1.6, 96.53), (1.25, 95.97),
  (1, 95.43), (0.8, 94.74), (0.63, 93.66), (0.5, 91.26), (0.4, 89.68), (0.315, 78.54),
  (0.25, 73.59), (0.2, 66.63), (0.16, 64.06), (0.125, 60.31), (0.1, 59.27), (0.08, 58.67)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.066, 39.33), (0.046, 32.86), (0.033, 31.02), (0.02, 28.25), (0.012, 26.4),
  (0.0071, 24.55), (0.0046, 22.69), (0.00275, 20.82), (0.00139, 18.96)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- ALIBI 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 99.06), (12.5, 98.72), (10, 98.34), (8, 97.17), (6.3, 96.52),
  (5, 95.94), (4, 95.33), (3.15, 94.52), (2.5, 93.74), (2, 93.07), (1.6, 92.43), (1.25, 91.45),
  (1, 90.72), (0.8, 89.69), (0.63, 87.88), (0.5, 85.4), (0.4, 82.36), (0.315, 77.3),
  (0.25, 71.79), (0.2, 62.93), (0.16, 58.51), (0.125, 54.51), (0.1, 52.39), (0.08, 51.27)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-OUDJABITI'
FROM e, (VALUES
  (0.066, 36.09), (0.046, 31.94), (0.033, 25.31), (0.02, 22.0), (0.012, 21.17),
  (0.0071, 21.17), (0.0046, 18.69), (0.00275, 17.03), (0.00139, 14.55)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- AUDITS (6 CHECKS)
-- ============================================================================

SELECT s.code, COUNT(DISTINCT eg.id) AS n_essais, COUNT(DISTINCT ep.id) AS n_phys,
       COUNT(DISTINCT ec.id) AS n_classif, COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'OUDJABITI Bassirou'
GROUP BY s.code ORDER BY s.code;

SELECT methode, COUNT(*) FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'OUDJABITI Bassirou' GROUP BY methode;

WITH d AS (
  SELECT essai_id, sieve_mm, COUNT(*) c FROM granulometrie_points gp 
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'OUDJABITI Bassirou' GROUP BY essai_id, sieve_mm
) SELECT * FROM d WHERE c > 1;

SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing
FROM granulometrie_points gp JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'OUDJABITI Bassirou'
AND (gp.percent_passing < 0 OR gp.percent_passing > 100);

WITH r AS (
  SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing,
         LAG(gp.percent_passing) OVER (PARTITION BY gp.essai_id ORDER BY gp.sieve_mm DESC) AS prev_pct
  FROM granulometrie_points gp JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'OUDJABITI Bassirou'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct ORDER BY delta DESC;

SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom FROM sondages 
WHERE source = 'OUDJABITI Bassirou';

SELECT 'OUDJABITI' AS projet, COUNT(DISTINCT s.id) AS n_sondages, COUNT(DISTINCT eg.id) AS n_essais,
       COUNT(DISTINCT ep.id) AS n_phys, COUNT(DISTINCT ec.id) AS n_classif, COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'OUDJABITI Bassirou';

COMMIT;
