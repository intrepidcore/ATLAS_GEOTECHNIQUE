-- ============================================================================
-- Migration 021: Reset des données terrain (préparation réimport propre)
-- Date: 2025-11-15
-- Description: Vide toutes les tables de données terrain en respectant les FK
--              Structure, vues, fonctions, triggers préservés
-- ============================================================================

BEGIN;

-- Désactiver temporairement les triggers pour éviter les cascades non voulues
SET session_replication_role = replica;

-- ============================================================================
-- NIVEAU 3: Tables RAW et essais détaillés (dépendent des essais/échantillons)
-- ============================================================================

TRUNCATE TABLE raw_lab_atterberg CASCADE;
TRUNCATE TABLE raw_lab_ags CASCADE;
TRUNCATE TABLE raw_lab_agt CASCADE;
TRUNCATE TABLE essais_classif CASCADE;
TRUNCATE TABLE essais_physiques CASCADE;
TRUNCATE TABLE granulo_points CASCADE;

-- ============================================================================
-- NIVEAU 2: Essais et échantillons (dépendent des sondages)
-- ============================================================================

TRUNCATE TABLE essais_geotechniques CASCADE;
TRUNCATE TABLE essais_atterberg CASCADE;
TRUNCATE TABLE essais_vbs CASCADE;
-- TRUNCATE TABLE essais_proctor CASCADE; -- Table n'existe pas encore
TRUNCATE TABLE echantillons CASCADE;

-- ============================================================================
-- NIVEAU 1: Sondages (table racine)
-- ============================================================================

TRUNCATE TABLE sondages CASCADE;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_sondages INTEGER;
    v_echantillons INTEGER;
    v_essais_geo INTEGER;
    v_essais_phys INTEGER;
    v_essais_classif INTEGER;
    v_granulo INTEGER;
    v_raw_agt INTEGER;
    v_raw_ags INTEGER;
    v_raw_att INTEGER;
    v_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sondages FROM sondages;
    SELECT COUNT(*) INTO v_echantillons FROM echantillons;
    SELECT COUNT(*) INTO v_essais_geo FROM essais_geotechniques;
    SELECT COUNT(*) INTO v_essais_phys FROM essais_physiques;
    SELECT COUNT(*) INTO v_essais_classif FROM essais_classif;
    SELECT COUNT(*) INTO v_granulo FROM granulo_points;
    SELECT COUNT(*) INTO v_raw_agt FROM raw_lab_agt;
    SELECT COUNT(*) INTO v_raw_ags FROM raw_lab_ags;
    SELECT COUNT(*) INTO v_raw_att FROM raw_lab_atterberg;
    
    v_total := v_sondages + v_echantillons + v_essais_geo + v_essais_phys + 
               v_essais_classif + v_granulo + v_raw_agt + v_raw_ags + v_raw_att;
    
    IF v_total > 0 THEN
        RAISE EXCEPTION 'Reset incomplet: % lignes restantes (sondages:%, echantillons:%, essais_geo:%)', 
            v_total, v_sondages, v_echantillons, v_essais_geo;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Reset terminé avec succès';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '  - sondages: % lignes', v_sondages;
    RAISE NOTICE '  - echantillons: % lignes', v_echantillons;
    RAISE NOTICE '  - essais_geotechniques: % lignes', v_essais_geo;
    RAISE NOTICE '  - essais_physiques: % lignes', v_essais_phys;
    RAISE NOTICE '  - essais_classif: % lignes', v_essais_classif;
    RAISE NOTICE '  - granulo_points: % lignes', v_granulo;
    RAISE NOTICE '  - raw_lab_agt: % lignes', v_raw_agt;
    RAISE NOTICE '  - raw_lab_ags: % lignes', v_raw_ags;
    RAISE NOTICE '  - raw_lab_atterberg: % lignes', v_raw_att;
    RAISE NOTICE '';
    RAISE NOTICE 'Structure préservée:';
    RAISE NOTICE '  ✓ Tables, colonnes, types intacts';
    RAISE NOTICE '  ✓ Vues (atlas.surveys, etc.) intactes';
    RAISE NOTICE '  ✓ Fonctions et triggers intacts';
    RAISE NOTICE '  ✓ Contraintes FK/PK intactes';
    RAISE NOTICE '';
    RAISE NOTICE 'Prêt pour réimport depuis Excel';
    RAISE NOTICE '============================================================================';
END $$;

COMMIT;
