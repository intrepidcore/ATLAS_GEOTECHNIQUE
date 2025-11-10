-- ============================================================================
-- Script d'audit : Identifier toutes les colonnes TEXT qui devraient avoir un autre type
-- Date : 2025-11-07
-- ============================================================================

-- Tables principales à auditer
SELECT '=== TABLE: sondages ===' as info;
\d sondages

SELECT '=== TABLE: echantillons ===' as info;
\d echantillons

SELECT '=== TABLE: essais_atterberg ===' as info;
\d essais_atterberg

SELECT '=== TABLE: essais_classif ===' as info;
\d essais_classif

SELECT '=== TABLE: essais_geotechniques ===' as info;
\d essais_geotechniques

SELECT '=== TABLE: essais_physiques ===' as info;
\d essais_physiques

SELECT '=== TABLE: essais_vbs ===' as info;
\d essais_vbs

SELECT '=== TABLE: adm3 ===' as info;
\d adm3

SELECT '=== TABLE: adm2 ===' as info;
\d adm2

SELECT '=== TABLE: adm1 ===' as info;
\d adm1

SELECT '=== TABLE: mailles ===' as info;
\d mailles

SELECT '=== TABLE: granulo_points ===' as info;
\d granulo_points

-- Résumé de toutes les colonnes TEXT par table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'sondages', 'echantillons', 
    'essais_atterberg', 'essais_classif', 'essais_geotechniques', 
    'essais_physiques', 'essais_vbs',
    'adm3', 'adm2', 'adm1', 'mailles', 'granulo_points'
  )
  AND data_type = 'text'
ORDER BY table_name, column_name;
