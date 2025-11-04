-- ============================================================================
-- IMPORT MANUEL: bleu.xlsx - Feuille 3-7 (12 localités)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-BLEU-3-7
-- Approche: INSERT direct avec toutes les valeurs
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-BLEU-3-7';

-- ============================================================================
-- FEUILLE 3-7: 12 localités
-- ============================================================================

-- 1. Adjengré (Pounpouni)
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-ADJENGRE', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADJENGRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 3.0, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADJENGRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 2.5, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADJENGRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 2.73, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 2. Agotivé
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-AGOTIVE', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AGOTIVE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 16.45, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AGOTIVE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 10.18, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AGOTIVE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 3.9, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 3. Apéyéyémé
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-APEYEYEME', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEYEYEME')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 16.65, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEYEYEME')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 18.07, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEYEYEME')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 9.47, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 4. Kadambara
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-KADAMBARA', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KADAMBARA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 8.46, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KADAMBARA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 7.57, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KADAMBARA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 10.67, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 5. Kamina Barrage
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-KAMINA-BARRAGE', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-BARRAGE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 6.69, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-BARRAGE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 10.66, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-BARRAGE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 19.92, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 6. Kamina Dakré
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-KAMINA-DAKRE', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-DAKRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 4.83, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-DAKRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 15.48, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KAMINA-DAKRE')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 20.0, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Note: VBS=28.86 dépasse la limite de 20, plafonné à 20 et noté en meta
UPDATE essais_geotechniques eg
SET meta = COALESCE(eg.meta, '{}'::jsonb) || '{"vbs_original": 28.86, "note": "Valeur plafonnée à 20 (contrainte DB)"}'::jsonb
FROM sondages s
WHERE s.code = 'BLEU-KAMINA-DAKRE' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- 7. Kaniamboua (Bago)
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-KANIAMBOUA', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KANIAMBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 10.9, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KANIAMBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 13.95, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KANIAMBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 5.8, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 8. Ountivou
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-OUNTIVOU', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-OUNTIVOU')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 9.01, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-OUNTIVOU')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 11.0, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-OUNTIVOU')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 20.0, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Note: VBS=20.16 dépasse la limite, plafonné
UPDATE essais_geotechniques eg
SET meta = COALESCE(eg.meta, '{}'::jsonb) || '{"vbs_original": 20.16, "note": "Valeur plafonnée à 20"}'::jsonb
FROM sondages s
WHERE s.code = 'BLEU-OUNTIVOU' AND eg.sondage_id = s.id AND eg.depth_m = 2.0;

-- 9. Sotouboua (Sondè)
INSERT INTO sondages (code, source, created_by_batch) 
VALUES ('BLEU-SOTOUBOUA', 'bleu', 'MD-20251103-BLEU-3-7') 
ON CONFLICT (code) DO NOTHING;

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-SOTOUBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.0, 5.26, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-SOTOUBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 1.5, 6.34, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);

WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-SOTOUBOUA')
INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch)
SELECT s.id, 2.0, 6.74, 'MD-20251103-BLEU-3-7' FROM s
WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- Note: Anié, Nyamassila, Badomé déjà dans projets principaux (mis à jour via import_BLEU_RECAP.sql)

-- ============================================================================
-- AUDITS (6 CHECKS)
-- ============================================================================

-- CHECK 1: Totaux
SELECT
  (SELECT COUNT(*) FROM sondages s WHERE s.source='bleu') AS n_sondages,
  (SELECT COUNT(*) FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id WHERE s.source='bleu') AS n_essais,
  (SELECT COUNT(*) FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id WHERE s.source='bleu' AND eg.vbs IS NOT NULL) AS n_avec_vbs;

-- CHECK 6: Géoloc (zéro spread)
SELECT location_mode, COUNT(*) FROM sondages
WHERE source='bleu'
GROUP BY location_mode;

-- Compteur final feuille 3-7
SELECT 'BLEU-FEUILLE-3-7' AS feuille,
       COUNT(DISTINCT s.id) AS sondages,
       COUNT(DISTINCT eg.id) AS essais,
       MIN(eg.vbs) AS vbs_min,
       MAX(eg.vbs) AS vbs_max
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.created_by_batch = 'MD-20251103-BLEU-3-7';

COMMIT;
