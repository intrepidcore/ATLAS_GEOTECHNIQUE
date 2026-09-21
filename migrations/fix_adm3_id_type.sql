-- Migration: Corriger le type de adm3_id dans sondages
-- Date: 2025-11-07
-- Problème: adm3_id est UUID mais devrait être INTEGER pour correspondre à adm3.gid

BEGIN;

-- 1. Supprimer la colonne adm3_id actuelle (UUID)
ALTER TABLE sondages DROP COLUMN IF EXISTS adm3_id CASCADE;

-- 2. Recréer adm3_id comme INTEGER
ALTER TABLE sondages ADD COLUMN adm3_id INTEGER;

-- 3. Ajouter l'index
CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id ON sondages(adm3_id);

-- 4. Ajouter la contrainte de clé étrangère
ALTER TABLE sondages 
ADD CONSTRAINT fk_sondages_adm3 
FOREIGN KEY (adm3_id) REFERENCES adm3(gid) 
ON DELETE SET NULL;

-- 5. Recréer la colonne is_geocoded (elle dépend de adm3_id)
ALTER TABLE sondages DROP COLUMN IF EXISTS is_geocoded CASCADE;

ALTER TABLE sondages ADD COLUMN is_geocoded BOOLEAN 
GENERATED ALWAYS AS (
  geom IS NOT NULL OR adm3_id IS NOT NULL
) STORED;

COMMIT;
