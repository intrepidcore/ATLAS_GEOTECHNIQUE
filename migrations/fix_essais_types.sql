-- Migration pour corriger les types de colonnes dans les tables d'essais
-- Date: 2025-11-09
-- Objectif: Convertir les colonnes TEXT en NUMERIC pour les valeurs numériques

BEGIN;

-- ============================================================================
-- 1. TABLE essais_vbs
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== Correction table essais_vbs ===';
    
    -- Vérifier les valeurs non numériques
    RAISE NOTICE 'Valeurs VBS non numériques:';
    PERFORM vbs FROM essais_vbs 
    WHERE vbs IS NOT NULL 
    AND vbs !~ '^[0-9]*\.?[0-9]+$';
    
    -- Créer une colonne temporaire
    ALTER TABLE essais_vbs ADD COLUMN vbs_new NUMERIC;
    
    -- Convertir les valeurs valides
    UPDATE essais_vbs 
    SET vbs_new = CASE 
        WHEN vbs ~ '^[0-9]*\.?[0-9]+$' THEN vbs::numeric
        ELSE NULL 
    END;
    
    -- Remplacer l'ancienne colonne
    ALTER TABLE essais_vbs DROP COLUMN vbs;
    ALTER TABLE essais_vbs RENAME COLUMN vbs_new TO vbs;
    
    RAISE NOTICE 'essais_vbs.vbs: TEXT → NUMERIC ✓';
END $$;

-- ============================================================================
-- 2. TABLE essais_atterberg
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== Correction table essais_atterberg ===';
    
    -- Colonne wl (Limite de liquidité)
    ALTER TABLE essais_atterberg ADD COLUMN wl_new NUMERIC;
    UPDATE essais_atterberg 
    SET wl_new = CASE 
        WHEN wl ~ '^[0-9]*\.?[0-9]+$' THEN wl::numeric
        ELSE NULL 
    END;
    ALTER TABLE essais_atterberg DROP COLUMN wl;
    ALTER TABLE essais_atterberg RENAME COLUMN wl_new TO wl;
    RAISE NOTICE 'essais_atterberg.wl: TEXT → NUMERIC ✓';
    
    -- Colonne wp (Limite de plasticité)
    ALTER TABLE essais_atterberg ADD COLUMN wp_new NUMERIC;
    UPDATE essais_atterberg 
    SET wp_new = CASE 
        WHEN wp ~ '^[0-9]*\.?[0-9]+$' THEN wp::numeric
        ELSE NULL 
    END;
    ALTER TABLE essais_atterberg DROP COLUMN wp;
    ALTER TABLE essais_atterberg RENAME COLUMN wp_new TO wp;
    RAISE NOTICE 'essais_atterberg.wp: TEXT → NUMERIC ✓';
    
    -- Colonne ip_generated (Indice de plasticité)
    ALTER TABLE essais_atterberg ADD COLUMN ip_generated_new NUMERIC;
    UPDATE essais_atterberg 
    SET ip_generated_new = CASE 
        WHEN ip_generated ~ '^[0-9]*\.?[0-9]+$' THEN ip_generated::numeric
        ELSE NULL 
    END;
    ALTER TABLE essais_atterberg DROP COLUMN ip_generated;
    ALTER TABLE essais_atterberg RENAME COLUMN ip_generated_new TO ip_generated;
    RAISE NOTICE 'essais_atterberg.ip_generated: TEXT → NUMERIC ✓';
END $$;

-- ============================================================================
-- 3. TABLE granulo_points
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== Correction table granulo_points ===';
    
    -- Colonne sieve_mm (Tamis en mm)
    ALTER TABLE granulo_points ADD COLUMN sieve_mm_new NUMERIC;
    UPDATE granulo_points 
    SET sieve_mm_new = CASE 
        WHEN sieve_mm ~ '^[0-9]*\.?[0-9]+$' THEN sieve_mm::numeric
        ELSE NULL 
    END;
    ALTER TABLE granulo_points DROP COLUMN sieve_mm;
    ALTER TABLE granulo_points RENAME COLUMN sieve_mm_new TO sieve_mm;
    RAISE NOTICE 'granulo_points.sieve_mm: TEXT → NUMERIC ✓';
    
    -- Colonne passing_pct (Pourcentage passant)
    ALTER TABLE granulo_points ADD COLUMN passing_pct_new NUMERIC;
    UPDATE granulo_points 
    SET passing_pct_new = CASE 
        WHEN passing_pct ~ '^[0-9]*\.?[0-9]+$' THEN passing_pct::numeric
        ELSE NULL 
    END;
    ALTER TABLE granulo_points DROP COLUMN passing_pct;
    ALTER TABLE granulo_points RENAME COLUMN passing_pct_new TO passing_pct;
    RAISE NOTICE 'granulo_points.passing_pct: TEXT → NUMERIC ✓';
END $$;

-- ============================================================================
-- 4. Recréer la vue matérialisée si elle utilise ces colonnes
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== Rafraîchissement de la vue matérialisée ===';
    REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
    RAISE NOTICE 'Vue matérialisée rafraîchie ✓';
END $$;

-- ============================================================================
-- 5. Vérification finale
-- ============================================================================
DO $$
DECLARE
    v_vbs_count INTEGER;
    v_wl_count INTEGER;
    v_wp_count INTEGER;
    v_sieve_count INTEGER;
    v_passing_count INTEGER;
BEGIN
    RAISE NOTICE '=== Vérification finale ===';
    
    SELECT COUNT(*) INTO v_vbs_count FROM essais_vbs WHERE vbs IS NOT NULL;
    RAISE NOTICE 'essais_vbs: % valeurs VBS', v_vbs_count;
    
    SELECT COUNT(*) INTO v_wl_count FROM essais_atterberg WHERE wl IS NOT NULL;
    RAISE NOTICE 'essais_atterberg: % valeurs WL', v_wl_count;
    
    SELECT COUNT(*) INTO v_wp_count FROM essais_atterberg WHERE wp IS NOT NULL;
    RAISE NOTICE 'essais_atterberg: % valeurs WP', v_wp_count;
    
    SELECT COUNT(*) INTO v_sieve_count FROM granulo_points WHERE sieve_mm IS NOT NULL;
    RAISE NOTICE 'granulo_points: % valeurs sieve_mm', v_sieve_count;
    
    SELECT COUNT(*) INTO v_passing_count FROM granulo_points WHERE passing_pct IS NOT NULL;
    RAISE NOTICE 'granulo_points: % valeurs passing_pct', v_passing_count;
END $$;

COMMIT;

RAISE NOTICE '✅ Migration terminée avec succès !';
