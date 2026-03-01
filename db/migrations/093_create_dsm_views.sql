-- ============================================================================
-- Migration 093: Création des vues DSM par maille
-- Description:
--   Crée les vues pour agréger les statistiques d'altitude DSM COP30
--   par maille 2km et 28km
-- ============================================================================

BEGIN;

-- Vue agrégée DSM par maille 2km
CREATE OR REPLACE VIEW atlas.v_maille_dsm_2km AS
SELECT
    m.id,
    m.code,
    ST_SummaryStatsAgg(
        ST_Clip(r.rast, m.geom),
        1,
        TRUE
    ) AS stats
FROM atlas.mailles m
LEFT JOIN atlas.dsm_cop30 r
  ON ST_Intersects(m.geom, ST_ConvexHull(r.rast))
GROUP BY m.id, m.code;

COMMENT ON VIEW atlas.v_maille_dsm_2km IS 'Statistiques DSM COP30 agrégées par maille 2km';

-- Vue dépliée avec colonnes simples
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
WHERE (m.stats).count > 0;

COMMENT ON VIEW atlas.v_maille_dsm_2km_flat IS 'Statistiques DSM COP30 par maille 2km (colonnes dépliées)';

-- Vue agrégée DSM par maille 28km
CREATE OR REPLACE VIEW atlas.v_maille_dsm_28km AS
SELECT
    m.id_m28,
    m.code_m28,
    m.profil_num,
    ST_SummaryStatsAgg(
        ST_Clip(r.rast, m.geom),
        1,
        TRUE
    ) AS stats
FROM atlas.maille_28km m
LEFT JOIN atlas.dsm_cop30 r
  ON ST_Intersects(m.geom, ST_ConvexHull(r.rast))
GROUP BY m.id_m28, m.code_m28, m.profil_num;

COMMENT ON VIEW atlas.v_maille_dsm_28km IS 'Statistiques DSM COP30 agrégées par maille 28km';

-- Vue dépliée 28km
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
WHERE (m.stats).count > 0;

COMMENT ON VIEW atlas.v_maille_dsm_28km_flat IS 'Statistiques DSM COP30 par maille 28km (colonnes dépliées)';

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 093 terminée';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Vues créées:';
    RAISE NOTICE '  - atlas.v_maille_dsm_2km';
    RAISE NOTICE '  - atlas.v_maille_dsm_2km_flat';
    RAISE NOTICE '  - atlas.v_maille_dsm_28km';
    RAISE NOTICE '  - atlas.v_maille_dsm_28km_flat';
    RAISE NOTICE '';
    RAISE NOTICE 'ATTENTION: Les vues retourneront des données vides';
    RAISE NOTICE 'tant que le DSM n''est pas importé.';
    RAISE NOTICE 'Utilisez scripts/import_dsm_cop30.ps1';
END $$;

COMMIT;
