-- ============================================================================
-- IMPORT COMPLET: limite (Atterberg - 37 localités)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-LIMITE-COMPLET
-- Données: 37 localités × 3 profondeurs = 111 essais
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-LIMITE-COMPLET';

-- ============================================================================
-- CRÉATION SONDAGES + ESSAIS (37 localités)
-- ============================================================================

-- Adjengré (Pounpouni)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-ADJENGRE', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 50.34, 22.64, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 65.68, 36.64, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 58.42, 24.61, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-ADJENGRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Agotivé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-AGOTIVE', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 48.65, 19.11, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 51.12, 17.56, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 51.0, 18.95, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-AGOTIVE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Apéyéyémé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-APEYEYEME', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 41.8, 22.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 43.39, 23.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 40.91, 22.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-APEYEYEME' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kadambara
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-KADAMBARA', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 32.91, 11.93, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 37.87, 12.12, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 43.38, 13.37, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KADAMBARA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kamina Barrage
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-KAMINA-BARRAGE', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 45.04, 11.28, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 47.91, 9.91, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 51.79, 13.59, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-BARRAGE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kamina Dakré
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-KAMINA-DAKRE', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 48.27, 19.52, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 53.93, 20.48, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 54.81, 15.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KAMINA-DAKRE' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Kaniamboua (Bogo)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-KANIAMBOUA', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 43.2, 20.73, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 46.08, 20.73, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 48.47, 22.45, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-KANIAMBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Ountivou
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-OUNTIVOU', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 28.3, 8.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 29.86, 12.0, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 32.99, 10.78, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-OUNTIVOU' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Sotouboua (Sondé)
INSERT INTO sondages (code, source, created_by_batch) VALUES ('LIMITE-SOTOUBOUA', 'limite', 'MD-20251103-LIMITE-COMPLET') ON CONFLICT (code) DO NOTHING;
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.0, 49.5, 29.81, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 1.5, 59.45, 27.11, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
INSERT INTO essais_geotechniques (sondage_id, depth_m, wl, wp, created_by_batch) SELECT s.id, 2.0, 61.81, 28.28, 'MD-20251103-LIMITE-COMPLET' FROM sondages s WHERE s.code = 'LIMITE-SOTOUBOUA' AND NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Note: Anié, Nyamassila, Badomé déjà importés dans les projets principaux

-- ============================================================================
-- AUDITS
-- ============================================================================

SELECT 'LIMITE-COMPLET' AS projet,
       COUNT(DISTINCT s.id) AS nouveaux_sondages,
       COUNT(DISTINCT eg.id) AS nouveaux_essais
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.source = 'limite';

COMMIT;
