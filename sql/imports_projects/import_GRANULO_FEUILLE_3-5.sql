-- ============================================================================
-- IMPORT MANUEL: Granulométrie.xlsx - Feuille 3.5 (11 localités)
-- ============================================================================
BEGIN;

-- Katore
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.49, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KATORE' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.13, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KATORE' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 52.58, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KATORE' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpadapé
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 60.36, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPADAPÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 51.76, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPADAPÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 53.47, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPADAPÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpimé (Séva)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 26.82, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-SÉVA' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 29.53, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-SÉVA' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 24.53, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-SÉVA' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpimé (Tomégbé)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 41.46, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-TOMÉGBÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 42.86, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-TOMÉGBÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 32.27, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-TOMÉGBÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpimé (Woumé)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 49.98, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-WOUMÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 53.74, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-WOUMÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 51.26, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPIMÉ-WOUMÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Kpodzi
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 69.31, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPODZI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 56.71, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPODZI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 67.3, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-KPODZI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Lavié Apédomé
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 52.9, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAVIÉ-APÉDOMÉ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 61.37, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAVIÉ-APÉDOMÉ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 53.84, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAVIÉ-APÉDOMÉ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Womé (Cascade)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 64.47, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-CASCADE' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 63.83, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-CASCADE' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.5, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-CASCADE' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Womé (Ville)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 64.43, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-VILLE' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 67.68, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-VILLE' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.12, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-WOMÉ-VILLE' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Womé (Zongo)
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 64.2, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-WOMÉ-ZONGO' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.09, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-WOMÉ-ZONGO' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.55, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-WOMÉ-ZONGO' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Zomayi
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 53.12, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ZOMAYI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 60.37, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ZOMAYI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 68.09, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-ZOMAYI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

COMMIT;

-- ============================================================================
-- VÉRIFICATIONS
-- ============================================================================

-- Compteur feuille 3.5
SELECT 'FEUILLE-3.5' AS feuille,
       COUNT(DISTINCT s.code) AS localites,
       COUNT(DISTINCT eg.id) AS essais,
       COUNT(gp.id) AS points_granulo
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id=gp.essai_id
JOIN sondages s ON s.id=eg.sondage_id
WHERE gp.created_by_batch='MD-20251103-GRANULO'
  AND s.code IN ('BLEU-KATORE','BLEU-KPADAPÉ','BLEU-KPIMÉ-SÉVA','BLEU-KPIMÉ-TOMÉGBÉ','BLEU-KPIMÉ-WOUMÉ','BLEU-KPODZI','BLEU-LAVIÉ-APÉDOMÉ','BLEU-WOMÉ-CASCADE','BLEU-WOMÉ-VILLE','GRANULO-WOMÉ-ZONGO','BLEU-ZOMAYI');
