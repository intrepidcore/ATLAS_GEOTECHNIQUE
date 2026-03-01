-- ============================================================================
-- Migration 032: Nettoyage des codes et localités dans public.sondages
-- ============================================================================
-- Description:
--   - Remplir code depuis meta->>'code' quand disponible
--   - Remplir localite_base depuis meta->>'localite'
--   - Générer localite_key (normalisée)
--   - Assigner AUTO_<id> pour les orphelins
--   - Ajouter contrainte NOT NULL sur code
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DIAGNOSTIC INITIAL
-- ============================================================================

DO $$
DECLARE
    v_total INTEGER;
    v_code_null INTEGER;
    v_code_auto INTEGER;
    v_localite_null INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM public.sondages;
    SELECT COUNT(*) INTO v_code_null FROM public.sondages WHERE code IS NULL;
    SELECT COUNT(*) INTO v_code_auto FROM public.sondages WHERE code LIKE 'AUTO_%';
    SELECT COUNT(*) INTO v_localite_null FROM public.sondages WHERE localite_base IS NULL;
    
    RAISE NOTICE '📊 DIAGNOSTIC INITIAL:';
    RAISE NOTICE '  Total sondages: %', v_total;
    RAISE NOTICE '  Code NULL: %', v_code_null;
    RAISE NOTICE '  Code AUTO_*: %', v_code_auto;
    RAISE NOTICE '  Localite_base NULL: %', v_localite_null;
END $$;

-- ============================================================================
-- 2. REMPLIR CODE DEPUIS meta->>'code'
-- ============================================================================

-- Remplacer AUTO_... par vrai code quand disponible
UPDATE public.sondages
SET code = meta->>'code'
WHERE (code IS NULL OR code LIKE 'AUTO_%')
  AND meta->>'code' IS NOT NULL
  AND meta->>'code' != ''
  AND meta->>'code' != code;  -- Éviter les updates inutiles

-- Log du résultat
DO $$
DECLARE
    v_updated INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '✅ Codes mis à jour depuis meta: %', v_updated;
END $$;

-- ============================================================================
-- 3. REMPLIR localite_base DEPUIS meta->>'localite'
-- ============================================================================

UPDATE public.sondages
SET localite_base = meta->>'localite'
WHERE localite_base IS NULL
  AND meta->>'localite' IS NOT NULL
  AND meta->>'localite' != '';

-- Log du résultat
DO $$
DECLARE
    v_updated INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '✅ Localite_base mis à jour depuis meta: %', v_updated;
END $$;

-- ============================================================================
-- 4. GÉNÉRER localite_key (NORMALISÉE)
-- ============================================================================

-- Créer extension unaccent si pas déjà présente
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Générer localite_key: UPPERCASE + sans accents + sans caractères spéciaux
UPDATE public.sondages
SET localite_key = UPPER(REGEXP_REPLACE(
    unaccent(localite_base), 
    '[^A-Z0-9]+', 
    '', 
    'g'
))
WHERE localite_base IS NOT NULL
  AND (localite_key IS NULL OR localite_key = '' OR localite_key != UPPER(REGEXP_REPLACE(unaccent(localite_base), '[^A-Z0-9]+', '', 'g')));

-- Log du résultat
DO $$
DECLARE
    v_updated INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '✅ Localite_key générées: %', v_updated;
END $$;

-- ============================================================================
-- 5. ASSIGNER AUTO_<id> POUR LES ORPHELINS
-- ============================================================================

UPDATE public.sondages
SET code = CONCAT('AUTO_', id::text)
WHERE code IS NULL;

-- Log du résultat
DO $$
DECLARE
    v_updated INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE '⚠️  Codes AUTO_* générés pour orphelins: %', v_updated;
END $$;

-- ============================================================================
-- 6. AJOUTER CONTRAINTE NOT NULL SUR code
-- ============================================================================

-- Vérifier qu'il n'y a plus de NULL
DO $$
DECLARE
    v_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_null_count FROM public.sondages WHERE code IS NULL;
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'Impossible d''ajouter contrainte NOT NULL: % sondages ont encore code IS NULL', v_null_count;
    END IF;
END $$;

-- Ajouter la contrainte
ALTER TABLE public.sondages
ALTER COLUMN code SET NOT NULL;

DO $$ BEGIN
    RAISE NOTICE '✅ Contrainte NOT NULL ajoutée sur code';
END $$;

-- ============================================================================
-- 7. CRÉER INDEX SUR localite_key SI PAS DÉJÀ PRÉSENT
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sondages_localite_key
    ON public.sondages(localite_key)
    WHERE localite_key IS NOT NULL;

DO $$ BEGIN
    RAISE NOTICE '✅ Index créé sur localite_key';
END $$;

-- ============================================================================
-- 8. STATISTIQUES FINALES
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '';
END $$;

DO $$
DECLARE
    v_total INTEGER;
    v_auto_codes INTEGER;
    v_with_localite INTEGER;
    v_with_localite_key INTEGER;
    v_geocoded INTEGER;
    v_with_geom INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM public.sondages;
    SELECT COUNT(*) INTO v_auto_codes FROM public.sondages WHERE code LIKE 'AUTO_%';
    SELECT COUNT(*) INTO v_with_localite FROM public.sondages WHERE localite_base IS NOT NULL;
    SELECT COUNT(*) INTO v_with_localite_key FROM public.sondages WHERE localite_key IS NOT NULL;
    SELECT COUNT(*) INTO v_geocoded FROM public.sondages WHERE is_geocoded = true;
    SELECT COUNT(*) INTO v_with_geom FROM public.sondages WHERE geom IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 STATISTIQUES FINALES:';
    RAISE NOTICE '  Total sondages: %', v_total;
    RAISE NOTICE '  Codes AUTO_*: % (%.1f%%)', v_auto_codes, (v_auto_codes::NUMERIC / v_total * 100);
    RAISE NOTICE '  Avec localite_base: % (%.1f%%)', v_with_localite, (v_with_localite::NUMERIC / v_total * 100);
    RAISE NOTICE '  Avec localite_key: % (%.1f%%)', v_with_localite_key, (v_with_localite_key::NUMERIC / v_total * 100);
    RAISE NOTICE '  Géocodés (is_geocoded=true): % (%.1f%%)', v_geocoded, (v_geocoded::NUMERIC / v_total * 100);
    RAISE NOTICE '  Avec géométrie: % (%.1f%%)', v_with_geom, (v_with_geom::NUMERIC / v_total * 100);
END $$;

-- ============================================================================
-- 9. EXEMPLES DE SONDAGES APRÈS NETTOYAGE
-- ============================================================================

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 EXEMPLES DE SONDAGES (5 premiers):';
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            LEFT(id::text, 8) as id_short,
            code,
            localite_base,
            localite_key,
            CASE WHEN geom IS NOT NULL THEN 'Oui' ELSE 'Non' END as has_geom,
            location_mode
        FROM public.sondages
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        RAISE NOTICE '  % | code=% | localite=% | key=% | geom=% | mode=%', 
            r.id_short, r.code, r.localite_base, r.localite_key, r.has_geom, r.location_mode;
    END LOOP;
END $$;

COMMIT;

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 032 terminée avec succès!';
END $$;
