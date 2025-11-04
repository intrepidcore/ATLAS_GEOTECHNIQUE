-- Migration 013: Extension schéma essais (physiques, classifications, granulo)
-- Date: 2025-11-03
-- Objectif: Supporter densités, teneur eau, classifications multiples, courbes granulo

-- ============================================================================
-- 1. TABLE: essais_physiques (densités, teneur en eau)
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_physiques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    essai_id UUID NOT NULL REFERENCES essais_geotechniques(id) ON DELETE CASCADE,
    
    -- Densités
    densite_apparente_gcm3 NUMERIC CHECK (densite_apparente_gcm3 > 0 AND densite_apparente_gcm3 < 5),
    densite_absolue_gcm3 NUMERIC CHECK (densite_absolue_gcm3 > 0 AND densite_absolue_gcm3 < 5),
    
    -- Teneur en eau
    teneur_eau_pct NUMERIC CHECK (teneur_eau_pct >= 0 AND teneur_eau_pct <= 100),
    
    -- Métadonnées
    source TEXT,
    measured_at DATE,
    meta JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    created_by_batch TEXT,
    updated_by_batch TEXT,
    deleted_by_batch TEXT,
    deleted_at TIMESTAMPTZ,
    
    -- Contraintes
    CONSTRAINT essais_physiques_essai_unique UNIQUE (essai_id)
);

CREATE INDEX IF NOT EXISTS idx_physiques_essai ON essais_physiques(essai_id);
CREATE INDEX IF NOT EXISTS idx_physiques_created_batch ON essais_physiques(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_physiques_deleted_batch ON essais_physiques(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;

COMMENT ON TABLE essais_physiques IS 'Propriétés physiques des essais (densités, teneur en eau)';
COMMENT ON COLUMN essais_physiques.densite_apparente_gcm3 IS 'Densité apparente (bulk density) en g/cm³';
COMMENT ON COLUMN essais_physiques.densite_absolue_gcm3 IS 'Densité absolue (particle density) en g/cm³';
COMMENT ON COLUMN essais_physiques.teneur_eau_pct IS 'Teneur en eau naturelle (%) = (m_eau / m_sec) * 100';

-- ============================================================================
-- 2. TABLE: essais_classif (classifications multiples par essai)
-- ============================================================================

CREATE TABLE IF NOT EXISTS essais_classif (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    essai_id UUID NOT NULL REFERENCES essais_geotechniques(id) ON DELETE CASCADE,
    
    -- Classification
    systeme TEXT NOT NULL CHECK (systeme IN ('AASHTO', 'USCS', 'GTR', 'LPC', 'HRB')),
    classe TEXT NOT NULL,
    reason TEXT,
    version TEXT,  -- ex: 'AASHTO M 145-91', 'ASTM D2487-17'
    computed BOOLEAN DEFAULT FALSE,  -- TRUE si calculé automatiquement
    
    -- Métadonnées
    source TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    created_by_batch TEXT,
    updated_by_batch TEXT,
    deleted_by_batch TEXT,
    deleted_at TIMESTAMPTZ,
    
    -- Contraintes
    CONSTRAINT essais_classif_essai_systeme_unique UNIQUE (essai_id, systeme)
);

CREATE INDEX IF NOT EXISTS idx_classif_essai ON essais_classif(essai_id);
CREATE INDEX IF NOT EXISTS idx_classif_systeme ON essais_classif(systeme);
CREATE INDEX IF NOT EXISTS idx_classif_classe ON essais_classif(classe);
CREATE INDEX IF NOT EXISTS idx_classif_created_batch ON essais_classif(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classif_deleted_batch ON essais_classif(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;

COMMENT ON TABLE essais_classif IS 'Classifications géotechniques multiples (AASHTO, USCS, GTR, etc.)';
COMMENT ON COLUMN essais_classif.systeme IS 'Système de classification: AASHTO, USCS, GTR, LPC, HRB';
COMMENT ON COLUMN essais_classif.classe IS 'Classe résultante (ex: A-7-5, CL, A1)';
COMMENT ON COLUMN essais_classif.computed IS 'TRUE si calculé automatiquement depuis WL/WP/granulo';

-- ============================================================================
-- 3. TABLE: granulometrie_points (courbes granulométriques détaillées)
-- ============================================================================

CREATE TABLE IF NOT EXISTS granulometrie_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    essai_id UUID NOT NULL REFERENCES essais_geotechniques(id) ON DELETE CASCADE,
    
    -- Point de mesure
    tamis_mm NUMERIC NOT NULL CHECK (tamis_mm > 0),  -- Ouverture tamis en mm
    passant_pct NUMERIC NOT NULL CHECK (passant_pct >= 0 AND passant_pct <= 100),  -- % passant
    
    -- Type d'analyse
    methode TEXT CHECK (methode IN ('tamisage', 'sedimentometrie', 'laser')),
    
    -- Métadonnées
    meta JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by_batch TEXT,
    deleted_by_batch TEXT,
    deleted_at TIMESTAMPTZ,
    
    -- Contraintes
    CONSTRAINT granulo_points_essai_tamis_unique UNIQUE (essai_id, tamis_mm)
);

CREATE INDEX IF NOT EXISTS idx_granulo_essai ON granulometrie_points(essai_id);
CREATE INDEX IF NOT EXISTS idx_granulo_tamis ON granulometrie_points(tamis_mm);
CREATE INDEX IF NOT EXISTS idx_granulo_methode ON granulometrie_points(methode) WHERE methode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_granulo_created_batch ON granulometrie_points(created_by_batch) WHERE created_by_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_granulo_deleted_batch ON granulometrie_points(deleted_by_batch) WHERE deleted_by_batch IS NOT NULL;

COMMENT ON TABLE granulometrie_points IS 'Points de courbes granulométriques (tamisage + sédimentométrie)';
COMMENT ON COLUMN granulometrie_points.tamis_mm IS 'Ouverture du tamis en mm (ou diamètre équivalent pour sédimentométrie)';
COMMENT ON COLUMN granulometrie_points.passant_pct IS 'Pourcentage de passant cumulé';
COMMENT ON COLUMN granulometrie_points.methode IS 'Méthode: tamisage, sedimentometrie, laser';

-- ============================================================================
-- 4. TRIGGERS: updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_physiques_updated_at ON essais_physiques;
CREATE TRIGGER trg_physiques_updated_at
    BEFORE UPDATE ON essais_physiques
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_classif_updated_at ON essais_classif;
CREATE TRIGGER trg_classif_updated_at
    BEFORE UPDATE ON essais_classif
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- 5. VÉRIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 013 terminée avec succès';
    RAISE NOTICE '  - Table essais_physiques créée';
    RAISE NOTICE '  - Table essais_classif créée';
    RAISE NOTICE '  - Table granulometrie_points créée';
    RAISE NOTICE '  - Indexes et triggers configurés';
END $$;
