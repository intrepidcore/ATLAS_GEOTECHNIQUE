-- ============================================================================
-- Migration 091: Création de la table DSM COP30
-- Description:
--   Crée la table raster pour le Modèle Numérique de Surface COP30
--   Résolution: ~30m, SRID: 25231 (UTM 31N)
--   Source: Copernicus DEM GLO-30
-- ============================================================================

BEGIN;

-- Table pour stocker le raster DSM
CREATE TABLE IF NOT EXISTS atlas.dsm_cop30 (
    rid         serial PRIMARY KEY,
    rast        raster,
    filename    text
);

-- Index spatial pour requêtes rapides
CREATE INDEX IF NOT EXISTS dsm_cop30_rast_st_convexhull_idx
    ON atlas.dsm_cop30
    USING gist (ST_ConvexHull(rast));

-- Contrainte pour vérifier le SRID
ALTER TABLE atlas.dsm_cop30
    ADD CONSTRAINT enforce_srid_rast 
    CHECK (ST_SRID(rast) = 25231);

COMMENT ON TABLE atlas.dsm_cop30 IS 'DSM COP30 - Modèle Numérique de Surface du Togo (SRID 25231)';
COMMENT ON COLUMN atlas.dsm_cop30.rid IS 'Identifiant de tuile raster';
COMMENT ON COLUMN atlas.dsm_cop30.rast IS 'Tuile raster (hauteur en mètres)';
COMMENT ON COLUMN atlas.dsm_cop30.filename IS 'Nom du fichier source';

-- Vérification
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT COUNT(*) INTO v_count FROM atlas.dsm_cop30;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 091 terminée';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Table atlas.dsm_cop30 créée';
    RAISE NOTICE 'Tuiles raster: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE 'ATTENTION: La table est vide.';
    RAISE NOTICE 'Utilisez scripts/import_dsm_cop30.ps1 pour importer le raster.';
END $$;

COMMIT;
