-- ============================================================================
-- NICABOU Ninsao Vianney - GRANULOMÉTRIE Tekpo
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-NICABOU-GRANULO

-- TEKPO 1m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NICABOU-GRANULO'
FROM e, (VALUES
  (40, 100), (31.5, 100), (20, 100), (10, 100), (5, 100), (2.5, 99.93),
  (1.25, 99.48), (0.63, 91.92), (0.315, 71.64), (0.16, 52.24), (0.08, 45.89),
  (0.0555, 40.57), (0.04, 39.47), (0.0305, 37.82), (0.0193, 35.76), (0.012, 33.7),
  (0.0069, 31.91), (0.0043, 30.71)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- TEKPO 1.5m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NICABOU-GRANULO'
FROM e, (VALUES
  (40, 100), (31.5, 100), (20, 100), (10, 100), (5, 100), (2.5, 100),
  (1.25, 99.6), (0.63, 92.58), (0.315, 71.53), (0.16, 51.32), (0.08, 44.68),
  (0.0563, 41.27), (0.041, 38.98), (0.0315, 36.41), (0.02, 33.41), (0.012, 30.41),
  (0.0072, 27.99), (0.0046, 26.56)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- TEKPO 2m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NICABOU-GRANULO'
FROM e, (VALUES
  (40, 100), (31.5, 100), (20, 100), (10, 100), (5, 100), (2.5, 99.99),
  (1.25, 99.53), (0.63, 93.1), (0.315, 75.19), (0.16, 58.95), (0.08, 53.1),
  (0.0615, 49.54)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- CONTRÔLE
SELECT 'NICABOU' as projet, COUNT(*) as total_points
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney';

-- ============================================================================
-- RÉSUMÉ: NICABOU Tekpo 3 profondeurs × ~15 points = ~45 points
-- ============================================================================
