-- ============================================================================
-- MIGRATION: Uniformisation des données public.* → atlas.*
-- ============================================================================
-- Ce script migre les données de référence du schéma public vers atlas
-- pour uniformiser l'architecture et éviter les confusions.
--
-- Tables migrées:
--   - public.mailles → atlas.mailles (29407 lignes)
--   - public.adm3 → atlas.adm3 (373 lignes) [nouvelle table]
--
-- Date: 2024-12-16
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MIGRATION DES MAILLES
-- ============================================================================

-- Vider atlas.mailles seulement si vide (éviter CASCADE sur données liées)
DO $$
DECLARE v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count FROM atlas.mailles;
    IF v_count > 0 THEN
        RAISE NOTICE 'atlas.mailles contient déjà % lignes, skip truncate', v_count;
    END IF;
END $$;

-- Insérer depuis public.mailles avec conversion des types
-- Note: stats utilise des guillemets simples (Python style), on les convertit
INSERT INTO atlas.mailles (id, geom, code, stats, updated_at)
SELECT 
    id::uuid,
    geom,  -- Déjà en SRID 25231
    code,
    CASE 
        WHEN stats IS NULL OR stats = '' THEN '{}'::jsonb
        ELSE REPLACE(stats, '''', '"')::jsonb 
    END,
    CASE 
        WHEN updated_at IS NULL OR updated_at = '' THEN now()
        ELSE updated_at::timestamptz 
    END
FROM public.mailles
WHERE code IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- Vérification
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count FROM atlas.mailles;
    RAISE NOTICE 'Mailles migrées: %', v_count;
    IF v_count < 29000 THEN
        RAISE EXCEPTION 'Migration mailles incomplète: seulement % lignes', v_count;
    END IF;
END $$;

-- ============================================================================
-- 2. CRÉATION ET MIGRATION DE atlas.adm3
-- ============================================================================

-- Créer la table atlas.adm3 si elle n'existe pas
CREATE TABLE IF NOT EXISTS atlas.adm3 (
    gid integer PRIMARY KEY,
    adm3_pcode text UNIQUE,
    adm3_fr text NOT NULL,
    adm2_pcode text,
    adm2_fr text,
    adm1_pcode text,
    adm1_fr text,
    adm0_fr text DEFAULT 'Togo',
    geom geometry(MultiPolygon, 4326),
    created_at timestamptz DEFAULT now()
);

-- Index spatial
CREATE INDEX IF NOT EXISTS idx_atlas_adm3_geom ON atlas.adm3 USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_atlas_adm3_pcode ON atlas.adm3 (adm3_pcode);

-- Insérer (sans truncate pour éviter CASCADE)

INSERT INTO atlas.adm3 (gid, adm3_pcode, adm3_fr, adm2_pcode, adm2_fr, adm1_pcode, adm1_fr, adm0_fr, geom)
SELECT 
    gid,
    adm3_pcode,
    adm3_fr,
    adm2_pcode,
    adm2_fr,
    adm1_pcode,
    adm1_fr,
    COALESCE(adm0_fr, 'Togo'),
    geom
FROM public.adm3
ON CONFLICT (gid) DO NOTHING;

-- Vérification
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count FROM atlas.adm3;
    RAISE NOTICE 'ADM3 migrées: %', v_count;
    IF v_count < 370 THEN
        RAISE EXCEPTION 'Migration ADM3 incomplète: seulement % lignes', v_count;
    END IF;
END $$;

-- ============================================================================
-- 3. MISE À JOUR DE LA FK sondages.adm3_id
-- ============================================================================

-- Supprimer l'ancienne FK vers public.adm3
ALTER TABLE atlas.sondages DROP CONSTRAINT IF EXISTS fk_sondages_adm3;

-- Créer la nouvelle FK vers atlas.adm3
ALTER TABLE atlas.sondages 
ADD CONSTRAINT fk_sondages_adm3 
FOREIGN KEY (adm3_id) REFERENCES atlas.adm3(gid) ON DELETE SET NULL;

-- ============================================================================
-- 4. CRÉER DES VUES DE COMPATIBILITÉ (optionnel)
-- ============================================================================

-- Vue public.adm3 → atlas.adm3 pour compatibilité avec ancien code
CREATE OR REPLACE VIEW public.adm3_compat AS 
SELECT * FROM atlas.adm3;

COMMENT ON VIEW public.adm3_compat IS 'Vue de compatibilité vers atlas.adm3 - utiliser atlas.adm3 directement';

-- ============================================================================
-- 5. STATISTIQUES FINALES
-- ============================================================================

DO $$
DECLARE
    v_mailles integer;
    v_adm3 integer;
BEGIN
    SELECT COUNT(*) INTO v_mailles FROM atlas.mailles;
    SELECT COUNT(*) INTO v_adm3 FROM atlas.adm3;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION TERMINÉE';
    RAISE NOTICE '  - atlas.mailles: % lignes', v_mailles;
    RAISE NOTICE '  - atlas.adm3: % lignes', v_adm3;
    RAISE NOTICE '========================================';
END $$;

COMMIT;
