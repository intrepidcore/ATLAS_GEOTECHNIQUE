-- ============================================================================
-- DIAGNOSTIC UI - Pourquoi les données n'apparaissent pas dans la carte
-- ============================================================================
-- Usage: psql -U atlas -d atlas_clean -f diagnostic_ui.sql
-- ============================================================================

\echo '==================================================================='
\echo 'DIAGNOSTIC UI - Atlas Geotechnique v1.5.3'
\echo '==================================================================='

-- ============================================================================
-- A) VERIFICATIONS BASE DE DONNEES (5 checks)
-- ============================================================================

\echo ''
\echo '[A1] Compteurs de base - Donnees importees ?'
\echo '-------------------------------------------------------------------'
SELECT 'sondages' AS table_name, COUNT(*) AS nb_lignes FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
ORDER BY table_name;

\echo ''
\echo '[A2] Sondages - Geometrie et ADM3'
\echo '-------------------------------------------------------------------'
SELECT 
  code, 
  (geom IS NOT NULL) AS has_geom,
  adm3_code,
  CASE 
    WHEN geom IS NOT NULL THEN 'GEOCODE'
    WHEN adm3_code IS NOT NULL THEN 'ADM3_SPREAD_POSSIBLE'
    ELSE 'AUCUNE_LOCALISATION'
  END AS statut_localisation
FROM sondages
ORDER BY code;

\echo ''
\echo '[A3] Sondages sans ADM3 (bloquants pour spread)'
\echo '-------------------------------------------------------------------'
SELECT code, adm3_code, geom IS NOT NULL AS has_geom
FROM sondages 
WHERE adm3_code IS NULL;

\echo ''
\echo '[A4] Tables RAW (info)'
\echo '-------------------------------------------------------------------'
SELECT 'raw_lab_agt' AS table_name, COUNT(*) AS nb_lignes FROM raw_lab_agt
UNION ALL SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg
ORDER BY table_name;

\echo ''
\echo '[A5] Mailles disponibles'
\echo '-------------------------------------------------------------------'
SELECT 
  COUNT(*) AS nb_mailles,
  COUNT(DISTINCT adm3_code) AS nb_adm3_distincts
FROM mailles;

-- ============================================================================
-- B) DIAGNOSTIC GEOM vs ADM3
-- ============================================================================

\echo ''
\echo '[B1] Repartition sondages par type de localisation'
\echo '-------------------------------------------------------------------'
SELECT 
  CASE 
    WHEN geom IS NOT NULL THEN 'GEOCODE (point GPS)'
    WHEN adm3_code IS NOT NULL THEN 'ADM3 uniquement (spread possible)'
    ELSE 'AUCUNE LOCALISATION (invisible)'
  END AS type_localisation,
  COUNT(*) AS nb_sondages
FROM sondages
GROUP BY 
  CASE 
    WHEN geom IS NOT NULL THEN 'GEOCODE (point GPS)'
    WHEN adm3_code IS NOT NULL THEN 'ADM3 uniquement (spread possible)'
    ELSE 'AUCUNE LOCALISATION (invisible)'
  END
ORDER BY nb_sondages DESC;

\echo ''
\echo '[B2] Verification ADM3 existants'
\echo '-------------------------------------------------------------------'
SELECT 
  s.adm3_code,
  COUNT(*) AS nb_sondages,
  (SELECT COUNT(*) FROM adm3 a WHERE a.code = s.adm3_code) AS adm3_existe,
  (SELECT COUNT(*) FROM mailles m JOIN adm3 a ON ST_Intersects(m.geom, a.geom) 
   WHERE a.code = s.adm3_code) AS nb_mailles_adm3
FROM sondages s
WHERE s.adm3_code IS NOT NULL
GROUP BY s.adm3_code
ORDER BY s.adm3_code;

-- ============================================================================
-- C) DIAGNOSTIC VUES EXISTANTES
-- ============================================================================

\echo ''
\echo '[C1] Vues existantes (spread et stats)'
\echo '-------------------------------------------------------------------'
SELECT 
  table_name,
  CASE 
    WHEN table_type = 'VIEW' THEN 'Vue normale'
    WHEN table_type = 'MATERIALIZED VIEW' THEN 'Vue materialisee'
    ELSE table_type
  END AS type_vue
FROM information_schema.tables
WHERE table_name IN (
  'v_sondages_spread',
  'v_mailles_geotech',
  'mv_mailles_geotech',
  'mailles_geotechnique_stats'
)
ORDER BY table_name;

\echo ''
\echo '[C2] Si mv_mailles_geotech existe - Compteurs'
\echo '-------------------------------------------------------------------'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mv_mailles_geotech') THEN
    RAISE NOTICE 'mv_mailles_geotech existe - Comptage...';
    PERFORM * FROM mv_mailles_geotech LIMIT 1;
  ELSE
    RAISE NOTICE 'mv_mailles_geotech N''EXISTE PAS - A creer !';
  END IF;
END $$;

SELECT COUNT(*) AS nb_mailles_avec_stats
FROM mv_mailles_geotech
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mv_mailles_geotech');

-- ============================================================================
-- D) RESUME DIAGNOSTIC
-- ============================================================================

\echo ''
\echo '[D] RESUME DIAGNOSTIC'
\echo '==================================================================='

WITH diag AS (
  SELECT
    (SELECT COUNT(*) FROM sondages) AS nb_sondages,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NOT NULL) AS nb_sondages_geocodes,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NULL AND adm3_code IS NOT NULL) AS nb_sondages_adm3_only,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NULL AND adm3_code IS NULL) AS nb_sondages_sans_localisation,
    (SELECT COUNT(*) FROM echantillons) AS nb_echantillons,
    (SELECT COUNT(*) FROM essais_atterberg) AS nb_essais_atterberg,
    (SELECT COUNT(*) FROM essais_vbs) AS nb_essais_vbs,
    (SELECT COUNT(*) FROM mailles) AS nb_mailles,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v_sondages_spread') AS vue_spread_existe,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mv_mailles_geotech') AS vue_stats_existe
)
SELECT
  'Sondages importes' AS verification,
  nb_sondages::text AS valeur,
  CASE WHEN nb_sondages > 0 THEN 'OK' ELSE 'ERREUR' END AS statut
FROM diag
UNION ALL
SELECT
  'Sondages geocodes (point GPS)',
  nb_sondages_geocodes::text,
  CASE WHEN nb_sondages_geocodes > 0 THEN 'OK' ELSE 'WARNING' END
FROM diag
UNION ALL
SELECT
  'Sondages ADM3 uniquement (spread)',
  nb_sondages_adm3_only::text,
  CASE WHEN nb_sondages_adm3_only > 0 THEN 'SPREAD_REQUIS' ELSE 'N/A' END
FROM diag
UNION ALL
SELECT
  'Sondages SANS localisation',
  nb_sondages_sans_localisation::text,
  CASE WHEN nb_sondages_sans_localisation > 0 THEN 'INVISIBLE' ELSE 'OK' END
FROM diag
UNION ALL
SELECT
  'Echantillons',
  nb_echantillons::text,
  CASE WHEN nb_echantillons > 0 THEN 'OK' ELSE 'ERREUR' END
FROM diag
UNION ALL
SELECT
  'Vue v_sondages_spread',
  CASE WHEN vue_spread_existe THEN 'EXISTE' ELSE 'A_CREER' END,
  CASE WHEN vue_spread_existe THEN 'OK' ELSE 'ACTION_REQUISE' END
FROM diag
UNION ALL
SELECT
  'Vue mv_mailles_geotech',
  CASE WHEN vue_stats_existe THEN 'EXISTE' ELSE 'A_CREER' END,
  CASE WHEN vue_stats_existe THEN 'OK' ELSE 'ACTION_REQUISE' END
FROM diag;

\echo ''
\echo '==================================================================='
\echo 'RECOMMANDATIONS'
\echo '==================================================================='
\echo ''
\echo 'Si statut = SPREAD_REQUIS ou ACTION_REQUISE :'
\echo '  1. Executer: psql -U atlas -d atlas_clean -f create_spread_views.sql'
\echo '  2. Verifier API pointe sur mv_mailles_geotech'
\echo '  3. Refresh cache frontend'
\echo ''
\echo 'Si statut = INVISIBLE :'
\echo '  1. Ajouter adm3_code dans le fichier Excel'
\echo '  2. Re-importer les donnees'
\echo ''
\echo '==================================================================='
