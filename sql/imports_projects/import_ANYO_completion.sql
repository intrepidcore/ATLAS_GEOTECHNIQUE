-- ============================================================================
-- ANYO - COMPLÉTION DJOGBEKOPE & BADOME (GRANULOMÉTRIE)
-- ============================================================================
-- Complétion du projet ANYO Akouete jean-paul

BEGIN;

-- ============================================================================
-- DJOGBEKOPE 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 99.98), (4, 99.98), (3.15, 99.97), (2.5, 99.87),
  (2, 99.48), (1.6, 98.63), (1.25, 97.07), (1, 95.53), (0.8, 93.59), (0.63, 91.49),
  (0.5, 88.13), (0.4, 84.94), (0.315, 81.1), (0.25, 77.35), (0.2, 72.97), (0.16, 70.14),
  (0.125, 67.2), (0.1, 64.86), (0.08, 60.61)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 55), (0.0515, 47.93), (0.0372, 43.37), (0.0239, 40.34), (0.0141, 35.02),
  (0.0083, 29.69), (0.0052, 26.66), (0.0037, 23.91), (0.003, 23.61), (0.0026, 22.86),
  (0.0021, 22.12), (0.0015, 20.88)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- DJOGBEKOPE 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 100), (4, 100), (3.15, 99.99), (2.5, 99.93),
  (2, 99.62), (1.6, 98.8), (1.25, 97.35), (1, 95.85), (0.8, 93.95), (0.63, 91.86),
  (0.5, 88.33), (0.4, 84.84), (0.315, 80.09), (0.25, 75.73), (0.2, 71.62), (0.16, 68.88),
  (0.125, 65.75), (0.1, 59.35), (0.08, 52.23)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 45), (0.0515, 32), (0.0372, 30), (0.0239, 25.88), (0.0141, 22.1),
  (0.0083, 18.32), (0.0052, 15), (0.0037, 14), (0.003, 13.27), (0.0026, 12.64),
  (0.0021, 12.67), (0.0015, 12.04)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- DJOGBEKOPE 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 100), (4, 100), (3.15, 99.99), (2.5, 99.86),
  (2, 99.5), (1.6, 98.64), (1.25, 97.45), (1, 95.94), (0.8, 94.02), (0.63, 92.09),
  (0.5, 88.89), (0.4, 85.36), (0.315, 80.56), (0.25, 77.17), (0.2, 73.29), (0.16, 69.83),
  (0.125, 66.31), (0.1, 56.44), (0.08, 47.15)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 46), (0.0515, 33), (0.0372, 29.84), (0.0239, 27.51), (0.0141, 24),
  (0.0083, 20.5), (0.0052, 18.18), (0.0037, 17.01), (0.003, 16.08), (0.0026, 15.85),
  (0.0021, 14.91), (0.0015, 14.09)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- BADOME 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 99.7), (5, 99.67), (4, 99.4), (3.15, 99.02), (2.5, 98.68),
  (2, 98.25), (1.6, 97.52), (1.25, 96.47), (1, 95.62), (0.8, 94.72), (0.63, 93.82),
  (0.5, 91.3), (0.4, 92.51), (0.315, 89.74), (0.25, 88.24), (0.2, 86.43), (0.16, 85.06),
  (0.125, 83.46), (0.1, 76.86), (0.08, 71.93)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 64.01), (0.0515, 57.03), (0.0372, 44.12), (0.0239, 39.41), (0.0141, 35.75),
  (0.0083, 31.19), (0.0052, 26.98), (0.0037, 24.79), (0.003, 21.11), (0.0026, 20.39),
  (0.0021, 19.3), (0.0015, 15.63)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- BADOME 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 99.6), (5, 99.43), (4, 99.14), (3.15, 98.55), (2.5, 98.54),
  (2, 98.1), (1.6, 97.69), (1.25, 97.44), (1, 97.27), (0.8, 97.16), (0.63, 96.25),
  (0.5, 95.34), (0.4, 94.69), (0.315, 94.11), (0.25, 93.67), (0.2, 90.02), (0.16, 85.23),
  (0.125, 80.04), (0.1, 70.14), (0.08, 60.09)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 49.34), (0.0515, 35.03), (0.0372, 20.27), (0.0239, 15.13), (0.0141, 10.11),
  (0.0083, 8.26), (0.0052, 7.23), (0.0037, 6.21), (0.003, 6.18), (0.0026, 5.02),
  (0.0021, 4.53), (0.0015, 4.21)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- BADOME 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 99.71), (5, 99.05), (4, 98.63), (3.15, 98.53), (2.5, 97.96),
  (2, 97.56), (1.6, 97.24), (1.25, 94.52), (1, 94.32), (0.8, 93.49), (0.63, 92.46),
  (0.5, 91.3), (0.4, 90.45), (0.315, 89.52), (0.25, 88.96), (0.2, 88.41), (0.16, 88.02),
  (0.125, 87.66), (0.1, 76.01), (0.08, 67.12)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO',
       CASE WHEN sieve = 0.0026 THEN '{"anomaly": "inversion mineure +2.42%"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (0.0728, 50.34), (0.0515, 41.21), (0.0372, 29.01), (0.0239, 22.18), (0.0141, 19.05),
  (0.0083, 12.1), (0.0052, 10.07), (0.0037, 5.61), (0.003, 4.9), (0.0026, 5.65),
  (0.0021, 3.23), (0.0015, 2.26)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- ============================================================================
-- AUDITS (6 CHECKS)
-- ============================================================================

-- CHECK 1: Totaux
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
WHERE s.source = 'ANYO Akouete jean-paul'
GROUP BY s.code 
ORDER BY s.code;

-- CHECK 2: Méthodes granulo
SELECT methode, COUNT(*) 
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'ANYO Akouete jean-paul'
GROUP BY methode;

-- CHECK 3: Doublons
WITH d AS (
  SELECT essai_id, sieve_mm, COUNT(*) c
  FROM granulometrie_points gp 
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'ANYO Akouete jean-paul'
  GROUP BY essai_id, sieve_mm
) SELECT * FROM d WHERE c > 1;

-- CHECK 4: Bornes
SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'ANYO Akouete jean-paul'
  AND (gp.percent_passing < 0 OR gp.percent_passing > 100);

-- CHECK 5: Monotonicité
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
  WHERE s.source = 'ANYO Akouete jean-paul'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY delta DESC;

-- CHECK 6: Géoloc
SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom
FROM sondages 
WHERE source = 'ANYO Akouete jean-paul';

-- Compteur final
SELECT 
  'ANYO Akouete jean-paul' AS projet,
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
WHERE s.source = 'ANYO Akouete jean-paul';

COMMIT;
