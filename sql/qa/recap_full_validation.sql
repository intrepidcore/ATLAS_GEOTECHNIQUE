-- =====================================================================
-- QA GLOBAL — récapitulatif bleu.xlsx + Granulométrie.xlsx + limite.xlsx
-- Produit: tableaux PASS/FAIL + extraits d'anomalies
-- Usage:   psql -U atlas -d atlas_clean -f sql/qa/recap_full_validation.sql
-- =====================================================================

\echo '============================================================'
\echo 'QA VALIDATION - RECAP IMPORTS (bleu + Granulométrie + limite)'
\echo '============================================================'
\echo ''

-- ⚙️ Paramètres attendus
\set expected_bleu_sondages 72
\set expected_bleu_essais   213

\set expected_gran_localites 72
\set expected_gran_essais    214

\set expected_limite_localites 32
\set expected_limite_essais    94

\echo '1️⃣  COMPTEURS & COUVERTURE'
\echo '-----------------------------------------------------------'

WITH totaux AS (
  SELECT
    -- BLEU (VBS) - tous les batches BLEU
    (SELECT COUNT(DISTINCT s.id) FROM sondages s 
     JOIN essais_geotechniques eg ON eg.sondage_id=s.id
     WHERE eg.created_by_batch LIKE 'MD-20251103-BLEU%') AS bleu_sondages,
    
    (SELECT COUNT(*) FROM essais_geotechniques eg 
     WHERE eg.created_by_batch LIKE 'MD-20251103-BLEU%' AND eg.vbs IS NOT NULL) AS bleu_essais,

    -- GRANULOMÉTRIE
    (SELECT COUNT(DISTINCT s.code) FROM sondages s 
     JOIN essais_geotechniques eg ON eg.sondage_id=s.id
     JOIN granulometrie_points gp ON gp.essai_id=eg.id
     WHERE gp.created_by_batch='MD-20251103-GRANULO') AS gran_localites,
    
    (SELECT COUNT(DISTINCT eg.id) FROM essais_geotechniques eg
     JOIN granulometrie_points gp ON gp.essai_id=eg.id
     WHERE gp.created_by_batch='MD-20251103-GRANULO') AS gran_essais,

    -- LIMITE (Atterberg) - tous les essais avec WL/WP
    (SELECT COUNT(DISTINCT s.code) FROM sondages s 
     JOIN essais_geotechniques eg ON eg.sondage_id=s.id
     WHERE (eg.wl IS NOT NULL OR eg.wp IS NOT NULL)) AS limite_localites,
    
    (SELECT COUNT(*) FROM essais_geotechniques eg
     WHERE (eg.wl IS NOT NULL OR eg.wp IS NOT NULL)) AS limite_essais
)
SELECT 
  'BLEU' AS projet,
  bleu_sondages AS sondages_actual,
  :expected_bleu_sondages AS sondages_expected,
  CASE WHEN bleu_sondages = :expected_bleu_sondages THEN '✅ PASS' ELSE '❌ FAIL' END AS status_sondages,
  bleu_essais AS essais_actual,
  :expected_bleu_essais AS essais_expected,
  CASE WHEN bleu_essais = :expected_bleu_essais THEN '✅ PASS' ELSE '❌ FAIL' END AS status_essais
FROM totaux
UNION ALL
SELECT 
  'GRANULO' AS projet,
  gran_localites AS sondages_actual,
  :expected_gran_localites AS sondages_expected,
  CASE WHEN gran_localites = :expected_gran_localites THEN '✅ PASS' ELSE '❌ FAIL' END AS status_sondages,
  gran_essais AS essais_actual,
  :expected_gran_essais AS essais_expected,
  CASE WHEN gran_essais BETWEEN :expected_gran_essais-2 AND :expected_gran_essais THEN '✅ PASS' ELSE '❌ FAIL' END AS status_essais
FROM totaux
UNION ALL
SELECT 
  'LIMITE' AS projet,
  limite_localites AS sondages_actual,
  :expected_limite_localites AS sondages_expected,
  CASE WHEN limite_localites = :expected_limite_localites THEN '✅ PASS' ELSE '❌ FAIL' END AS status_sondages,
  limite_essais AS essais_actual,
  :expected_limite_essais AS essais_expected,
  CASE WHEN limite_essais = :expected_limite_essais THEN '✅ PASS' ELSE '❌ FAIL' END AS status_essais
FROM totaux;

\echo ''
\echo '2️⃣  MÉTHODES GRANULO (distribution tamisage/sédimentométrie)'
\echo '-----------------------------------------------------------'

SELECT 
  COALESCE(gp.methode, 'NULL') AS methode,
  COUNT(*) AS nb_points,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM granulometrie_points gp
WHERE gp.created_by_batch='MD-20251103-GRANULO'
GROUP BY gp.methode
ORDER BY nb_points DESC;

\echo ''
\echo '3️⃣  DOUBLONS (essai_id, sieve_mm) - DOIT ÊTRE VIDE'
\echo '-----------------------------------------------------------'

WITH dups AS (
  SELECT s.code, eg.depth_m, gp.sieve_mm, COUNT(*) AS n
  FROM granulometrie_points gp
  JOIN essais_geotechniques eg ON eg.id=gp.essai_id
  JOIN sondages s ON s.id=eg.sondage_id
  WHERE gp.created_by_batch='MD-20251103-GRANULO'
  GROUP BY s.code, eg.depth_m, gp.sieve_mm
  HAVING COUNT(*) > 1
)
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS - Aucun doublon' 
       ELSE '❌ FAIL - ' || COUNT(*) || ' doublons détectés' 
  END AS status
FROM dups
UNION ALL
SELECT code || ' @ ' || depth_m || 'm, tamis ' || sieve_mm || 'mm: ' || n || ' occurrences'
FROM dups
LIMIT 20;

\echo ''
\echo '4️⃣  BORNES % PASSING [0,100] - DOIT ÊTRE VIDE'
\echo '-----------------------------------------------------------'

WITH out_bounds AS (
  SELECT s.code, eg.depth_m, gp.sieve_mm, gp.percent_passing
  FROM granulometrie_points gp
  JOIN essais_geotechniques eg ON eg.id=gp.essai_id
  JOIN sondages s ON s.id=eg.sondage_id
  WHERE gp.created_by_batch='MD-20251103-GRANULO'
    AND (gp.percent_passing < 0 OR gp.percent_passing > 100)
)
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS - Toutes les valeurs dans [0,100]' 
       ELSE '❌ FAIL - ' || COUNT(*) || ' valeurs hors bornes' 
  END AS status
FROM out_bounds
UNION ALL
SELECT code || ' @ ' || depth_m || 'm, tamis ' || sieve_mm || 'mm: ' || percent_passing || '%'
FROM out_bounds
LIMIT 20;

\echo ''
\echo '5️⃣  MONOTONICITÉ (% passant décroissant) - Anomalies à documenter'
\echo '-----------------------------------------------------------'

WITH monotone_check AS (
  SELECT
    s.code, eg.id AS essai_id, eg.depth_m, gp.sieve_mm, gp.percent_passing,
    LAG(gp.percent_passing) OVER (PARTITION BY eg.id ORDER BY gp.sieve_mm DESC) AS prev_pct,
    LAG(gp.sieve_mm) OVER (PARTITION BY eg.id ORDER BY gp.sieve_mm DESC) AS prev_sieve
  FROM granulometrie_points gp
  JOIN essais_geotechniques eg ON eg.id=gp.essai_id
  JOIN sondages s ON s.id=eg.sondage_id
  WHERE gp.created_by_batch='MD-20251103-GRANULO'
),
inversions AS (
  SELECT code, essai_id, depth_m, sieve_mm, percent_passing, prev_sieve, prev_pct,
         (percent_passing - prev_pct) AS delta
  FROM monotone_check
  WHERE prev_pct IS NOT NULL
    AND percent_passing > prev_pct
)
SELECT 
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS - Aucune inversion' 
       ELSE '⚠️  WARNING - ' || COUNT(*) || ' inversions détectées (à documenter dans meta)' 
  END AS status
FROM inversions
UNION ALL
SELECT code || ' @ ' || depth_m || 'm: tamis ' || prev_sieve || '→' || sieve_mm || 
       'mm, %passant ' || prev_pct || '→' || percent_passing || ' (Δ=' || delta || ')'
FROM inversions
ORDER BY 1
LIMIT 50;

\echo ''
\echo '6️⃣  GÉOLOCALISATION - Modes & Grid Codes'
\echo '-----------------------------------------------------------'

WITH geoloc_stats AS (
  SELECT 
    CASE 
      WHEN eg.created_by_batch LIKE 'MD-20251103-BLEU%' THEN 'BLEU'
      WHEN eg.wl IS NOT NULL OR eg.wp IS NOT NULL THEN 'LIMITE'
      WHEN EXISTS(SELECT 1 FROM granulometrie_points gp WHERE gp.essai_id=eg.id AND gp.created_by_batch='MD-20251103-GRANULO') THEN 'GRANULO'
      ELSE 'OTHER'
    END AS projet,
    s.location_mode,
    COUNT(DISTINCT s.id) AS nb_sondages,
    SUM(CASE WHEN s.grid_code IS NULL THEN 1 ELSE 0 END) AS grid_nulls
  FROM sondages s
  JOIN essais_geotechniques eg ON eg.sondage_id=s.id
  WHERE eg.created_by_batch LIKE 'MD-20251103-%'
     OR (eg.wl IS NOT NULL OR eg.wp IS NOT NULL)
     OR EXISTS(SELECT 1 FROM granulometrie_points gp WHERE gp.essai_id=eg.id AND gp.created_by_batch='MD-20251103-GRANULO')
  GROUP BY projet, s.location_mode
),
spread_check AS (
  SELECT COUNT(DISTINCT s.id) AS nb_spread
  FROM sondages s
  JOIN essais_geotechniques eg ON eg.sondage_id=s.id
  WHERE (eg.created_by_batch LIKE 'MD-20251103-%' OR (eg.wl IS NOT NULL OR eg.wp IS NOT NULL))
    AND s.location_mode = 'spread'
),
grid_null_adm AS (
  SELECT COUNT(DISTINCT s.id) AS nb_null_grid
  FROM sondages s
  JOIN essais_geotechniques eg ON eg.sondage_id=s.id
  WHERE (eg.created_by_batch LIKE 'MD-20251103-%' OR (eg.wl IS NOT NULL OR eg.wp IS NOT NULL))
    AND s.location_mode = 'adm_random_cell'
    AND s.grid_code IS NULL
)
SELECT 
  CASE 
    WHEN (SELECT nb_spread FROM spread_check) = 0 
     AND (SELECT nb_null_grid FROM grid_null_adm) = 0 
    THEN '✅ PASS - Aucun spread, tous les adm_random_cell ont grid_code'
    WHEN (SELECT nb_spread FROM spread_check) > 0 
    THEN '❌ FAIL - ' || (SELECT nb_spread FROM spread_check) || ' sondages en mode spread'
    ELSE '❌ FAIL - ' || (SELECT nb_null_grid FROM grid_null_adm) || ' adm_random_cell sans grid_code'
  END AS status
UNION ALL
SELECT '--- Détail par projet et mode ---'
UNION ALL
SELECT projet || ': ' || location_mode || ' = ' || nb_sondages || ' sondages' ||
       CASE WHEN grid_nulls > 0 THEN ' (⚠️  ' || grid_nulls || ' sans grid_code)' ELSE '' END
FROM geoloc_stats
ORDER BY 1;

\echo ''
\echo '============================================================'
\echo '✅ VALIDATION TERMINÉE'
\echo '============================================================'
