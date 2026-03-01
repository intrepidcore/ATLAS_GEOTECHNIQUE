-- Migration 007: Enrichissement géotechnique - modèle complet pour données de rapport
-- Version: 1.4.0
-- Date: 2025-10-18
-- Description: Ajoute types de sol, classifications, granulométrie complète

BEGIN;

-- ============================================================================
-- 1. ENUM pour types de sol (classification pédologique)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE type_sol_enum AS ENUM (
    'Vertisols et Paravertisols',
    'Ferrugineux Tropicaux et Pseudogley',
    'Hydromorphes',
    'Faiblement Ferralitique',
    'Ferralitique Typique ou Modaux',
    'Ferrugineux Tropicaux Lessivés',
    'Autre'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE type_sol_enum IS 'Classification pédologique des sols selon typologie africaine';

-- ============================================================================
-- 2. ENUM pour analyses qualitatives
-- ============================================================================

DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE analyse_qualitative_enum IS 'Valeurs qualitatives pour interprétation des essais';

-- ============================================================================
-- 3. ENUM pour méthodes de classification
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE methode_classification_enum AS ENUM (
    'CHASSAGNEUX D. et al. ;1996',
    'Dakshanamurthy et Raman (1973)',
    'SEED H. (1962)',
    'VIJAYVERGIYA et GHAZZALY 1973',
    'Williams et Donaldson (1980)',
    'Chen (1988)',
    'Autre'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE methode_classification_enum IS 'Méthodes de classification géotechnique reconnues';

-- ============================================================================
-- 4. Enrichir la table sondages avec type_sol
-- ============================================================================

ALTER TABLE sondages
  ADD COLUMN IF NOT EXISTS type_sol type_sol_enum;

CREATE INDEX IF NOT EXISTS idx_sondages_type_sol ON sondages(type_sol);

COMMENT ON COLUMN sondages.type_sol IS 'Type de sol selon classification pédologique';

-- ============================================================================
-- 5. Modifier la table essais pour supporter valeurs qualitatives
-- ============================================================================

-- Renommer 'value' en 'valeur_numerique' si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'essais' AND column_name = 'value') THEN
    ALTER TABLE essais RENAME COLUMN value TO valeur_numerique;
  END IF;
END $$;

-- Ajouter colonne pour valeurs qualitatives
ALTER TABLE essais
  ADD COLUMN IF NOT EXISTS valeur_qualitative analyse_qualitative_enum;

-- Renommer 'type' en 'type_essai' si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'essais' AND column_name = 'type') THEN
    ALTER TABLE essais RENAME COLUMN type TO type_essai;
  END IF;
END $$;

-- S'assurer que type_essai est TEXT (pas ENUM) pour flexibilité
ALTER TABLE essais ALTER COLUMN type_essai TYPE TEXT;

-- Ajouter colonne meta si n'existe pas
ALTER TABLE essais
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_essais_type_essai ON essais(type_essai);
CREATE INDEX IF NOT EXISTS idx_essais_meta ON essais USING gin(meta);

COMMENT ON COLUMN essais.type_essai IS 'Type d''essai (Granulometrie, BleuMethylene_VBS, Atterberg_WL, etc.)';
COMMENT ON COLUMN essais.valeur_numerique IS 'Valeur numérique de l''essai';
COMMENT ON COLUMN essais.valeur_qualitative IS 'Interprétation qualitative de l''essai';
COMMENT ON COLUMN essais.meta IS 'Métadonnées JSON (ex: {"sieve_mm": 0.08} pour granulométrie)';

-- ============================================================================
-- 6. Migrer les données existantes: Tamisat_0.08mm → Granulometrie
-- ============================================================================

UPDATE essais
SET type_essai = 'Granulometrie',
    meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('sieve_mm', 0.08)
WHERE type_essai = 'Tamisat_0.08mm';

-- ============================================================================
-- 7. Créer table classifications (interprétations selon méthodes reconnues)
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

CREATE INDEX IF NOT EXISTS idx_classifications_sondage_id ON classifications(sondage_id);
CREATE INDEX IF NOT EXISTS idx_classifications_methode ON classifications(methode);
CREATE INDEX IF NOT EXISTS idx_classifications_deleted ON classifications(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE classifications IS 'Classifications géotechniques selon méthodes reconnues (potentiel de gonflement, etc.)';
COMMENT ON COLUMN classifications.profondeur_m IS 'Profondeur en mètres';
COMMENT ON COLUMN classifications.methode IS 'Méthode de classification utilisée';
COMMENT ON COLUMN classifications.resultat IS 'Résultat qualitatif de la classification';

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS classifications_updated_at ON classifications;
CREATE TRIGGER classifications_updated_at
  BEFORE UPDATE ON classifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. Créer table granulometrie_points (pour courbes granulométriques complètes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS granulometrie_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  essai_id UUID NOT NULL REFERENCES essais(id) ON DELETE CASCADE,
  sieve_mm NUMERIC NOT NULL CHECK (sieve_mm > 0),
  percent_passing NUMERIC NOT NULL CHECK (percent_passing >= 0 AND percent_passing <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_granulo_point UNIQUE(essai_id, sieve_mm)
);

CREATE INDEX idx_granulo_essai_id ON granulometrie_points(essai_id);
CREATE INDEX idx_granulo_sieve ON granulometrie_points(sieve_mm);

COMMENT ON TABLE granulometrie_points IS 'Points de la courbe granulométrique (plusieurs tamis par essai)';
COMMENT ON COLUMN granulometrie_points.sieve_mm IS 'Diamètre du tamis en millimètres';
COMMENT ON COLUMN granulometrie_points.percent_passing IS 'Pourcentage de passant (0-100)';

-- ============================================================================
-- 9. View enrichie: sondages avec statistiques complètes
-- ============================================================================

CREATE OR REPLACE VIEW v_sondages_enriched AS
SELECT 
  s.*,
  ST_AsGeoJSON(ST_Transform(s.geom, 4326))::jsonb AS geom_geojson,
  COUNT(DISTINCT e.id) FILTER (WHERE e.deleted_at IS NULL) AS n_essais,
  COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) AS n_classifications,
  MIN(e.depth_m) FILTER (WHERE e.deleted_at IS NULL) AS min_depth_m,
  MAX(e.depth_m) FILTER (WHERE e.deleted_at IS NULL) AS max_depth_m,
  array_agg(DISTINCT e.type_essai) FILTER (WHERE e.deleted_at IS NULL AND e.type_essai IS NOT NULL) AS types_essais,
  array_agg(DISTINCT c.methode::text) FILTER (WHERE c.deleted_at IS NULL) AS methodes_classification
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
LEFT JOIN classifications c ON c.sondage_id = s.id AND c.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id;

COMMENT ON VIEW v_sondages_enriched IS 'Vue enrichie des sondages avec statistiques essais et classifications';

-- ============================================================================
-- 10. View: essais avec granulométrie complète
-- ============================================================================

CREATE OR REPLACE VIEW v_essais_granulo AS
SELECT 
  e.*,
  json_agg(
    json_build_object(
      'sieve_mm', gp.sieve_mm,
      'percent_passing', gp.percent_passing
    ) ORDER BY gp.sieve_mm DESC
  ) FILTER (WHERE gp.id IS NOT NULL) AS courbe_granulo
FROM essais e
LEFT JOIN granulometrie_points gp ON gp.essai_id = e.id
WHERE e.deleted_at IS NULL AND e.type_essai = 'Granulometrie'
GROUP BY e.id;

COMMENT ON VIEW v_essais_granulo IS 'Essais de granulométrie avec courbe complète (tous les tamis)';

-- ============================================================================
-- 11. Fonction: calculer IP automatiquement (WL - WP)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_atterberg_ip()
RETURNS TRIGGER AS $$
DECLARE
  wl_val NUMERIC;
  wp_val NUMERIC;
  ip_val NUMERIC;
  ip_essai_id UUID;
BEGIN
  -- Si c'est un essai Atterberg_WL ou Atterberg_WP, recalculer IP
  IF NEW.type_essai IN ('Atterberg_WL', 'Atterberg_WP') AND NEW.deleted_at IS NULL THEN
    
    -- Récupérer WL et WP pour ce sondage à cette profondeur
    SELECT 
      MAX(valeur_numerique) FILTER (WHERE type_essai = 'Atterberg_WL'),
      MAX(valeur_numerique) FILTER (WHERE type_essai = 'Atterberg_WP')
    INTO wl_val, wp_val
    FROM essais
    WHERE sondage_id = NEW.sondage_id 
      AND depth_m = NEW.depth_m
      AND deleted_at IS NULL
      AND type_essai IN ('Atterberg_WL', 'Atterberg_WP');
    
    -- Si les deux existent, calculer IP
    IF wl_val IS NOT NULL AND wp_val IS NOT NULL THEN
      ip_val := wl_val - wp_val;
      
      -- Vérifier si IP existe déjà
      SELECT id INTO ip_essai_id
      FROM essais
      WHERE sondage_id = NEW.sondage_id
        AND depth_m = NEW.depth_m
        AND type_essai = 'Atterberg_IP'
        AND deleted_at IS NULL
      LIMIT 1;
      
      IF ip_essai_id IS NOT NULL THEN
        -- Mettre à jour
        UPDATE essais
        SET valeur_numerique = ip_val,
            updated_at = now()
        WHERE id = ip_essai_id;
      ELSE
        -- Créer nouveau
        INSERT INTO essais (id, sondage_id, depth_m, type_essai, valeur_numerique, unit)
        VALUES (gen_random_uuid(), NEW.sondage_id, NEW.depth_m, 'Atterberg_IP', ip_val, '%');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS essais_calculate_ip ON essais;
CREATE TRIGGER essais_calculate_ip
  AFTER INSERT OR UPDATE ON essais
  FOR EACH ROW
  EXECUTE FUNCTION calculate_atterberg_ip();

COMMENT ON FUNCTION calculate_atterberg_ip() IS 'Calcule automatiquement IP = WL - WP lors de saisie Atterberg';

-- ============================================================================
-- 12. Contraintes de validation
-- ============================================================================

-- Essai doit avoir soit valeur_numerique, soit valeur_qualitative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_essai_has_value'
      AND n.nspname = 'public'
      AND t.relname = 'essais'
  ) THEN
    ALTER TABLE essais ADD CONSTRAINT check_essai_has_value
      CHECK (valeur_numerique IS NOT NULL OR valeur_qualitative IS NOT NULL);
  END IF;
END $$;

-- Classification doit avoir profondeur positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'check_classification_depth_positive'
      AND n.nspname = 'public'
      AND t.relname = 'classifications'
  ) THEN
    ALTER TABLE classifications ADD CONSTRAINT check_classification_depth_positive
      CHECK (profondeur_m >= 0);
  END IF;
END $$;

-- ============================================================================
-- 13. Données de référence: types d'essais standards
-- ============================================================================

-- Table de référence pour les types d'essais (optionnel, pour UI)
CREATE TABLE IF NOT EXISTS ref_types_essais (
  code TEXT PRIMARY KEY,
  nom_fr TEXT NOT NULL,
  nom_en TEXT,
  categorie TEXT NOT NULL CHECK (categorie IN ('Granulometrie', 'Atterberg', 'Gonflement', 'Compaction', 'Resistance', 'Autre')),
  unite_defaut TEXT,
  description TEXT,
  ordre_affichage INT DEFAULT 999
);

INSERT INTO ref_types_essais (code, nom_fr, nom_en, categorie, unite_defaut, ordre_affichage) VALUES
  ('Granulometrie', 'Granulométrie (% passant)', 'Grain size distribution', 'Granulometrie', '%', 10),
  ('BleuMethylene_VBS', 'Valeur au bleu de méthylène (VBS)', 'Methylene blue value', 'Atterberg', 'g/100g', 20),
  ('Atterberg_WL', 'Limite de liquidité (WL)', 'Liquid limit', 'Atterberg', '%', 30),
  ('Atterberg_WP', 'Limite de plasticité (WP)', 'Plastic limit', 'Atterberg', '%', 40),
  ('Atterberg_IP', 'Indice de plasticité (IP)', 'Plasticity index', 'Atterberg', '%', 50),
  ('PotentielGonflement_eg', 'Potentiel de gonflement (eg)', 'Swelling potential', 'Gonflement', '%', 60),
  ('Analyse_Bleu', 'Analyse qualitative VBS', 'VBS qualitative analysis', 'Atterberg', NULL, 25),
  ('Analyse_Atterberg', 'Analyse qualitative Atterberg', 'Atterberg qualitative analysis', 'Atterberg', NULL, 55),
  ('Analyse_Gonflement', 'Analyse qualitative gonflement', 'Swelling qualitative analysis', 'Gonflement', NULL, 65)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE ref_types_essais IS 'Table de référence des types d''essais géotechniques standards';

-- ============================================================================
-- 14. Audit: enregistrer les opérations sur classifications
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_classification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (action, entity, entity_id, payload)
    VALUES ('DELETE', 'classification', OLD.id, row_to_json(OLD)::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (action, entity, entity_id, payload)
    VALUES ('UPDATE', 'classification', NEW.id, jsonb_build_object(
      'old', row_to_json(OLD)::jsonb,
      'new', row_to_json(NEW)::jsonb
    ));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (action, entity, entity_id, payload)
    VALUES ('INSERT', 'classification', NEW.id, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classifications_audit ON classifications;
CREATE TRIGGER classifications_audit
  AFTER INSERT OR UPDATE OR DELETE ON classifications
  FOR EACH ROW
  EXECUTE FUNCTION audit_classification();

COMMIT;

-- ============================================================================
-- FIN MIGRATION 007
-- ============================================================================
