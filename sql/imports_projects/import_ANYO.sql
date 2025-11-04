-- ============================================================================
-- IMPORT MANUEL: ANYO Akouete jean-paul
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-ANYO
-- Localités: Apeyeme, Djogbekope, Badome
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg (WL, WP), VBS, Granulo (AGT+AGS), Densité abs., Teneur eau, Classif
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-ANYO';

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('ANYO-APEYEME', 'ANYO Akouete jean-paul', 'MD-20251103-ANYO', now()),
  ('ANYO-DJOGBEKOPE', 'ANYO Akouete jean-paul', 'MD-20251103-ANYO', now()),
  ('ANYO-BADOME', 'ANYO Akouete jean-paul', 'MD-20251103-ANYO', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CRÉATION ESSAIS GÉOTECHNIQUES (WL, WP, VBS)
-- ============================================================================

-- APEYEME
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 41.8, 22.0, 0.7, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-APEYEME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 43.39, 23.0, 0.79, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-APEYEME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 40.91, 22.0, 0.78, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-APEYEME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- DJOGBEKOPE
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 46.25, 23.6, 1.95, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-DJOGBEKOPE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 44.49, 19.8, 1.93, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-DJOGBEKOPE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 41.64, 19.0, 1.87, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-DJOGBEKOPE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- BADOME
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 69.96, 37.0, 5.71, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-BADOME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 37.74, 19.0, 6.96, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-BADOME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 46.5, 31.0, 7.79, 'MD-20251103-ANYO'
FROM sondages s WHERE s.code = 'ANYO-BADOME'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Densité absolue + Teneur eau)
-- ============================================================================

-- APEYEME
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.17, 8.09, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.27, 7.88, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.18, 7.25, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- DJOGBEKOPE
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.59, 7.3, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.57, 8.17, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.6, 8.48, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- BADOME
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.27, 13.79, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.4, 4.39, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.47, 2.46, 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS
-- ============================================================================

-- APEYEME
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=41.8, IP=19.8, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=43.39, IP=20.39, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=40.91, IP=18.91, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-APEYEME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

-- DJOGBEKOPE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=46.25, IP=22.65, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=44.49, IP=24.8, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=41.64, IP=22.6, Sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol grenu argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-DJOGBEKOPE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

-- BADOME
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-5', 'WL=69.96, IP=32.96, SOL ARGILEUX', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin silteux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=37.74, IP=18.74, sol argileux', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin argileux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-5', 'WL=46.5, IP=15.5, SOL ARGILEUX', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin silteux', 'Classification unifiée', 'MD-20251103-ANYO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'ANYO-BADOME' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

COMMIT;
