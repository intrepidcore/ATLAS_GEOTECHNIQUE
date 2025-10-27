-- ============================================================================
-- PHASE 0 : Vérification Schémas & Objets
-- ============================================================================

-- Vérifier extensions
SELECT 'Extensions' AS check_type, 
       extname, 
       extversion 
FROM pg_extension 
WHERE extname IN ('unaccent', 'pg_trgm', 'fuzzystrmatch')
ORDER BY extname;

-- Vérifier tables
SELECT 'Tables' AS check_type,
       tablename AS name,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('adm3_synonyms', 'geocode_suggestions', 'sondages')
ORDER BY tablename;

-- Vérifier vues matérialisées
SELECT 'Materialized Views' AS check_type,
       matviewname AS name,
       pg_size_pretty(pg_total_relation_size('public.'||matviewname)) AS size
FROM pg_matviews
WHERE matviewname IN ('adm3_names', 'mv_mailles_geotech')
ORDER BY matviewname;

-- Vérifier fonctions
SELECT 'Functions' AS check_type,
       proname AS name,
       pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('normalize_name', 'match_adm3_strict')
ORDER BY proname;

-- Compteurs
SELECT 'Counts' AS check_type,
       'adm3_names' AS table_name,
       COUNT(*) AS count
FROM adm3_names
UNION ALL
SELECT 'Counts', 'adm3_synonyms', COUNT(*) FROM adm3_synonyms
UNION ALL
SELECT 'Counts', 'geocode_suggestions', COUNT(*) FROM geocode_suggestions
UNION ALL
SELECT 'Counts', 'sondages', COUNT(*) FROM sondages;

-- Statut suggestions
SELECT 'Suggestion Status' AS check_type,
       status,
       COUNT(*) AS count
FROM geocode_suggestions
GROUP BY status
ORDER BY status;
