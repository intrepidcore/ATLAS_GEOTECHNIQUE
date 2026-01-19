-- ============================================================================
-- Migration 105: Ajout des coordonnées UTM31 bbox + centre pour mailles 2km
-- ============================================================================
-- Objectif: Afficher dans le panneau gauche les coordonnées académiques UTM31
-- Format: X: xmin–xmax, Y: ymin–ymax + centre (optionnel)
-- SRID source: 25231 (projection locale Togo)
-- SRID cible: 32631 (UTM Zone 31N)
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1: Ajouter les colonnes
-- ============================================================================

ALTER TABLE atlas.mailles
ADD COLUMN IF NOT EXISTS xmin_utm31 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS xmax_utm31 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS ymin_utm31 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS ymax_utm31 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS xc_utm31 DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS yc_utm31 DOUBLE PRECISION;

COMMENT ON COLUMN atlas.mailles.xmin_utm31 IS 'Coordonnée X minimale en UTM Zone 31N (EPSG:32631)';
COMMENT ON COLUMN atlas.mailles.xmax_utm31 IS 'Coordonnée X maximale en UTM Zone 31N (EPSG:32631)';
COMMENT ON COLUMN atlas.mailles.ymin_utm31 IS 'Coordonnée Y minimale en UTM Zone 31N (EPSG:32631)';
COMMENT ON COLUMN atlas.mailles.ymax_utm31 IS 'Coordonnée Y maximale en UTM Zone 31N (EPSG:32631)';
COMMENT ON COLUMN atlas.mailles.xc_utm31 IS 'Coordonnée X du centre en UTM Zone 31N (EPSG:32631)';
COMMENT ON COLUMN atlas.mailles.yc_utm31 IS 'Coordonnée Y du centre en UTM Zone 31N (EPSG:32631)';

-- ============================================================================
-- ÉTAPE 2: Backfill - Remplir pour toutes les mailles existantes
-- ============================================================================

UPDATE atlas.mailles
SET 
    xmin_utm31 = ST_XMin(ST_Transform(geom, 32631)),
    xmax_utm31 = ST_XMax(ST_Transform(geom, 32631)),
    ymin_utm31 = ST_YMin(ST_Transform(geom, 32631)),
    ymax_utm31 = ST_YMax(ST_Transform(geom, 32631)),
    xc_utm31 = ST_X(ST_Transform(ST_Centroid(geom), 32631)),
    yc_utm31 = ST_Y(ST_Transform(ST_Centroid(geom), 32631))
WHERE xmin_utm31 IS NULL;

-- ============================================================================
-- ÉTAPE 3: Trigger pour mise à jour automatique
-- ============================================================================

-- Fonction trigger
CREATE OR REPLACE FUNCTION atlas.update_maille_utm31_coords()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer les coordonnées UTM31 à partir de la géométrie
    NEW.xmin_utm31 := ST_XMin(ST_Transform(NEW.geom, 32631));
    NEW.xmax_utm31 := ST_XMax(ST_Transform(NEW.geom, 32631));
    NEW.ymin_utm31 := ST_YMin(ST_Transform(NEW.geom, 32631));
    NEW.ymax_utm31 := ST_YMax(ST_Transform(NEW.geom, 32631));
    NEW.xc_utm31 := ST_X(ST_Transform(ST_Centroid(NEW.geom), 32631));
    NEW.yc_utm31 := ST_Y(ST_Transform(ST_Centroid(NEW.geom), 32631));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur INSERT et UPDATE de geom
DROP TRIGGER IF EXISTS trg_update_maille_utm31_coords ON atlas.mailles;

CREATE TRIGGER trg_update_maille_utm31_coords
    BEFORE INSERT OR UPDATE OF geom ON atlas.mailles
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_maille_utm31_coords();

COMMENT ON FUNCTION atlas.update_maille_utm31_coords() IS 
    'Trigger function: Met à jour automatiquement les coordonnées UTM31 quand la géométrie change';

-- ============================================================================
-- ÉTAPE 4: Index pour performance (optionnel mais recommandé)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mailles_utm31_bbox 
    ON atlas.mailles (xmin_utm31, xmax_utm31, ymin_utm31, ymax_utm31);

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

-- Vérifier que les bornes sont cohérentes (environ 2000m x 2000m)
DO $$
DECLARE
    avg_width DOUBLE PRECISION;
    avg_height DOUBLE PRECISION;
BEGIN
    SELECT 
        AVG(xmax_utm31 - xmin_utm31),
        AVG(ymax_utm31 - ymin_utm31)
    INTO avg_width, avg_height
    FROM atlas.mailles
    WHERE xmin_utm31 IS NOT NULL;
    
    RAISE NOTICE 'Largeur moyenne des mailles: % m', ROUND(avg_width::numeric, 2);
    RAISE NOTICE 'Hauteur moyenne des mailles: % m', ROUND(avg_height::numeric, 2);
    
    IF avg_width < 1900 OR avg_width > 2100 THEN
        RAISE WARNING 'Largeur moyenne hors plage attendue (1900-2100m): %', avg_width;
    END IF;
    
    IF avg_height < 1900 OR avg_height > 2100 THEN
        RAISE WARNING 'Hauteur moyenne hors plage attendue (1900-2100m): %', avg_height;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Test rapide
-- ============================================================================
SELECT 
    code,
    ROUND(xmin_utm31::numeric, 0) as xmin,
    ROUND(xmax_utm31::numeric, 0) as xmax,
    ROUND(ymin_utm31::numeric, 0) as ymin,
    ROUND(ymax_utm31::numeric, 0) as ymax,
    ROUND(xc_utm31::numeric, 0) as xc,
    ROUND(yc_utm31::numeric, 0) as yc,
    ROUND((xmax_utm31 - xmin_utm31)::numeric, 0) as width_m,
    ROUND((ymax_utm31 - ymin_utm31)::numeric, 0) as height_m
FROM atlas.mailles
WHERE code LIKE 'TG-0488-0212-01'
LIMIT 1;
