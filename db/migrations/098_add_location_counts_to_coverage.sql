-- Migration 098: Ajouter compteurs exact/random aux vues de couverture
-- Pour implémenter les couleurs unifiées vert/bleu/gris selon localisation dominante

BEGIN;

-- ============================================================================
-- 1. Enrichir la vue de couverture 2km avec compteurs exact/random
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
    m.adm2_name
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
'Vue de couverture des mailles 2km avec compteurs de sondages par type de localisation (exact/random)';

-- ============================================================================
-- 2. Enrichir la vue de couverture 28km avec compteurs exact/random
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km AS
SELECT 
    m28.code,
    ST_Transform(m28.geom, 4326) AS geom,
    COALESCE(stats.n_sondages, 0) AS n_sondages,
    COALESCE(stats.n_sondages_exact, 0) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, 0) AS n_sondages_random,
    COALESCE(stats.n_echantillons, 0) AS n_echantillons,
    COALESCE(stats.n_mailles_2km, 0) AS n_mailles_2km,
    COALESCE(stats.n_mailles_2km_with_data, 0) AS n_mailles_2km_with_data
FROM atlas.mailles_28km m28
LEFT JOIN (
    SELECT 
        s.id_m28 AS code_28km,
        COUNT(DISTINCT s.id) AS n_sondages,
        SUM(CASE WHEN s.location_mode = 'exact' THEN 1 ELSE 0 END) AS n_sondages_exact,
        SUM(CASE WHEN s.location_mode IN ('adm_random_cell', 'adm_spread') THEN 1 ELSE 0 END) AS n_sondages_random,
        COUNT(DISTINCT e.id) AS n_echantillons,
        COUNT(DISTINCT s.maille_code) AS n_mailles_2km,
        COUNT(DISTINCT CASE WHEN s.maille_code IS NOT NULL THEN s.maille_code END) AS n_mailles_2km_with_data
    FROM atlas.sondages s
    LEFT JOIN atlas.echantillons e ON e.sondage_id = s.id
    WHERE s.id_m28 IS NOT NULL
    GROUP BY s.id_m28
) stats ON stats.code_28km = m28.code;

COMMENT ON VIEW atlas.v_coverage_mailles_28km IS 
'Vue de couverture des mailles 28km avec compteurs de sondages par type de localisation et nombre de mailles 2km';

-- ============================================================================
-- 3. Vérification
-- ============================================================================

DO $$
DECLARE
    v_total_2km int;
    v_with_exact int;
    v_with_random int;
    v_total_28km int;
BEGIN
    -- Stats 2km
    SELECT COUNT(*) INTO v_total_2km FROM atlas.v_coverage_mailles_2km WHERE n_sondages > 0;
    SELECT COUNT(*) INTO v_with_exact FROM atlas.v_coverage_mailles_2km WHERE n_sondages_exact > 0;
    SELECT COUNT(*) INTO v_with_random FROM atlas.v_coverage_mailles_2km WHERE n_sondages_random > 0;
    
    RAISE NOTICE '✓ Migration 098 terminée';
    RAISE NOTICE '  Mailles 2km avec données: %', v_total_2km;
    RAISE NOTICE '  Avec sondages exact: %', v_with_exact;
    RAISE NOTICE '  Avec sondages random: %', v_with_random;
    
    -- Stats 28km
    SELECT COUNT(*) INTO v_total_28km FROM atlas.v_coverage_mailles_28km WHERE n_sondages > 0;
    RAISE NOTICE '  Mailles 28km avec données: %', v_total_28km;
END $$;

COMMIT;
