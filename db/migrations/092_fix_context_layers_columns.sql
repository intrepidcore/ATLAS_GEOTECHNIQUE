-- ============================================================================
-- Migration 092: Correction des colonnes des couches contextuelles
-- Description:
--   Ajoute les colonnes manquantes (code, libelle, description) et mappe
--   les données depuis les colonnes existantes des fichiers GPKG importés
-- ============================================================================

BEGIN;

-- 1. Géologie : ajouter colonnes et mapper depuis type_sols
ALTER TABLE atlas.unites_geologiques 
    ADD COLUMN IF NOT EXISTS code varchar(50),
    ADD COLUMN IF NOT EXISTS libelle text,
    ADD COLUMN IF NOT EXISTS description text;

-- Mapper les données existantes
UPDATE atlas.unites_geologiques SET
    code = 'GEO_' || LPAD(ogc_fid::text, 3, '0'),
    libelle = COALESCE(type_sols, 'Unité géologique ' || ogc_fid),
    description = 'Formation géologique: ' || COALESCE(type_sols, 'Non spécifié')
WHERE code IS NULL;

-- 2. Pédologie : ajouter colonnes et mapper depuis type_sol
ALTER TABLE atlas.unites_pedologiques 
    ADD COLUMN IF NOT EXISTS code varchar(50),
    ADD COLUMN IF NOT EXISTS libelle text,
    ADD COLUMN IF NOT EXISTS description text;

UPDATE atlas.unites_pedologiques SET
    code = 'PEDO_' || LPAD(ogc_fid::text, 3, '0'),
    libelle = COALESCE(type_sol, 'Unité pédologique ' || ogc_fid),
    description = 'Type de sol: ' || COALESCE(type_sol, 'Non spécifié')
WHERE code IS NULL;

-- 3. Risque de gonflement : ajouter colonnes et mapper depuis risque_gonflement
ALTER TABLE atlas.risque_gonflement 
    ADD COLUMN IF NOT EXISTS code varchar(50),
    ADD COLUMN IF NOT EXISTS libelle text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS niveau_risque varchar(50);

UPDATE atlas.risque_gonflement SET
    code = 'RISQUE_' || LPAD(ogc_fid::text, 3, '0'),
    libelle = COALESCE(risque_gonflement, 'Zone de risque ' || ogc_fid),
    niveau_risque = COALESCE(risque_gonflement, 'non défini'),
    description = 'Risque de gonflement: ' || COALESCE(risque_gonflement, 'Non spécifié') || 
                  ' - Type de sol: ' || COALESCE(type_sol, type_sols, 'Non spécifié')
WHERE code IS NULL;

-- Vérifications
DO $$
DECLARE
    v_geo_count int;
    v_pedo_count int;
    v_risque_count int;
BEGIN
    SELECT COUNT(*) INTO v_geo_count FROM atlas.unites_geologiques WHERE code IS NOT NULL;
    SELECT COUNT(*) INTO v_pedo_count FROM atlas.unites_pedologiques WHERE code IS NOT NULL;
    SELECT COUNT(*) INTO v_risque_count FROM atlas.risque_gonflement WHERE code IS NOT NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 092 terminée';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Colonnes ajoutées et données mappées:';
    RAISE NOTICE '  - atlas.unites_geologiques: % lignes avec code', v_geo_count;
    RAISE NOTICE '  - atlas.unites_pedologiques: % lignes avec code', v_pedo_count;
    RAISE NOTICE '  - atlas.risque_gonflement: % lignes avec code', v_risque_count;
END $$;

COMMIT;
