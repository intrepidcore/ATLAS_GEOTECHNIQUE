-- ============================================================================
-- IMPORT MANUEL: ADOTE Adote emmanuel
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-ADOTE
-- Localités: OGARO, Batbougou, Nanousongue
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Granulométrie uniquement (AGT + AGS partiels)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CRÉATION SONDAGES (si absents)
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('ADOTE-OGARO', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now()),
  ('ADOTE-BATBOUGOU', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now()),
  ('ADOTE-NANOUSONGUE', 'ADOTE Adote emmanuel', 'MD-20251103-ADOTE', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CRÉATION ESSAIS GÉOTECHNIQUES (si absents)
-- ============================================================================

-- OGARO
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch)
SELECT s.id, d.depth, 'MD-20251103-ADOTE'
FROM sondages s
CROSS JOIN (VALUES (1.0), (1.5), (2.0)) AS d(depth)
WHERE s.code = 'ADOTE-OGARO'
  AND NOT EXISTS (
    SELECT 1 FROM essais_geotechniques eg 
    WHERE eg.sondage_id = s.id AND eg.depth_m = d.depth
  );

-- BATBOUGOU
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch)
SELECT s.id, d.depth, 'MD-20251103-ADOTE'
FROM sondages s
CROSS JOIN (VALUES (1.0), (1.5), (2.0)) AS d(depth)
WHERE s.code = 'ADOTE-BATBOUGOU'
  AND NOT EXISTS (
    SELECT 1 FROM essais_geotechniques eg 
    WHERE eg.sondage_id = s.id AND eg.depth_m = d.depth
  );

-- NANOUSONGUE
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch)
SELECT s.id, d.depth, 'MD-20251103-ADOTE'
FROM sondages s
CROSS JOIN (VALUES (1.0), (1.5), (2.0)) AS d(depth)
WHERE s.code = 'ADOTE-NANOUSONGUE'
  AND NOT EXISTS (
    SELECT 1 FROM essais_geotechniques eg 
    WHERE eg.sondage_id = s.id AND eg.depth_m = d.depth
  );

-- ============================================================================
-- 3. GRANULOMÉTRIE: OGARO (AGT uniquement)
-- ============================================================================

-- OGARO 1m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 100), (8, 100), (6.3, 99.81), (2.5, 96.56), (1.25, 93.78),
  (1, 93.37), (0.8, 92.82), (0.63, 92.09), (0.4, 87.64), (0.315, 80.13), (0.25, 67.3),
  (0.16, 31.24), (0.15, 12.49), (0.1, 4.53), (0.08, 0.72)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- OGARO 1.5m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 100), (8, 96.48), (6.3, 92.98), (2.5, 75.08), (1.25, 69.52),
  (1, 68.88), (0.8, 68.22), (0.63, 67.46), (0.4, 63.73), (0.315, 58.04), (0.25, 48.6),
  (0.16, 22.79), (0.15, 11.13), (0.1, 3.73), (0.08, 0.74)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- OGARO 2m
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-OGARO' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (20, 100), (12.5, 96.34), (8, 91.38), (6.3, 87.75), (2.5, 59.48), (1.25, 49.58),
  (1, 48.71), (0.8, 47.94), (0.63, 47.17), (0.4, 43.95), (0.315, 39.11), (0.25, 30.71),
  (0.16, 12.96), (0.15, 5.16), (0.1, 1.82), (0.08, 0.24)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- 4. GRANULOMÉTRIE: BATBOUGOU (AGT + AGS)
-- ============================================================================

-- BATBOUGOU 1m AGT
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (16, 100), (12.5, 99.26), (8, 97.63), (6.3, 96.15), (5, 94.45), (3.15, 91.54),
  (2.5, 90.52), (1, 88.88), (0.8, 88.67), (0.63, 88.49), (0.4, 87.68), (0.315, 85.26),
  (0.25, 80.02), (0.16, 49.22), (0.15, 16.77), (0.1, 6.87), (0.08, 1.73)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- BATBOUGOU 1m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0591, 0.4273), (0.0423, 0.3465), (0.027, 0.2658), (0.0197, 0.2254),
  (0.0137, 0.1446), (0.0098, 0.1042), (0.0069, 0.1042), (0.0057, 0.0643),
  (0.004, 0.0647), (0.0033, 0.0253), (0.0028, 0.0253), (0.0023, 0.023), (0.0016, 0.0609)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- BATBOUGOU 1.5m AGT
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (16, 100), (12.5, 100), (8, 100), (6.3, 99.72), (5, 99.52), (3.15, 99.2),
  (2.5, 98.79), (1, 97.31), (0.8, 96.95), (0.63, 96.61), (0.4, 96.65), (0.315, 94.2),
  (0.25, 90.96), (0.16, 71.38), (0.15, 34.14), (0.1, 13.91), (0.08, 2.7)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- BATBOUGOU 1.5m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0563, 1.2392), (0.0406, 1.0496), (0.0263, 0.7967), (0.0188, 0.6703),
  (0.0134, 0.5438), (0.0093, 0.7967), (0.0068, 0.4174), (0.0056, 0.3549),
  (0.0039, 0.3549), (0.0032, 0.3564), (0.0028, 0.294), (0.0023, 0.291), (0.0016, 0.285)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- BATBOUGOU 2m AGT (ATTENTION: inversion détectée 0.315mm vs 0.25mm)
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch, meta)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE', 
       CASE WHEN sieve IN (0.315, 0.25, 0.16) THEN '{"anomaly": "possible inversion in source data"}'::jsonb ELSE NULL END
FROM e, (VALUES
  (16, 100), (12.5, 100), (8, 100), (6.3, 100), (5, 99.95), (3.15, 99.63),
  (2.5, 99.5), (1, 98.51), (0.8, 97.61), (0.63, 96.59), (0.4, 94.22), 
  (0.315, 66.09), (0.25, 94.22), (0.16, 66.09), (0.15, 20.74), (0.1, 9.76), (0.08, 3.41)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET 
  percent_passing = EXCLUDED.percent_passing,
  meta = EXCLUDED.meta;

-- BATBOUGOU 2m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-BATBOUGOU' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0565, 1.8368), (0.0402, 1.7553), (0.0256, 1.6738), (0.0183, 1.5108),
  (0.0131, 1.3478), (0.0093, 1.378), (0.0067, 1.1033), (0.0055, 1.0218),
  (0.0039, 0.9419), (0.0032, 0.8613), (0.0028, 0.8613), (0.0023, 0.7798), (0.0016, 0.7757)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- 5. GRANULOMÉTRIE: NANOUSONGUE (AGT + AGS)
-- ============================================================================

-- NANOUSONGUE 1m AGT
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 98.72), (12.5, 89.34), (8, 68.03), (6.3, 56.01), (4, 35.99),
  (3.15, 25.44), (2.5, 20.48), (1.25, 14.91), (1, 14.26), (0.8, 13.8), (0.63, 11.98),
  (0.4, 11.43), (0.25, 10.36), (0.1, 1.5), (0.08, 0.29)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- NANOUSONGUE 1m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0517, 0.1088), (0.0368, 0.1026), (0.0235, 0.0902), (0.0167, 0.084),
  (0.012, 0.0716), (0.0085, 0.0654), (0.006, 0.0654), (0.0049, 0.0653),
  (0.0035, 0.0531), (0.0029, 0.0531), (0.0025, 0.047), (0.002, 0.0469), (0.0014, 0.0529)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- NANOUSONGUE 1.5m AGT
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 100), (12.5, 93.37), (8, 67.3), (6.3, 53.42), (4, 30.7),
  (3.15, 20.93), (2.5, 15.31), (1.25, 10.35), (1, 10.1), (0.8, 9.81), (0.63, 9.62),
  (0.4, 9.25), (0.25, 8.08), (0.15, 3), (0.1, 1), (0.08, 0.18)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- NANOUSONGUE 1.5m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 1.5
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0484, 0.0824), (0.0344, 0.0788), (0.0219, 0.0751), (0.0157, 0.0678),
  (0.0112, 0.0642), (0.0079, 0.0605), (0.0056, 0.0568), (0.0046, 0.0569),
  (0.0033, 0.0532), (0.0027, 0.0496), (0.0023, 0.0497), (0.0019, 0.046), (0.0014, 0.0458)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- NANOUSONGUE 2m AGT
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (25, 100), (20, 100), (12.5, 92.7), (8, 75.91), (6.3, 62.76), (4, 43.17),
  (3.15, 33.52), (2.5, 28.12), (1.25, 22.39), (1, 21.73), (0.8, 21.23), (0.63, 20.85),
  (0.4, 20.01), (0.25, 17.94), (0.15, 4.87), (0.1, 1.64), (0.08, 0.22)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- NANOUSONGUE 2m AGS
WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'ADOTE-NANOUSONGUE' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'sedimentometrie', 'MD-20251103-ADOTE'
FROM e, (VALUES
  (0.0523, 0.1034), (0.0372, 0.0986), (0.0235, 0.0986), (0.0169, 0.089),
  (0.012, 0.0842), (0.0085, 0.0794), (0.0061, 0.0796), (0.005, 0.0698),
  (0.0035, 0.0698), (0.0029, 0.0699), (0.0025, 0.0652), (0.002, 0.065), (0.0014, 0.0649)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

-- ============================================================================
-- 6. AUDITS
-- ============================================================================

-- Vue d'ensemble par sondage
SELECT 
  s.code, 
  COUNT(DISTINCT eg.id) AS n_essais,
  COUNT(DISTINCT gp.id) AS n_points_granulo,
  MIN(gp.sieve_mm) AS tamis_min,
  MAX(gp.sieve_mm) AS tamis_max
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'ADOTE Adote emmanuel'
GROUP BY s.code 
ORDER BY s.code;

-- Détection inversions (granulo non monotone)
WITH r AS (
  SELECT 
    eg.sondage_id,
    s.code,
    eg.depth_m,
    gp.essai_id, 
    gp.sieve_mm, 
    gp.percent_passing,
    LAG(gp.percent_passing) OVER (PARTITION BY gp.essai_id ORDER BY gp.sieve_mm DESC) AS prev_pct
  FROM granulometrie_points gp
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'ADOTE Adote emmanuel'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct,
       (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY code, depth_m, sieve_mm DESC;

-- Compteurs finaux
SELECT 
  'ADOTE Adote emmanuel' AS projet,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT eg.id) AS n_essais,
  COUNT(DISTINCT gp.id) AS n_points_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'ADOTE Adote emmanuel';

COMMIT;
