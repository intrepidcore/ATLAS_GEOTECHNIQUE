-- Import complet: ADANDOGOU Afiwa Pamela PAS TERMINE
-- Mise à jour avec densité, teneur en eau, et classification
-- Date: 2025-11-03

-- ============================================================================
-- UPDATE: Ajouter densité et teneur en eau aux essais existants
-- ============================================================================

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    -- ========================================================================
    -- KÉVÉ
    -- ========================================================================
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-KEVE';
    
    -- Profondeur 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    
    UPDATE essais_geotechniques SET
        meta = jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(meta, '{densite_apparente}', '1.28'),
                        '{densite_absolue}', '2.49'),
                    '{teneur_eau}', '14.61'),
                '{classification_hrb}', '"Sol argileux"'),
            '{classification_uscs}', '"sol fin"'),
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.16,
        densite_absolue = 2.45,
        teneur_eau = 11.29,
        classification_hrb = 'Sol argileux',
        classification_uscs = 'sol fin',
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.22,
        densite_absolue = 2.58,
        teneur_eau = 4.4,
        classification_hrb = 'Sol argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    RAISE NOTICE 'Kévé: 3 essais mis à jour avec densité et teneur en eau';
    
    -- ========================================================================
    -- ASSAHOUM
    -- ========================================================================
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-ASSAHOUM';
    
    -- Profondeur 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.31,
        densite_absolue = 2.44,
        teneur_eau = 10.66,
        classification_hrb = 'Sol argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.25,
        densite_absolue = 2.44,
        teneur_eau = 28.37,
        classification_hrb = 'Gravier et sable limoneux ou argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.33,
        densite_absolue = 2.58,
        teneur_eau = 20.97,
        classification_hrb = 'Gravier et sable limoneux ou argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    RAISE NOTICE 'Assahoum: 3 essais mis à jour avec densité et teneur en eau';
    
    -- ========================================================================
    -- BADJA
    -- ========================================================================
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-BADJA';
    
    -- Profondeur 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.31,
        densite_absolue = 2.37,
        teneur_eau = 9.29,
        classification_hrb = 'Sol argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.32,
        densite_absolue = 2.35,
        teneur_eau = 14.44,
        classification_hrb = 'Gravier et sable limoneux ou argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    -- Profondeur 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques 
    WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    
    UPDATE essais_geotechniques SET
        densite_apparente = 1.5,
        densite_absolue = 2.31,
        teneur_eau = 20.65,
        classification_hrb = 'Sol argileux',
        classification_uscs = 'sol genu',
        updated_at = now()
    WHERE id = v_essai_id;
    
    RAISE NOTICE 'Badja: 3 essais mis à jour avec densité et teneur en eau';
    
END $$;

-- ============================================================================
-- RÉSUMÉ COMPLET
-- ============================================================================
-- 3 sondages: Kévé, Assahoum, Badja
-- 9 essais géotechniques complets avec:
--   - WL, WP (IP calculé automatiquement)
--   - VBS
--   - Densité apparente et absolue
--   - Teneur en eau
--   - Classification HRB et USCS
-- Note: Données granulométriques détaillées (AGT/AGS) non importées (trop volumineuses)
