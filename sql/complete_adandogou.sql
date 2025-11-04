-- Compléter ADANDOGOU avec physiques (densités, teneur eau)
-- Date: 2025-11-03

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    -- KÉVÉ
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-KEVE';
    
    -- 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.28, 2.49, 14.61)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.28,
        densite_absolue_gcm3 = 2.49,
        teneur_eau_pct = 14.61;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'USCS', 'sol fin')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.16, 2.45, 11.29)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.16,
        densite_absolue_gcm3 = 2.45,
        teneur_eau_pct = 11.29;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'USCS', 'sol fin')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.22, 2.58, 4.4)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.22,
        densite_absolue_gcm3 = 2.58,
        teneur_eau_pct = 4.4;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'USCS', 'sol genu')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- ASSAHOUM
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-ASSAHOUM';
    
    -- 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.31, 2.44, 10.66)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.31,
        densite_absolue_gcm3 = 2.44,
        teneur_eau_pct = 10.66;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.25, 2.44, 28.37)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.25,
        densite_absolue_gcm3 = 2.44,
        teneur_eau_pct = 28.37;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Gravier et sable limoneux ou argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.33, 2.58, 20.97)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.33,
        densite_absolue_gcm3 = 2.58,
        teneur_eau_pct = 20.97;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Gravier et sable limoneux ou argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- BADJA
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-BADJA';
    
    -- 1m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.31, 2.37, 9.29)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.31,
        densite_absolue_gcm3 = 2.37,
        teneur_eau_pct = 9.29;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 1.5m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 1.5;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.32, 2.35, 14.44)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.32,
        densite_absolue_gcm3 = 2.35,
        teneur_eau_pct = 14.44;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Gravier et sable limoneux ou argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    -- 2m
    SELECT id INTO v_essai_id FROM essais_geotechniques WHERE sondage_id = v_sondage_id AND depth_m = 2.0;
    INSERT INTO essais_physiques (id, essai_id, densite_apparente_gcm3, densite_absolue_gcm3, teneur_eau_pct)
    VALUES (gen_random_uuid(), v_essai_id, 1.5, 2.31, 20.65)
    ON CONFLICT (essai_id) DO UPDATE SET
        densite_apparente_gcm3 = 1.5,
        densite_absolue_gcm3 = 2.31,
        teneur_eau_pct = 20.65;
    
    INSERT INTO essais_classif (id, essai_id, systeme, classe)
    VALUES (gen_random_uuid(), v_essai_id, 'AASHTO', 'Sol argileux')
    ON CONFLICT (essai_id, systeme) DO NOTHING;
    
    RAISE NOTICE 'ADANDOGOU complété: 9 essais avec physiques et classifications';
END $$;
