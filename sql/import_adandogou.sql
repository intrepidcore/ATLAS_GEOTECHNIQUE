-- Import manuel: ADANDOGOU Afiwa Pamela PAS TERMINE
-- Source: ADANDOGOU Afiwa Pamela PAS TERMINE.xlsx
-- Date: 2025-11-03
-- Localités: Kévé, Assahoum, Badja
-- Données: Atterberg + VBS

-- ============================================================================
-- LOCALITÉ: Kévé
-- ============================================================================

-- Créer sondage Kévé (sans géométrie)
INSERT INTO sondages (
    id, code, source,
    created_at
) VALUES (
    gen_random_uuid(),
    'ADANDOGOU-KEVE',
    'ADANDOGOU Afiwa Pamela',
    now()
) ON CONFLICT (code) DO NOTHING;

-- Récupérer l'ID
DO $$
DECLARE
    v_sondage_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-KEVE';
    
    -- Essai profondeur 1m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.0,
        53, 23, 4.02,
        now()
    );
    
    -- Essai profondeur 1.5m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.5,
        48, 21, 3.61,
        now()
    );
    
    -- Essai profondeur 2m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        2.0,
        51, 22, 1.22,
        now()
    );
    
    RAISE NOTICE 'Kévé: 3 essais importés';
END $$;

-- ============================================================================
-- LOCALITÉ: Assahoum
-- ============================================================================

-- Créer sondage Assahoum (sans géométrie)
INSERT INTO sondages (
    id, code, source,
    created_at
) VALUES (
    gen_random_uuid(),
    'ADANDOGOU-ASSAHOUM',
    'ADANDOGOU Afiwa Pamela',
    now()
) ON CONFLICT (code) DO NOTHING;

-- Récupérer l'ID
DO $$
DECLARE
    v_sondage_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-ASSAHOUM';
    
    -- Essai profondeur 1m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.0,
        24, 12, 1.83,
        now()
    );
    
    -- Essai profondeur 1.5m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.5,
        41, 19, 3.82,
        now()
    );
    
    -- Essai profondeur 2m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        2.0,
        42, 22, 2.64,
        now()
    );
    
    RAISE NOTICE 'Assahoum: 3 essais importés';
END $$;

-- ============================================================================
-- LOCALITÉ: Badja
-- ============================================================================

-- Créer sondage Badja (sans géométrie)
INSERT INTO sondages (
    id, code, source,
    created_at
) VALUES (
    gen_random_uuid(),
    'ADANDOGOU-BADJA',
    'ADANDOGOU Afiwa Pamela',
    now()
) ON CONFLICT (code) DO NOTHING;

-- Récupérer l'ID
DO $$
DECLARE
    v_sondage_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'ADANDOGOU-BADJA';
    
    -- Essai profondeur 1m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.0,
        49, 18, 4.6,
        now()
    );
    
    -- Essai profondeur 1.5m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.5,
        53, 18, 4.03,
        now()
    );
    
    -- Essai profondeur 2m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, vbs,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        2.0,
        51, 17, 5.03,
        now()
    );
    
    RAISE NOTICE 'Badja: 3 essais importés';
END $$;

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================
-- 3 sondages créés (Kévé, Assahoum, Badja)
-- 9 essais géotechniques importés (3 par sondage)
-- Données: WL, WP, IP, VBS
