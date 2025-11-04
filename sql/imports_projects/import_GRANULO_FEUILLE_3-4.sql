-- ============================================================================
-- IMPORT MANUEL: Granulométrie.xlsx - Feuille 3.4 (10 localités)
-- ============================================================================
BEGIN;

-- Apéssito
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.05, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-APÉSSITO' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 63.4, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-APÉSSITO' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 63.34, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-APÉSSITO' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Bohou
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 34.99, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BOHOU' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 31.48, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BOHOU' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.05, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-BOHOU' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Campement
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 23.19, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-CAMPEMENT' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 41.04, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-CAMPEMENT' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 41.83, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-CAMPEMENT' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Djidjolé
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 82.48, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DJIDJOLÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 54.74, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DJIDJOLÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 56.61, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DJIDJOLÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Doutikopé
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 35.17, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DOUTIKOPÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.19, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DOUTIKOPÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 28.89, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-DOUTIKOPÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Koudjouwdè
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 34.88, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOUDJOUWDÈ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 34.58, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOUDJOUWDÈ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 49.9, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KOUDJOUWDÈ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpawa
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 60.47, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPAWA' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 75.4, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPAWA' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 53.41, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPAWA' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Lama Feing
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 44.6, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-FEING' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 46.36, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-FEING' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 55.25, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-FEING' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Lama Tchamdè
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.72, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TCHAMDÈ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 31.16, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TCHAMDÈ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 32.34, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TCHAMDÈ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Solim
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 21.86, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-SOLIM' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 24.22, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-SOLIM' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 31.83, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-SOLIM' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

COMMIT;

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

-- Compteur feuille 3.4
SELECT 'FEUILLE-3.4' AS feuille,
       COUNT(DISTINCT s.code) AS localites,
       COUNT(DISTINCT eg.id) AS essais,
       COUNT(gp.id) AS points_granulo
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id=gp.essai_id
JOIN sondages s ON s.id=eg.sondage_id
WHERE gp.created_by_batch='MD-20251103-GRANULO'
  AND s.code IN ('BLEU-APÉSSITO','BLEU-BOHOU','BLEU-CAMPEMENT','BLEU-DJIDJOLÉ','BLEU-DOUTIKOPÉ','BLEU-KOUDJOUWDÈ','BLEU-KPAWA','BLEU-LAMA-FEING','BLEU-LAMA-TCHAMDÈ','BLEU-SOLIM');
