-- ============================================================================
-- IMPORT MANUEL: AKONDOR Tigana Messanh
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-AKONDOR
-- Localités: Anié, Nyamassila
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg (WL, IP), VBS, Granulo (AGT+AGS), Densité abs., Teneur eau, Classif
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-AKONDOR';

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('AKONDOR-ANIE', 'AKONDOR Tigana Messanh', 'MD-20251103-AKONDOR', now()),
  ('AKONDOR-NYAMASSILA', 'AKONDOR Tigana Messanh', 'MD-20251103-AKONDOR', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CRÉATION ESSAIS GÉOTECHNIQUES (WL, WP calculé, VBS)
-- ============================================================================

-- ANIE (WP = WL - IP)
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 61.56, (61.56 - 37.45), 8.0, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-ANIE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 35.08, (35.08 - 14.0), 4.8, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-ANIE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 24.19, (24.19 - 6.69), 2.0, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-ANIE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- NYAMASSILA
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 52.59, (52.59 - 27.11), 2.0, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-NYAMASSILA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 53.48, (53.48 - 29.25), 2.0, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-NYAMASSILA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 52.01, (52.01 - 30.51), 7.33, 'MD-20251103-AKONDOR'
FROM sondages s WHERE s.code = 'AKONDOR-NYAMASSILA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Densité absolue + Teneur eau)
-- ============================================================================

-- ANIE
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.53, 18.7, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.6, 6.09, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.63, 9.17, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- NYAMASSILA
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.63, 5.24, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.62, 5.84, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.62, 3.3, 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS
-- ============================================================================

-- ANIE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=61.56, IP=37.45', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin et plasticité moyenne', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=35.08, IP=14.0', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin et faible plasticité', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-2-6', 'WL=24.19, IP=6.69', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol grenu faible plasticité', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-ANIE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

-- NYAMASSILA
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=52.59, IP=27.11', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin argile de plasticité faible', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=53.48, IP=29.25', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sol fin un silt-argile de platicité faible', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=52.01, IP=30.51', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin un silt-argile de plasticité moyenne', 'Classification HRB', 'MD-20251103-AKONDOR'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AKONDOR-NYAMASSILA' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

COMMIT;
