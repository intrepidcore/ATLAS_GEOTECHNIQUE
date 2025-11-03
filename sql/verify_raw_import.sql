-- ============================================================================
-- Script de Vérification Import RAW v1.5.3
-- ============================================================================
-- Usage: psql -U atlas -d atlas_clean -f verify_raw_import.sql
-- ============================================================================

\echo '==================================================================='
\echo 'VERIFICATION IMPORT RAW v1.5.3'
\echo '==================================================================='

-- 1. Compteurs de lignes
\echo ''
\echo '[1] Compteurs de lignes par table RAW:'
\echo '-------------------------------------------------------------------'
SELECT 'raw_lab_agt' AS table_name, COUNT(*) AS nb_lignes FROM raw_lab_agt
UNION ALL SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg
ORDER BY table_name;

-- 2. Vérifier les liens echantillon_id
\echo ''
\echo '[2] Vérification liens echantillon_id (devrait être 0 partout):'
\echo '-------------------------------------------------------------------'
SELECT 
  table_name, 
  COUNT(*) AS sans_lien,
  (SELECT COUNT(*) FROM (
    SELECT CASE 
      WHEN table_name = 'AGT' THEN (SELECT COUNT(*) FROM raw_lab_agt)
      WHEN table_name = 'AGS' THEN (SELECT COUNT(*) FROM raw_lab_ags)
      ELSE (SELECT COUNT(*) FROM raw_lab_atterberg)
    END
  ) x) AS total
FROM (
  SELECT 'AGT' AS table_name, echantillon_id FROM raw_lab_agt
  UNION ALL SELECT 'AGS', echantillon_id FROM raw_lab_ags
  UNION ALL SELECT 'ATT', echantillon_id FROM raw_lab_atterberg
) x
WHERE echantillon_id IS NULL
GROUP BY table_name
ORDER BY table_name;

-- 3. Distribution par site et profondeur (AGT)
\echo ''
\echo '[3] Distribution AGT par site et profondeur:'
\echo '-------------------------------------------------------------------'
SELECT 
  code_site, 
  depth_m, 
  COUNT(*) AS nb_mesures,
  MIN(sieve_mm) AS sieve_min,
  MAX(sieve_mm) AS sieve_max
FROM raw_lab_agt
GROUP BY code_site, depth_m
ORDER BY code_site, depth_m;

-- 4. Distribution par site et profondeur (AGS)
\echo ''
\echo '[4] Distribution AGS par site et profondeur:'
\echo '-------------------------------------------------------------------'
SELECT 
  code_site, 
  depth_m, 
  COUNT(*) AS nb_mesures,
  MIN(sieve_mm) AS sieve_min,
  MAX(sieve_mm) AS sieve_max
FROM raw_lab_ags
GROUP BY code_site, depth_m
ORDER BY code_site, depth_m;

-- 5. Distribution Atterberg par site, profondeur et type
\echo ''
\echo '[5] Distribution Atterberg RAW par site et type de test:'
\echo '-------------------------------------------------------------------'
SELECT 
  code_site, 
  depth_m, 
  test_type,
  COUNT(*) AS nb_mesures,
  AVG(teneur_eau_pct) AS teneur_eau_moy
FROM raw_lab_atterberg
GROUP BY code_site, depth_m, test_type
ORDER BY code_site, depth_m, test_type;

-- 6. Exemple de courbe granulo complète (AGT + AGS)
\echo ''
\echo '[6] Exemple courbe granulo fusionnée (KEVE-S1 @ 1.5m):'
\echo '-------------------------------------------------------------------'
SELECT 
  sieve_mm, 
  passants_pct, 
  src,
  CASE WHEN echantillon_id IS NOT NULL THEN 'Lié' ELSE 'Non lié' END AS statut_lien
FROM v_raw_lab_granulo
WHERE code_site = 'KEVE-S1' AND depth_m = 1.5
ORDER BY sieve_mm DESC
LIMIT 10;

-- 7. Vérifier les valeurs aberrantes (% > 100)
\echo ''
\echo '[7] Valeurs aberrantes (passants_pct > 100):'
\echo '-------------------------------------------------------------------'
SELECT 'AGT' AS source, code_site, depth_m, sieve_mm, passants_pct
FROM raw_lab_agt
WHERE passants_pct > 100
UNION ALL
SELECT 'AGS', code_site, depth_m, sieve_mm, passants_pct
FROM raw_lab_ags
WHERE passants_pct > 100
ORDER BY source, code_site, depth_m;

-- 8. Statistiques Atterberg (nb_coups pour LL)
\echo ''
\echo '[8] Statistiques nb_coups pour LL (devrait être entre 10-35):'
\echo '-------------------------------------------------------------------'
SELECT 
  code_site,
  depth_m,
  COUNT(*) AS nb_mesures_LL,
  MIN(nb_coups) AS nb_coups_min,
  MAX(nb_coups) AS nb_coups_max,
  AVG(nb_coups) AS nb_coups_moy
FROM raw_lab_atterberg
WHERE test_type = 'LL'
GROUP BY code_site, depth_m
ORDER BY code_site, depth_m;

-- 9. Vérifier les triggers updated_at
\echo ''
\echo '[9] Vérification triggers updated_at:'
\echo '-------------------------------------------------------------------'
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgname IN ('tr_raw_agt_updated_at', 'tr_raw_ags_updated_at')
ORDER BY tgname;

-- 10. Résumé global
\echo ''
\echo '[10] RESUME GLOBAL:'
\echo '-------------------------------------------------------------------'
SELECT 
  'Tables RAW créées' AS verification,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_name IN ('raw_lab_agt', 'raw_lab_ags', 'raw_lab_atterberg')) AS resultat,
  '3' AS attendu,
  CASE WHEN (SELECT COUNT(*) FROM information_schema.tables 
             WHERE table_name IN ('raw_lab_agt', 'raw_lab_ags', 'raw_lab_atterberg')) = 3 
       THEN 'OK' ELSE 'ERREUR' END AS statut
UNION ALL
SELECT 
  'Total lignes RAW',
  (SELECT COUNT(*) FROM raw_lab_agt) + 
  (SELECT COUNT(*) FROM raw_lab_ags) + 
  (SELECT COUNT(*) FROM raw_lab_atterberg),
  '348',
  CASE WHEN (SELECT COUNT(*) FROM raw_lab_agt) + 
            (SELECT COUNT(*) FROM raw_lab_ags) + 
            (SELECT COUNT(*) FROM raw_lab_atterberg) = 348 
       THEN 'OK' ELSE 'VERIFIER' END
UNION ALL
SELECT 
  'Vue v_raw_lab_granulo',
  (SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'v_raw_lab_granulo'),
  '1',
  CASE WHEN (SELECT COUNT(*) FROM information_schema.views 
             WHERE table_name = 'v_raw_lab_granulo') = 1 
       THEN 'OK' ELSE 'ERREUR' END
UNION ALL
SELECT 
  'Triggers updated_at',
  (SELECT COUNT(*) FROM pg_trigger 
   WHERE tgname IN ('tr_raw_agt_updated_at', 'tr_raw_ags_updated_at')),
  '2',
  CASE WHEN (SELECT COUNT(*) FROM pg_trigger 
             WHERE tgname IN ('tr_raw_agt_updated_at', 'tr_raw_ags_updated_at')) = 2 
       THEN 'OK' ELSE 'ERREUR' END;

\echo ''
\echo '==================================================================='
\echo 'FIN DE LA VERIFICATION'
\echo '==================================================================='
