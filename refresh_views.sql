-- ============================================================================
-- REFRESH VUES MATERIALISEES - Apres import de donnees
-- ============================================================================
-- Usage: psql -U atlas -d atlas_clean -f refresh_views.sql
-- ============================================================================

\echo '==================================================================='
\echo 'REFRESH VUES MATERIALISEES'
\echo '==================================================================='

\echo ''
\echo '[1/2] Refresh mv_mailles_geotech...'
\timing on

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;

\timing off
\echo '   [OK] mv_mailles_geotech rafraichie'

\echo ''
\echo '[2/2] Verification compteurs...'
SELECT 
  'mv_mailles_geotech' AS vue,
  COUNT(*) AS nb_mailles_avec_stats,
  COUNT(*) FILTER (WHERE has_spread) AS nb_mailles_spread,
  COUNT(*) FILTER (WHERE NOT has_spread) AS nb_mailles_geocodees
FROM mv_mailles_geotech;

\echo ''
\echo '==================================================================='
\echo 'REFRESH TERMINE'
\echo '==================================================================='
