-- Migration 100: Couleurs unifiées pour grilles 2km et 28km
-- Ajoute compteurs n_sondages_exact et n_sondages_random pour logique vert/bleu/gris

BEGIN;

-- ============================================================================
-- 1. Vue de couverture 2km avec compteurs exact/random
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_2km AS
SELECT 
    m.code,
    ST_Transform(m.geom, 4326) AS geom,
    COALESCE(stats.n_sondages, 0) AS n_sondages,
    COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, 0) AS n_sondages_random,
    COALESCE(stats.n_echantillons, 0) AS n_echantillons,
    m.pref_code,
    m.pref_name,
    m.adm2_name,
    m.id_m28
FROM atlas.mailles m
LEFT JOIN (
    SELECT 
        s.maille_code,
        COUNT(DISTINCT s.id) AS n_sondages,
        SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END) AS n_sondages_exact,
        SUM(CASE WHEN s.location_mode IN ('adm_random_cell', 'adm_spread') THEN 1 ELSE 0 END) AS n_sondages_random,
        COUNT(DISTINCT e.id) AS n_echantillons
    FROM atlas.sondages s
    LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
    WHERE s.maille_code IS NOT NULL
    GROUP BY s.maille_code
) stats ON stats.maille_code = m.code;

COMMENT ON VIEW atlas.v_coverage_mailles_2km IS 
'Vue de couverture mailles 2km avec compteurs exact/random pour couleurs unifiées (vert=exact dominant, bleu=random dominant, gris=sans données)';

-- ============================================================================
-- 2. Vue de couverture 28km avec compteurs exact/random
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km AS
SELECT 
    m28.id_m28,
    m28.code_m28,
    m28.profil_num,
    ST_Transform(m28.geom, 4326) AS geom,
    COALESCE(stats.n_sondages, 0) AS n_sondages,
    COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, 0) AS n_sondages_random,
    COALESCE(stats.n_echantillons, 0) AS n_echantillons,
    COALESCE(stats.n_essais, 0) AS n_essais,
    COALESCE(stats.n_mailles_2km, 0) AS n_mailles_2km,
    COALESCE(stats.n_mailles_2km_with_data, 0) AS n_mailles_2km_with_data
FROM atlas.maille_28km m28
LEFT JOIN (
    SELECT 
        s.id_m28,
        COUNT(DISTINCT s.id) AS n_sondages,
        SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END) AS n_sondages_exact,
        SUM(CASE WHEN s.location_mode IN ('adm_random_cell', 'adm_spread') THEN 1 ELSE 0 END) AS n_sondages_random,
        COUNT(DISTINCT e.id) AS n_echantillons,
        COUNT(DISTINCT eg.id) AS n_essais,
        COUNT(DISTINCT s.maille_code) AS n_mailles_2km,
        COUNT(DISTINCT CASE WHEN s.maille_code IS NOT NULL THEN s.maille_code END) AS n_mailles_2km_with_data
    FROM atlas.sondages s
    LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
    LEFT JOIN atlas.essais_geotechniques eg ON eg.echantillon_id = e.id
    WHERE s.id_m28 IS NOT NULL
    GROUP BY s.id_m28
) stats ON stats.id_m28 = m28.id_m28;

COMMENT ON VIEW atlas.v_coverage_mailles_28km IS 
'Vue de couverture mailles 28km avec compteurs exact/random pour couleurs unifiées et nombre de mailles 2km instrumentées';

-- ============================================================================
-- 3. Vérification et statistiques
-- ============================================================================

DO $$
DECLARE
    v_total_2km int;
    v_with_exact_2km int;
    v_with_random_2km int;
    v_total_28km int;
    v_with_data_28km int;
BEGIN
    -- Stats 2km
    SELECT COUNT(*) INTO v_total_2km FROM atlas.v_coverage_mailles_2km WHERE n_sondages > 0;
    SELECT COUNT(*) INTO v_with_exact_2km FROM atlas.v_coverage_mailles_2km WHERE n_sondages_exact > n_sondages_random;
    SELECT COUNT(*) INTO v_with_random_2km FROM atlas.v_coverage_mailles_2km WHERE n_sondages_random > n_sondages_exact;
    
    RAISE NOTICE '✓ Migration 100 terminée - Couleurs unifiées';
    RAISE NOTICE '  Mailles 2km avec données: %', v_total_2km;
    RAISE NOTICE '    → Vert (exact dominant): %', v_with_exact_2km;
    RAISE NOTICE '    → Bleu (random dominant): %', v_with_random_2km;
    RAISE NOTICE '    → Gris (sans données): %', (SELECT COUNT(*) FROM atlas.mailles) - v_total_2km;
    
    -- Stats 28km
    SELECT COUNT(*) INTO v_total_28km FROM atlas.maille_28km;
    SELECT COUNT(*) INTO v_with_data_28km FROM atlas.v_coverage_mailles_28km WHERE n_sondages > 0;
    
    RAISE NOTICE '  Mailles 28km total: %', v_total_28km;
    RAISE NOTICE '  Mailles 28km avec données: % (%.1f%%)', 
        v_with_data_28km, 
        (v_with_data_28km::float / v_total_28km * 100);
END $$;

COMMIT;
