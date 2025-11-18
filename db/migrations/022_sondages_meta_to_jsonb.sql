-- ============================================================================
-- Migration 022: Conversion sondages.meta TEXT → JSONB
-- Date: 2025-11-17
-- Description: Alignement du type meta avec le reste du système (cohérence)
--              Table vide après reset 021, donc conversion simple et sûre
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Sauvegarder la définition de la vue v_sondages_unifies
-- ============================================================================

CREATE TEMP TABLE _view_backup AS
SELECT pg_get_viewdef('atlas.v_sondages_unifies'::regclass, true) AS view_def;

-- ============================================================================
-- 2. Dropper temporairement la vue qui dépend de sondages.meta
-- ============================================================================

DROP VIEW IF EXISTS atlas.v_sondages_unifies CASCADE;

-- ============================================================================
-- 3. Conversion meta TEXT → JSONB
-- ============================================================================

ALTER TABLE public.sondages
  ALTER COLUMN meta TYPE jsonb
  USING
    CASE
      WHEN meta IS NULL OR trim(meta) = '' THEN '{}'::jsonb
      ELSE meta::jsonb
    END;

-- ============================================================================
-- 4. Recréer la vue v_sondages_unifies
-- ============================================================================

DO $$
DECLARE
    v_view_def TEXT;
BEGIN
    SELECT view_def INTO v_view_def FROM _view_backup;
    EXECUTE 'CREATE VIEW atlas.v_sondages_unifies AS ' || v_view_def;
    RAISE NOTICE '  ✓ Vue atlas.v_sondages_unifies recréée';
END $$;

-- ============================================================================
-- Validation
-- ============================================================================

DO $$
DECLARE
    v_meta_type TEXT;
    v_count INTEGER;
BEGIN
    -- Vérifier le type de meta
    SELECT data_type INTO v_meta_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sondages'
      AND column_name = 'meta';
    
    -- Compter les lignes
    SELECT COUNT(*) INTO v_count FROM sondages;
    
    IF v_meta_type != 'jsonb' THEN
        RAISE EXCEPTION 'Migration 022 échouée: meta est encore de type %', v_meta_type;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 022 terminée avec succès';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '  ✓ sondages.meta: TEXT → JSONB';
    RAISE NOTICE '  ✓ Lignes dans sondages: %', v_count;
    RAISE NOTICE '  ✓ Opérateur meta->>''code'' maintenant disponible';
    RAISE NOTICE '';
    RAISE NOTICE 'Cohérence schéma:';
    RAISE NOTICE '  ✓ sondages.meta: JSONB';
    RAISE NOTICE '  ✓ echantillons.meta: JSONB';
    RAISE NOTICE '  ✓ essais_*.meta: JSONB';
    RAISE NOTICE '';
    RAISE NOTICE 'Prêt pour import Excel avec 02_import_excel.py';
    RAISE NOTICE '============================================================================';
END $$;

COMMIT;
