\set ON_ERROR_STOP 1
-- Migration 178 — Table essais_cbr + indice_groupe dans essais_classif
-- Intrepid Core Engineering Standards — DB-11 (atomique/idempotent)
--
-- Ajouts :
--  1. essais_classif.indice_groupe (IG HRB) — colonne manquante
--  2. essais_cbr — courbe CBR par niveau de compactage
--  3. Catalogue : cbr_95 interpolable par horizon H1/H2/H3

BEGIN;

-- ── 1. Colonne indice_groupe dans essais_classif ──────────────────────────────
ALTER TABLE atlas.essais_classif
  ADD COLUMN IF NOT EXISTS indice_groupe NUMERIC
    CHECK (indice_groupe >= 0 AND indice_groupe <= 20);

COMMENT ON COLUMN atlas.essais_classif.indice_groupe IS
  'Indice de Groupe HRB (0–20). Source V10_LABORATOIRE_HORIZONS.csv colonne indice_groupe_ig.';

-- ── 2. Table essais_cbr ───────────────────────────────────────────────────────
-- Courbe CBR complète : 3 niveaux de compactage (55, 25, 12 coups)
-- Le cbr_95_pct du LABORATOIRE_HORIZONS est stocké ici comme mesure à ~95 %
-- Les points CBR détaillés viennent des fichiers V10_COMPACITE_CBR_*.csv

CREATE TABLE IF NOT EXISTS atlas.essais_cbr (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  echantillon_id   UUID        NOT NULL REFERENCES atlas.echantillons(id) ON DELETE CASCADE,
  -- Conditions d'essai
  proctor_type     TEXT        NOT NULL DEFAULT 'modified'
    CHECK (proctor_type IN ('modified','standard','unknown')),
  n_coups          INTEGER     CHECK (n_coups > 0),  -- énergie Proctor (55/25/12)
  immersion_j      INTEGER     NOT NULL DEFAULT 4
    CHECK (immersion_j >= 0),                         -- durée immersion (j)
  -- Résultats mesurés
  compactage_pct   NUMERIC     CHECK (compactage_pct > 0 AND compactage_pct <= 110),
  cbr_pct          NUMERIC     CHECK (cbr_pct >= 0),  -- valeur CBR (%) ← kriging cible
  gamma_d_gcm3     NUMERIC     CHECK (gamma_d_gcm3 > 0),
  w_pct            NUMERIC     CHECK (w_pct >= 0),    -- teneur en eau de compactage
  -- Horizon et traçabilité
  h_canon          TEXT        CHECK (h_canon IN ('H1','H2','H3')),
  source_reference TEXT,
  meta             JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  created_by_batch TEXT
);

COMMENT ON TABLE atlas.essais_cbr IS
  'Essais CBR avec courbe compactage. Sources : V10_COMPACITE_CBR_*.csv + cbr_95_pct de V10_LABORATOIRE_HORIZONS.csv.';
COMMENT ON COLUMN atlas.essais_cbr.cbr_pct IS
  'Valeur CBR (%). Paramètre principal pour interpolation kriging portance routière.';
COMMENT ON COLUMN atlas.essais_cbr.n_coups IS
  '55 coups → 100% Proctor, 25 coups → ~95%, 12 coups → ~90%. NULL si CBR ponctuel (cbr_95_pct seul disponible).';
COMMENT ON COLUMN atlas.essais_cbr.h_canon IS
  'Horizon canonique H1/H2/H3 hérité de l''échantillon associé.';

CREATE INDEX IF NOT EXISTS idx_essais_cbr_echantillon
  ON atlas.essais_cbr (echantillon_id);
CREATE INDEX IF NOT EXISTS idx_essais_cbr_h_canon
  ON atlas.essais_cbr (h_canon);
CREATE INDEX IF NOT EXISTS idx_essais_cbr_cbr_pct
  ON atlas.essais_cbr (cbr_pct) WHERE cbr_pct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_essais_cbr_compactage
  ON atlas.essais_cbr (compactage_pct);

-- ── 3. Trigger updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION atlas.set_updated_at_cbr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_cbr ON atlas.essais_cbr;
CREATE TRIGGER trg_updated_at_cbr
  BEFORE UPDATE ON atlas.essais_cbr
  FOR EACH ROW EXECUTE FUNCTION atlas.set_updated_at_cbr();

-- ── 4. Catalogue paramètres cbr_95 ───────────────────────────────────────────
INSERT INTO atlas.ai_parameter_catalog
  (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled,
   is_active, source_table, source_column, physical_min, physical_max,
   depth_stratified, is_derived, derived_from, min_pts_stratified, min_pts_rk)
VALUES
  -- CBR à 95% Proctor — paramètre portance routière
  ('cbr_95_ked_h1','portance','interpolation','%', true, false, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_ked_h2','portance','interpolation','%', true, false, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_ked_h3','portance','interpolation','%', true, false, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_rk_h1','portance','interpolation','%', true, true, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_rk_h2','portance','interpolation','%', true, true, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_rk_h3','portance','interpolation','%', true, true, true,
   'essais_cbr','cbr_pct', 0, 100, true, false, '{}', 10, 20),
  ('cbr_95_avg','portance','base','%', false, true, true,
   'essais_cbr','cbr_pct', 0, 100, false, false, '{}', 10, 20),
  -- OPM gamma_d par horizon (essais_proctor)
  ('gamma_d_ked_h1','compacite','interpolation','g/cm3', true, false, true,
   'essais_proctor','gamma_d_max', 1.4, 2.3, true, false, '{}', 10, 20),
  ('gamma_d_ked_h2','compacite','interpolation','g/cm3', true, false, true,
   'essais_proctor','gamma_d_max', 1.4, 2.3, true, false, '{}', 10, 20),
  ('gamma_d_ked_h3','compacite','interpolation','g/cm3', true, false, true,
   'essais_proctor','gamma_d_max', 1.4, 2.3, true, false, '{}', 10, 20)
ON CONFLICT (parameter_id) DO NOTHING;

-- ── 5. Vérification ───────────────────────────────────────────────────────────
DO $$
DECLARE v_col BOOLEAN; v_tbl BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='atlas' AND table_name='essais_classif'
      AND column_name='indice_groupe'
  ) INTO v_col;
  IF NOT v_col THEN
    RAISE EXCEPTION 'Migration 178 FAILED : colonne indice_groupe manquante dans essais_classif';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='essais_cbr'
  ) INTO v_tbl;
  IF NOT v_tbl THEN
    RAISE EXCEPTION 'Migration 178 FAILED : table essais_cbr non créée';
  END IF;

  RAISE NOTICE '=== Migration 178 OK — essais_cbr + indice_groupe + catalogue paramètres ===';
END $$;

COMMIT;
