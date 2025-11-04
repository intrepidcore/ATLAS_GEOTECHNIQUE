-- Import projet: GAMBAGA Inoussa
-- Source: GAMBAGA Inoussa.md
-- Date: 2025-11-03T16:18:23.627279
-- Tables: 14


-- Sondage: 2.47
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-2.47', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-2.47';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, '{"reference": 2.0, "profondeursm": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
    INSERT INTO essais_physiques (id, essai_id, densite_absolue_gcm3)
    VALUES (gen_random_uuid(), v_essai_id, 2.47);
    
END $$;


-- Sondage: 2.39
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-2.39', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-2.39';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, '{"profondeursm": 1.5}'::jsonb)
    RETURNING id INTO v_essai_id;
    
    INSERT INTO essais_physiques (id, essai_id, densite_absolue_gcm3)
    VALUES (gen_random_uuid(), v_essai_id, 2.39);
    
END $$;


-- Sondage: 2.63
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-2.63', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-2.63';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, '{"profondeursm": 2.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
    INSERT INTO essais_physiques (id, essai_id, densite_absolue_gcm3)
    VALUES (gen_random_uuid(), v_essai_id, 2.63);
    
END $$;


-- Sondage: 2.51
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-2.51', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-2.51';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, '{"profondeursm": 1.5}'::jsonb)
    RETURNING id INTO v_essai_id;
    
    INSERT INTO essais_physiques (id, essai_id, densite_absolue_gcm3)
    VALUES (gen_random_uuid(), v_essai_id, 2.51);
    
END $$;


-- Sondage: 2.57
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-2.57', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-2.57';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, '{"profondeursm": 2.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
    INSERT INTO essais_physiques (id, essai_id, densite_absolue_gcm3)
    VALUES (gen_random_uuid(), v_essai_id, 2.57);
    
END $$;


-- Sondage: Sanfatoute
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-SANFATOUTE', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-SANFATOUTE';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, 57.57, 25.06, 7.31, '{"profondeur": 1.0, "ip": 32.51, "reference": 1.0, "profondeursm": 1.0, "teneur_en_eau": 9.82, "is": 0.171, "profondeurm": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-SANFATOUTE';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, 42.95, 29.96, 6.28, '{"profondeur": 1.5, "ip": 12.99, "reference": 1.0, "profondeursm": 1.5, "teneur_en_eau": 10.35, "is": 0.241}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-SANFATOUTE';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, 32.46, 23.83, 4.69, '{"profondeur": 2.0, "ip": 8.63, "reference": 1.0, "profondeursm": 2.0, "teneur_en_eau": 8.02, "is": 0.247}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;


-- Sondage: Korbongou
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'GAMBAGA-INOUSSA-KORBONGOU', 'GAMBAGA Inoussa', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-KORBONGOU';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, 39.6, 16.66, 4.4, '{"profondeur": 1.0, "ip": 22.94, "reference": 2.0, "profondeursm": 1.0, "teneur_en_eau": 8.17, "is": 0.206, "profondeurm": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-KORBONGOU';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, 33.47, 16.09, 3.98, '{"profondeur": 1.5, "ip": 17.38, "reference": 2.0, "profondeursm": 1.5, "teneur_en_eau": 7.52, "is": 0.225}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'GAMBAGA-INOUSSA-KORBONGOU';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, wl, wp, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, 24.24, 16.22, 2.48, '{"profondeur": 2.0, "ip": 8.02, "reference": 2.0, "profondeursm": 2.0, "teneur_en_eau": 6.21, "is": 0.256}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;


-- Statistiques: 7 sondages, 11 essais, 5 physiques, 0 classifications