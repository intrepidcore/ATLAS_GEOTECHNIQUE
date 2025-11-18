-- ============================================================================
-- DÉTECTION ET NETTOYAGE DES DOUBLONS
-- Étape 1: Identifier les doublons avant import propre
-- ============================================================================

\echo '🔍 DÉTECTION DES DOUBLONS DANS TOUTES LES TABLES'

-- ============================================================================
-- 1. SONDAGES - Doublons par code + date_sondage
-- ============================================================================
\echo '📋 1. SONDAGES - Doublons métier (code + date_sondage):'

SELECT 
    'SONDAGES' as table_name,
    code, 
    date_sondage, 
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.sondages 
WHERE deleted_at IS NULL
GROUP BY code, date_sondage 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- Doublons par ID (ne devrait pas exister)
\echo '📋 SONDAGES - Doublons par ID:'
SELECT 
    id, 
    COUNT(*) as duplicates
FROM public.sondages 
GROUP BY id 
HAVING COUNT(*) > 1;

-- ============================================================================
-- 2. ÉCHANTILLONS - Doublons par sondage_id + depth_m
-- ============================================================================
\echo '📋 2. ÉCHANTILLONS - Doublons métier (sondage_id + depth_m):'

SELECT 
    'ECHANTILLONS' as table_name,
    sondage_id, 
    depth_m, 
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.echantillons 
WHERE deleted_at IS NULL
GROUP BY sondage_id, depth_m 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- ============================================================================
-- 3. ESSAIS_ATTERBERG - Doublons par echantillon_id
-- ============================================================================
\echo '📋 3. ESSAIS_ATTERBERG - Doublons par echantillon_id:'

SELECT 
    'ESSAIS_ATTERBERG' as table_name,
    echantillon_id, 
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.essais_atterberg 
WHERE deleted_at IS NULL
GROUP BY echantillon_id 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- ============================================================================
-- 4. ESSAIS_GEOTECHNIQUES - Doublons par sondage_id + depth_m
-- ============================================================================
\echo '📋 4. ESSAIS_GEOTECHNIQUES - Doublons métier:'

SELECT 
    'ESSAIS_GEOTECHNIQUES' as table_name,
    sondage_id, 
    depth_m, 
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.essais_geotechniques 
WHERE deleted_at IS NULL
GROUP BY sondage_id, depth_m 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- ============================================================================
-- 5. RAW_LAB_* - Doublons par code_site + depth_m + sieve_mm
-- ============================================================================
\echo '📋 5. RAW_LAB_AGS - Doublons métier:'

SELECT 
    'RAW_LAB_AGS' as table_name,
    code_site, 
    depth_m, 
    sieve_mm,
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.raw_lab_ags 
GROUP BY code_site, depth_m, sieve_mm 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

\echo '📋 6. RAW_LAB_AGT - Doublons métier:'

SELECT 
    'RAW_LAB_AGT' as table_name,
    code_site, 
    depth_m, 
    sieve_mm,
    COUNT(*) as duplicates,
    array_agg(id::text) as ids
FROM public.raw_lab_agt 
GROUP BY code_site, depth_m, sieve_mm 
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- ============================================================================
-- RÉSUMÉ GLOBAL DES DOUBLONS
-- ============================================================================
\echo '📊 RÉSUMÉ GLOBAL:'

SELECT 'TOTAL_SONDAGES' as metric, COUNT(*) as value FROM public.sondages
UNION ALL
SELECT 'TOTAL_ECHANTILLONS', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'TOTAL_ESSAIS_ATTERBERG', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'TOTAL_ESSAIS_GEOTECHNIQUES', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'TOTAL_RAW_LAB_AGS', COUNT(*) FROM public.raw_lab_ags
UNION ALL
SELECT 'TOTAL_RAW_LAB_AGT', COUNT(*) FROM public.raw_lab_agt;

-- ============================================================================
-- NETTOYAGE DES DOUBLONS (GARDER LE PLUS RÉCENT)
-- ============================================================================

\echo '🧹 NETTOYAGE DES DOUBLONS - GARDER LE PLUS RÉCENT'

-- 1. Sondages - Garder le plus récent par (code, date_sondage)
\echo '🧹 1. Nettoyage SONDAGES:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY code, date_sondage 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.sondages
  WHERE deleted_at IS NULL
)
DELETE FROM public.sondages s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 2. Échantillons - Garder le plus récent par (sondage_id, depth_m)
\echo '🧹 2. Nettoyage ÉCHANTILLONS:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY sondage_id, depth_m 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.echantillons
  WHERE deleted_at IS NULL
)
DELETE FROM public.echantillons e
USING ranked r
WHERE e.id = r.id AND r.rn > 1;

-- 3. Essais Atterberg - Garder le plus récent par echantillon_id
\echo '🧹 3. Nettoyage ESSAIS_ATTERBERG:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY echantillon_id 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.essais_atterberg
  WHERE deleted_at IS NULL
)
DELETE FROM public.essais_atterberg ea
USING ranked r
WHERE ea.id = r.id AND r.rn > 1;

-- 4. Essais Géotechniques - Garder le plus récent par (sondage_id, depth_m)
\echo '🧹 4. Nettoyage ESSAIS_GEOTECHNIQUES:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY sondage_id, depth_m 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.essais_geotechniques
  WHERE deleted_at IS NULL
)
DELETE FROM public.essais_geotechniques eg
USING ranked r
WHERE eg.id = r.id AND r.rn > 1;

-- 5. Raw Lab AGS - Garder le plus récent par (code_site, depth_m, sieve_mm)
\echo '🧹 5. Nettoyage RAW_LAB_AGS:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY code_site, depth_m, sieve_mm 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.raw_lab_ags
)
DELETE FROM public.raw_lab_ags rla
USING ranked r
WHERE rla.id = r.id AND r.rn > 1;

-- 6. Raw Lab AGT - Garder le plus récent par (code_site, depth_m, sieve_mm)
\echo '🧹 6. Nettoyage RAW_LAB_AGT:'

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY code_site, depth_m, sieve_mm 
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id
         ) AS rn
  FROM public.raw_lab_agt
)
DELETE FROM public.raw_lab_agt rlt
USING ranked r
WHERE rlt.id = r.id AND r.rn > 1;

-- ============================================================================
-- VÉRIFICATION POST-NETTOYAGE
-- ============================================================================
\echo '✅ VÉRIFICATION POST-NETTOYAGE:'

SELECT 'APRÈS_NETTOYAGE_SONDAGES' as metric, COUNT(*) as value FROM public.sondages
UNION ALL
SELECT 'APRÈS_NETTOYAGE_ECHANTILLONS', COUNT(*) FROM public.echantillons
UNION ALL
SELECT 'APRÈS_NETTOYAGE_ESSAIS_ATTERBERG', COUNT(*) FROM public.essais_atterberg
UNION ALL
SELECT 'APRÈS_NETTOYAGE_ESSAIS_GEOTECHNIQUES', COUNT(*) FROM public.essais_geotechniques
UNION ALL
SELECT 'APRÈS_NETTOYAGE_RAW_LAB_AGS', COUNT(*) FROM public.raw_lab_ags
UNION ALL
SELECT 'APRÈS_NETTOYAGE_RAW_LAB_AGT', COUNT(*) FROM public.raw_lab_agt;

-- Vérifier FK orphelins
\echo '🔍 VÉRIFICATION INTÉGRITÉ FK:'

SELECT 
    'ECHANTILLONS_ORPHELINS' as check_name,
    COUNT(*) as count
FROM public.echantillons e 
LEFT JOIN public.sondages s ON e.sondage_id = s.id 
WHERE s.id IS NULL;

\echo '✅ NETTOYAGE TERMINÉ - BASE PRÊTE POUR IMPORT PROPRE';
