-- ============================================================================
-- MIGRATION 009: Import Bulk Infrastructure
-- ============================================================================
-- Description: Tables et fonctions pour l'import bulk de sondages
-- Version: 1.0
-- Date: 2025-10-19
-- Auteur: Atlas Team
-- ============================================================================

-- ============================================================================
-- 1. TABLE: test_type_defaults (Référentiel types d'essais)
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_type_defaults (
  type_essai TEXT PRIMARY KEY,
  default_unit TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  accepted_units TEXT[], -- Unités acceptées avec conversion
  converter_fn TEXT, -- Nom de la fonction de conversion (optionnel)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE test_type_defaults IS 'Référentiel des types d''essais avec unités et plages de valeurs';
COMMENT ON COLUMN test_type_defaults.type_essai IS 'Type d''essai (clé primaire)';
COMMENT ON COLUMN test_type_defaults.default_unit IS 'Unité par défaut';
COMMENT ON COLUMN test_type_defaults.min_value IS 'Valeur minimale acceptable';
COMMENT ON COLUMN test_type_defaults.max_value IS 'Valeur maximale acceptable';
COMMENT ON COLUMN test_type_defaults.accepted_units IS 'Liste des unités acceptées';
COMMENT ON COLUMN test_type_defaults.converter_fn IS 'Fonction de conversion entre unités';

-- Insertion des types d'essais standards
INSERT INTO test_type_defaults (type_essai, default_unit, min_value, max_value, accepted_units, description) VALUES
  ('Granulometrie', '%', 0, 100, ARRAY['%'], 'Analyse granulométrique - % passant'),
  ('BleuMethylene_VBS', 'g/100g', 0, 15, ARRAY['g/100g'], 'Valeur au bleu de méthylène'),
  ('Atterberg_WL', '%', 0, 100, ARRAY['%'], 'Limite de liquidité'),
  ('Atterberg_WP', '%', 0, 100, ARRAY['%'], 'Limite de plasticité'),
  ('Atterberg_IP', '%', 0, 100, ARRAY['%'], 'Indice de plasticité'),
  ('Proctor_gdmax', 't/m³', 1.5, 2.3, ARRAY['t/m³', 'g/cm³'], 'Proctor - Densité sèche maximale'),
  ('Proctor_wopt', '%', 5, 25, ARRAY['%'], 'Proctor - Teneur en eau optimale'),
  ('PotentielGonflement_eg', '%', 0.5, 15, ARRAY['%'], 'Potentiel de gonflement'),
  ('SPT_N', 'blows/30cm', 0, 100, ARRAY['blows/30cm'], 'Standard Penetration Test (legacy)'),
  ('qc', 'MPa', 0.1, 50, ARRAY['MPa', 'kPa'], 'Résistance de pointe CPT (legacy)')
ON CONFLICT (type_essai) DO NOTHING;

-- ============================================================================
-- 2. TABLE: imports (Lots d'import)
-- ============================================================================

CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL, -- SHA256 du fichier
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  mapping_json JSONB NOT NULL, -- Configuration mapping utilisée
  geoloc_mode TEXT NOT NULL CHECK (geoloc_mode IN ('exact', 'centroid', 'random', 'unknown', 'maille')),
  seed INTEGER, -- Pour mode random (déterminisme)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'partial', 'cancelled')),
  stats_json JSONB, -- {sondages: 12, essais: 36, warnings: 2, errors: 0}
  file_blob BYTEA, -- Fichier brut sauvegardé (optionnel)
  error_message TEXT,
  progress NUMERIC(5,2) DEFAULT 0.0 CHECK (progress >= 0 AND progress <= 100)
);

COMMENT ON TABLE imports IS 'Lots d''import bulk de sondages';
COMMENT ON COLUMN imports.content_hash IS 'Hash SHA256 du fichier pour détecter les doublons';
COMMENT ON COLUMN imports.mapping_json IS 'Configuration du mapping colonnes utilisée';
COMMENT ON COLUMN imports.geoloc_mode IS 'Mode de géolocalisation: exact/centroid/random/unknown/maille';
COMMENT ON COLUMN imports.seed IS 'Seed pour génération déterministe des points aléatoires';
COMMENT ON COLUMN imports.status IS 'Statut: pending/running/succeeded/failed/partial/cancelled';
COMMENT ON COLUMN imports.stats_json IS 'Statistiques de l''import (JSON)';
COMMENT ON COLUMN imports.file_blob IS 'Fichier source brut (optionnel, pour traçabilité)';

CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_content_hash ON imports(content_hash);

-- ============================================================================
-- 3. TABLE: import_items (Traçabilité ligne par ligne)
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  row_idx INTEGER NOT NULL, -- Numéro de ligne dans le fichier source
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'error', 'skipped')),
  error_msg TEXT,
  warning_msg TEXT,
  created_survey_id UUID REFERENCES sondages(id) ON DELETE SET NULL,
  created_tests_count INTEGER DEFAULT 0,
  raw_json JSONB, -- Ligne source brute
  fingerprint TEXT, -- hash(localite, date, type_essai, profondeur_m, valeur) pour anti-doublon
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(import_id, row_idx)
);

COMMENT ON TABLE import_items IS 'Traçabilité ligne par ligne des imports';
COMMENT ON COLUMN import_items.row_idx IS 'Numéro de ligne dans le fichier source';
COMMENT ON COLUMN import_items.status IS 'Statut: ok/warning/error/skipped';
COMMENT ON COLUMN import_items.fingerprint IS 'Hash anti-doublon de la ligne';
COMMENT ON COLUMN import_items.raw_json IS 'Données source brutes (JSON)';

CREATE INDEX IF NOT EXISTS idx_import_items_import_id ON import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_import_items_fingerprint ON import_items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON import_items(status);
CREATE INDEX IF NOT EXISTS idx_import_items_survey_id ON import_items(created_survey_id);

-- ============================================================================
-- 4. TABLE: import_logs (Logs structurés)
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  context_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE import_logs IS 'Logs structurés des imports';
COMMENT ON COLUMN import_logs.level IS 'Niveau: debug/info/warning/error';
COMMENT ON COLUMN import_logs.context_json IS 'Contexte additionnel (JSON)';

CREATE INDEX IF NOT EXISTS idx_import_logs_import_id ON import_logs(import_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_level ON import_logs(level);
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs(created_at DESC);

-- ============================================================================
-- 5. TABLE: import_mapping_profiles (Profils de mapping réutilisables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_mapping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  mapping_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

COMMENT ON TABLE import_mapping_profiles IS 'Profils de mapping sauvegardés par utilisateur';
COMMENT ON COLUMN import_mapping_profiles.mapping_json IS 'Configuration du mapping (JSON)';
COMMENT ON COLUMN import_mapping_profiles.use_count IS 'Nombre d''utilisations du profil';

CREATE INDEX IF NOT EXISTS idx_import_mapping_profiles_user_id ON import_mapping_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_import_mapping_profiles_last_used ON import_mapping_profiles(last_used_at DESC);

-- ============================================================================
-- 6. MODIFICATIONS: Tables existantes (sondages, essais)
-- ============================================================================

-- Ajouter colonnes traçabilité import dans sondages
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES imports(id) ON DELETE SET NULL;
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS import_row_idx INTEGER;

COMMENT ON COLUMN sondages.import_id IS 'Référence vers le lot d''import (si importé)';
COMMENT ON COLUMN sondages.import_row_idx IS 'Numéro de ligne dans le fichier source';

CREATE INDEX IF NOT EXISTS idx_sondages_import_id ON sondages(import_id);

-- Ajouter colonnes traçabilité import dans essais
ALTER TABLE essais ADD COLUMN IF NOT EXISTS is_from_import BOOLEAN DEFAULT false;
ALTER TABLE essais ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES imports(id) ON DELETE SET NULL;

COMMENT ON COLUMN essais.is_from_import IS 'Indique si l''essai provient d''un import bulk';
COMMENT ON COLUMN essais.import_id IS 'Référence vers le lot d''import (si importé)';

CREATE INDEX IF NOT EXISTS idx_essais_import_id ON essais(import_id);
CREATE INDEX IF NOT EXISTS idx_essais_is_from_import ON essais(is_from_import) WHERE is_from_import = true;

-- ============================================================================
-- 7. FONCTIONS: Utilitaires import
-- ============================================================================

-- Fonction: Calculer fingerprint anti-doublon
CREATE OR REPLACE FUNCTION compute_import_fingerprint(
  p_localite TEXT,
  p_date DATE,
  p_type_essai TEXT,
  p_profondeur_m NUMERIC,
  p_valeur NUMERIC
) RETURNS TEXT AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(p_localite, '') || '|' || 
           COALESCE(p_date::TEXT, '') || '|' || 
           COALESCE(p_type_essai, '') || '|' || 
           COALESCE(p_profondeur_m::TEXT, '') || '|' || 
           COALESCE(p_valeur::TEXT, '');
  
  RETURN substring(encode(digest(v_key, 'sha256'), 'hex'), 1, 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION compute_import_fingerprint IS 'Calcule un fingerprint anti-doublon pour une ligne d''import';

-- Fonction: Valider valeur essai
CREATE OR REPLACE FUNCTION validate_test_value(
  p_type_essai TEXT,
  p_valeur NUMERIC,
  p_unit TEXT DEFAULT NULL
) RETURNS TABLE(
  is_valid BOOLEAN,
  error_msg TEXT,
  warning_msg TEXT
) AS $$
DECLARE
  v_defaults RECORD;
  v_unit TEXT;
BEGIN
  -- Récupérer les defaults
  SELECT * INTO v_defaults FROM test_type_defaults WHERE type_essai = p_type_essai;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Type d''essai inconnu: ' || p_type_essai, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Vérifier l'unité
  v_unit := COALESCE(p_unit, v_defaults.default_unit);
  
  IF v_unit != v_defaults.default_unit AND NOT (v_unit = ANY(v_defaults.accepted_units)) THEN
    RETURN QUERY SELECT false, 'Unité non acceptée: ' || v_unit || ' (attendu: ' || v_defaults.default_unit || ')', NULL::TEXT;
    RETURN;
  END IF;
  
  -- Vérifier la plage
  IF p_valeur < v_defaults.min_value OR p_valeur > v_defaults.max_value THEN
    RETURN QUERY SELECT true, NULL::TEXT, 
      'Valeur hors plage: ' || p_valeur || ' ' || v_unit || 
      ' (attendu: [' || v_defaults.min_value || ', ' || v_defaults.max_value || '])';
    RETURN;
  END IF;
  
  -- Tout est OK
  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_test_value IS 'Valide une valeur d''essai selon les référentiels';

-- ============================================================================
-- 8. VUES: Statistiques imports
-- ============================================================================

CREATE OR REPLACE VIEW v_import_stats AS
SELECT 
  i.id,
  i.filename,
  i.status,
  i.geoloc_mode,
  i.created_at,
  i.completed_at,
  (i.stats_json->>'sondages')::INTEGER AS sondages_count,
  (i.stats_json->>'essais')::INTEGER AS essais_count,
  (i.stats_json->>'warnings')::INTEGER AS warnings_count,
  (i.stats_json->>'errors')::INTEGER AS errors_count,
  COUNT(DISTINCT ii.created_survey_id) AS surveys_created,
  SUM(ii.created_tests_count) AS tests_created,
  COUNT(*) FILTER (WHERE ii.status = 'error') AS rows_error,
  COUNT(*) FILTER (WHERE ii.status = 'warning') AS rows_warning,
  COUNT(*) FILTER (WHERE ii.status = 'ok') AS rows_ok
FROM imports i
LEFT JOIN import_items ii ON ii.import_id = i.id
GROUP BY i.id, i.filename, i.status, i.geoloc_mode, i.created_at, i.completed_at, i.stats_json;

COMMENT ON VIEW v_import_stats IS 'Statistiques détaillées des imports';

-- ============================================================================
-- FIN DE LA MIGRATION 009
-- ============================================================================

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'Migration 009 appliquée avec succès';
  RAISE NOTICE 'Tables créées: test_type_defaults, imports, import_items, import_logs, import_mapping_profiles';
  RAISE NOTICE 'Colonnes ajoutées: sondages.import_id, essais.is_from_import';
  RAISE NOTICE 'Fonctions créées: compute_import_fingerprint, validate_test_value';
  RAISE NOTICE 'Vues créées: v_import_stats';
END $$;
