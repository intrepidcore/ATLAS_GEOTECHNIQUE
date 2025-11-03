-- ============================================================================
-- DIAGNOSTIC UI COMPLET - Pourquoi rien ne s'affiche
-- ============================================================================
-- Usage: psql -U atlas -d atlas_clean -f diagnostic_ui_complet.sql
-- ============================================================================

\echo '==================================================================='
\echo 'DIAGNOSTIC UI COMPLET'
\echo '==================================================================='

-- ============================================================================
-- ETAPE 0: SANITY CHECK - Import reel fait ?
-- ============================================================================

\echo ''
\echo '[ETAPE 0] Sanity Check - Donnees importees ?'
\echo '-------------------------------------------------------------------'

SELECT 'sondages' AS table_name, COUNT(*) AS nb_lignes FROM sondages
UNION ALL
SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL
SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL
SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL
SELECT 'raw_lab_agt', COUNT(*) FROM raw_lab_agt
UNION ALL
SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL
SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;

\echo ''
\echo 'ATTENDU: sondages >= 1, echantillons >= 1'
\echo 'Si 0 partout: refaire import SANS --dry-run'

-- ============================================================================
-- ETAPE 1: Geometrie et ADM3
-- ============================================================================

\echo ''
\echo '[ETAPE 1] Geometrie et ADM3 des sondages'
\echo '-------------------------------------------------------------------'

SELECT 
  code,
  (geom IS NOT NULL) AS has_geom,
  adm3_code,
  CASE 
    WHEN geom IS NOT NULL THEN 'GPS (affichage direct)'
    WHEN adm3_code IS NOT NULL THEN 'ADM3 spread (diffusion)'
    ELSE 'INVISIBLE (ni GPS ni ADM3)'
  END AS statut_affichage
FROM sondages
ORDER BY code;

\echo ''
\echo 'Si has_geom=false partout ET adm3_code=NULL: INVISIBLE'
\echo 'Si has_geom=false ET adm3_code rempli: OK pour spread'

-- ============================================================================
-- ETAPE 2: Vues existantes
-- ============================================================================

\echo ''
\echo '[ETAPE 2] Vues existantes'
\echo '-------------------------------------------------------------------'

SELECT 
  table_name,
  CASE table_type
    WHEN 'VIEW' THEN 'Vue normale'
    WHEN 'MATERIALIZED VIEW' THEN 'Vue materialisee'
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
\echo 'ATTENDU: 4 vues (v_sondages_spread, v_mailles_geotech, mv_mailles_geotech, mailles_geotechnique_stats)'
\echo 'Si manquantes: executer fix_ui_vues_complete.sql'

-- ============================================================================
-- ETAPE 3: Compteurs vues
-- ============================================================================

\echo ''
\echo '[ETAPE 3] Compteurs vues (si existent)'
\echo '-------------------------------------------------------------------'

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- v_sondages_spread
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_sondages_spread') THEN
    SELECT COUNT(*) INTO v_count FROM v_sondages_spread;
    RAISE NOTICE 'v_sondages_spread: % lignes', v_count;
  ELSE
    RAISE NOTICE 'v_sondages_spread: N''EXISTE PAS';
  END IF;
  
  -- mv_mailles_geotech
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_mailles_geotech') THEN
    SELECT COUNT(*) INTO v_count FROM mv_mailles_geotech;
    RAISE NOTICE 'mv_mailles_geotech: % lignes', v_count;
  ELSE
    RAISE NOTICE 'mv_mailles_geotech: N''EXISTE PAS';
  END IF;
END $$;

-- ============================================================================
-- ETAPE 4: Exemple de donnees
-- ============================================================================

\echo ''
\echo '[ETAPE 4] Exemple de donnees (si vue existe)'
\echo '-------------------------------------------------------------------'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_mailles_geotech') THEN
    RAISE NOTICE 'Affichage exemple...';
  ELSE
    RAISE NOTICE 'mv_mailles_geotech n''existe pas - skip';
  END IF;
END $$;

SELECT 
  maille_id,
  ROUND(w_avg::numeric, 2) AS w_avg,
  ROUND(ip_avg::numeric, 2) AS ip_avg,
  ROUND(vbs_avg::numeric, 2) AS vbs_avg,
  n AS nb_echantillons,
  has_spread
FROM mv_mailles_geotech
WHERE w_avg IS NOT NULL OR ip_avg IS NOT NULL OR vbs_avg IS NOT NULL
LIMIT 5;

-- ============================================================================
-- ETAPE 5: Verification ADM3
-- ============================================================================

\echo ''
\echo '[ETAPE 5] Verification ADM3 (pour spread)'
\echo '-------------------------------------------------------------------'

SELECT 
  s.code,
  s.adm3_code,
  (SELECT COUNT(*) FROM adm3 a WHERE a.code = s.adm3_code) AS adm3_existe,
  (SELECT COUNT(*) FROM mailles m JOIN adm3 a ON ST_Intersects(m.geom, a.geom) 
   WHERE a.code = s.adm3_code) AS nb_mailles_adm3
FROM sondages s
WHERE s.adm3_code IS NOT NULL
ORDER BY s.code;

\echo ''
\echo 'Si adm3_existe=0: le code ADM3 est invalide'
\echo 'Si nb_mailles_adm3=0: aucune maille dans cet ADM3'

-- ============================================================================
-- RESUME DIAGNOSTIC
-- ============================================================================

\echo ''
\echo '==================================================================='
\echo 'RESUME DIAGNOSTIC'
\echo '==================================================================='

WITH diag AS (
  SELECT
    (SELECT COUNT(*) FROM sondages) AS nb_sondages,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NOT NULL) AS nb_avec_gps,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NULL AND adm3_code IS NOT NULL) AS nb_adm3_only,
    (SELECT COUNT(*) FROM sondages WHERE geom IS NULL AND adm3_code IS NULL) AS nb_invisibles,
    (SELECT COUNT(*) FROM echantillons) AS nb_echantillons,
    EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_mailles_geotech') AS vue_existe,
    (SELECT COUNT(*) FROM mv_mailles_geotech WHERE EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_mailles_geotech')) AS nb_mailles_stats
)
SELECT
  'Sondages importes' AS check_item,
  nb_sondages::text AS valeur,
  CASE WHEN nb_sondages > 0 THEN 'OK' ELSE 'ERREUR - Refaire import' END AS statut
FROM diag
UNION ALL
SELECT
  'Sondages avec GPS',
  nb_avec_gps::text,
  CASE WHEN nb_avec_gps > 0 THEN 'OK' ELSE 'WARNING - Utiliser spread' END
FROM diag
UNION ALL
SELECT
  'Sondages ADM3 spread',
  nb_adm3_only::text,
  CASE WHEN nb_adm3_only > 0 THEN 'SPREAD_ACTIF' ELSE 'N/A' END
FROM diag
UNION ALL
SELECT
  'Sondages INVISIBLES',
  nb_invisibles::text,
  CASE WHEN nb_invisibles > 0 THEN 'PROBLEME - Ajouter GPS ou ADM3' ELSE 'OK' END
FROM diag
UNION ALL
SELECT
  'Vue mv_mailles_geotech',
  CASE WHEN vue_existe THEN 'EXISTE' ELSE 'MANQUANTE' END,
  CASE WHEN vue_existe THEN 'OK' ELSE 'ERREUR - Executer fix_ui_vues_complete.sql' END
FROM diag
UNION ALL
SELECT
  'Mailles avec stats',
  nb_mailles_stats::text,
  CASE WHEN nb_mailles_stats > 0 THEN 'OK' ELSE 'ERREUR - REFRESH vue' END
FROM diag;

\echo ''
\echo '==================================================================='
\echo 'ACTIONS RECOMMANDEES'
\echo '==================================================================='
\echo ''
\echo 'Si sondages=0: python scripts\02_import_excel.py ... (SANS --dry-run)'
\echo 'Si vue manquante: psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql'
\echo 'Si mailles_stats=0: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;'
\echo 'Si invisibles>0: Ajouter adm3_code dans Excel ou geocoder'
\echo ''
