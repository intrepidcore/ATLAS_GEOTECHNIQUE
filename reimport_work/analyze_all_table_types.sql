-- ============================================================================
-- ANALYSE COMPLÈTE DES TYPES DE COLONNES DE TOUTES LES TABLES
-- Identifier les problèmes de types de données
-- ============================================================================

\echo '🔍 ANALYSE COMPLÈTE DES TYPES DE COLONNES'

-- Analyser les tables principales d'import
SELECT 
    '=== SONDAGES ===' as analysis,
    table_name, column_name, data_type, 
    CASE 
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name IN ('depth_m', 'depth_m_min', 'depth_m_max') AND data_type != 'numeric' THEN '❌ Profondeur devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        WHEN column_name = 'date%' AND data_type != 'date' THEN '❌ Date devrait être date'
        WHEN column_name LIKE '%_pct' AND data_type != 'numeric' THEN '❌ Pourcentage devrait être numeric'
        WHEN column_name LIKE 'passant_%' AND data_type != 'numeric' THEN '❌ Passant devrait être numeric'
        WHEN column_name IN ('wl', 'wp', 'ip', 'vbs', 'gs') AND data_type != 'numeric' THEN '❌ Valeur numérique devrait être numeric'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'sondages'
ORDER BY ordinal_position;

SELECT 
    '=== ECHANTILLONS ===' as analysis,
    table_name, column_name, data_type,
    CASE 
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_m' AND data_type != 'numeric' THEN '❌ Mesure devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        WHEN column_name = 'date' AND data_type != 'date' THEN '❌ Date devrait être date'
        WHEN column_name LIKE '%_gcm3' AND data_type != 'numeric' THEN '❌ Densité devrait être numeric'
        WHEN column_name LIKE '%_w' AND data_type != 'numeric' THEN '❌ Teneur eau devrait être numeric'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'echantillons'
ORDER BY ordinal_position;

SELECT 
    '=== ESSAIS_GEOTECHNIQUES ===' as analysis,
    table_name, column_name, data_type,
    CASE 
        WHEN column_name = 'id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_m' AND data_type != 'numeric' THEN '❌ Mesure devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        WHEN column_name LIKE 'test_date' AND data_type != 'date' THEN '❌ Date devrait être date'
        WHEN column_name LIKE 'passant_%' AND data_type != 'numeric' THEN '❌ Passant devrait être numeric'
        WHEN column_name IN ('wl', 'wp', 'ip', 'vbs', 'gamma_d_max', 'w_opt') AND data_type != 'numeric' THEN '❌ Valeur numérique devrait être numeric'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'essais_geotechniques'
ORDER BY ordinal_position;

SELECT 
    '=== ESSAIS_ATTERBERG ===' as analysis,
    table_name, column_name, data_type,
    CASE 
        WHEN column_name = 'id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name IN ('wl', 'wp', 'ip_generated') AND data_type != 'numeric' THEN '❌ Valeur Atterberg devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'essais_atterberg'
ORDER BY ordinal_position;

SELECT 
    '=== ESSAIS_PHYSIQUES ===' as analysis,
    table_name, column_name, data_type,
    CASE 
        WHEN column_name = 'id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_gcm3' AND data_type != 'numeric' THEN '❌ Densité devrait être numeric'
        WHEN column_name LIKE '%_pct' AND data_type != 'numeric' THEN '❌ Pourcentage devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'essais_physiques'
ORDER BY ordinal_position;

SELECT 
    '=== ESSAIS_VBS ===' as analysis,
    table_name, column_name, data_type,
    CASE 
        WHEN column_name = 'id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name LIKE '%_id' AND data_type != 'uuid' THEN '❌ ID devrait être UUID'
        WHEN column_name = 'vbs' AND data_type != 'numeric' THEN '❌ VBS devrait être numeric'
        WHEN column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%' THEN '❌ Timestamp devrait être timestamptz'
        ELSE '✅ OK'
    END as type_status
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'essais_vbs'
ORDER BY ordinal_position;

-- Résumé des problèmes par table
SELECT 
    '=== RÉSUMÉ DES PROBLÈMES ===' as summary,
    table_name,
    COUNT(*) as total_columns,
    COUNT(*) FILTER (WHERE 
        (column_name LIKE '%_id' AND data_type != 'uuid') OR
        (column_name LIKE '%_m' AND data_type != 'numeric') OR
        (column_name LIKE '%_at' AND data_type NOT LIKE 'timestamp%') OR
        (column_name LIKE '%_pct' AND data_type != 'numeric') OR
        (column_name LIKE 'passant_%' AND data_type != 'numeric') OR
        (column_name IN ('wl', 'wp', 'ip', 'vbs', 'gs', 'gamma_d_max', 'w_opt') AND data_type != 'numeric')
    ) as problematic_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('sondages', 'echantillons', 'essais_geotechniques', 'essais_atterberg', 'essais_physiques', 'essais_vbs')
GROUP BY table_name
ORDER BY table_name;
