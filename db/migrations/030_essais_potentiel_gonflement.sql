-- Migration 030: Créer table dédiée essais_potentiel_gonflement
-- Séparer le potentiel de gonflement (AMESSEFE) des classifications géotechniques
-- Date: 2025-11-19

BEGIN;

-- ============================================================================
-- 1. CRÉER LA NOUVELLE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_potentiel_gonflement (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    echantillon_id  uuid NOT NULL UNIQUE
        REFERENCES echantillons(id) ON DELETE CASCADE,
    
    -- Potentiel de gonflement (cg)
    cg              numeric,           -- Valeur numérique (ex: 2.49, 4.17, 5.37)
    cg_qual         text,              -- Qualificatif: Faible / Moyen / Elevé
    
    -- Type de sol (classification pédologique)
    type_sol        text,              -- Ex: "Hydromorphes", "Vertisols et Paravertisols"
    
    -- Métadonnées
    meta            jsonb,             -- Infos supplémentaires (source, analyse, etc.)
    
    -- Audit
    created_at      timestamptz DEFAULT now(),
    created_by      uuid,
    updated_at      timestamptz,
    updated_by      uuid
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_potentiel_gonflement_echantillon 
    ON essais_potentiel_gonflement(echantillon_id);

CREATE INDEX IF NOT EXISTS idx_potentiel_gonflement_cg_qual 
    ON essais_potentiel_gonflement(cg_qual);

COMMENT ON TABLE essais_potentiel_gonflement IS 
    'Potentiel de gonflement des sols (AMESSEFE) - séparé des classifications géotechniques';

COMMENT ON COLUMN essais_potentiel_gonflement.cg IS 
    'Coefficient de gonflement (valeur numérique)';

COMMENT ON COLUMN essais_potentiel_gonflement.cg_qual IS 
    'Qualificatif du potentiel: Faible / Moyen / Elevé';

COMMENT ON COLUMN essais_potentiel_gonflement.type_sol IS 
    'Classification pédologique du sol (ex: Hydromorphes, Vertisols)';

-- ============================================================================
-- 2. TRANSFÉRER LES DONNÉES EXISTANTES
-- ============================================================================

-- Transférer les données de essais_classif vers essais_potentiel_gonflement
INSERT INTO essais_potentiel_gonflement (echantillon_id, cg, cg_qual, type_sol, created_at)
SELECT 
    echantillon_id,
    cg,
    cg_qual,
    type_sol,
    COALESCE(created_at, now())
FROM essais_classif
WHERE cg IS NOT NULL 
   OR cg_qual IS NOT NULL 
   OR type_sol IS NOT NULL
ON CONFLICT (echantillon_id) DO NOTHING;

-- Statistiques du transfert
DO $$
DECLARE
    v_count_transferred int;
BEGIN
    SELECT COUNT(*) INTO v_count_transferred 
    FROM essais_potentiel_gonflement;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 030: Table essais_potentiel_gonflement créée';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '  ✓ Table créée avec contrainte UNIQUE sur echantillon_id';
    RAISE NOTICE '  ✓ % lignes transférées depuis essais_classif', v_count_transferred;
    RAISE NOTICE '';
    RAISE NOTICE 'Structure:';
    RAISE NOTICE '  • cg (numeric) : coefficient de gonflement';
    RAISE NOTICE '  • cg_qual (text) : Faible / Moyen / Elevé';
    RAISE NOTICE '  • type_sol (text) : classification pédologique';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: Les colonnes cg, cg_qual, type_sol restent dans essais_classif';
    RAISE NOTICE '      pour compatibilité. Elles peuvent être supprimées plus tard.';
    RAISE NOTICE '============================================================================';
END $$;

COMMIT;
