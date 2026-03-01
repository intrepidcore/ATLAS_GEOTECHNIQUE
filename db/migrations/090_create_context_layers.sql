-- ============================================================================
-- Migration 090: Création des tables de couches contextuelles
-- Description:
--   Crée les tables pour les couches géologie, pédologie et risque de gonflement
--   Ces tables sont utilisées par l'API /layers/* pour afficher les contextes
--
-- CONTRAT API (services/api-geo/src/layers.rs):
--   L'API attend les colonnes suivantes dans chaque table:
--   - ogc_fid     : clé primaire (mappée vers 'id' côté JSON)
--   - code        : code de l'unité (ex: "GEO_001")
--   - libelle     : nom affiché dans l'UI (ex: "Formation de Buem")
--   - description : texte détaillé pour popup/info
--   - geom        : géométrie MultiPolygon en SRID 25231
--
--   Les requêtes SQL dans l'API utilisent:
--   SELECT ogc_fid as id, code, libelle, description, ST_AsGeoJSON(ST_Transform(geom, 4326))
--   (pas de SELECT * pour éviter les ambiguïtés)
--
-- IMPORT DES DONNÉES:
--   Utiliser scripts/import_context_layers.ps1 ou shp2pgsql:
--   shp2pgsql -s 25231 -I -D geologie.shp atlas.unites_geologiques | psql ...
-- ============================================================================

BEGIN;

-- 1. Table unités géologiques
CREATE TABLE IF NOT EXISTS atlas.unites_geologiques (
    ogc_fid         serial PRIMARY KEY,
    code            varchar(50),
    libelle         text,
    description     text,
    age             varchar(100),
    lithologie      text,
    geom            geometry(MultiPolygon, 25231),
    created_at      timestamp DEFAULT NOW(),
    updated_at      timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS unites_geologiques_geom_idx 
    ON atlas.unites_geologiques USING GIST (geom);

COMMENT ON TABLE atlas.unites_geologiques IS 'Unités géologiques du Togo (SRID 25231)';
COMMENT ON COLUMN atlas.unites_geologiques.code IS 'Code de l''unité géologique';
COMMENT ON COLUMN atlas.unites_geologiques.libelle IS 'Nom de l''unité géologique';
COMMENT ON COLUMN atlas.unites_geologiques.lithologie IS 'Description lithologique';

-- 2. Table unités pédologiques
CREATE TABLE IF NOT EXISTS atlas.unites_pedologiques (
    ogc_fid         serial PRIMARY KEY,
    code            varchar(50),
    libelle         text,
    description     text,
    type_sol        varchar(100),
    texture         varchar(100),
    drainage        varchar(50),
    geom            geometry(MultiPolygon, 25231),
    created_at      timestamp DEFAULT NOW(),
    updated_at      timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS unites_pedologiques_geom_idx 
    ON atlas.unites_pedologiques USING GIST (geom);

COMMENT ON TABLE atlas.unites_pedologiques IS 'Unités pédologiques du Togo (SRID 25231)';
COMMENT ON COLUMN atlas.unites_pedologiques.type_sol IS 'Type de sol (classification)';
COMMENT ON COLUMN atlas.unites_pedologiques.texture IS 'Texture dominante du sol';

-- 3. Table risque de gonflement
CREATE TABLE IF NOT EXISTS atlas.risque_gonflement (
    ogc_fid         serial PRIMARY KEY,
    code            varchar(50),
    libelle         text,           -- Niveau de risque (pour affichage)
    niveau_risque   varchar(50),    -- 'faible', 'moyen', 'fort', 'très fort'
    description     text,
    ip_moyen        numeric(5,2),   -- Indice de plasticité moyen
    vbs_moyen       numeric(5,2),   -- VBS moyen
    geom            geometry(MultiPolygon, 25231),
    created_at      timestamp DEFAULT NOW(),
    updated_at      timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risque_gonflement_geom_idx 
    ON atlas.risque_gonflement USING GIST (geom);
CREATE INDEX IF NOT EXISTS risque_gonflement_niveau_idx 
    ON atlas.risque_gonflement (niveau_risque);

COMMENT ON TABLE atlas.risque_gonflement IS 'Zones de risque de gonflement des sols argileux (SRID 25231)';
COMMENT ON COLUMN atlas.risque_gonflement.niveau_risque IS 'Niveau de risque: faible, moyen, fort, très fort';
COMMENT ON COLUMN atlas.risque_gonflement.ip_moyen IS 'Indice de plasticité moyen de la zone';

-- 4. Vérifications finales
DO $$
DECLARE
    v_count_geo int;
    v_count_pedo int;
    v_count_risque int;
BEGIN
    SELECT COUNT(*) INTO v_count_geo FROM atlas.unites_geologiques;
    SELECT COUNT(*) INTO v_count_pedo FROM atlas.unites_pedologiques;
    SELECT COUNT(*) INTO v_count_risque FROM atlas.risque_gonflement;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 090 terminée';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables créées:';
    RAISE NOTICE '  - atlas.unites_geologiques: % lignes', v_count_geo;
    RAISE NOTICE '  - atlas.unites_pedologiques: % lignes', v_count_pedo;
    RAISE NOTICE '  - atlas.risque_gonflement: % lignes', v_count_risque;
    RAISE NOTICE '';
    RAISE NOTICE 'ATTENTION: Les tables sont vides.';
    RAISE NOTICE 'Vous devez importer les données depuis les shapefiles/GPKG.';
    RAISE NOTICE 'Utilisez: shp2pgsql ou ogr2ogr';
END $$;

COMMIT;
