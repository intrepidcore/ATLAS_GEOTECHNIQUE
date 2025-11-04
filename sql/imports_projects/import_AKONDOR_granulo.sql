-- ============================================================================
-- AKONDOR - GRANULOMÉTRIE (AGT + AGS)
-- ============================================================================
-- Suite du fichier import_AKONDOR.sql
-- Exécuter APRÈS import_AKONDOR.sql

BEGIN;

-- ============================================================================
-- ANIE 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (31.5, 100), (20, 0), (10, 100), (5, 96.74), (2.5, 88.61), (1.25, 81.78),
  (0.63, 78.81), (0.315, 75.9), (0.16, 71.54), (0.08, 63.74)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.076, 59.97), (0.0543, 44.16), (0.0385, 41.9), (0.0145, 32.87),
  (0.0084, 24.74), (0.0052, 19.32), (0.0046, 14.95), (0.0016, 5.89)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- ANIE 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (31.5, 100), (20, 90.55), (10, 73.35), (5, 69.66), (2.5, 65.15), (1.25, 60.09),
  (0.63, 57.09), (0.315, 54.02), (0.16, 46.97), (0.08, 44.92)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.076, 38.43), (0.0543, 32.16), (0.0385, 30.6), (0.0145, 22.76),
  (0.0084, 16.81), (0.0052, 13.37), (0.0046, 10.43), (0.0016, 4.15)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- ANIE 2m (AGT + AGS) - ATTENTION: valeur 32025 corrigée en 32.025
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR',
       CASE WHEN sieve = 0.08 THEN '{"anomaly": "MD source: 32025, corrigé en 32.025"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (31.5, 100), (20, 100), (10, 100), (5, 91.59), (2.5, 82.98), (1.25, 66.45),
  (0.63, 53.07), (0.315, 43.1), (0.16, 34.05), (0.08, 32.025)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.076, 26.14), (0.0543, 24.87), (0.0385, 23.6), (0.0145, 18.45),
  (0.0084, 13.89), (0.0052, 10.85), (0.0046, 8.23), (0.0016, 3.28)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- NYAMASSILA 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (31.15, 100), (20, 97.66), (10, 95.45), (5, 87.44), (2.5, 73.21), (1.25, 60.17),
  (0.63, 54.62), (0.315, 47.81), (0.16, 40.45), (0.08, 34.71)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.078, 29.38), (0.0563, 24.63), (0.0403, 17.98), (0.0255, 17.35), (0.015, 14.18),
  (0.0086, 10.38), (0.0053, 7.21), (0.0049, 4.15), (0.0016, 4.08), (0.001, 1.01)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- NYAMASSILA 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (31.15, 100), (20, 100), (10, 100), (5, 99.19), (2.5, 95.94), (1.25, 91.5),
  (0.63, 86.49), (0.315, 77.87), (0.16, 66.76), (0.08, 56.3)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.078, 48.68), (0.0563, 44.0), (0.0403, 38.38), (0.0255, 27.14), (0.015, 26.21),
  (0.0086, 25.27), (0.0053, 20.05), (0.0049, 15.21), (0.0016, 14.99), (0.001, 10.77)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- NYAMASSILA 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (31.15, 100), (20, 100), (10, 100), (5, 98.6), (2.5, 96.04), (1.25, 92.72),
  (0.63, 88.89), (0.315, 80.49), (0.16, 68.15), (0.08, 55.6)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-AKONDOR'
FROM e, (VALUES
  (0.078, 48.9), (0.0563, 38.92), (0.0403, 32.27), (0.0255, 30.37), (0.015, 28.0),
  (0.0086, 25.15), (0.0053, 20.82), (0.0049, 15.43), (0.0016, 10.95), (0.001, 6.2)
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
WHERE s.source = 'AKONDOR Tigana Messanh'
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
  WHERE s.source = 'AKONDOR Tigana Messanh'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY delta DESC;

-- Compteurs finaux
SELECT 
  'AKONDOR Tigana Messanh' AS projet,
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
WHERE s.source = 'AKONDOR Tigana Messanh';

COMMIT;
