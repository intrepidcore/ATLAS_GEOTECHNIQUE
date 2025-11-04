-- ============================================================================
-- IMPORT MANUEL: AG TCHESSI pas terminer
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-AGTCHESSI
-- Localités: Bohou, Lama Feing, Lama Tchamdé
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg, VBS, Granulo (AGT+AGS), Densité abs., Teneur eau, Classif
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('AGTCHESSI-BOHOU', 'AG TCHESSI pas terminer', 'MD-20251103-AGTCHESSI', now()),
  ('AGTCHESSI-LAMA-FEING', 'AG TCHESSI pas terminer', 'MD-20251103-AGTCHESSI', now()),
  ('AGTCHESSI-LAMA-TCHANDE', 'AG TCHESSI pas terminer', 'MD-20251103-AGTCHESSI', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. CRÉATION ESSAIS GÉOTECHNIQUES
-- ============================================================================

-- BOHOU (ip est auto-calculé: wl - wp)
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 32.88, 10.94, 4.49, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-BOHOU'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 36.53, 11.82, 3.12, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-BOHOU'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 55.27, 15.85, 3.83, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-BOHOU'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- LAMA FEING
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 44.32, 26.64, 8.75, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-FEING'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 35.18, 20.58, 9.74, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-FEING'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 42.01, 35.16, 9.28, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-FEING'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- LAMA TCHANDE
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 21.67, 11.39, 4.51, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 28.03, 14.13, 3.78, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 34.36, 16.27, 7.78, 'MD-20251103-AGTCHESSI'
FROM sondages s WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Densité absolue + Teneur eau)
-- ============================================================================

-- BOHOU
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.48, 8.8, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.51, 9.94, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.34, 13.25, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- LAMA FEING
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.42, 2.77, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.12, 3.59, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.04, 3.52, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- LAMA TCHANDE
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.53, 3.58, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.56, 2.07, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.3, 5.004, 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS
-- ============================================================================

-- BOHOU
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=32.88, IP=21.94', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sable argileux grenu', 'Classification HRB', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=36.53, IP=24.71', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sable argileux grenu', 'Classification HRB', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=55.27, IP=39.42', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sable argileux grenu', 'Classification HRB', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-BOHOU' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

-- LAMA FEING
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=44.32, IP=17.68', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Argile peu plastique', 'VBS=8.75', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=35.18, IP=14.6', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Limon peu plastique', 'VBS=9.74', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=42.01, IP=6.85', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Limon peu plastique', 'VBS=9.28', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-FEING' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

-- LAMA TCHANDE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=21.67, IP=10.29', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Argile peu plastique', 'VBS=4.51', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-2-6', 'WL=28.03, IP=13.84', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'sable argileux grenu', 'Classification HRB', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=34.36, IP=18.09', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'AASHTO');

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Argile peu plastique', 'VBS=7.78', 'MD-20251103-AGTCHESSI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'AGTCHESSI-LAMA-TCHANDE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_classif ec WHERE ec.essai_id = eg.id AND ec.systeme = 'USCS');

COMMIT;
