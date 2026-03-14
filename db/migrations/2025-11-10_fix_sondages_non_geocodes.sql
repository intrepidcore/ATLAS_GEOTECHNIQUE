-- Migration: Correction de la structure sondages_non_geocodes
-- Date: 2025-11-10
-- Description: S'assure que la table sondages_non_geocodes a la bonne structure
--              avec les colonnes date_sondage, localite, adm1/2/3

BEGIN;

-- La table existe déjà (créée dans create_import_tables.sql)
-- On vérifie juste qu'elle a toutes les colonnes nécessaires

-- Ajouter les colonnes si elles n'existent pas
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS date_sondage DATE;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS localite TEXT;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS adm1 TEXT;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS adm2 TEXT;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS adm3 TEXT;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS commune_id INTEGER;
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS profondeur_m NUMERIC(10, 2);
ALTER TABLE atlas.sondages_non_geocodes ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ajouter les index pour les recherches
CREATE INDEX IF NOT EXISTS idx_sondages_non_geocodes_date ON atlas.sondages_non_geocodes(date_sondage);
CREATE INDEX IF NOT EXISTS idx_sondages_non_geocodes_localite ON atlas.sondages_non_geocodes(localite);

-- Commentaires pour documentation
COMMENT ON COLUMN atlas.sondages_non_geocodes.date_sondage IS 'Date du sondage (pas "date")';
COMMENT ON COLUMN atlas.sondages_non_geocodes.localite IS 'Localité du sondage (utilisé comme "source")';
COMMENT ON COLUMN atlas.sondages_non_geocodes.adm1 IS 'Division administrative niveau 1 (pas "adm1_name")';
COMMENT ON COLUMN atlas.sondages_non_geocodes.adm2 IS 'Division administrative niveau 2 (pas "adm2_name")';
COMMENT ON COLUMN atlas.sondages_non_geocodes.adm3 IS 'Division administrative niveau 3 (pas "adm3_name")';

COMMIT;

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 2025-11-10_fix_sondages_non_geocodes appliquée avec succès';
    RAISE NOTICE '   - Structure vérifiée et normalisée';
    RAISE NOTICE '   - Index créés sur date_sondage et localite';
    RAISE NOTICE '   - Commentaires ajoutés pour documentation';
END $$;
