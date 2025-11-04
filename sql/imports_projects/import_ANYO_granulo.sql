-- ============================================================================
-- ANYO - GRANULOMÉTRIE (AGT + AGS)
-- ============================================================================
-- Suite du fichier import_ANYO.sql

BEGIN;

-- ============================================================================
-- APEYEME 1m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 99.98), (4, 99.98), (3.15, 99.97), (2.5, 99.87),
  (2, 99.48), (1.6, 98.63), (1.25, 97.07), (1, 95.53), (0.8, 93.59), (0.63, 91.49),
  (0.5, 88.13), (0.4, 84.94), (0.315, 81.1), (0.25, 77.35), (0.2, 72.97), (0.16, 69.42),
  (0.125, 65.76), (0.1, 60.54), (0.08, 58.23)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 56), (0.0515, 46.05), (0.0372, 41.67), (0.0239, 38.75), (0.0141, 33.65),
  (0.0083, 28.53), (0.0052, 25.61), (0.0037, 22.97), (0.003, 22.68), (0.0026, 21.96),
  (0.0021, 21.25), (0.0015, 20.06)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- APEYEME 1.5m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 100), (4, 100), (3.15, 99.99), (2.5, 99.93),
  (2, 99.62), (1.6, 98.8), (1.25, 97.35), (1, 95.85), (0.8, 93.95), (0.63, 91.86),
  (0.5, 88.33), (0.4, 84.84), (0.315, 78.56), (0.25, 74.92), (0.2, 70.81), (0.16, 68.07),
  (0.125, 64.94), (0.1, 59.97), (0.08, 55.71)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO',
       CASE WHEN sieve = 0.0015 THEN '{"anomaly": "MD source: 28.84, possible inversion"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (0.0728, 49), (0.0515, 35), (0.0372, 28.94), (0.0239, 27.6), (0.0141, 23.57),
  (0.0083, 19.54), (0.0052, 15), (0.0037, 15), (0.003, 14.15), (0.0026, 13.48),
  (0.0021, 13.51), (0.0015, 28.84)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- ============================================================================
-- APEYEME 2m (AGT + AGS)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ANYO'
FROM e, (VALUES
  (8, 100), (6.3, 100), (5, 100), (4, 100), (3.15, 99.99), (2.5, 99.86),
  (2, 99.5), (1.6, 98.64), (1.25, 97.45), (1, 95.94), (0.8, 94.02), (0.63, 92.09),
  (0.5, 88.89), (0.4, 85.36), (0.315, 81.27), (0.25, 77.88), (0.2, 74), (0.16, 70.54),
  (0.125, 67.03), (0.1, 63.38), (0.08, 56.32)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ANYO'
FROM e, (VALUES
  (0.0728, 50.34), (0.0515, 41), (0.0372, 35.59), (0.0239, 32.81), (0.0141, 28.63),
  (0.0083, 24.45), (0.0052, 21.68), (0.0037, 20.29), (0.003, 19.18), (0.0026, 18.9),
  (0.0021, 17.78), (0.0015, 16.8)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- DJOGBEKOPE & BADOME - Données granulo simplifiées (à compléter si besoin)
-- ============================================================================
-- Note: Le MD contient des tableaux détaillés pour ces localités
-- Pour l'instant, on importe les essais de base (déjà fait dans import_ANYO.sql)

-- ============================================================================
-- AUDITS
-- ============================================================================

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
