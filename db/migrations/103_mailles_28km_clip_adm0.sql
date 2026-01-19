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
    -- Récupérer la géométrie de la frontière du Togo depuis adm0_raw
    -- Note: adm0_raw contient uniquement la géométrie du Togo en WGS84 (4326)
    -- Transformer en 25231 pour correspondre au SRID des mailles
    SELECT ST_Transform(ST_Union(geom), 25231) as geom
    FROM public.adm0_raw
    LIMIT 1
)
SELECT 
    m.id_m28,
    m.code_m28,
    m.code_lisible,
    m.profil_num,
    m.pk_min_km,
    m.pk_max_km,
    -- Clipper la géométrie à la frontière du Togo (les deux sont maintenant en 25231)
    CASE 
        WHEN tb.geom IS NOT NULL THEN ST_Intersection(m.geom, tb.geom)
        ELSE m.geom
    END as geom
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
    -- adm0_raw contient uniquement la géométrie du Togo en WGS84 (4326)
    -- Transformer en 25231 pour correspondre au SRID des mailles
    SELECT ST_Transform(ST_Union(geom), 25231) as geom
    FROM public.adm0_raw
    LIMIT 1
),
maille_stats AS (
    SELECT 
        m28.id_m28,
        m28.code_m28,
        m28.code_lisible,
        m28.profil_num,
        CASE 
            WHEN tb.geom IS NOT NULL THEN ST_Intersection(m28.geom, tb.geom)
            ELSE m28.geom
        END as geom,
        -- Agrégation depuis les mailles 2km via stats jsonb
        COALESCE(agg.n_sondages, 0)::bigint as n_sondages,
        COALESCE(agg.n_mailles_2km, 0)::bigint as n_mailles_2km,
        COALESCE(agg.n_mailles_2km_with_data, 0)::bigint as n_mailles_2km_with_data,
        COALESCE(agg.n_sondages, 0) > 0 as has_data
    FROM atlas.maille_28km m28
    CROSS JOIN togo_boundary tb
    LEFT JOIN LATERAL (
        SELECT
            SUM(COALESCE((m2.stats->>'n_sondages')::int, 0)) as n_sondages,
            COUNT(*)::int as n_mailles_2km,
            COUNT(*) FILTER (WHERE COALESCE((m2.stats->>'n_sondages')::int, 0) > 0)::int as n_mailles_2km_with_data
        FROM atlas.mailles m2
        WHERE m2.id_m28 = m28.id_m28
    ) agg ON true
    WHERE ST_Intersects(m28.geom, tb.geom)
)
SELECT * FROM maille_stats;

COMMENT ON VIEW atlas.v_coverage_mailles_28km_clip IS 
    'Vue de couverture des mailles 28km clipées avec statistiques agrégées depuis les mailles 2km';
