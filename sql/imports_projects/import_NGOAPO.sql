-- ============================================================================
-- IMPORT MANUEL: NGOAPO-GOLLO Roxane Lenira Chrisie
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-NGOAPO
-- Localités: Yade, Tchitchao
-- Profondeurs: 1.0m, 1.5m, 2.0m
-- Données: Atterberg, VBS, Granulo (AGT+AGS), Densité abs., Teneur eau, Classif
-- Note: MD mentionne "profondeur 5" mais contexte indique 2m
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-NGOAPO';

-- ============================================================================
-- 1. CRÉATION SONDAGES
-- ============================================================================

INSERT INTO sondages (code, source, created_by_batch, created_at)
VALUES 
  ('NGOAPO-YADE', 'NGOAPO-GOLLO Roxane Lenira Chrisie', 'MD-20251103-NGOAPO', now()),
  ('NGOAPO-TCHITCHAO', 'NGOAPO-GOLLO Roxane Lenira Chrisie', 'MD-20251103-NGOAPO', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. ESSAIS GÉOTECHNIQUES (WL, WP, VBS)
-- ============================================================================

-- YADE
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 61.5, 23.0, 7.29, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-YADE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 37.0, 24.0, 7.94, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-YADE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 34.5, 22.0, 6.84, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-YADE'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- TCHITCHAO
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.0, 26.33, 18.0, 6.8, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-TCHITCHAO'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 1.5, 48.5, 17.0, 8.62, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-TCHITCHAO'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, vbs, created_by_batch)
SELECT s.id, 2.0, 52.0, 15.0, 6.68, 'MD-20251103-NGOAPO'
FROM sondages s WHERE s.code = 'NGOAPO-TCHITCHAO'
AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- ============================================================================
-- 3. ESSAIS PHYSIQUES (Densité absolue + Teneur eau)
-- ============================================================================

-- YADE
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.46, 18.52, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.32, 11.66, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.6, 5.89, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- TCHITCHAO
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.44, 4.59, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.47, 4.26, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.5
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, created_by_batch)
SELECT eg.id, 2.34, 10.14, 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 2.0
AND NOT EXISTS (SELECT 1 FROM essais_physiques ep WHERE ep.essai_id = eg.id);

-- ============================================================================
-- 4. CLASSIFICATIONS
-- ============================================================================

-- YADE
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=61.5, IP=38.5', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol argileux peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=37.0, IP=13.0', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol argileux peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-6', 'WL=34.5, IP=12.5', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol argileux peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-YADE' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

-- TCHITCHAO
INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-4', 'WL=26.33, IP=8.33', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol argileux peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=48.5, IP=31.5', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol argileux peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 1.5
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'AASHTO', 'A-7-6', 'WL=52.0, IP=37.0', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

INSERT INTO essais_classif (essai_id, systeme, classe, reason, created_by_batch)
SELECT eg.id, 'USCS', 'Sol peu plastique', 'Classification unifiée', 'MD-20251103-NGOAPO'
FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code = 'NGOAPO-TCHITCHAO' AND eg.depth_m = 2.0
ON CONFLICT (essai_id, systeme) DO UPDATE SET classe=EXCLUDED.classe, reason=EXCLUDED.reason;

COMMIT;
