-- ============================================================================
-- Migration 103: Vue mailles 28km clipées à la frontière ADM0 (Togo)
-- ============================================================================
-- Cette vue clip les mailles 28km à la frontière du Togo pour éviter
-- que les mailles dépassent la frontière nationale.
-- 
-- IMPORTANT: Ne modifie PAS la table de base atlas.maille_28km
-- Utilise ST_Intersection pour clipper à la volée
-- ============================================================================

-- Supprimer la vue si elle existe
DROP VIEW IF EXISTS atlas.v_mailles_28km_clip;

-- Créer la vue clipée
CREATE OR REPLACE VIEW atlas.v_mailles_28km_clip AS
WITH togo_boundary AS (
    -- Récupérer la géométrie de la frontière du Togo depuis adm0
    SELECT ST_Union(geom) as geom
    FROM public.adm0
    WHERE name ILIKE '%togo%' OR iso_a3 = 'TGO'
    LIMIT 1
)
SELECT 
    m.id_m28,
    m.code_m28,
    -- Clipper la géométrie à la frontière du Togo
    CASE 
        WHEN tb.geom IS NOT NULL THEN ST_Intersection(m.geom, tb.geom)
        ELSE m.geom
    END as geom,
    -- Conserver les attributs
    m.adm1_name,
    m.adm2_name,
    m.adm3_name
FROM atlas.maille_28km m
CROSS JOIN togo_boundary tb
WHERE ST_Intersects(m.geom, tb.geom);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_v_mailles_28km_clip_geom 
    ON atlas.maille_28km USING GIST (geom);

-- Commentaire
COMMENT ON VIEW atlas.v_mailles_28km_clip IS 
    'Vue des mailles 28km clipées à la frontière du Togo (ADM0). Utiliser cette vue pour l''affichage cartographique.';

-- ============================================================================
-- Vue de couverture 28km clipée (avec statistiques)
-- ============================================================================
DROP VIEW IF EXISTS atlas.v_coverage_mailles_28km_clip;

CREATE OR REPLACE VIEW atlas.v_coverage_mailles_28km_clip AS
WITH togo_boundary AS (
    SELECT ST_Union(geom) as geom
    FROM public.adm0
    WHERE name ILIKE '%togo%' OR iso_a3 = 'TGO'
    LIMIT 1
),
maille_stats AS (
    SELECT 
        m28.id_m28,
        m28.code_m28,
        CASE 
            WHEN tb.geom IS NOT NULL THEN ST_Intersection(m28.geom, tb.geom)
            ELSE m28.geom
        END as geom,
        m28.adm1_name,
        m28.adm2_name,
        -- Agrégation depuis les mailles 2km
        COALESCE(agg.n_sondages, 0) as n_sondages,
        COALESCE(agg.n_sondages_exact, 0) as n_sondages_exact,
        COALESCE(agg.n_sondages_random, 0) as n_sondages_random,
        COALESCE(agg.n_echantillons, 0) as n_echantillons,
        COALESCE(agg.n_mailles_2km, 0) as n_mailles_2km,
        COALESCE(agg.n_mailles_2km_with_data, 0) as n_mailles_2km_with_data,
        -- Flags booléens
        COALESCE(agg.n_sondages, 0) > 0 as has_data,
        COALESCE(agg.n_sondages_exact, 0) > 0 as has_exact_location,
        COALESCE(agg.n_sondages_random, 0) > 0 as has_random_location
    FROM atlas.maille_28km m28
    CROSS JOIN togo_boundary tb
    LEFT JOIN LATERAL (
        SELECT
            SUM(COALESCE(m2.n_sondages, 0))::bigint as n_sondages,
            SUM(COALESCE(m2.n_sondages_exact, 0))::bigint as n_sondages_exact,
            SUM(COALESCE(m2.n_sondages_random, 0))::bigint as n_sondages_random,
            SUM(COALESCE(m2.n_echantillons, 0))::bigint as n_echantillons,
            COUNT(*)::bigint as n_mailles_2km,
            COUNT(*) FILTER (WHERE COALESCE(m2.n_sondages, 0) > 0)::bigint as n_mailles_2km_with_data
        FROM mailles m2
        WHERE m2.id_m28 = m28.id_m28
    ) agg ON true
    WHERE ST_Intersects(m28.geom, tb.geom)
)
SELECT * FROM maille_stats;

COMMENT ON VIEW atlas.v_coverage_mailles_28km_clip IS 
    'Vue de couverture des mailles 28km clipées avec statistiques agrégées depuis les mailles 2km';
