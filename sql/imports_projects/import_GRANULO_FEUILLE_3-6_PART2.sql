-- ============================================================================
-- IMPORT MANUEL: Granulométrie.xlsx - Feuille 3.6 PARTIE 2 (8 localités - FINALE!)
-- ============================================================================
BEGIN;

-- Lama-tessi
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 36.26, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TESSI' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 38.45, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TESSI' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 41.68, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-LAMA-TESSI' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Pitiah
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 46.42, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-PITIAH' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 49.48, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-PITIAH' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 44.6, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-PITIAH' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Sanfatoule
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 52.81, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-SANFATOULE' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 57.5, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-SANFATOULE' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.75, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='GRANULO-SANFATOULE' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Tchalo
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 26.09, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHALO' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 29.83, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHALO' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 33.21, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHALO' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Tchamba
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 39.88, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMBA' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 44.92, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMBA' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 54.01, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMBA' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Tchamdè
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 48.51, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMDÈ' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 50.79, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMDÈ' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 57.8, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHAMDÈ' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Tchitchao
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 66.38, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHITCHAO' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 60.77, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHITCHAO' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 58.36, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-TCHITCHAO' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

-- Yade
INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 57.05, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-YADE' AND eg.depth_m=1.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 65.0, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-YADE' AND eg.depth_m=1.5 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

INSERT INTO granulometrie_points (essai_id, sieve_mm, percent_passing, methode, created_by_batch)
SELECT eg.id, 0.08, 42.49, 'tamisage', 'MD-20251103-GRANULO'
FROM essais_geotechniques eg JOIN sondages s ON s.id=eg.sondage_id 
WHERE s.code='BLEU-YADE' AND eg.depth_m=2.0 
ON CONFLICT (essai_id, sieve_mm) DO UPDATE SET percent_passing=EXCLUDED.percent_passing;

COMMIT;

-- Vérification PART2
SELECT 'PART2' AS partie, COUNT(DISTINCT s.code) AS localites, COUNT(gp.id) AS points
FROM granulometrie_points gp
JOIN essais_geotechniques eg ON eg.id=gp.essai_id
JOIN sondages s ON s.id=eg.sondage_id
WHERE gp.created_by_batch='MD-20251103-GRANULO'
  AND s.code IN ('BLEU-LAMA-TESSI','GRANULO-PITIAH','GRANULO-SANFATOULE','BLEU-TCHALO','BLEU-TCHAMBA','BLEU-TCHAMDÈ','BLEU-TCHITCHAO','BLEU-YADE');
