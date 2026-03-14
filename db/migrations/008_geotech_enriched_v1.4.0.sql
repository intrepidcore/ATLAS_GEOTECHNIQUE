-- Migration 008: Enrichissement du modèle géotechnique (v1.4.0)
-- Date: 2025-10-18
-- Description: Ajout des ENUMs, table classifications, colonnes enrichies pour sondages/essais

-- ============================================================================
-- 1. Créer les types ENUM
-- ============================================================================

-- Type de sol (pour sondages)
CREATE TYPE type_sol_enum AS ENUM (
    'Vertisols et Paravertisols',
    'Ferrugineux Tropicaux et Pseudogley',
    'Hydromorphes',
    'Faiblement Ferralitique',
    'Ferralitique Typique ou Modaux',
    'Ferrugineux Tropicaux Lessivés',
    'Autre'
);

-- Analyses qualitatives (pour essais et classifications)
CREATE TYPE analyse_qualitative_enum AS ENUM (
    'Faible',
    'Moyen',
    'Moyenne',
    'Fort',
    'Forte',
    'Très forte',
    'Elevé',
    'Très élevé',
    'Non gonflant',
    'Gonflant',
    'Peu gonflant',
    'Moyennement gonflant',
    'Très gonflant'
);

-- Méthodes de classification
CREATE TYPE methode_classification_enum AS ENUM (
    'CHASSAGNEUX D. et al. ;1996',
    'Dakshanamurthy et Raman (1973)',
    'SEED H. (1962)',
    'VIJAYVERGIYA et GHAZZALY 1973',
    'Williams et Donaldson (1980)',
    'Chen (1988)',
    'Autre'
);

-- ============================================================================
-- 2. Enrichir la table sondages
-- ============================================================================

-- Ajouter colonne type_sol
ALTER TABLE sondages
ADD COLUMN IF NOT EXISTS type_sol type_sol_enum;

-- Ajouter colonnes manquantes si elles n'existent pas encore
ALTER TABLE sondages
ADD COLUMN IF NOT EXISTS location_accuracy TEXT DEFAULT 'exact',
ADD COLUMN IF NOT EXISTS is_geocoded BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS operator TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS maille_code TEXT,
ADD COLUMN IF NOT EXISTS adm1_name TEXT,
ADD COLUMN IF NOT EXISTS adm2_name TEXT,
ADD COLUMN IF NOT EXISTS adm3_name TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Renommer date_sondage en date si elle existe encore
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sondages' AND column_name = 'date_sondage'
    ) THEN
        -- Si 'date' n'existe pas encore, renommer
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'sondages' AND column_name = 'date'
        ) THEN
            ALTER TABLE sondages RENAME COLUMN date_sondage TO date;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 3. Enrichir la table essais
-- ============================================================================

-- Renommer 'type' en 'type_essai' si nécessaire
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'essais' AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'essais' AND column_name = 'type_essai'
    ) THEN
        ALTER TABLE essais RENAME COLUMN type TO type_essai;
    END IF;
END $$;

-- Renommer 'value' en 'valeur_numerique'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'essais' AND column_name = 'value'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'essais' AND column_name = 'valeur_numerique'
    ) THEN
        ALTER TABLE essais RENAME COLUMN value TO valeur_numerique;
    END IF;
END $$;

-- Ajouter colonnes manquantes
ALTER TABLE essais
ADD COLUMN IF NOT EXISTS valeur_qualitative analyse_qualitative_enum,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- S'assurer que type_essai est en TEXT (pas ENUM) pour flexibilité
ALTER TABLE essais ALTER COLUMN type_essai TYPE TEXT;

-- ============================================================================
-- 4. Créer la table classifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id UUID NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
    profondeur_m NUMERIC NOT NULL,
    methode methode_classification_enum NOT NULL,
    resultat analyse_qualitative_enum NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_classification UNIQUE(sondage_id, profondeur_m, methode)
);

-- Index pour classifications
CREATE INDEX IF NOT EXISTS idx_classifications_sondage_id ON classifications(sondage_id);
CREATE INDEX IF NOT EXISTS idx_classifications_profondeur ON classifications(profondeur_m);
CREATE INDEX IF NOT EXISTS idx_classifications_methode ON classifications(methode);

-- ============================================================================
-- 5. Mettre à jour les données existantes
-- ============================================================================

-- Remplacer "Tamisat_0.08mm" par "Granulometrie"
UPDATE essais
SET type_essai = 'Granulometrie'
WHERE type_essai = 'Tamisat_0.08mm';

-- Ajouter meta.sieve_mm = 0.08 pour tous les essais Granulometrie sans cette info
UPDATE essais
SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('sieve_mm', 0.08)
WHERE type_essai = 'Granulometrie'
  AND (meta IS NULL OR NOT (meta ? 'sieve_mm'));

-- ============================================================================
-- 6. Créer/mettre à jour la table audit_log si nécessaire
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    payload JSONB,
    location_mode TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- 7. Créer tables ADM si elles n'existent pas
-- ============================================================================

CREATE TABLE IF NOT EXISTS adm1_tg (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT,
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adm2_tg (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    adm1_name TEXT,
    code TEXT,
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adm3_tg (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    adm2_name TEXT,
    code TEXT,
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index spatiaux
CREATE INDEX IF NOT EXISTS idx_adm1_tg_geom ON adm1_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm2_tg_geom ON adm2_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_geom ON adm3_tg USING GIST(geom);

-- ============================================================================
-- Fin de la migration 008
-- ============================================================================

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Migration 008 appliquée avec succès - Modèle géotechnique enrichi v1.4.0';
END $$;
