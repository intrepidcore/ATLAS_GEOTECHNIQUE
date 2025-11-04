-- ============================================================================
-- IMPORT COMPLET: bleu.xlsx (76 localités VBS)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-BLEU-COMPLET
-- Données: VBS pour 76 localités × 3 profondeurs
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-BLEU-COMPLET';

-- ============================================================================
-- FEUILLE 3-7 (12 localités)
-- ============================================================================

-- Adjengré (Pounpouni)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-ADJENGRE', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 3.0, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 2.5, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 2.73, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Agotivé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-AGOTIVE', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 16.45, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 10.18, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 3.9, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Apéyéyémé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-APEYEYEME', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 16.65, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 18.07, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 9.47, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kadambara
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KADAMBARA', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 8.46, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 7.57, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 10.67, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kamina Barrage
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KAMINA-BARRAGE', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 6.69, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 10.66, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 19.92, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kamina Dakré
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KAMINA-DAKRE', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 4.83, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 15.48, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 28.86, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kaniamboua (Bago)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KANIAMBOUA', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 10.9, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 13.95, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 5.8, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Ountivou
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-OUNTIVOU', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 9.01, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 11, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 20.16, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Sotouboua (Sondè)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-SOTOUBOUA', 'bleu', 'MD-20251103-BLEU-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 5.26, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 6.34, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 6.74, 'MD-20251103-BLEU-COMPLET' FROM sondages s WHERE s.code = 'BLEU-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Note: Anié, Nyamassila, Badomé déjà dans projets principaux (mis à jour via import_BLEU_RECAP.sql)

-- ============================================================================
-- AUDITS PARTIELS (Feuille 3-7)
-- ============================================================================

SELECT 'BLEU-3-7' AS feuille,
       COUNT(DISTINCT s.id) AS nouveaux_sondages,
       COUNT(DISTINCT eg.id) AS nouveaux_essais
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.source = 'bleu' AND s.code LIKE 'BLEU-%';

COMMIT;
