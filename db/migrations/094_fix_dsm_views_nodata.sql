-- ============================================================================
-- Migration 094: Correction des vues DSM pour filtrer les valeurs NoData
-- Description:
--   Corrige les vues DSM pour exclure les valeurs NoData/invalides
--   et ne conserver que les altitudes réalistes pour le Togo (-100m à 1000m)
-- ============================================================================

BEGIN;

-- Vue dépliée 2km avec filtrage des valeurs invalides
CREATE OR REPLACE VIEW atlas.v_maille_dsm_2km_flat AS
SELECT
    m.id,
    m.code,
    ROUND((m.stats).count::numeric, 0) AS nb_pixels,
    ROUND((m.stats).mean::numeric, 1) AS altitude_mean,
    ROUND((m.stats).min::numeric, 1) AS altitude_min,
    ROUND((m.stats).max::numeric, 1) AS altitude_max,
    ROUND((m.stats).stddev::numeric, 1) AS altitude_stddev,
    ROUND(((m.stats).max - (m.stats).min)::numeric, 1) AS altitude_range
FROM atlas.v_maille_dsm_2km m
WHERE (m.stats).count > 0
  AND (m.stats).mean > -100 
  AND (m.stats).mean < 1000
  AND (m.stats).min > -100
  AND (m.stats).max < 1000;

COMMENT ON VIEW atlas.v_maille_dsm_2km_flat IS 'Statistiques DSM COP30 par maille 2km (valeurs NoData filtrées)';

-- Vue dépliée 28km avec filtrage des valeurs invalides
CREATE OR REPLACE VIEW atlas.v_maille_dsm_28km_flat AS
SELECT
    m.id_m28,
    m.code_m28,
    m.profil_num,
    ROUND((m.stats).count::numeric, 0) AS nb_pixels,
    ROUND((m.stats).mean::numeric, 1) AS altitude_mean,
    ROUND((m.stats).min::numeric, 1) AS altitude_min,
    ROUND((m.stats).max::numeric, 1) AS altitude_max,
    ROUND((m.stats).stddev::numeric, 1) AS altitude_stddev,
    ROUND(((m.stats).max - (m.stats).min)::numeric, 1) AS altitude_range
FROM atlas.v_maille_dsm_28km m
WHERE (m.stats).count > 0
  AND (m.stats).mean > -100
  AND (m.stats).mean < 1000
  AND (m.stats).min > -100
  AND (m.stats).max < 1000;

COMMENT ON VIEW atlas.v_maille_dsm_28km_flat IS 'Statistiques DSM COP30 par maille 28km (valeurs NoData filtrées)';

-- Vérification
DO $$
DECLARE
    v_count_2km int;
    v_count_28km int;
BEGIN
    SELECT COUNT(*) INTO v_count_2km FROM atlas.v_maille_dsm_2km_flat;
    SELECT COUNT(*) INTO v_count_28km FROM atlas.v_maille_dsm_28km_flat;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 094 terminée';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Vues DSM corrigées (filtrage NoData):';
    RAISE NOTICE '  - Mailles 2km avec DSM valide: %', v_count_2km;
    RAISE NOTICE '  - Mailles 28km avec DSM valide: %', v_count_28km;
END $$;

COMMIT;
