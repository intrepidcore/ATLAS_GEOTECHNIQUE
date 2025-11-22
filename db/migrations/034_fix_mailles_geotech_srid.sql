-- Migration 034: Corriger la vue matérialisée mailles_geotech pour gérer les SRID
-- Problème: ST_Contains compare geom (25231) avec sondages.geom (4326) sans transformation
-- Solution: Transformer sondages.geom vers 25231 pour la comparaison

-- Drop et recréer la vue matérialisée avec transformation SRID
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech;

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
SELECT 
    m.id,
    m.code,
    m.geom,
    m.geom_4326,
    m.adm1_name,
    m.adm2_name,
    m.adm3_name,
    COUNT(DISTINCT s.id) AS nb_sondages_real,
    0 AS nb_sondages_spread,
    CASE 
        WHEN COUNT(DISTINCT s.id) > 0 THEN true 
        ELSE false 
    END AS has_data,
    CASE 
        WHEN COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'exact') > 0 THEN true 
        ELSE false 
    END AS has_exact_location,
    CASE 
        WHEN COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode IN ('adm_random_cell', 'random')) > 0 THEN true 
        ELSE false 
    END AS has_random_location
FROM mailles m
LEFT JOIN sondages s 
    ON ST_Contains(m.geom, ST_Transform(s.geom, 25231))  -- TRANSFORMATION SRID ICI
    AND s.deleted_at IS NULL
    AND s.geom IS NOT NULL  -- Seulement les sondages géocodés
GROUP BY m.id, m.code, m.geom, m.geom_4326, m.adm1_name, m.adm2_name, m.adm3_name;

-- Recréer les index
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON atlas.mv_mailles_geotech(id);
CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON atlas.mv_mailles_geotech USING GIST(geom_4326);

-- Commentaires
COMMENT ON MATERIALIZED VIEW atlas.mv_mailles_geotech IS 'Vue matérialisée des statistiques géotechniques par maille (2x2km). Transforme sondages.geom (4326) vers 25231 pour ST_Contains.';
COMMENT ON COLUMN atlas.mv_mailles_geotech.nb_sondages_real IS 'Nombre de sondages géocodés dans cette maille';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_data IS 'true si au moins un sondage géocodé';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_exact_location IS 'true si au moins un sondage avec location_mode=exact';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_random_location IS 'true si au moins un sondage avec location_mode=random ou adm_random_cell';

-- Refresh initial
REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
