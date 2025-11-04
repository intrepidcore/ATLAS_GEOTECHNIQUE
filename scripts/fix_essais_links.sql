-- ============================================================================
-- Script de correction: Lier les essais orphelins aux sondages
-- ============================================================================
-- Problème: Les essais ont été importés mais sondage_id = NULL
-- Solution: Lier par code_sondage = code du sondage
-- ============================================================================

-- 1. Diagnostic: Compter les essais orphelins
SELECT 
    '🔍 DIAGNOSTIC' as etape,
    COUNT(*) as n_essais_orphelins,
    COUNT(DISTINCT type_essai) as n_types
FROM essais 
WHERE sondage_id IS NULL 
  AND deleted_at IS NULL;

-- 2. Aperçu des correspondances possibles (par code exact)
SELECT 
    '📋 CORRESPONDANCES EXACTES' as etape,
    COUNT(*) as n_correspondances
FROM essais e
JOIN sondages s ON UPPER(TRIM(e.code_sondage)) = UPPER(TRIM(s.code))
WHERE e.sondage_id IS NULL 
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL;

-- 3. Exemples de correspondances (5 premiers)
SELECT 
    '📝 EXEMPLES' as etape,
    e.id as essai_id,
    e.type_essai,
    e.code_sondage as code_essai,
    s.id as sondage_id,
    s.code as code_sondage
FROM essais e
JOIN sondages s ON UPPER(TRIM(e.code_sondage)) = UPPER(TRIM(s.code))
WHERE e.sondage_id IS NULL 
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL
LIMIT 5;

-- ============================================================================
-- 4. CORRECTION: Lier les essais par code exact
-- ============================================================================
-- ⚠️ DÉCOMMENTER LA LIGNE SUIVANTE POUR EXÉCUTER LA CORRECTION
-- BEGIN;

UPDATE essais e
SET sondage_id = s.id,
    updated_at = NOW()
FROM sondages s
WHERE e.sondage_id IS NULL
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND UPPER(TRIM(e.code_sondage)) = UPPER(TRIM(s.code));

-- Afficher le résultat
SELECT 
    '✅ RÉSULTAT' as etape,
    COUNT(*) as n_essais_lies
FROM essais
WHERE sondage_id IS NOT NULL
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ⚠️ DÉCOMMENTER LA LIGNE SUIVANTE POUR VALIDER
-- COMMIT;

-- ============================================================================
-- 5. Vérification post-correction
-- ============================================================================

-- Compter les essais par sondage
SELECT 
    '📊 ESSAIS PAR SONDAGE' as etape,
    s.code,
    COUNT(e.id) as n_essais,
    COUNT(DISTINCT e.type_essai) as n_types_essais
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.code
HAVING COUNT(e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;

-- Vérifier GRANULO-PITIAH spécifiquement
SELECT 
    '🔎 GRANULO-PITIAH' as etape,
    s.code,
    s.source,
    COUNT(e.id) as n_essais,
    COUNT(CASE WHEN e.type_essai = 'atterberg' THEN 1 END) as n_atterberg,
    COUNT(CASE WHEN e.type_essai = 'granulo' THEN 1 END) as n_granulo,
    COUNT(CASE WHEN e.type_essai = 'proctor' THEN 1 END) as n_proctor,
    COUNT(CASE WHEN e.type_essai = 'vbs' THEN 1 END) as n_vbs
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.code LIKE '%PITIAH%'
GROUP BY s.code, s.source;

-- Compter les essais encore orphelins
SELECT 
    '⚠️ ORPHELINS RESTANTS' as etape,
    COUNT(*) as n_orphelins,
    type_essai
FROM essais
WHERE sondage_id IS NULL 
  AND deleted_at IS NULL
GROUP BY type_essai;

-- ============================================================================
-- 6. (Optionnel) Correspondances par similarité si des orphelins restent
-- ============================================================================
-- Activer l'extension pg_trgm si pas déjà fait
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trouver les correspondances par similarité (>60%)
/*
SELECT 
    '🔗 SIMILARITÉ' as etape,
    e.id as essai_id,
    e.type_essai,
    e.code_sondage as code_essai,
    s.id as sondage_id,
    s.code as code_sondage,
    similarity(e.code_sondage, s.code) as sim
FROM essais e
CROSS JOIN sondages s
WHERE e.sondage_id IS NULL 
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND similarity(e.code_sondage, s.code) > 0.6
ORDER BY sim DESC
LIMIT 20;
*/

-- ============================================================================
-- INSTRUCTIONS D'UTILISATION:
-- ============================================================================
-- 1. Exécuter d'abord les sections 1-3 pour diagnostic
-- 2. Vérifier les exemples de correspondances
-- 3. Décommenter BEGIN et COMMIT (lignes 46 et 61)
-- 4. Exécuter la section 4 pour faire la correction
-- 5. Vérifier avec la section 5
-- ============================================================================
