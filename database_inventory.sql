-- ============================================================================
-- SCRIPT D'INVENTAIRE COMPLET DE LA BASE ATLAS
-- À exécuter dans psql ou pgAdmin pour obtenir l'état actuel
-- ============================================================================

-- 1) LISTER TOUTES LES TABLES GÉOTECHNIQUES
-- ============================================================================
\echo '=== 1. INVENTAIRE DES TABLES GÉOTECHNIQUES ==='

SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname IN ('public', 'atlas')
  AND tablename IN (
    'sondages', 'mailles', 'echantillons', 
    'essais_atterberg', 'essais_classif', 'essais_geotechniques',
    'essais_physiques', 'essais_proctor', 'essais_vbs',
    'granulo_points', 'granulometrie_points',
    'raw_lab_ags', 'raw_lab_agt', 'raw_lab_atterberg',
    'ref_types_essais', 'classifications',
    'geocode_suggestions'
  )
ORDER BY schemaname, tablename;

-- 2) STRUCTURE DÉTAILLÉE DE CHAQUE TABLE
-- ============================================================================
\echo '=== 2. STRUCTURE DES COLONNES ==='

SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN c.data_type = 'USER-DEFINED' AND c.udt_name = 'geometry' THEN
            (SELECT type || ',' || srid 
             FROM geometry_columns gc 
             WHERE gc.f_table_schema = t.table_schema 
               AND gc.f_table_name = t.table_name 
               AND gc.f_geometry_column = c.column_name)
        ELSE NULL
    END as geometry_info
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema IN ('public', 'atlas')
  AND t.table_name IN (
    'sondages', 'mailles', 'echantillons', 
    'essais_atterberg', 'essais_classif', 'essais_geotechniques',
    'essais_physiques', 'essais_proctor', 'essais_vbs',
    'granulo_points', 'granulometrie_points',
    'raw_lab_ags', 'raw_lab_agt', 'raw_lab_atterberg',
    'ref_types_essais', 'classifications',
    'geocode_suggestions'
  )
ORDER BY t.table_schema, t.table_name, c.ordinal_position;

-- 3) CONTRAINTES (PK, FK, UNIQUE, CHECK)
-- ============================================================================
\echo '=== 3. CONTRAINTES ==='

SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    CASE 
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN
            ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ')'
        ELSE NULL
    END as references
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name 
    AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema IN ('public', 'atlas')
  AND tc.table_name IN (
    'sondages', 'mailles', 'echantillons', 
    'essais_atterberg', 'essais_classif', 'essais_geotechniques',
    'essais_physiques', 'essais_proctor', 'essais_vbs',
    'granulo_points', 'granulometrie_points',
    'raw_lab_ags', 'raw_lab_agt', 'raw_lab_atterberg',
    'ref_types_essais', 'classifications',
    'geocode_suggestions'
  )
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4) INDEX SPATIAUX ET GÉOMÉTRIES
-- ============================================================================
\echo '=== 4. GÉOMÉTRIES ET INDEX SPATIAUX ==='

-- Colonnes géométriques
SELECT 
    f_table_schema,
    f_table_name,
    f_geometry_column,
    coord_dimension,
    srid,
    type
FROM geometry_columns
WHERE f_table_schema IN ('public', 'atlas')
ORDER BY f_table_schema, f_table_name;

-- Index spatiaux (GIST)
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname IN ('public', 'atlas')
  AND indexdef LIKE '%gist%'
ORDER BY schemaname, tablename;

-- 5) STATISTIQUES DES GÉOMÉTRIES
-- ============================================================================
\echo '=== 5. STATISTIQUES GÉOMÉTRIES ==='

-- Sondages - statut géométrique
SELECT 
    'sondages' as table_name,
    COUNT(*) as total_rows,
    COUNT(geom) as with_geom,
    COUNT(*) - COUNT(geom) as without_geom,
    ROUND(100.0 * COUNT(geom) / COUNT(*), 2) as pct_with_geom,
    COUNT(DISTINCT location_mode) as distinct_location_modes,
    COUNT(DISTINCT location_accuracy) as distinct_accuracies
FROM sondages
WHERE deleted_at IS NULL;

-- Détail par mode de localisation
SELECT 
    location_mode,
    location_accuracy,
    COUNT(*) as count,
    COUNT(geom) as with_geom,
    ROUND(100.0 * COUNT(geom) / COUNT(*), 2) as pct_with_geom
FROM sondages 
WHERE deleted_at IS NULL
GROUP BY location_mode, location_accuracy
ORDER BY count DESC;

-- Mailles - vérification intégrité
SELECT 
    'mailles' as table_name,
    COUNT(*) as total_rows,
    COUNT(geom) as with_geom,
    COUNT(geom_4326) as with_geom_4326,
    COUNT(DISTINCT code) as distinct_codes
FROM mailles;

-- 6) RELATIONS FK ET INTÉGRITÉ
-- ============================================================================
\echo '=== 6. VÉRIFICATION INTÉGRITÉ FK ==='

-- Échantillons orphelins
SELECT 
    'echantillons_orphelins' as check_name,
    COUNT(*) as count
FROM echantillons e
LEFT JOIN sondages s ON e.sondage_id = s.id
WHERE s.id IS NULL;

-- Essais orphelins (par type)
SELECT 
    'essais_atterberg_orphelins' as check_name,
    COUNT(*) as count
FROM essais_atterberg ea
LEFT JOIN echantillons e ON ea.echantillon_id = e.id
WHERE e.id IS NULL;

-- Sondages avec maille_code invalide
SELECT 
    'sondages_maille_invalide' as check_name,
    COUNT(*) as count
FROM sondages s
LEFT JOIN mailles m ON s.maille_code = m.code
WHERE s.maille_code IS NOT NULL 
  AND m.code IS NULL
  AND s.deleted_at IS NULL;

-- 7) VUES ET FONCTIONS GÉOCODAGE
-- ============================================================================
\echo '=== 7. VUES ET FONCTIONS ==='

-- Lister les vues
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname IN ('public', 'atlas')
  AND (viewname LIKE '%sondage%' OR viewname LIKE '%geocod%' OR viewname LIKE '%unifi%')
ORDER BY schemaname, viewname;

-- Lister les fonctions de géocodage
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'atlas')
  AND (p.proname LIKE '%geocod%' 
       OR p.proname LIKE '%centroid%' 
       OR p.proname LIKE '%random%'
       OR p.proname LIKE '%adm%'
       OR p.proname LIKE '%refresh%')
ORDER BY n.nspname, p.proname;

-- 8) TRIGGERS ET AUTOMATISATIONS
-- ============================================================================
\echo '=== 8. TRIGGERS ==='

SELECT 
    t.trigger_schema,
    t.trigger_name,
    t.event_manipulation,
    t.event_object_table,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_schema IN ('public', 'atlas')
  AND t.event_object_table IN (
    'sondages', 'mailles', 'echantillons', 
    'essais_atterberg', 'essais_classif', 'essais_geotechniques',
    'essais_physiques', 'essais_proctor', 'essais_vbs',
    'granulo_points', 'granulometrie_points',
    'raw_lab_ags', 'raw_lab_agt', 'raw_lab_atterberg',
    'ref_types_essais', 'classifications'
  )
ORDER BY t.trigger_schema, t.event_object_table, t.trigger_name;

-- 9) SUGGESTIONS DE GÉOCODAGE
-- ============================================================================
\echo '=== 9. ÉTAT DU GÉOCODAGE ==='

-- Statistiques des suggestions
SELECT 
    status,
    reason,
    COUNT(*) as count
FROM atlas.geocode_suggestions
GROUP BY status, reason
ORDER BY status, count DESC;

-- Sondages par statut de géocodage
SELECT 
    CASE 
        WHEN geom IS NOT NULL AND location_mode = 'exact' THEN 'geocoded_exact'
        WHEN geom IS NOT NULL AND location_mode IN ('centroid', 'random') THEN 'geocoded_approx'
        WHEN geom IS NULL AND location_mode = 'unknown' THEN 'not_geocoded'
        ELSE 'other'
    END as geocode_status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sondages WHERE deleted_at IS NULL), 2) as percentage
FROM sondages
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY count DESC;

\echo '=== FIN INVENTAIRE ==='
