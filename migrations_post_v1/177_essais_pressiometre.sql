\set ON_ERROR_STOP 1
-- Migration 177 — Table essais_pressiometre
-- Intrepid Core Engineering Standards — DB-11 (atomique/idempotent)
--
-- Stocke les mesures pressiométriques par profondeur (SP)
-- Source : V10_INSITU_PROFIL_Z.csv colonnes pressiometre_*
-- Utilisé pour interpolation kriging Em (module pressiométrique)

BEGIN;

-- ── 1. Table essais_pressiometre ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS atlas.essais_pressiometre (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  echantillon_id   UUID        NOT NULL REFERENCES atlas.echantillons(id) ON DELETE CASCADE,
  -- Profondeur réelle de la mesure
  z_reel_m         NUMERIC     NOT NULL CHECK (z_reel_m >= 0),
  -- Horizon canonique (H1/H2/H3 ou H3 si > 2m)
  h_canon          TEXT        CHECK (h_canon IN ('H1','H2','H3')),
  -- Paramètres pressiométriques (MPa)
  pf_mpa           NUMERIC     CHECK (pf_mpa >= 0),   -- pression de fluage
  pl_mpa           NUMERIC     CHECK (pl_mpa >= 0),   -- pression limite
  em_mpa           NUMERIC     CHECK (em_mpa >= 0),   -- module pressiométrique (kriging cible)
  e_pl_ratio       NUMERIC     CHECK (e_pl_ratio >= 0), -- rapport Em/Pl
  -- Traçabilité
  source_reference TEXT,
  meta             JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,
  created_by_batch TEXT
);

COMMENT ON TABLE atlas.essais_pressiometre IS
  'Mesures pressiométriques par profondeur (SP). Source : V10_INSITU_PROFIL_Z.csv.';
COMMENT ON COLUMN atlas.essais_pressiometre.em_mpa IS
  'Module pressiométrique Em (MPa). Paramètre cible pour interpolation kriging.';
COMMENT ON COLUMN atlas.essais_pressiometre.pl_mpa IS
  'Pression limite Pl (MPa). Utilisée pour calcul portance ELS/ELU fondations.';

CREATE INDEX IF NOT EXISTS idx_essais_pressiometre_echantillon
  ON atlas.essais_pressiometre (echantillon_id);
CREATE INDEX IF NOT EXISTS idx_essais_pressiometre_h_canon
  ON atlas.essais_pressiometre (h_canon);
CREATE INDEX IF NOT EXISTS idx_essais_pressiometre_em
  ON atlas.essais_pressiometre (em_mpa) WHERE em_mpa IS NOT NULL;

-- ── 2. Trigger updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION atlas.set_updated_at_pressiometre()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_pressiometre ON atlas.essais_pressiometre;
CREATE TRIGGER trg_updated_at_pressiometre
  BEFORE UPDATE ON atlas.essais_pressiometre
  FOR EACH ROW EXECUTE FUNCTION atlas.set_updated_at_pressiometre();

-- ── 3. Catalogue paramètres (Em interpolable) ─────────────────────────────────
INSERT INTO atlas.ai_parameter_catalog
  (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled,
   is_active, source_table, source_column, physical_min, physical_max,
   depth_stratified, is_derived, derived_from, min_pts_stratified, min_pts_rk)
VALUES
  ('em_mpa_ked_h1','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('em_mpa_ked_h2','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('em_mpa_ked_h3','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('em_mpa_rk_h1','geotech','interpolation','MPa', true, true, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('em_mpa_rk_h2','geotech','interpolation','MPa', true, true, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('em_mpa_rk_h3','geotech','interpolation','MPa', true, true, true,
   'essais_pressiometre','em_mpa', 0, 200, true, false, '{}', 15, 30),
  ('pl_mpa_ked_h1','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','pl_mpa', 0, 5, true, false, '{}', 15, 30),
  ('pl_mpa_ked_h2','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','pl_mpa', 0, 5, true, false, '{}', 15, 30),
  ('pl_mpa_ked_h3','geotech','interpolation','MPa', true, false, true,
   'essais_pressiometre','pl_mpa', 0, 5, true, false, '{}', 15, 30)
ON CONFLICT (parameter_id) DO NOTHING;

-- ── 4. Vérification ───────────────────────────────────────────────────────────
DO $$
DECLARE v_tbl BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='atlas' AND table_name='essais_pressiometre'
  ) INTO v_tbl;
  IF NOT v_tbl THEN
    RAISE EXCEPTION 'Migration 177 FAILED : table essais_pressiometre non créée';
  END IF;
  RAISE NOTICE '=== Migration 177 OK — essais_pressiometre créé ===';
END $$;

COMMIT;
