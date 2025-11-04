-- ============================================================================
-- IMPORT MANUEL: OUDJABITI Bassirou
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-OUDJABITI
-- Localités: Tchamba, Alibi
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg, VBS, Granulo (AGT+AGS), Densité abs., Teneur eau, Classif
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-OUDJABITI';

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('OUDJABITI-TCHAMBA', 'OUDJABITI Bassirou', 'MD-20251103-OUDJABITI', now()),
  ('OUDJABITI-ALIBI', 'OUDJABITI Bassirou', 'MD-20251103-OUDJABITI', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. ESSAIS GÉOTECHNIQUES (WL, WP, VBS)
-- ============================================================================

-- TCHAMBA
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 30.64, 17.81, 1.02, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-TCHAMBA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 34.91, 16.08, 1.04, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-TCHAMBA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 37.44, 17.14, 2.71, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-TCHAMBA'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ALIBI
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 35.03, 11.94, 4.23, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-ALIBI'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 30.79, 12.92, 1.73, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-ALIBI'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 27.14, 11.72, 1.67, 'MD-20251103-OUDJABITI'
FROM sondages s WHERE s.code = 'OUDJABITI-ALIBI'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Densité absolue + Teneur eau)
-- ============================================================================

-- TCHAMBA
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.56, 5.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.31, 5.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.73, 4.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ALIBI
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.49, 4.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.49, 4.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.44, 7.0, 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS
-- ============================================================================

-- TCHAMBA
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=30.64, IP=12.83', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol grenu argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=34.91, IP=18.83', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol grenu argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=37.44, IP=20.03', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-TCHAMBA' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

-- ALIBI
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=35.03, IP=23.09', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=30.79, IP=17.87', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=27.14, IP=15.42', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol fin argileux', 'Classification unifiée', 'MD-20251103-OUDJABITI'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'OUDJABITI-ALIBI' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

COMMIT;
