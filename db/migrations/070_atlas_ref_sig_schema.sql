-- ============================================
-- Migration 070: Schéma SIG de référence Atlas
-- ============================================
-- Ce script crée l'architecture pour les données SIG de référence
-- (routes, localités, bâtiments, hydrographie, limites admin)
-- 
-- Les tables sont créées vides, prêtes à recevoir les données NextGIS
-- ou d'autres sources de données géographiques.
--
-- SRID 25231 = UTM Zone 31N (Togo)
-- ============================================

-- ===========================================
-- 1. CRÉATION DES SCHÉMAS
-- ===========================================

-- Schéma pour les données de référence (NextGIS, OSM, etc.)
CREATE SCHEMA IF NOT EXISTS atlas_ref;
COMMENT ON SCHEMA atlas_ref IS 'Données SIG de référence (routes, localités, bâtiments, hydro, admin)';

-- Schéma pour les corrections terrain (étudiants, QField)
CREATE SCHEMA IF NOT EXISTS atlas_terrain;
COMMENT ON SCHEMA atlas_terrain IS 'Corrections et ajouts terrain par les étudiants';

-- ===========================================
-- 2. TABLES DE RÉFÉRENCE (atlas_ref)
-- ===========================================

-- -----------------------------------------
-- 2.1 Routes et pistes
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.routes_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,                    -- ID OpenStreetMap original
    name TEXT,                        -- Nom de la route
    name_fr TEXT,                     -- Nom en français
    highway TEXT,                     -- Type OSM (primary, secondary, track, etc.)
    surface TEXT,                     -- Revêtement (asphalt, unpaved, etc.)
    width NUMERIC(5,2),               -- Largeur en mètres
    lanes INTEGER,                    -- Nombre de voies
    oneway BOOLEAN DEFAULT FALSE,     -- Sens unique
    bridge BOOLEAN DEFAULT FALSE,     -- Pont
    tunnel BOOLEAN DEFAULT FALSE,     -- Tunnel
    ref TEXT,                         -- Référence (ex: N1, RN2)
    source TEXT DEFAULT 'nextgis',    -- Source des données
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiLineString, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS routes_25231_geom_idx 
ON atlas_ref.routes_25231 USING GIST (geom);

CREATE INDEX IF NOT EXISTS routes_25231_highway_idx 
ON atlas_ref.routes_25231 (highway);

COMMENT ON TABLE atlas_ref.routes_25231 IS 'Routes et pistes du Togo (EPSG:25231)';

-- -----------------------------------------
-- 2.2 Localités - Points (villages, villes)
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.localites_points_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    name_fr TEXT,
    place TEXT,                       -- Type OSM (city, town, village, hamlet)
    population INTEGER,               -- Population estimée
    is_capital BOOLEAN DEFAULT FALSE, -- Capitale régionale/nationale
    admin_level INTEGER,              -- Niveau administratif
    adm1_code TEXT,                   -- Code région
    adm2_code TEXT,                   -- Code préfecture
    adm3_code TEXT,                   -- Code commune
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(Point, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS localites_points_25231_geom_idx 
ON atlas_ref.localites_points_25231 USING GIST (geom);

CREATE INDEX IF NOT EXISTS localites_points_25231_place_idx 
ON atlas_ref.localites_points_25231 (place);

COMMENT ON TABLE atlas_ref.localites_points_25231 IS 'Localités ponctuelles (villages, villes) du Togo';

-- -----------------------------------------
-- 2.3 Localités - Polygones (emprises urbaines)
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.localites_polygons_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    name_fr TEXT,
    place TEXT,
    landuse TEXT,                     -- Type d'occupation (residential, commercial)
    population INTEGER,
    area_km2 NUMERIC(10,4),           -- Surface en km²
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiPolygon, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS localites_polygons_25231_geom_idx 
ON atlas_ref.localites_polygons_25231 USING GIST (geom);

COMMENT ON TABLE atlas_ref.localites_polygons_25231 IS 'Emprises urbaines du Togo';

-- -----------------------------------------
-- 2.4 Bâtiments
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.batiments_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    building TEXT,                    -- Type (yes, residential, commercial, school, hospital)
    building_levels INTEGER,          -- Nombre d'étages
    height NUMERIC(6,2),              -- Hauteur en mètres
    amenity TEXT,                     -- Équipement (school, hospital, etc.)
    area_m2 NUMERIC(12,2),            -- Surface au sol en m²
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiPolygon, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS batiments_25231_geom_idx 
ON atlas_ref.batiments_25231 USING GIST (geom);

CREATE INDEX IF NOT EXISTS batiments_25231_building_idx 
ON atlas_ref.batiments_25231 (building);

COMMENT ON TABLE atlas_ref.batiments_25231 IS 'Bâtiments du Togo';

-- -----------------------------------------
-- 2.5 Hydrographie - Cours d'eau (lignes)
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.hydro_cours_eau_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    name_fr TEXT,
    waterway TEXT,                    -- Type (river, stream, canal, drain)
    width NUMERIC(6,2),               -- Largeur en mètres
    intermittent BOOLEAN DEFAULT FALSE, -- Cours d'eau temporaire
    seasonal BOOLEAN DEFAULT FALSE,   -- Saisonnier
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiLineString, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS hydro_cours_eau_25231_geom_idx 
ON atlas_ref.hydro_cours_eau_25231 USING GIST (geom);

COMMENT ON TABLE atlas_ref.hydro_cours_eau_25231 IS 'Cours d''eau du Togo (rivières, ruisseaux)';

-- -----------------------------------------
-- 2.6 Hydrographie - Surfaces (lacs, mares)
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.hydro_surfaces_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    name_fr TEXT,
    water TEXT,                       -- Type (lake, pond, reservoir)
    natural_type TEXT,                -- Type naturel (water, wetland)
    intermittent BOOLEAN DEFAULT FALSE,
    area_km2 NUMERIC(10,4),
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiPolygon, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS hydro_surfaces_25231_geom_idx 
ON atlas_ref.hydro_surfaces_25231 USING GIST (geom);

COMMENT ON TABLE atlas_ref.hydro_surfaces_25231 IS 'Plans d''eau du Togo (lacs, mares, réservoirs)';

-- -----------------------------------------
-- 2.7 Limites administratives
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS atlas_ref.admin_limites_25231 (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT,
    name TEXT,
    name_fr TEXT,
    admin_level INTEGER,              -- Niveau (2=pays, 4=région, 6=préfecture, 8=commune)
    boundary TEXT,                    -- Type (administrative)
    ref TEXT,                         -- Code de référence
    population INTEGER,
    area_km2 NUMERIC(12,4),
    parent_id INTEGER REFERENCES atlas_ref.admin_limites_25231(id),
    source TEXT DEFAULT 'nextgis',
    import_date TIMESTAMPTZ DEFAULT NOW(),
    geom GEOMETRY(MultiPolygon, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_limites_25231_geom_idx 
ON atlas_ref.admin_limites_25231 USING GIST (geom);

CREATE INDEX IF NOT EXISTS admin_limites_25231_level_idx 
ON atlas_ref.admin_limites_25231 (admin_level);

COMMENT ON TABLE atlas_ref.admin_limites_25231 IS 'Limites administratives du Togo';

-- ===========================================
-- 3. VUES PROPRES POUR L'API
-- ===========================================

-- Vue routes pour l'API
CREATE OR REPLACE VIEW atlas_ref.v_routes_atlas AS
SELECT
    id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    highway,
    surface,
    ref,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.routes_25231;

COMMENT ON VIEW atlas_ref.v_routes_atlas IS 'Vue des routes pour l''API Atlas';

-- Vue localités pour l'API
CREATE OR REPLACE VIEW atlas_ref.v_localites_atlas AS
SELECT
    id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    place AS type,
    population,
    is_capital,
    adm1_code,
    adm2_code,
    adm3_code,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.localites_points_25231;

COMMENT ON VIEW atlas_ref.v_localites_atlas IS 'Vue des localités pour l''API Atlas';

-- Vue bâtiments pour l'API
CREATE OR REPLACE VIEW atlas_ref.v_batiments_atlas AS
SELECT
    id,
    osm_id,
    name,
    building AS type,
    building_levels AS levels,
    amenity,
    area_m2,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.batiments_25231;

COMMENT ON VIEW atlas_ref.v_batiments_atlas IS 'Vue des bâtiments pour l''API Atlas';

-- Vue hydrographie pour l'API
CREATE OR REPLACE VIEW atlas_ref.v_hydro_atlas AS
SELECT
    'cours_eau' AS layer,
    id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    waterway AS type,
    intermittent,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.hydro_cours_eau_25231
UNION ALL
SELECT
    'surface' AS layer,
    id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    water AS type,
    intermittent,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.hydro_surfaces_25231;

COMMENT ON VIEW atlas_ref.v_hydro_atlas IS 'Vue de l''hydrographie pour l''API Atlas';

-- Vue limites admin pour l'API
CREATE OR REPLACE VIEW atlas_ref.v_admin_atlas AS
SELECT
    id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    admin_level,
    ref AS code,
    population,
    area_km2,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    geom
FROM atlas_ref.admin_limites_25231;

COMMENT ON VIEW atlas_ref.v_admin_atlas IS 'Vue des limites administratives pour l''API Atlas';

-- ===========================================
-- 4. TABLES TERRAIN (atlas_terrain)
-- ===========================================

-- Table pour les corrections de routes par les étudiants
CREATE TABLE IF NOT EXISTS atlas_terrain.routes_corrections (
    id SERIAL PRIMARY KEY,
    route_ref_id INTEGER REFERENCES atlas_ref.routes_25231(id),
    correction_type TEXT NOT NULL,    -- 'add', 'modify', 'delete'
    name TEXT,
    highway TEXT,
    surface TEXT,
    comment TEXT,
    submitted_by UUID,                -- ID utilisateur
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    validated BOOLEAN DEFAULT FALSE,
    validated_by UUID,
    validated_at TIMESTAMPTZ,
    geom GEOMETRY(MultiLineString, 25231)
);

CREATE INDEX IF NOT EXISTS routes_corrections_geom_idx 
ON atlas_terrain.routes_corrections USING GIST (geom);

COMMENT ON TABLE atlas_terrain.routes_corrections IS 'Corrections de routes soumises par les étudiants';

-- Table pour les POI terrain
CREATE TABLE IF NOT EXISTS atlas_terrain.poi_terrain (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,                    -- 'infrastructure', 'service', 'danger', etc.
    description TEXT,
    photo_url TEXT,
    submitted_by UUID,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    validated BOOLEAN DEFAULT FALSE,
    validated_by UUID,
    validated_at TIMESTAMPTZ,
    geom GEOMETRY(Point, 25231) NOT NULL
);

CREATE INDEX IF NOT EXISTS poi_terrain_geom_idx 
ON atlas_terrain.poi_terrain USING GIST (geom);

COMMENT ON TABLE atlas_terrain.poi_terrain IS 'Points d''intérêt collectés sur le terrain';

-- ===========================================
-- 5. FONCTIONS UTILITAIRES
-- ===========================================

-- Fonction pour compter les features par table
CREATE OR REPLACE FUNCTION atlas_ref.get_layer_stats()
RETURNS TABLE (
    layer_name TEXT,
    feature_count BIGINT,
    last_import TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'routes'::TEXT, COUNT(*)::BIGINT, MAX(import_date) FROM atlas_ref.routes_25231
    UNION ALL
    SELECT 'localites_points', COUNT(*), MAX(import_date) FROM atlas_ref.localites_points_25231
    UNION ALL
    SELECT 'localites_polygons', COUNT(*), MAX(import_date) FROM atlas_ref.localites_polygons_25231
    UNION ALL
    SELECT 'batiments', COUNT(*), MAX(import_date) FROM atlas_ref.batiments_25231
    UNION ALL
    SELECT 'hydro_cours_eau', COUNT(*), MAX(import_date) FROM atlas_ref.hydro_cours_eau_25231
    UNION ALL
    SELECT 'hydro_surfaces', COUNT(*), MAX(import_date) FROM atlas_ref.hydro_surfaces_25231
    UNION ALL
    SELECT 'admin_limites', COUNT(*), MAX(import_date) FROM atlas_ref.admin_limites_25231;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas_ref.get_layer_stats() IS 'Retourne les statistiques des couches SIG';

-- ===========================================
-- 6. PERMISSIONS
-- ===========================================

-- Donner accès en lecture au rôle atlas (API)
GRANT USAGE ON SCHEMA atlas_ref TO atlas;
GRANT SELECT ON ALL TABLES IN SCHEMA atlas_ref TO atlas;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA atlas_ref TO atlas;

GRANT USAGE ON SCHEMA atlas_terrain TO atlas;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA atlas_terrain TO atlas;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA atlas_terrain TO atlas;

-- ===========================================
-- FIN DE LA MIGRATION
-- ===========================================

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 070 terminée: Schéma SIG atlas_ref créé';
    RAISE NOTICE '   - atlas_ref.routes_25231';
    RAISE NOTICE '   - atlas_ref.localites_points_25231';
    RAISE NOTICE '   - atlas_ref.localites_polygons_25231';
    RAISE NOTICE '   - atlas_ref.batiments_25231';
    RAISE NOTICE '   - atlas_ref.hydro_cours_eau_25231';
    RAISE NOTICE '   - atlas_ref.hydro_surfaces_25231';
    RAISE NOTICE '   - atlas_ref.admin_limites_25231';
    RAISE NOTICE '   - Vues v_*_atlas pour l''API';
    RAISE NOTICE '   - Tables atlas_terrain pour corrections';
END $$;
