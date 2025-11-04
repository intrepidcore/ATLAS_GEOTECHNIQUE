-- ============================================================================
-- IMPORT MANUEL: NABIYOU Warou
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-NABIYOU
-- Localité: NABIYOU (GPS: 10.3186, 0.497)
-- Profondeurs: 1.0m, 3.4m
-- Données: Atterberg, VBS, Proctor, Granulo (AGT), passants, eg
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-NABIYOU';

-- ============================================================================
-- 1. CRÉATION SONDAGE (avec GPS exact)
-- ============================================================================

INSERT INTO sondages (code, source, location_mode, geom, created_by_batch, created_at)
VALUES (
  'NABIYOU-01',
  'NABIYOU Warou',
  'exact',
  ST_Transform(ST_SetSRID(ST_MakePoint(0.497, 10.3186), 4326), 25231),
  'MD-20251103-NABIYOU',
  now()
)
ON CONFLICT (code) DO UPDATE 
SET source = EXCLUDED.source, 
    location_mode = EXCLUDED.location_mode,
    geom = EXCLUDED.geom;

-- ============================================================================
-- 2. ESSAIS GÉOTECHNIQUES (WL, WP, VBS, Proctor, eg)
-- ============================================================================

-- 1.0m
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, gamma_d_max, w_opt, proctor_type, created_by_batch, meta)
SELECT s.id, 1.0, 47.9, 39.6, 5.42, 16.12, 22.9, 'normal', 'MD-20251103-NABIYOU',
       jsonb_build_object('eg', 5.33, 'laboratory', 'Lab C - Sokodé', 'norm', 'NF P94-051',
                          'passant_80um', 80.3, 'passant_2mm', 89.8, 'passant_20mm', 97.0)
FROM sondages s WHERE s.code = 'NABIYOU-01'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

-- 3.4m
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, gamma_d_max, w_opt, proctor_type, created_by_batch, meta)
SELECT s.id, 3.4, 45.5, 22.9, 5.27, 15.74, 21.2, 'normal', 'MD-20251103-NABIYOU',
       jsonb_build_object('eg', 3.88, 'laboratory', 'Lab C - Sokodé', 'norm', 'NF P94-051',
                          'passant_80um', 85.4, 'passant_2mm', 96.2, 'passant_20mm', 95.5)
FROM sondages s WHERE s.code = 'NABIYOU-01'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 3.4);

-- ============================================================================
-- 3. GRANULOMÉTRIE (AGT - Profondeur 2m mentionnée dans le MD)
-- ============================================================================
-- Note: Le MD mentionne "Profondeur 2m" mais pas d'essai de base à 2m dans Sheet 1
-- On crée l'essai de base pour stocker la granulo

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch, meta)
SELECT s.id, 2.0, 40.0, 14.0, 5.03, 'MD-20251103-NABIYOU',
       jsonb_build_object('source_sheet', 'Annexe', 'note', 'Valeurs de l''Annexe')
FROM sondages s WHERE s.code = 'NABIYOU-01'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

WITH e AS (
  SELECT eg.id FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.code = 'NABIYOU-01' AND eg.depth_m = 2.0
)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT e.id, sieve, pct, 'tamisage', 'MD-20251103-NABIYOU'
FROM e, (VALUES
  (0.08, 47.87), (0.1, 51.37), (0.125, 55.93), (0.16, 62.39), (0.2, 69.51),
  (0.25, 77.73), (0.315, 83.56), (0.4, 88.3), (0.5, 91.37), (0.63, 94.15),
  (0.8, 96.55), (1, 98.19), (1.25, 99.08), (1.6, 99.59), (2, 99.81),
  (2.5, 99.84), (3.15, 99.95), (4, 99.99)
) AS t(sieve, pct)
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing = EXCLUDED.percent_passing;

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
WHERE s.source = 'NABIYOU Warou'
GROUP BY s.code 
ORDER BY s.code;

-- CHECK 2: Méthodes granulo
SELECT methode, COUNT(*) 
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NABIYOU Warou'
GROUP BY methode;

-- CHECK 3: Doublons
WITH d AS (
  SELECT essai_id, sieve_mm, COUNT(*) c
  FROM granulometrie_points gp 
  JOIN essais_geotechniques eg ON eg.id = gp.essai_id
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NABIYOU Warou'
  GROUP BY essai_id, sieve_mm
) SELECT * FROM d WHERE c > 1;

-- CHECK 4: Bornes
SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing
FROM granulometrie_points gp 
JOIN essais_geotechniques eg ON eg.id = gp.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NABIYOU Warou'
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
  WHERE s.source = 'NABIYOU Warou'
)
SELECT code, depth_m, sieve_mm, percent_passing, prev_pct, (percent_passing - prev_pct) AS delta
FROM r 
WHERE prev_pct IS NOT NULL AND percent_passing > prev_pct
ORDER BY delta DESC;

-- CHECK 6: Géoloc
SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom,
       ST_X(geom) as lon, ST_Y(geom) as lat
FROM sondages 
WHERE source = 'NABIYOU Warou';

-- Compteur final
SELECT 
  'NABIYOU Warou' AS projet,
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
WHERE s.source = 'NABIYOU Warou';

COMMIT;
