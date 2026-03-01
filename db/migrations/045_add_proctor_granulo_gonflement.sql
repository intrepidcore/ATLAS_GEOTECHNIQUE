-- ============================================================================
-- Migration 045: Ajouter Proctor, Granulo, Gonflement à la vue matérialisée
-- Date: 2025-11-26
-- Description: 
--   - Ajouter n_proctor, n_granulo, n_gonflement par maille
--   - Mettre à jour n_essais pour inclure ces 3 nouveaux types
--   - Ajouter colonne ip calculé dans essais_atterberg si manquant
-- ============================================================================

-- 1) S'assurer que la colonne IP existe dans essais_atterberg
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'atlas' 
        AND table_name = 'essais_atterberg' 
        AND column_name = 'ip'
    ) THEN
        ALTER TABLE atlas.essais_atterberg ADD COLUMN ip numeric GENERATED ALWAYS AS (wl - wp) STORED;
        RAISE NOTICE '✓ Colonne IP ajoutée à essais_atterberg (calculée automatiquement)';
    ELSE
        RAISE NOTICE '→ Colonne IP existe déjà dans essais_atterberg';
    END IF;
END $$;

-- 2) Drop et recréer la vue matérialisée avec les 7 types d'essais
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_mailles_geotech;

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
WITH essais_counts AS (
    -- Pré-calculer le nombre d'essais par sondage et par type
    SELECT 
        e.sondage_id,
        COUNT(DISTINCT ea.id) AS n_atterberg,
        COUNT(DISTINCT ev.id) AS n_vbs,
        COUNT(DISTINCT ep.id) AS n_physiques,
        COUNT(DISTINCT ec.id) AS n_classif,
        COUNT(DISTINCT epr.id) AS n_proctor,
        COUNT(DISTINCT eg.id) AS n_granulo,
        COUNT(DISTINCT egf.id) AS n_gonflement
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
    -- Compteurs essais par type (7 types)
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

-- Commentaires
COMMENT ON MATERIALIZED VIEW atlas.mv_mailles_geotech IS 
'Vue matérialisée des statistiques géotechniques par maille (2x2km). 
Inclut le comptage des sondages, échantillons et 7 types d''essais.';

COMMENT ON COLUMN atlas.mv_mailles_geotech.n_proctor IS 'Nombre d''essais Proctor';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_granulo IS 'Nombre de points granulométriques';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_gonflement IS 'Nombre d''essais de potentiel de gonflement';
COMMENT ON COLUMN atlas.mv_mailles_geotech.n_essais IS 'Nombre total d''essais (7 types)';

-- Refresh initial
REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;

DO $$ BEGIN
  RAISE NOTICE '✓ Vue matérialisée mise à jour avec 7 types d''essais (Atterberg, VBS, Physiques, Classif, Proctor, Granulo, Gonflement)';
END $$;
