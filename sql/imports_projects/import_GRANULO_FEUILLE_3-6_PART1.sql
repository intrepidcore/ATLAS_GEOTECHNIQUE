-- ============================================================================
-- IMPORT MANUEL: Granulométrie.xlsx - Feuille 3.6 PARTIE 1 (9 localités)
-- ============================================================================
BEGIN;

-- Akié
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 50.94, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-AKIÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 52.3, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-AKIÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 57.81, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-AKIÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Alibi
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.98, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ALIBI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.67, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ALIBI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 51.27, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ALIBI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Bassar (Kpankissi)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 44.24, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BASSAR-KPANKISSI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 54.02, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BASSAR-KPANKISSI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 64.81, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BASSAR-KPANKISSI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Bitchabé
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 48.52, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BITCHABÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 31.43, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BITCHABÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.3, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BITCHABÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Dimouri
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 49.36, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DIMOURI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.44, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DIMOURI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.88, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DIMOURI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kabou (okpandoupo)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.85, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KABOU' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 36.36, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KABOU' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 39.89, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KABOU' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Komah
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 40.92, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOMAH' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 42.53, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOMAH' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 44.56, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOMAH' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Korbongou
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 56.74, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KORBONGOU' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 54.47, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KORBONGOU' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 36.13, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KORBONGOU' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kparatao
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 25.8, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPARATAO' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 22.35, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPARATAO' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 21.78, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPARATAO' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

COMMIT;

-- Vérification PART1
SELECT 'PART1' AS partie, COUNT(DISTINCT s.code) AS localites, COUNT(gp.id) AS points
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id=gp.essai_id
JOIN sondages s ON s.id=eg.sondage_id
WHERE gp.created_by_batch='MD-20251103-GRANULO'
  AND s.code IN ('GRANULO-AKIÉ','BLEU-ALIBI','BLEU-BASSAR-KPANKISSI','BLEU-BITCHABÉ','BLEU-DIMOURI','BLEU-KABOU','BLEU-KOMAH','BLEU-KORBONGOU','BLEU-KPARATAO');
