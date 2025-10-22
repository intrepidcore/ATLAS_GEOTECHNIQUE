DO $$
DECLARE
    sondage_ids uuid[];
    sondage_id uuid;
    i int;
    soil_type text;
    depth_val numeric;
    passant_80um_val numeric;
    passant_2mm_val numeric;
    wl_val numeric;
    wp_val numeric;
    vbs_val numeric;
    gamma_d_max_val numeric;
    w_opt_val numeric;
    eg_val numeric;
BEGIN
    SELECT array_agg(id) INTO sondage_ids FROM sondages LIMIT 200;
    
    FOR i IN 1..200 LOOP
        sondage_id := sondage_ids[1 + floor(random() * array_length(sondage_ids, 1))::int];
        soil_type := (ARRAY['argileux', 'limoneux', 'sableux', 'graveleux'])[1 + floor(random() * 4)::int];
        depth_val := 1 + random() * 14;
        
        CASE soil_type
            WHEN 'argileux' THEN
                passant_80um_val := 50 + random() * 40;
                passant_2mm_val := 85 + random() * 15;
                wl_val := 40 + random() * 50;
                wp_val := wl_val - 15 - random() * 10;
                vbs_val := 2.5 + random() * 5.5;
                gamma_d_max_val := 15 + random() * 3;
                w_opt_val := 18 + random() * 10;
                eg_val := 2 + random() * 10;
            WHEN 'limoneux' THEN
                passant_80um_val := 35 + random() * 25;
                passant_2mm_val := 70 + random() * 25;
                wl_val := 25 + random() * 20;
                wp_val := wl_val - 10 - random() * 5;
                vbs_val := 1 + random() * 2;
                gamma_d_max_val := 17 + random() * 2;
                w_opt_val := 12 + random() * 8;
                eg_val := 0.5 + random() * 2.5;
            WHEN 'sableux' THEN
                passant_80um_val := 5 + random() * 20;
                passant_2mm_val := 50 + random() * 35;
                wl_val := 15 + random() * 15;
                wp_val := wl_val - 5 - random() * 5;
                vbs_val := random();
                gamma_d_max_val := 18 + random() * 3;
                w_opt_val := 8 + random() * 6;
                eg_val := random() * 0.8;
            ELSE -- graveleux
                passant_80um_val := random() * 15;
                passant_2mm_val := 20 + random() * 40;
                wl_val := NULL;
                wp_val := NULL;
                vbs_val := random() * 0.5;
                gamma_d_max_val := 19 + random() * 3;
                w_opt_val := 6 + random() * 4;
                eg_val := random() * 0.3;
        END CASE;
        
        INSERT INTO essais_geotechniques 
        (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, proctor_type, eg, test_date, laboratory, norm)
        VALUES (
            sondage_id,
            round(depth_val::numeric, 1),
            round(passant_80um_val::numeric, 2),
            round(passant_2mm_val::numeric, 2),
            round(wl_val::numeric, 2),
            round(wp_val::numeric, 2),
            round(vbs_val::numeric, 2),
            round(gamma_d_max_val::numeric, 2),
            round(w_opt_val::numeric, 2),
            (ARRAY['normal', 'modifie'])[1 + floor(random() * 2)::int],
            round(eg_val::numeric, 2),
            CURRENT_DATE - (random() * 365)::int,
            (ARRAY['Lab A', 'Lab B', 'Lab C'])[1 + floor(random() * 3)::int],
            'NF P94-051'
        );
    END LOOP;
    
    RAISE NOTICE '✅ 200 essais insérés';
    REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;
    RAISE NOTICE '✅ Vue matérialisée rafraîchie';
END $$;

SELECT COUNT(*) as essais_total FROM essais_geotechniques;
SELECT COUNT(*) as mailles_avec_donnees FROM mailles_geotechnique_stats WHERE n_essais_geo > 0;
