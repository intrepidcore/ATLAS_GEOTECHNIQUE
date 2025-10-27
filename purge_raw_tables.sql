-- ============================================================================
-- Script de Purge Tables RAW v1.5.3
-- ============================================================================
-- ATTENTION: Ce script SUPPRIME toutes les données RAW
-- Usage: psql -U atlas -d atlas_clean -f purge_raw_tables.sql
-- ============================================================================

\echo '==================================================================='
\echo 'PURGE TABLES RAW v1.5.3'
\echo '==================================================================='
\echo ''
\echo 'ATTENTION: Cette operation va SUPPRIMER toutes les donnees RAW !'
\echo ''
\prompt 'Tapez YES pour confirmer: ' confirmation

\if :{?confirmation}
  \if :confirmation = 'YES'
    \echo ''
    \echo 'Purge en cours...'
    
    -- Purge tables RAW
    TRUNCATE raw_lab_agt RESTART IDENTITY CASCADE;
    TRUNCATE raw_lab_ags RESTART IDENTITY CASCADE;
    TRUNCATE raw_lab_atterberg RESTART IDENTITY CASCADE;
    
    \echo ''
    \echo '[OK] Tables RAW purgees avec succes'
    \echo ''
    
    -- Vérification
    SELECT 
      'raw_lab_agt' AS table_name, 
      COUNT(*) AS nb_lignes 
    FROM raw_lab_agt
    UNION ALL 
    SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
    UNION ALL 
    SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;
    
    \echo ''
    \echo '==================================================================='
    \echo 'PURGE TERMINEE - Toutes les tables RAW sont vides'
    \echo '==================================================================='
  \else
    \echo ''
    \echo 'Purge annulee (confirmation incorrecte)'
  \endif
\else
  \echo ''
  \echo 'Purge annulee (pas de confirmation)'
\endif
