-- ============================================================================
-- Migration 019: Nettoyage des chaînes vides avant conversion de types
-- Date: 2025-11-15
-- Description: Remplace les chaînes vides '' par NULL pour permettre la
--              conversion TEXT → NUMERIC/UUID/JSONB/TIMESTAMPTZ
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE: echantillons
-- ============================================================================

UPDATE echantillons SET date = NULL WHERE date = '';
UPDATE echantillons SET rho_s_gcm3 = NULL WHERE rho_s_gcm3 = '';
UPDATE echantillons SET water_content_w = NULL WHERE water_content_w = '';
UPDATE echantillons SET is_index = NULL WHERE is_index = '';
UPDATE echantillons SET eg = NULL WHERE eg = '';
UPDATE echantillons SET meta = NULL WHERE meta = '';
UPDATE echantillons SET created_at = NULL WHERE created_at = '';
UPDATE echantillons SET updated_at = NULL WHERE updated_at = '';
UPDATE echantillons SET created_by = NULL WHERE created_by = '';
UPDATE echantillons SET updated_by = NULL WHERE updated_by = '';

-- ============================================================================
-- 2. TABLE: essais_physiques
-- ============================================================================

UPDATE essais_physiques SET densite_apparente_gcm3 = NULL WHERE densite_apparente_gcm3 = '';
UPDATE essais_physiques SET densite_absolue_gcm3 = NULL WHERE densite_absolue_gcm3 = '';
UPDATE essais_physiques SET teneur_eau_pct = NULL WHERE teneur_eau_pct = '';
UPDATE essais_physiques SET measured_at = NULL WHERE measured_at = '';
UPDATE essais_physiques SET meta = NULL WHERE meta = '';
UPDATE essais_physiques SET created_at = NULL WHERE created_at = '';
UPDATE essais_physiques SET updated_at = NULL WHERE updated_at = '';
UPDATE essais_physiques SET deleted_at = NULL WHERE deleted_at = '';
UPDATE essais_physiques SET created_by = NULL WHERE created_by = '';
UPDATE essais_physiques SET updated_by = NULL WHERE updated_by = '';

-- ============================================================================
-- 3. TABLE: essais_classif
-- ============================================================================

UPDATE essais_classif SET meta = NULL WHERE meta = '';
UPDATE essais_classif SET created_at = NULL WHERE created_at = '';
UPDATE essais_classif SET updated_at = NULL WHERE updated_at = '';
UPDATE essais_classif SET deleted_at = NULL WHERE deleted_at = '';
UPDATE essais_classif SET created_by = NULL WHERE created_by = '';
UPDATE essais_classif SET updated_by = NULL WHERE updated_by = '';

-- ============================================================================
-- 4. TABLE: granulo_points
-- ============================================================================

UPDATE granulo_points SET meta = NULL WHERE meta = '';
UPDATE granulo_points SET created_at = NULL WHERE created_at = '';

-- ============================================================================
-- 5. TABLE: essais_geotechniques
-- ============================================================================

UPDATE essais_geotechniques SET depth_m = NULL WHERE depth_m = '';
UPDATE essais_geotechniques SET passant_80um = NULL WHERE passant_80um = '';
UPDATE essais_geotechniques SET passant_2mm = NULL WHERE passant_2mm = '';
UPDATE essais_geotechniques SET passant_20mm = NULL WHERE passant_20mm = '';
UPDATE essais_geotechniques SET wl = NULL WHERE wl = '';
UPDATE essais_geotechniques SET wp = NULL WHERE wp = '';
UPDATE essais_geotechniques SET ip = NULL WHERE ip = '';
UPDATE essais_geotechniques SET vbs = NULL WHERE vbs = '';
UPDATE essais_geotechniques SET gamma_d_max = NULL WHERE gamma_d_max = '';
UPDATE essais_geotechniques SET w_opt = NULL WHERE w_opt = '';
UPDATE essais_geotechniques SET eg = NULL WHERE eg = '';
UPDATE essais_geotechniques SET test_date = NULL WHERE test_date = '';
UPDATE essais_geotechniques SET meta = NULL WHERE meta = '';
UPDATE essais_geotechniques SET created_at = NULL WHERE created_at = '';
UPDATE essais_geotechniques SET updated_at = NULL WHERE updated_at = '';
UPDATE essais_geotechniques SET deleted_at = NULL WHERE deleted_at = '';
UPDATE essais_geotechniques SET created_by = NULL WHERE created_by = '';
UPDATE essais_geotechniques SET updated_by = NULL WHERE updated_by = '';

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Vérifier qu'il ne reste plus de chaînes vides dans les colonnes numériques
    SELECT COUNT(*) INTO v_count FROM echantillons 
    WHERE rho_s_gcm3 = '' OR water_content_w = '' OR is_index = '' OR eg = '';
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Il reste % lignes avec des chaînes vides dans echantillons', v_count;
    END IF;
    
    RAISE NOTICE 'Migration 019 terminée avec succès';
    RAISE NOTICE '  - Toutes les chaînes vides remplacées par NULL';
    RAISE NOTICE '  - Base prête pour la conversion de types (migration 020)';
END $$;

COMMIT;
