-- ============================================================================
-- IMPORT COMPLET: bleu.xlsx (76 localités VBS) - Version 2
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-BLEU-V2
-- Approche: Créer essais puis UPDATE VBS
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-BLEU-V2';

-- ============================================================================
-- FEUILLE 3-7 (12 localités) - Approche en 2 étapes
-- ============================================================================

-- Adjengré
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-ADJENGRE', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 3.0 FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 2.5 FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 2.73 FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Agotivé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-AGOTIVE', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 16.45 FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 10.18 FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 3.9 FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Apéyéyémé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-APEYEYEME', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 16.65 FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 18.07 FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 9.47 FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Kadambara
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KADAMBARA', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 8.46 FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 7.57 FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 10.67 FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Kamina Barrage
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KAMINA-BARRAGE', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 6.69 FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 10.66 FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 19.92 FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Kamina Dakré
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KAMINA-DAKRE', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 4.83 FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 15.48 FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 28.86 FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Kaniamboua
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KANIAMBOUA', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 10.9 FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 13.95 FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 5.8 FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Ountivou
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-OUNTIVOU', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 9.01 FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 11 FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 20.16 FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- Sotouboua
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-SOTOUBOUA', 'bleu', 'MD-20251103-BLEU-V2') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 1.5, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, created_by_batch) SELECT s.id, 2.0, 'MD-20251103-BLEU-V2' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
UPDATE essais_geotechniques eg SET vbs = 5.26 FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 1.0;
UPDATE essais_geotechniques eg SET vbs = 6.34 FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 1.5;
UPDATE essais_geotechniques eg SET vbs = 6.74 FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- ============================================================================
-- AUDITS
-- ============================================================================

SELECT 'BLEU-V2-FEUILLE-3-7' AS lot,
       COUNT(DISTINCT s.id) AS sondages,
       COUNT(DISTINCT eg.id) AS essais,
       COUNT(DISTINCT CASE WHEN eg.vbs IS NOT NULL THEN eg.id END) AS essais_avec_vbs
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.source = 'bleu';

COMMIT;
