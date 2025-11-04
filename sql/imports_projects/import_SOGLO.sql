-- ============================================================================
-- IMPORT MANUEL: SOGLO FERDINAND
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-SOGLO
-- Localités: Konsogou T1, Konsogou T2, Nassablé, Kontongbongue
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg, VBS, Granulo (AGT+AGS partiel), Teneur eau, Classif
-- Note: 36 feuilles, import partiel des données principales
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-SOGLO';

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('SOGLO-KONSOGOU-T1', 'SOGLO FERDINAND', 'MD-20251103-SOGLO', now()),
  ('SOGLO-KONSOGOU-T2', 'SOGLO FERDINAND', 'MD-20251103-SOGLO', now()),
  ('SOGLO-NASSABLE', 'SOGLO FERDINAND', 'MD-20251103-SOGLO', now()),
  ('SOGLO-KONTONGBONGUE', 'SOGLO FERDINAND', 'MD-20251103-SOGLO', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. ESSAIS GÉOTECHNIQUES (WL, WP, VBS)
-- ============================================================================

-- KONSOGOU T1
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 23.0, 10.48, 0.99, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T1'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 32.0, 12.52, 0.99, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T1'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 31.0, 19.56, 0.97, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T1'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- KONSOGOU T2
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 27.8, 12.89, 1.44, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T2'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 20.6, 13.81, 0.86, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T2'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 25.0, 19.81, 0.86, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONSOGOU-T2'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- NASSABLE
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 27.9, 15.77, 0.82, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-NASSABLE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 20.6, 14.26, 0.7, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-NASSABLE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 28.0, 15.96, 0.87, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-NASSABLE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- KONTONGBONGUE
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 64.0, 19.44, 5.43, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONTONGBONGUE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 47.2, 27.92, 1.45, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONTONGBONGUE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 38.75, 29.89, 2.89, 'MD-20251103-SOGLO'
FROM sondages s WHERE s.code = 'SOGLO-KONTONGBONGUE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Teneur eau uniquement)
-- ============================================================================

-- KONSOGOU T1
INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 3.865, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T1' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 8.777, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T1' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 8.829, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T1' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- KONSOGOU T2
INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 3.603, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T2' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 4.286, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T2' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 6.147, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T2' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- NASSABLE
INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 3.856, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-NASSABLE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 3.246, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-NASSABLE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 5.85, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-NASSABLE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- KONTONGBONGUE
INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 59.005, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONTONGBONGUE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 9.374, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONTONGBONGUE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, teneur_eau_pct, created_by_batch)
SELECT eg.id, 8.445, 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONTONGBONGUE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS (simplifiées)
-- ============================================================================

-- KONSOGOU T1 (toutes profondeurs: sol argileux / sol fin)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'sol argileux', 'Classification HRB', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T1'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin', 'Classification unifiée', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T1'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

-- KONSOGOU T2
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'sol argileux', 'Classification HRB', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T2'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin', 'Classification unifiée', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONSOGOU-T2'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

-- NASSABLE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'sol argileux', 'Classification HRB', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-NASSABLE'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin', 'Classification unifiée', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-NASSABLE'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

-- KONTONGBONGUE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'sol argileux', 'Classification HRB', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONTONGBONGUE'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin', 'Classification unifiée', 'MD-20251103-SOGLO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'SOGLO-KONTONGBONGUE'
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

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
WHERE s.source = 'SOGLO FERDINAND'
GROUP BY s.code ORDER BY s.code;

SELECT code, location_mode, grid_code, geom IS NOT NULL as has_geom FROM sondages 
WHERE source = 'SOGLO FERDINAND';

SELECT 'SOGLO' AS projet, COUNT(DISTINCT s.id) AS n_sondages, COUNT(DISTINCT eg.id) AS n_essais,
       COUNT(DISTINCT ep.id) AS n_phys, COUNT(DISTINCT ec.id) AS n_classif, COUNT(DISTINCT gp.id) AS n_granulo
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id
LEFT JOIN essais_classif ec ON ec.essai_id = eg.id
LEFT JOIN granulometrie_points gp ON gp.essai_id = eg.id
WHERE s.source = 'SOGLO FERDINAND';

COMMIT;
