-- ============================================================================
-- Migration 024: Documentation et nettoyage de la table sondages
-- ============================================================================
-- Description: 
--   - Documente les colonnes canoniques vs legacy
--   - Ajoute les index spatiaux manquants
--   - Prépare la dépréciation de atlas.sondages
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DOCUMENTATION DES COLONNES (via COMMENT)
-- ============================================================================

-- Colonnes CANONIQUES (à utiliser dans tout nouveau code)
COMMENT ON COLUMN public.sondages.id IS 'PK UUID - identifiant unique du sondage';
COMMENT ON COLUMN public.sondages.meta IS 'JSONB canonique - contient code, localite, date, source, adm3_code, etc.';
COMMENT ON COLUMN public.sondages.date IS 'DATE - date du sondage (source de vérité)';
COMMENT ON COLUMN public.sondages.source IS 'TEXT - source/auteur du sondage (NICABOU, BONOU, etc.)';
COMMENT ON COLUMN public.sondages.geom_real IS 'GEOMETRY - position finale validée (EPSG:25231)';
COMMENT ON COLUMN public.sondages.grid_code IS 'TEXT - code de la maille géographique';
COMMENT ON COLUMN public.sondages.adm3_id IS 'INTEGER - FK vers adm3 (commune)';
COMMENT ON COLUMN public.sondages.is_geocoded IS 'BOOLEAN - indique si le géocodage est validé';
COMMENT ON COLUMN public.sondages.localite_base IS 'TEXT - localité normalisée pour matching';
COMMENT ON COLUMN public.sondages.localite_key IS 'TEXT - clé de recherche pour localité';
COMMENT ON COLUMN public.sondages.created_at IS 'TIMESTAMPTZ - date de création de l''enregistrement';
COMMENT ON COLUMN public.sondages.updated_at IS 'TIMESTAMPTZ - date de dernière modification';
COMMENT ON COLUMN public.sondages.deleted_at IS 'TIMESTAMPTZ - soft delete (NULL = actif)';

-- Colonnes LEGACY (à ne plus utiliser dans nouveau code)
COMMENT ON COLUMN public.sondages.date_sondage IS 'LEGACY - remplacé par "date" (DATE). Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.code IS 'LEGACY - utiliser meta->>''code'' à la place. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.geom IS 'LEGACY - utiliser geom_real. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.adm1_name IS 'LEGACY - utiliser JOIN avec adm1. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.adm2_name IS 'LEGACY - utiliser JOIN avec adm2. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.adm3_name IS 'LEGACY - utiliser JOIN avec adm3. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.adm1_id IS 'LEGACY - utiliser adm3_id et remonter via adm3.adm2_id. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.adm2_id IS 'LEGACY - utiliser adm3_id et remonter via adm3.adm2_id. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.operator IS 'LEGACY - utiliser meta->>''operator'' si nécessaire. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.notes IS 'LEGACY - utiliser meta->>''notes'' si nécessaire. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.comment IS 'LEGACY - utiliser meta->>''comment'' si nécessaire. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.type_sol IS 'LEGACY - utiliser meta->>''type_sol'' si nécessaire. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.import_id IS 'LEGACY - traçabilité ancienne. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.import_row_idx IS 'LEGACY - traçabilité ancienne. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.loc_mode IS 'LEGACY - remplacé par is_geocoded. Ne plus utiliser.';
COMMENT ON COLUMN public.sondages.location_mode IS 'LEGACY - remplacé par is_geocoded. Ne plus utiliser.';

-- Colonnes OPTIONNELLES (peuvent être utiles plus tard)
COMMENT ON COLUMN public.sondages.depth_m_min IS 'OPTIONNEL - profondeur minimale de la campagne';
COMMENT ON COLUMN public.sondages.depth_m_max IS 'OPTIONNEL - profondeur maximale de la campagne';
COMMENT ON COLUMN public.sondages.maille_code IS 'OPTIONNEL - ancien code maille (remplacé par grid_code)';

-- ============================================================================
-- 2. INDEX SPATIAUX (performance QGIS + API)
-- ============================================================================

-- Index spatial sur geom_real (géométrie canonique)
CREATE INDEX IF NOT EXISTS idx_sondages_geom_real_gist
    ON public.sondages
    USING GIST (geom_real);

-- Index sur meta JSONB pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_sondages_meta_code
    ON public.sondages
    USING btree ((meta->>'code'));

CREATE INDEX IF NOT EXISTS idx_sondages_meta_localite
    ON public.sondages
    USING btree ((meta->>'localite'));

-- Index sur date pour filtres temporels
CREATE INDEX IF NOT EXISTS idx_sondages_date
    ON public.sondages
    USING btree (date);

-- Index sur adm3_id pour jointures
CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id
    ON public.sondages
    USING btree (adm3_id);

-- Index sur grid_code pour mailles
CREATE INDEX IF NOT EXISTS idx_sondages_grid_code
    ON public.sondages
    USING btree (grid_code);

-- ============================================================================
-- 3. VUE PROPRE POUR QGIS/UI (sans colonnes legacy)
-- ============================================================================

CREATE OR REPLACE VIEW atlas.v_sondages_clean AS
SELECT
    id,
    geom_real AS geom,
    date,
    source,
    meta->>'code' AS code,
    meta->>'localite' AS localite,
    meta->>'adm3_code' AS adm3_code,
    grid_code,
    adm3_id,
    is_geocoded,
    created_at,
    updated_at,
    deleted_at
FROM public.sondages
WHERE deleted_at IS NULL;

COMMENT ON VIEW atlas.v_sondages_clean IS 
'Vue propre des sondages sans colonnes legacy - à utiliser dans QGIS/UI';

-- ============================================================================
-- 4. RENOMMER atlas.sondages EN atlas.sondages_legacy
-- ============================================================================

-- Vérifier si atlas.sondages existe et la renommer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'atlas' AND table_name = 'sondages'
    ) THEN
        ALTER TABLE atlas.sondages RENAME TO sondages_legacy_20251117;
        RAISE NOTICE '✓ atlas.sondages renommée en atlas.sondages_legacy_20251117';
    ELSE
        RAISE NOTICE 'ℹ atlas.sondages n''existe pas (déjà nettoyée)';
    END IF;
END $$;

-- ============================================================================
-- 5. VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_count int;
    v_index_count int;
BEGIN
    -- Compter les sondages actifs
    SELECT COUNT(*) INTO v_count 
    FROM public.sondages 
    WHERE deleted_at IS NULL;
    
    -- Compter les index créés
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public' 
    AND tablename = 'sondages'
    AND indexname LIKE 'idx_sondages_%';
    
    RAISE NOTICE '✓ Migration 024 terminée';
    RAISE NOTICE '  - Sondages actifs: %', v_count;
    RAISE NOTICE '  - Index créés: %', v_index_count;
    RAISE NOTICE '  - Vue atlas.v_sondages_clean créée';
    RAISE NOTICE '  - atlas.sondages → atlas.sondages_legacy_20251117';
END $$;

COMMIT;
