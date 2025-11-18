-- ============================================================================
-- Migration 027: Unification de essais_classif pour tous les formats
-- Date: 2025-11-18
-- Description: 
--   - Étendre essais_classif pour supporter TOUS les formats de classification
--   - HRB + Unified (imports classiques NICABOU, BONOU, etc.)
--   - Normes AMESSEFE (Chassagneux, Dakshanamurthy, SEED, Vijayvergiya)
--   - Potentiel de gonflement (cg, cg_qual)
--   - Type de sol
--   - essais_classif devient LA table source of truth pour toutes les classifications
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 027: Unification essais_classif';
  RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- 1. AJOUTER COLONNES MANQUANTES À essais_classif
-- ============================================================================

-- Colonnes de base (si pas déjà présentes)
ALTER TABLE essais_classif
  ADD COLUMN IF NOT EXISTS echantillon_id UUID,
  ADD COLUMN IF NOT EXISTS depth_m NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS laboratory TEXT,
  ADD COLUMN IF NOT EXISTS test_date DATE;

-- Classifications simples (HRB, Unified)
ALTER TABLE essais_classif
  ADD COLUMN IF NOT EXISTS hrb TEXT,
  ADD COLUMN IF NOT EXISTS unified TEXT;

-- Classifications AMESSEFE (4 normes)
ALTER TABLE essais_classif
  ADD COLUMN IF NOT EXISTS class_chassagneux TEXT,
  ADD COLUMN IF NOT EXISTS class_daksha TEXT,
  ADD COLUMN IF NOT EXISTS class_seed TEXT,
  ADD COLUMN IF NOT EXISTS class_vijay TEXT;

-- Type de sol et potentiel de gonflement
ALTER TABLE essais_classif
  ADD COLUMN IF NOT EXISTS type_sol TEXT,
  ADD COLUMN IF NOT EXISTS cg NUMERIC,
  ADD COLUMN IF NOT EXISTS cg_qual TEXT;

-- Métadonnées
ALTER TABLE essais_classif
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

DO $$ BEGIN
  RAISE NOTICE '✓ Colonnes ajoutées à essais_classif';
END $$;

-- ============================================================================
-- 2. CONTRAINTES ET INDEX
-- ============================================================================

-- Foreign Key vers echantillons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'essais_classif_echantillon_fk'
  ) THEN
    ALTER TABLE essais_classif
      ADD CONSTRAINT essais_classif_echantillon_fk
      FOREIGN KEY (echantillon_id) REFERENCES echantillons(id)
      ON DELETE CASCADE;
    RAISE NOTICE '✓ FK essais_classif → echantillons créée';
  ELSE
    RAISE NOTICE '  FK essais_classif → echantillons déjà présente';
  END IF;
END$$;

-- Contrainte unique sur echantillon_id (1 classification par échantillon)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'essais_classif_echantillon_unique'
  ) THEN
    ALTER TABLE essais_classif
      ADD CONSTRAINT essais_classif_echantillon_unique
      UNIQUE (echantillon_id);
    RAISE NOTICE '✓ Contrainte UNIQUE sur echantillon_id créée';
  ELSE
    RAISE NOTICE '  Contrainte UNIQUE déjà présente';
  END IF;
END$$;

-- Index sur echantillon_id
CREATE INDEX IF NOT EXISTS idx_essais_classif_echantillon
  ON essais_classif(echantillon_id);

DO $$ BEGIN
  RAISE NOTICE '✓ Index créés';
END $$;

-- ============================================================================
-- 3. COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE essais_classif IS 
'Table unifiée pour TOUTES les classifications géotechniques (HRB, Unified, normes AMESSEFE, potentiel de gonflement)';

COMMENT ON COLUMN essais_classif.echantillon_id IS 
'Clé étrangère vers echantillons (1 classification par échantillon)';

COMMENT ON COLUMN essais_classif.hrb IS 
'Classification HRB (Highway Research Board) - imports classiques';

COMMENT ON COLUMN essais_classif.unified IS 
'Classification USCS (Unified Soil Classification System) - imports classiques';

COMMENT ON COLUMN essais_classif.class_chassagneux IS 
'Classification CHASSAGNEUX D. et al. 1996 - données AMESSEFE';

COMMENT ON COLUMN essais_classif.class_daksha IS 
'Classification Dakshanamurthy et Raman 1973 - données AMESSEFE';

COMMENT ON COLUMN essais_classif.class_seed IS 
'Classification SEED H. et al 1962 - données AMESSEFE';

COMMENT ON COLUMN essais_classif.class_vijay IS 
'Classification VIJAYVERGIYA et GHAZZALY 1973 - données AMESSEFE';

COMMENT ON COLUMN essais_classif.type_sol IS 
'Type de sol (Vertisols, Ferrugineux, Hydromorphes, etc.)';

COMMENT ON COLUMN essais_classif.cg IS 
'Potentiel de gonflement (cg) - valeur numérique';

COMMENT ON COLUMN essais_classif.cg_qual IS 
'Analyse qualitative du potentiel de gonflement (Faible/Moyen/Élevé)';

COMMENT ON COLUMN essais_classif.laboratory IS 
'Laboratoire ayant réalisé l''essai (ex: FORMATEC)';

DO $$ BEGIN
  RAISE NOTICE '✓ Commentaires ajoutés';
END $$;

-- ============================================================================
-- 4. TRIGGER POUR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_essais_classif_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_essais_classif_updated ON essais_classif;
CREATE TRIGGER trg_essais_classif_updated
BEFORE UPDATE ON essais_classif
FOR EACH ROW
EXECUTE FUNCTION update_essais_classif_timestamp();

DO $$ BEGIN
  RAISE NOTICE '✓ Trigger updated_at créé';
END $$;

-- ============================================================================
-- 5. MIGRER LES DONNÉES EXISTANTES DE essais_geotechniques → essais_classif
-- ============================================================================

DO $$ 
DECLARE
  v_migrated INTEGER := 0;
BEGIN
  -- Migrer les classifications AMESSEFE depuis essais_geotechniques
  INSERT INTO essais_classif (
    echantillon_id,
    depth_m,
    class_chassagneux,
    class_daksha,
    class_seed,
    class_vijay,
    type_sol,
    cg,
    cg_qual,
    laboratory,
    created_at,
    updated_at
  )
  SELECT 
    eg.echantillon_id,
    eg.depth_m,
    eg.class_chassagneux,
    eg.class_daksha,
    eg.class_seed,
    eg.class_vijay,
    eg.type_sol,
    eg.cg,
    eg.cg_qual,
    'FORMATEC',
    eg.created_at,
    eg.updated_at
  FROM essais_geotechniques eg
  WHERE eg.echantillon_id IS NOT NULL
    AND (
      eg.class_chassagneux IS NOT NULL OR
      eg.class_daksha IS NOT NULL OR
      eg.class_seed IS NOT NULL OR
      eg.class_vijay IS NOT NULL OR
      eg.cg IS NOT NULL
    )
  ON CONFLICT (echantillon_id) DO UPDATE
  SET
    class_chassagneux = EXCLUDED.class_chassagneux,
    class_daksha = EXCLUDED.class_daksha,
    class_seed = EXCLUDED.class_seed,
    class_vijay = EXCLUDED.class_vijay,
    type_sol = COALESCE(EXCLUDED.type_sol, essais_classif.type_sol),
    cg = EXCLUDED.cg,
    cg_qual = EXCLUDED.cg_qual,
    updated_at = now();
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  RAISE NOTICE '✓ % classifications migrées depuis essais_geotechniques', v_migrated;
END $$;

-- ============================================================================
-- 6. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
  v_total INTEGER;
  v_with_hrb INTEGER;
  v_with_amessefe INTEGER;
  v_with_cg INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM essais_classif;
  SELECT COUNT(*) INTO v_with_hrb FROM essais_classif WHERE hrb IS NOT NULL;
  SELECT COUNT(*) INTO v_with_amessefe FROM essais_classif 
    WHERE class_chassagneux IS NOT NULL OR class_daksha IS NOT NULL;
  SELECT COUNT(*) INTO v_with_cg FROM essais_classif WHERE cg IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration 027 terminée avec succès';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Total classifications       : %', v_total;
  RAISE NOTICE '  Avec HRB/Unified            : %', v_with_hrb;
  RAISE NOTICE '  Avec normes AMESSEFE        : %', v_with_amessefe;
  RAISE NOTICE '  Avec potentiel gonflement   : %', v_with_cg;
  RAISE NOTICE '';
  RAISE NOTICE 'essais_classif est maintenant LA table source of truth pour:';
  RAISE NOTICE '  ✓ Classifications HRB + Unified (imports classiques)';
  RAISE NOTICE '  ✓ Normes AMESSEFE (Chassagneux, Daksha, SEED, Vijay)';
  RAISE NOTICE '  ✓ Potentiel de gonflement (cg, cg_qual)';
  RAISE NOTICE '  ✓ Type de sol';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Ne plus jamais insérer directement dans essais_geotechniques !';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
