-- Lister toutes les tables/vues mailles
SELECT schemaname, tablename, 'table' as type
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE '%mailles%'
UNION ALL
SELECT schemaname, matviewname, 'matview' as type
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname LIKE '%mailles%'
ORDER BY tablename;

-- Vérifier si mailles_geotechnique_stats existe
\echo '=== mailles_geotechnique_stats existe? ==='
SELECT EXISTS (
  SELECT 1 FROM pg_matviews 
  WHERE schemaname = 'public' AND matviewname = 'mailles_geotechnique_stats'
) as mv_exists;

-- Si c'est une MV, voir sa définition
\echo '=== Définition actuelle de mailles_geotechnique_stats_wgs84 ==='
SELECT pg_get_viewdef('mailles_geotechnique_stats_wgs84'::regclass, true);
