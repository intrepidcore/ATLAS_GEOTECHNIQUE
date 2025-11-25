-- ============================================================================
-- Migration 043: Ajouter n_essais et n_echantillons à la vue matérialisée mailles
-- Date: 2025-11-25
-- Description: 
--   - Ajouter le comptage des essais (échantillons) par maille
--   - Définitions claires:
--     * n_echantillons = nombre d'échantillons distincts
--     * n_essais = nombre total d'essais (Atterberg + VBS + Physiques + Classification)
-- ============================================================================

-- Drop et recréer la vue matérialisée avec les nouveaux compteurs
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech;

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
WITH essais_counts AS (
    -- Pré-calculer le nombre d'essais par sondage
    SELECT 
        e.sondage_id,
        COUNT(DISTINCT ea.id) AS n_atterberg,
        COUNT(DISTINCT ev.id) AS n_vbs,
        COUNT(DISTINCT ep.id) AS n_physiques,
        COUNT(DISTINCT ec.id) AS n_classif
    FROM echantillons e
    LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
    LEFT JOIN essais_vbs ev ON ev.echantillon_id = e.id
    LEFT JOIN essais_physiques ep ON ep.echantillon_id = e.id
    LEFT JOIN essais_classif ec ON ec.echantillon_id = e.id
    GROUP BY e.sondage_id
)
SELECT 
    m.id,
    m.code,
    m.geom,
    m.geom_4326,
    m.adm1_name,
    m.adm2_name,
    m.adm3_name,
    -- Compteurs sondages
    COUNT(DISTINCT s.id) AS nb_sondages_real,
    0 AS nb_sondages_spread,
    -- Compteurs échantillons et essais
    COUNT(DISTINCT e.id) AS n_echantillons,
    COALESCE(SUM(ec.n_atterberg + ec.n_vbs + ec.n_physiques + ec.n_classif), 0)::bigint AS n_essais,
    -- Flags
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
    ON ST_Contains(m.geom, ST_Transform(s.geom, 25231))
    AND s.deleted_at IS NULL
    AND s.geom IS NOT NULL
LEFT JOIN echantillons e 
    ON e.sondage_id = s.id
LEFT JOIN essais_counts ec
    ON ec.sondage_id = s.id
GROUP BY m.id, m.code, m.geom, m.geom_4326, m.adm1_name, m.adm2_name, m.adm3_name;

-- Recréer les index
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON atlas.mv_mailles_geotech(id);
CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON atlas.mv_mailles_geotech USING GIST(geom_4326);
CREATE INDEX idx_mv_mailles_geotech_code ON atlas.mv_mailles_geotech(code);

-- Commentaires
COMMENT ON MATERIALIZED VIEW atlas.mv_mailles_geotech IS 
'Vue matérialisée des statistiques géotechniques par maille (2x2km). 
Inclut le comptage des sondages, échantillons et essais.';

COMMENT ON COLUMN atlas.mv_mailles_geotech.nb_sondages_real IS 'Nombre de sondages géocodés dans cette maille';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_echantillons IS 'Nombre d''échantillons distincts dans cette maille';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_essais IS 'Nombre total d''essais (Atterberg + VBS + Physiques + Classification)';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_data IS 'true si au moins un sondage géocodé';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_exact_location IS 'true si au moins un sondage avec location_mode=exact';
COMMENT ON COLUMN atlas.mv_mailles_geotech.has_random_location IS 'true si au moins un sondage avec location_mode=random ou adm_random_cell';

-- Refresh initial
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

DO $$ BEGIN
  RAISE NOTICE '✓ Vue matérialisée atlas.mv_mailles_geotech mise à jour avec n_echantillons et n_essais';
END $$;
