-- ============================================================================
-- Migration 027b: Ajouter echantillon_id aux tables essais_physiques et essais_proctor
-- Date: 2025-11-18
-- Description: 
--   - Ajouter echantillon_id à essais_physiques et essais_proctor
--   - Migrer les données existantes depuis essai_id → echantillon_id
--   - Créer contraintes UNIQUE sur echantillon_id
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 027b: Ajouter echantillon_id aux tables essais_*';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. AJOUTER echantillon_id À essais_physiques
-- ============================================================================

ALTER TABLE essais_physiques
  ADD COLUMN IF NOT EXISTS echantillon_id UUID,
  ADD COLUMN IF NOT EXISTS w NUMERIC,
  ADD COLUMN IF NOT EXISTS rho_s NUMERIC,
  ADD COLUMN IF NOT EXISTS laboratory TEXT;

-- Migrer les données existantes
UPDATE essais_physiques ep
SET echantillon_id = eg.echantillon_id
FROM essais_geotechniques eg
WHERE ep.essai_id = eg.id
  AND ep.echantillon_id IS NULL;

-- FK et contrainte UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'essais_physiques_echantillon_fk'
  ) THEN
    ALTER TABLE essais_physiques
      ADD CONSTRAINT essais_physiques_echantillon_fk
      FOREIGN KEY (echantillon_id) REFERENCES echantillons(id)
      ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'essais_physiques_echantillon_unique'
  ) THEN
    ALTER TABLE essais_physiques
      ADD CONSTRAINT essais_physiques_echantillon_unique
      UNIQUE (echantillon_id);
  END IF;
END$$;

DO $$ BEGIN
  RAISE NOTICE '✓ echantillon_id ajouté à essais_physiques';
END $$;

-- ============================================================================
-- 2. essais_proctor a déjà echantillon_id (rien à faire)
-- ============================================================================

DO $$ BEGIN
  RAISE NOTICE '✓ essais_proctor a déjà echantillon_id (OK)';
END $$;

-- ============================================================================
-- 3. STATISTIQUES
-- ============================================================================

DO $$
DECLARE
  v_physiques INTEGER;
  v_proctor INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_physiques FROM essais_physiques WHERE echantillon_id IS NOT NULL;
  SELECT COUNT(*) INTO v_proctor FROM essais_proctor WHERE echantillon_id IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 027b terminée';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  essais_physiques avec echantillon_id : %', v_physiques;
  RAISE NOTICE '  essais_proctor avec echantillon_id   : %', v_proctor;
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
