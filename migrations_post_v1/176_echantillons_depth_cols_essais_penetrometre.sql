\set ON_ERROR_STOP 1
-- Migration 176 — Colonnes profondeur canonique + table essais_penetrometre
-- Intrepid Core Engineering Standards — DB-11 (atomique/idempotent), DB-10
--
-- Modifications echantillons :
--   depth_z_min  : borne inférieure réelle de l'horizon (audit)
--   depth_z_max  : borne supérieure réelle de l'horizon (audit)
--   h_canon      : horizon canonique H1/H2/H3 (dérivé du centroïde)
--   depth_m reste le centroïde = (z_min+z_max)/2 (ou la profondeur historique)
--
-- Règle canonisation V10 :
--   centroïde = (z_min + z_max) / 2
--   H1 : centroïde ≤ 1.0 m
--   H2 : 1.0 < centroïde ≤ 1.5 m
--   H3 : centroïde > 1.5 m  (inclus profondeurs > 2 m → traitées comme H3,
--                             profondeur réelle conservée dans depth_z_max)

BEGIN;

-- ── 1. Colonnes echantillons ──────────────────────────────────────────────────
ALTER TABLE atlas.echantillons
  ADD COLUMN IF NOT EXISTS depth_z_min  NUMERIC,
  ADD COLUMN IF NOT EXISTS depth_z_max  NUMERIC,
  ADD COLUMN IF NOT EXISTS h_canon      TEXT
    CHECK (h_canon IN ('H1','H2','H3'));

COMMENT ON COLUMN atlas.echantillons.depth_z_min IS
  'Borne supérieure réelle de l''horizon de prélèvement (m depuis surface). Audit V10.';
COMMENT ON COLUMN atlas.echantillons.depth_z_max IS
  'Borne inférieure réelle de l''horizon de prélèvement (m depuis surface). Profondeurs > 2 m acceptées, mappées H3.';
COMMENT ON COLUMN atlas.echantillons.h_canon IS
  'Horizon canonique : H1 (0–1 m), H2 (1–1,5 m), H3 (> 1,5 m). Calculé à partir du centroïde (depth_z_min + depth_z_max)/2.';

-- Index pour requêtes kriging par horizon
CREATE INDEX IF NOT EXISTS idx_echantillons_h_canon
  ON atlas.echantillons (h_canon)
  WHERE h_canon IS NOT NULL;

-- ── 2. Table essais_penetrometre ──────────────────────────────────────────────
-- Stocke les profils de résistance dynamique (PD) par sondage
-- FK → echantillons (1 ligne par profondeur mesurée)

CREATE TABLE IF NOT EXISTS atlas.essais_penetrometre (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  echantillon_id   UUID        NOT NULL REFERENCES atlas.echantillons(id) ON DELETE CASCADE,
  -- Profondeur réelle de la mesure
  z_reel_m         NUMERIC     NOT NULL CHECK (z_reel_m >= 0),
  -- Horizon canonique calculé à l'insertion
  h_canon          TEXT        CHECK (h_canon IN ('H1','H2','H3')),
  -- Résistance dynamique Rd (MPa) — colonne principale pour kriging
  rd_mpa           NUMERIC     CHECK (rd_mpa >= 0),
  -- Portance ELU et ELS calculées depuis Rd
  elu_mpa          NUMERIC     CHECK (elu_mpa >= 0),
  els_mpa          NUMERIC     CHECK (els_mpa >= 0),
  -- Résistivité géophysique si disponible
  resistivite_ohm  NUMERIC     CHECK (resistivite_ohm >= 0),
  -- Source et traçabilité
  source_reference TEXT,
  meta             JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  created_by_batch TEXT
);

COMMENT ON TABLE atlas.essais_penetrometre IS
  'Profils de pénétromètre dynamique (PD) par profondeur. Source : V10_INSITU_PROFIL_Z.csv.';
COMMENT ON COLUMN atlas.essais_penetrometre.rd_mpa IS
  'Résistance à la pointe Rd (MPa). Paramètre principal pour interpolation kriging.';
COMMENT ON COLUMN atlas.essais_penetrometre.h_canon IS
  'Horizon canonique H1/H2/H3 dérivé de z_reel_m. Profondeurs > 2 m → H3 (valeur réelle dans z_reel_m).';

CREATE INDEX IF NOT EXISTS idx_essais_penetrometre_echantillon
  ON atlas.essais_penetrometre (echantillon_id);
CREATE INDEX IF NOT EXISTS idx_essais_penetrometre_h_canon
  ON atlas.essais_penetrometre (h_canon);
CREATE INDEX IF NOT EXISTS idx_essais_penetrometre_rd
  ON atlas.essais_penetrometre (rd_mpa) WHERE rd_mpa IS NOT NULL;

-- ── 3. Trigger updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION atlas.set_updated_at_penetrometre()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_penetrometre ON atlas.essais_penetrometre;
CREATE TRIGGER trg_updated_at_penetrometre
  BEFORE UPDATE ON atlas.essais_penetrometre
  FOR EACH ROW EXECUTE FUNCTION atlas.set_updated_at_penetrometre();

-- ── 4. Entrée catalogue paramètres (rd_mpa interpolable par horizon) ──────────
INSERT INTO atlas.ai_parameter_catalog
  (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled,
   is_active, source_table, source_column, physical_min, physical_max,
   depth_stratified, is_derived, derived_from, min_pts_stratified, min_pts_rk)
VALUES
  ('rd_mpa_ked_h1','geotech','interpolation','MPa', true, false, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30),
  ('rd_mpa_ked_h2','geotech','interpolation','MPa', true, false, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30),
  ('rd_mpa_ked_h3','geotech','interpolation','MPa', true, false, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30),
  ('rd_mpa_rk_h1','geotech','interpolation','MPa', true, true, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30),
  ('rd_mpa_rk_h2','geotech','interpolation','MPa', true, true, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30),
  ('rd_mpa_rk_h3','geotech','interpolation','MPa', true, true, true,
   'essais_penetrometre','rd_mpa', 0, 50, true, false, '{}', 15, 30)
ON CONFLICT (parameter_id) DO NOTHING;

-- ── 5. Vérification ───────────────────────────────────────────────────────────
DO $$
DECLARE v_cols INTEGER; v_tbl BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_cols
    FROM information_schema.columns
    WHERE table_schema = 'atlas' AND table_name = 'echantillons'
      AND column_name IN ('depth_z_min','depth_z_max','h_canon');
  IF v_cols < 3 THEN
    RAISE EXCEPTION 'Migration 176 FAILED : colonnes echantillons manquantes (% sur 3)', v_cols;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='essais_penetrometre'
  ) INTO v_tbl;
  IF NOT v_tbl THEN
    RAISE EXCEPTION 'Migration 176 FAILED : table essais_penetrometre non créée';
  END IF;

  RAISE NOTICE '=== Migration 176 OK — echantillons (+3 cols) + essais_penetrometre créés ===';
END $$;

COMMIT;
