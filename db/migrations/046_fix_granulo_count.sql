-- ============================================================================
-- Migration 046: Corriger le comptage granulo (1 par échantillon, pas par point)
-- Date: 2025-11-26
-- Description: 
--   - granulo_points contient plusieurs points par échantillon (courbe granulo)
--   - On doit compter 1 essai granulo par échantillon, pas par point
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech;

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
WITH essais_counts AS (
    -- Pré-calculer le nombre d'essais par sondage et par type
    -- IMPORTANT: Pour granulo, on compte les échantillons distincts ayant des points
    SELECT 
        e.sondage_id,
        COUNT(DISTINCT ea.echantillon_id) AS n_atterberg,
        COUNT(DISTINCT ev.echantillon_id) AS n_vbs,
        COUNT(DISTINCT ep.echantillon_id) AS n_physiques,
        COUNT(DISTINCT ec.echantillon_id) AS n_classif,
        COUNT(DISTINCT epr.echantillon_id) AS n_proctor,
        COUNT(DISTINCT eg.echantillon_id) AS n_granulo,  -- 1 par échantillon, pas par point
        COUNT(DISTINCT egf.echantillon_id) AS n_gonflement
    FROM echantillons e
    LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
    LEFT JOIN essais_vbs ev ON ev.echantillon_id = e.id
    LEFT JOIN essais_physiques ep ON ep.echantillon_id = e.id
    LEFT JOIN essais_classif ec ON ec.echantillon_id = e.id
    LEFT JOIN essais_proctor epr ON epr.echantillon_id = e.id
    LEFT JOIN granulo_points eg ON eg.echantillon_id = e.id
    LEFT JOIN essais_potentiel_gonflement egf ON egf.echantillon_id = e.id
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
    -- Compteurs échantillons
    COUNT(DISTINCT e.id) AS n_echantillons,
    -- Compteurs essais par type (7 types) - corrigé pour granulo
    COALESCE(SUM(ec.n_atterberg), 0)::bigint AS n_atterberg,
    COALESCE(SUM(ec.n_vbs), 0)::bigint AS n_vbs,
    COALESCE(SUM(ec.n_physiques), 0)::bigint AS n_physiques,
    COALESCE(SUM(ec.n_classif), 0)::bigint AS n_classif,
    COALESCE(SUM(ec.n_proctor), 0)::bigint AS n_proctor,
    COALESCE(SUM(ec.n_granulo), 0)::bigint AS n_granulo,
    COALESCE(SUM(ec.n_gonflement), 0)::bigint AS n_gonflement,
    -- Total essais (somme des 7 types)
    COALESCE(SUM(
        ec.n_atterberg + ec.n_vbs + ec.n_physiques + ec.n_classif + 
        ec.n_proctor + ec.n_granulo + ec.n_gonflement
    ), 0)::bigint AS n_essais,
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

-- Refresh initial
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

DO $$ BEGIN
  RAISE NOTICE '✓ Vue matérialisée corrigée: granulo compte 1 par échantillon (pas par point)';
END $$;
