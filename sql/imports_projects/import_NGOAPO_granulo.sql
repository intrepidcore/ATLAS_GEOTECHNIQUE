-- ============================================================================
-- NGOAPO - GRANULOMÉTRIE (AGT + AGS)
-- ============================================================================

BEGIN;

-- ============================================================================
-- YADE 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 99.39), (10, 99.22), (8, 99.01), (6.3, 98.59),
  (5, 97.85), (4, 96.41), (3.15, 92.66), (2.5, 88.77), (2, 85.04), (1.6, 82.1), (1.25, 80.05),
  (1, 79.02), (0.8, 78.01), (0.63, 77.08), (0.5, 75.98), (0.4, 74.85), (0.315, 73.28),
  (0.25, 71.44), (0.2, 68.64), (0.16, 66.03), (0.125, 61.74), (0.1, 58.71), (0.08, 57.05)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO',
       CASE WHEN sieve = 0.008 THEN '{"anomaly": "inversion +1.03%"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (0.0634, 50.34), (0.0475, 38.76), (0.0353, 27.86), (0.0235, 15.74), (0.014, 7.9),
  (0.008, 8.93), (0.005, 6.64), (0.0035, 6.51), (0.0029, 6.51), (0.0025, 6.51),
  (0.002, 6.48), (0.0014, 5.78)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- ============================================================================
-- YADE 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 100), (6.3, 100),
  (5, 100), (4, 99.98), (3.15, 99.83), (2.5, 99.57), (2, 99.22), (1.6, 98.85), (1.25, 98.01),
  (1, 97.59), (0.8, 97.01), (0.63, 96.35), (0.5, 94.97), (0.4, 93.73), (0.315, 89.3),
  (0.25, 84.24), (0.2, 78.66), (0.16, 73.18), (0.125, 67.47), (0.1, 66.09), (0.08, 65)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (0.0634, 60.06), (0.0475, 52.06), (0.0353, 44.06), (0.0235, 37.64), (0.014, 34.44),
  (0.008, 31.24), (0.005, 25.64), (0.0035, 20.2), (0.0029, 15.27), (0.0025, 10.48),
  (0.002, 4.09), (0.0014, 0.89)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- YADE 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 100), (6.3, 100),
  (5, 99.96), (4, 99.82), (3.15, 99.43), (2.5, 98.88), (2, 98.15), (1.6, 97.11), (1.25, 94.99),
  (1, 92.77), (0.8, 89.8), (0.63, 87.43), (0.5, 82.26), (0.4, 78.41), (0.315, 73.89),
  (0.25, 69.2), (0.2, 62.9), (0.16, 58.14), (0.125, 49.23), (0.1, 45.04), (0.08, 42.49)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (0.0634, 36.26), (0.0475, 27.09), (0.0353, 20.67), (0.0235, 13.33), (0.014, 10.58),
  (0.008, 7.84), (0.005, 6.01), (0.0035, 5.57), (0.0029, 5.12), (0.0025, 5.1),
  (0.002, 5.1), (0.0014, 5.1)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- TCHITCHAO 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO',
       CASE WHEN sieve = 12.5 THEN '{"anomaly": "inversion +0.27%"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (25, 100), (20, 95.84), (16, 94.65), (12.5, 94.92), (10, 94.06), (8, 93.67), (6.3, 92.85),
  (5, 92.39), (4, 91.97), (3.15, 91.59), (2.5, 91.35), (2, 91.21), (1.6, 91.04), (1.25, 90.88),
  (1, 90.74), (0.8, 90.59), (0.63, 90.41), (0.5, 90.09), (0.4, 89.64), (0.315, 88.8),
  (0.25, 87.46), (0.2, 84.81), (0.16, 81.33), (0.125, 72.63), (0.1, 69.16), (0.08, 66.38)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO',
       CASE WHEN sieve = 0.008 THEN '{"anomaly": "inversion +1.03%"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (0.0617, 50.34), (0.0454, 38.76), (0.0338, 27.86), (0.0224, 15.74), (0.0131, 7.9),
  (0.0076, 8.93), (0.0047, 6.64), (0.0033, 6.51), (0.0027, 6.51), (0.0024, 6.51),
  (0.002, 6.48), (0.0014, 5.78)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- ============================================================================
-- TCHITCHAO 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 99.56), (12.5, 99.56), (10, 99.56), (8, 99.43), (6.3, 99.43),
  (5, 99.14), (4, 98.96), (3.15, 98.64), (2.5, 98.42), (2, 98.17), (1.6, 97.94), (1.25, 97.66),
  (1, 97.44), (0.8, 97.15), (0.63, 96.78), (0.5, 95.9), (0.4, 94.82), (0.315, 87.48),
  (0.25, 82.36), (0.2, 71.72), (0.16, 67.23), (0.125, 62.68), (0.1, 61.43), (0.08, 60.77)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (0.0617, 56.62), (0.0454, 45.98), (0.0338, 36.66), (0.0224, 27.35), (0.0131, 26.02),
  (0.0076, 24.69), (0.0047, 23.37), (0.0033, 22.04), (0.0027, 20.71), (0.0024, 20.04),
  (0.002, 18.05), (0.0014, 15.36)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- TCHITCHAO 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NGOAPO'
FROM e, (VALUES
  (25, 100), (20, 100), (16, 100), (12.5, 100), (10, 100), (8, 99.94), (6.3, 99.87),
  (5, 99.74), (4, 99.48), (3.15, 98.96), (2.5, 98.63), (2, 98.31), (1.6, 97.98), (1.25, 97.64),
  (1, 97.33), (0.8, 96.92), (0.63, 96.33), (0.5, 94.96), (0.4, 93.37), (0.315, 90.15),
  (0.25, 85.73), (0.2, 79.41), (0.16, 73.81), (0.125, 64.93), (0.1, 60.64), (0.08, 58.36)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-NGOAPO',
       CASE WHEN sieve = 0.0076 THEN '{"anomaly": "inversion +0.07%"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (0.0617, 52.71), (0.0454, 42.88), (0.0338, 35.87), (0.0224, 28.85), (0.0131, 24.29),
  (0.0076, 24.36), (0.0047, 21.84), (0.0033, 20.45), (0.0027, 20.45), (0.0024, 19.05),
  (0.002, 19.05), (0.0014, 16.23)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- ============================================================================
-- AUDITS (6 CHECKS)
-- ============================================================================

-- CHECK 1
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
WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie'
GROUP BY s.code 
ORDER BY s.code;

-- CHECK 2
SELECT methode, COUNT(*) 
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie'
GROUP BY methode;

-- CHECK 3
WITH d AS (
  SELECT essai_id, sieve_mm, COUNT(*) c
  FROM granulometrie_points gp 
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie'
  GROUP BY essai_id, sieve_mm
) SELECT * FROM d WHERE c > 1;

-- CHECK 4
SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie'
  AND (gp.percent_passing < 0 OR gp.percent_passing > 100);

-- CHECK 5
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
  WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY delta DESC;

-- CHECK 6
SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom
FROM sondages 
WHERE source = 'NGOAPO-GOLLO Roxane Lenira Chrisie';

-- Compteur final
SELECT 
  'NGOAPO-GOLLO' AS projet,
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
WHERE s.source = 'NGOAPO-GOLLO Roxane Lenira Chrisie';

COMMIT;
