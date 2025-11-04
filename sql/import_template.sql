-- Import manuel: TEMPLATE
-- Source: TEMPLATE.xlsx
-- Date: 2025-11-03
-- Lignes: 2

-- Créer sondage TEST-9034-415
INSERT INTO sondages (
    id, code, date, source, 
    geom, location_mode, is_geocoded,
    created_at
) VALUES (
    gen_random_uuid(),
    'TEST-9034-415',
    '2024-07-30'::date,
    'Lab C - Sokodé',
    ST_Transform(ST_SetSRID(ST_MakePoint(0.497, 10.3186), 4326), 25231),
    'exact',
    true,
    now()
) ON CONFLICT (code) DO NOTHING
RETURNING id;

-- Récupérer l'ID du sondage
DO $$
DECLARE
    v_sondage_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'TEST-9034-415';
    
    -- Essai 1: Profondeur 1.0m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, ip, vbs,
        gamma_d_max, w_opt, proctor_type,
        eg, laboratory, norm,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        1.0,
        47.9, 39.6, (47.9 - 39.6), 5.42,
        16.12, 22.9, 'normal',
        5.33, 'Lab C - Sokodé', 'NF P94-051',
        now()
    );
    
    -- Essai 2: Profondeur 3.4m
    INSERT INTO essais_geotechniques (
        id, sondage_id, depth_m,
        wl, wp, ip, vbs,
        gamma_d_max, w_opt, proctor_type,
        eg, laboratory, norm,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_sondage_id,
        3.4,
        45.5, 22.9, (45.5 - 22.9), 5.27,
        15.74, 21.2, 'normal',
        3.88, 'Lab C - Sokodé', 'NF P94-051',
        now()
    );
    
    RAISE NOTICE 'Import TEMPLATE terminé: 1 sondage, 2 essais';
END $$;
