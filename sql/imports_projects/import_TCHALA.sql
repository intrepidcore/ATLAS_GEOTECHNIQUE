-- ============================================================================
-- IMPORT MANUEL: TCHALA Komla Hyacinthe
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-TCHALA
-- Type: Matériaux routiers (granulats, Proctor)
-- Données: Atterberg, Proctor, Granulo, Équivalent sable, LA, MD
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-TCHALA';

-- ============================================================================
-- 1. CRÉATION SONDAGE (matériau simple)
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at, meta)
VALUES (
  'TCHALA-MATERIAU-SIMPLE',
  'TCHALA Komla Hyacinthe',
  'MD-20251103-TCHALA',
  now(),
  '{"type": "materiau_routier", "note": "Matériau simple + concassé"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. ESSAI GÉOTECHNIQUE (WL, WP, Proctor)
-- ============================================================================

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, gamma_d_max, w_opt, proctor_type, created_by_batch, meta)
SELECT s.id, 0.0, 48.0, 24.0, 21.0, 8.6, 'normal', 'MD-20251103-TCHALA',
       jsonb_build_object('equivalent_sable', 50, 'los_angeles', 28.47, 'micro_deval', 15.63, 
                          'note', 'gamma_d_max=2.1 g/cm3 = 21 kN/m3')
FROM sondages s WHERE s.code = 'TCHALA-MATERIAU-SIMPLE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 0.0);

-- ============================================================================
-- 3. GRANULOMÉTRIE (matériau simple)
-- ============================================================================

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'TCHALA-MATERIAU-SIMPLE' AND eg.depth_m = 0.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-TCHALA'
FROM e, (VALUES
  (40, 100), (31.5, 99.28), (25, 96.91), (20, 92.74), (10, 66.94), (5, 41.82),
  (2, 31.61), (1, 30.23), (0.5, 28.68), (0.315, 26.58), (0.2, 24.0), (0.08, 20.39)
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
WHERE s.source = 'TCHALA Komla Hyacinthe'
GROUP BY s.code ORDER BY s.code;

SELECT methode, COUNT(*) FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'TCHALA Komla Hyacinthe' GROUP BY methode;

SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom FROM sondages 
WHERE source = 'TCHALA Komla Hyacinthe';

SELECT 'TCHALA' AS projet, COUNT(DISTINCT s.id) AS n_sondages, COUNT(DISTINCT eg.id) AS n_essais,
       COUNT(DISTINCT ep.id) AS n_phys, COUNT(DISTINCT ec.id) AS n_classif, COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'TCHALA Komla Hyacinthe';

COMMIT;
