-- BLEU.XLSX FEUILLES 3-9 à 3-12 (PART 1: 30 localités)
BEGIN;
-- 3-9: Abobo
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-ABOBO', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ABOBO') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 3.74, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ABOBO') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.4, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ABOBO') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 4.1, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Adétikopé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-ADETIKOPE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADETIKOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 6.56, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADETIKOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 5.27, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-ADETIKOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 3.58, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Apéhéme
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-APEHEME', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEHEME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 2.0, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEHEME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.33, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-APEHEME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 3.33, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Belgique
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-BELGIQUE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BELGIQUE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.82, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BELGIQUE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.78, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-BELGIQUE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 5.5, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Dalavé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-DALAVE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DALAVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 5.2, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DALAVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 7.4, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DALAVE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 10.3, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Dikamé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-DIKAME', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DIKAME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.32, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DIKAME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 1.4, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DIKAME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 2.18, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Djagblé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-DJAGBLE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DJAGBLE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.32, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DJAGBLE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 1.4, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DJAGBLE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 2.18, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Dzogbékomé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-DZOGBEKOME', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DZOGBEKOME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 3.33, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DZOGBEKOME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 3.33, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-DZOGBEKOME') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 4.0, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Gbatopé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-GBATOPE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-GBATOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.0, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-GBATOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 4.0, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-GBATOPE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 1.6, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
-- 3-9: Hahotoé
INSERT INTO sondages (code, source, created_by_batch) VALUES ('BLEU-HAHOTOE', 'bleu', 'MD-20251103-BLEU') ON CONFLICT (code) DO NOTHING;
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-HAHOTOE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.0, 1.28, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.0);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-HAHOTOE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 1.5, 1.7, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 1.5);
WITH s AS (SELECT id FROM sondages WHERE code = 'BLEU-HAHOTOE') INSERT INTO essais_geotechniques (sondage_id, depth_m, vbs, created_by_batch) SELECT s.id, 2.0, 1.88, 'MD-20251103-BLEU' FROM s WHERE NOT EXISTS (SELECT 1 FROM essais_geotechniques eg WHERE eg.sondage_id = s.id AND eg.depth_m = 2.0);
COMMIT;
