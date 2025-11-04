-- Import projet: NICABOU Ninsao Vianney
-- Source: NICABOU Ninsao Vianney.md
-- Date: 2025-11-03T16:18:23.637039
-- Tables: 29


-- Sondage: Apéhémé
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'NICABOU-NINSAO-VIANNEY-APÉHÉMÉ', 'NICABOU Ninsao Vianney', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-APÉHÉMÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, 2.0, '{"reference": 1.0, "profondeurs": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-APÉHÉMÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, 3.33, '{"reference": 1.0, "profondeurs": 1.5}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-APÉHÉMÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, 3.33, '{"reference": 1.0, "profondeurs": 2.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;


-- Sondage: Dzogbécopé
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'NICABOU-NINSAO-VIANNEY-DZOGBÉCOPÉ', 'NICABOU Ninsao Vianney', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-DZOGBÉCOPÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, 3.33, '{"reference": 2.0, "profondeurs": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-DZOGBÉCOPÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, 3.33, '{"reference": 2.0, "profondeurs": 1.5}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-DZOGBÉCOPÉ';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, 4.0, '{"reference": 2.0, "profondeurs": 2.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;


-- Sondage: Tekpo
INSERT INTO sondages (id, code, source, created_at)
VALUES (gen_random_uuid(), 'NICABOU-NINSAO-VIANNEY-TEKPO', 'NICABOU Ninsao Vianney', now())
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-TEKPO';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.0, 2.0, '{"reference": 3.0, "profondeurs": 1.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-TEKPO';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 1.5, 2.0, '{"reference": 3.0, "profondeurs": 1.5}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;

DO $$
DECLARE
    v_sondage_id uuid;
    v_essai_id uuid;
BEGIN
    SELECT id INTO v_sondage_id FROM sondages WHERE code = 'NICABOU-NINSAO-VIANNEY-TEKPO';
    
    INSERT INTO essais_geotechniques (id, sondage_id, depth_m, vbs, meta)
    VALUES (gen_random_uuid(), v_sondage_id, 2.0, 2.33, '{"reference": 3.0, "profondeurs": 2.0}'::jsonb)
    RETURNING id INTO v_essai_id;
    
END $$;


-- Statistiques: 3 sondages, 9 essais, 0 physiques, 0 classifications