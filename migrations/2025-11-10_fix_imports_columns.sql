-- Migration: Ajout des colonnes manquantes dans la table imports
-- Date: 2025-11-10
-- Description: Ajoute batch_id, sha256, params, stats, updated_at à la table imports
--              et change batch_id de UUID à TEXT pour supporter le format IMP-YYYYMMDD-HHMMSS

BEGIN;

-- Ajouter les colonnes manquantes
ALTER TABLE atlas.imports ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE atlas.imports ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE atlas.imports ADD COLUMN IF NOT EXISTS params JSONB;
ALTER TABLE atlas.imports ADD COLUMN IF NOT EXISTS stats JSONB;
ALTER TABLE atlas.imports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Changer batch_id de UUID à TEXT (pour format IMP-YYYYMMDD-HHMMSS)
ALTER TABLE atlas.imports ALTER COLUMN batch_id TYPE TEXT USING batch_id::TEXT;

-- Ajouter un index sur batch_id pour les recherches
CREATE INDEX IF NOT EXISTS idx_imports_batch_id ON atlas.imports(batch_id);

-- Ajouter un trigger pour updated_at
DROP TRIGGER IF EXISTS update_imports_updated_at ON atlas.imports;
CREATE TRIGGER update_imports_updated_at
    BEFORE UPDATE ON atlas.imports
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

COMMIT;

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 2025-11-10_fix_imports_columns appliquée avec succès';
    RAISE NOTICE '   - batch_id: UUID → TEXT';
    RAISE NOTICE '   - Colonnes ajoutées: sha256, params, stats, updated_at';
    RAISE NOTICE '   - Index créé sur batch_id';
    RAISE NOTICE '   - Trigger updated_at configuré';
END $$;
