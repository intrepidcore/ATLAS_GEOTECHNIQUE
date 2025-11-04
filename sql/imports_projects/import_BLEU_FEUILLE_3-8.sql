-- ============================================================================
-- IMPORT MANUEL: bleu.xlsx - Feuille 3-8 (8 localités)
-- ============================================================================

BEGIN;

-- 1. Aképé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-AKEPE', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AKEPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 0.33, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AKEPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 0.5, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-AKEPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 2. Assahoun
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-ASSAHOUN', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ASSAHOUN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.83, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ASSAHOUN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.82, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ASSAHOUN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 2.64, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 3. Badja
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-BADJA', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BADJA') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 4.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BADJA') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 4.03, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BADJA') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 5.06, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 4. Kévé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-KEVE', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 4.02, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.61, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-KEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 1.2, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 5. Tovégan
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-TOVEGAN', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TOVEGAN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 4.55, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TOVEGAN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 4.88, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TOVEGAN') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 6.3, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 6. Tsévié blévé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-TSEVIE-BLEVE', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-BLEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.33, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-BLEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-BLEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 7. Tsévié dalavémodji
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-TSEVIE-DALAVEMODJI', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DALAVEMODJI') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.5, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DALAVEMODJI') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DALAVEMODJI') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- 8. Tsévié dévé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-TSEVIE-DEVE', 'bleu', 'MD-20251103-BLEU-3-8') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 2.33, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-TSEVIE-DEVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 0.6, 'MD-20251103-BLEU-3-8' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);

-- AUDITS
SELECT 'BLEU-3-8' AS feuille, COUNT(DISTINCT s.id) AS sondages, COUNT(DISTINCT eg.id) AS essais FROM sondages s LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id WHERE s.created_by_batch = 'MD-20251103-BLEU-3-8';

COMMIT;
