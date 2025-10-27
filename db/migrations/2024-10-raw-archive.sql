-- ============================================================================
-- RAW Archive for AGT/AGS/Atterberg (v1.5.3)
-- ============================================================================
-- Description: Tables pour archiver les mesures laboratoire au format long
-- Date: 2024-10-24
-- Author: Atlas Geotechnique Team
-- ============================================================================

-- Type ENUM pour Atterberg (Limite de Liquidité / Limite de Plasticité)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'atterberg_test_type') THEN
    CREATE TYPE atterberg_test_type AS ENUM ('LL','PL');
  END IF;
END $$;

-- ============================================================================
-- Table: raw_lab_agt (Analyse Granulométrique par Tamisage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_lab_agt (
  id                BIGSERIAL PRIMARY KEY,
  code_site         TEXT NOT NULL,
  depth_m           NUMERIC(5,2) NOT NULL,
  sieve_mm          NUMERIC(10,4) NOT NULL,
  mass_refus_cum_g  NUMERIC(14,3),
  refus_cum_pct     NUMERIC(7,3),
  passants_pct      NUMERIC(7,3),
  echantillon_id    BIGINT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code_site, depth_m, sieve_mm)
);

COMMENT ON TABLE raw_lab_agt IS 'Archive RAW des analyses granulométriques par tamisage (AGT)';
COMMENT ON COLUMN raw_lab_agt.code_site IS 'Code du sondage (ex: KEVE-S1)';
COMMENT ON COLUMN raw_lab_agt.depth_m IS 'Profondeur en mètres';
COMMENT ON COLUMN raw_lab_agt.sieve_mm IS 'Ouverture du tamis en mm';
COMMENT ON COLUMN raw_lab_agt.mass_refus_cum_g IS 'Masse de refus cumulés en grammes';
COMMENT ON COLUMN raw_lab_agt.refus_cum_pct IS 'Refus cumulés en %';
COMMENT ON COLUMN raw_lab_agt.passants_pct IS 'Passants en %';
COMMENT ON COLUMN raw_lab_agt.echantillon_id IS 'Lien vers echantillons.id (rempli après import)';

-- ============================================================================
-- Table: raw_lab_ags (Analyse Granulométrique par Sédimentométrie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_lab_ags (
  id                BIGSERIAL PRIMARY KEY,
  code_site         TEXT NOT NULL,
  depth_m           NUMERIC(5,2) NOT NULL,
  sieve_mm          NUMERIC(10,4) NOT NULL,
  passants_pct      NUMERIC(7,3) NOT NULL,
  echantillon_id    BIGINT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code_site, depth_m, sieve_mm)
);

COMMENT ON TABLE raw_lab_ags IS 'Archive RAW des analyses granulométriques par sédimentométrie (AGS)';
COMMENT ON COLUMN raw_lab_ags.code_site IS 'Code du sondage (ex: KEVE-S1)';
COMMENT ON COLUMN raw_lab_ags.depth_m IS 'Profondeur en mètres';
COMMENT ON COLUMN raw_lab_ags.sieve_mm IS 'Diamètre équivalent en mm';
COMMENT ON COLUMN raw_lab_ags.passants_pct IS 'Passants en %';
COMMENT ON COLUMN raw_lab_ags.echantillon_id IS 'Lien vers echantillons.id (rempli après import)';

-- ============================================================================
-- Table: raw_lab_atterberg (Essais Atterberg détaillés)
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_lab_atterberg (
  id                   BIGSERIAL PRIMARY KEY,
  code_site            TEXT NOT NULL,
  depth_m              NUMERIC(5,2) NOT NULL,
  test_type            atterberg_test_type NOT NULL,
  tare_no              INT,
  nb_coups             NUMERIC(6,2),
  poids_total_humide_g NUMERIC(10,2),
  poids_total_sec_g    NUMERIC(10,2),
  poids_tare_g         NUMERIC(10,2),
  poids_eau_g          NUMERIC(10,2),
  poids_sol_sec_g      NUMERIC(10,2),
  teneur_eau_pct       NUMERIC(7,3),
  echantillon_id       BIGINT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE raw_lab_atterberg IS 'Archive RAW des essais Atterberg détaillés (mesures par tare)';
COMMENT ON COLUMN raw_lab_atterberg.code_site IS 'Code du sondage (ex: KEVE-S1)';
COMMENT ON COLUMN raw_lab_atterberg.depth_m IS 'Profondeur en mètres';
COMMENT ON COLUMN raw_lab_atterberg.test_type IS 'Type de test: LL (Limite de Liquidité) ou PL (Limite de Plasticité)';
COMMENT ON COLUMN raw_lab_atterberg.tare_no IS 'Numéro de la tare';
COMMENT ON COLUMN raw_lab_atterberg.nb_coups IS 'Nombre de coups (pour LL uniquement)';
COMMENT ON COLUMN raw_lab_atterberg.poids_total_humide_g IS 'Poids total humide en grammes';
COMMENT ON COLUMN raw_lab_atterberg.poids_total_sec_g IS 'Poids total sec en grammes';
COMMENT ON COLUMN raw_lab_atterberg.poids_tare_g IS 'Poids de la tare en grammes';
COMMENT ON COLUMN raw_lab_atterberg.poids_eau_g IS 'Poids de l''eau en grammes';
COMMENT ON COLUMN raw_lab_atterberg.poids_sol_sec_g IS 'Poids du sol sec en grammes';
COMMENT ON COLUMN raw_lab_atterberg.teneur_eau_pct IS 'Teneur en eau en %';
COMMENT ON COLUMN raw_lab_atterberg.echantillon_id IS 'Lien vers echantillons.id (rempli après import)';

-- ============================================================================
-- Index pour performances
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_raw_agt_site_depth ON raw_lab_agt(code_site, depth_m);
CREATE INDEX IF NOT EXISTS idx_raw_agt_echantillon ON raw_lab_agt(echantillon_id) WHERE echantillon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_ags_site_depth ON raw_lab_ags(code_site, depth_m);
CREATE INDEX IF NOT EXISTS idx_raw_ags_echantillon ON raw_lab_ags(echantillon_id) WHERE echantillon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_att_site_depth ON raw_lab_atterberg(code_site, depth_m);
CREATE INDEX IF NOT EXISTS idx_raw_att_test_type ON raw_lab_atterberg(test_type);
CREATE INDEX IF NOT EXISTS idx_raw_att_echantillon ON raw_lab_atterberg(echantillon_id) WHERE echantillon_id IS NOT NULL;

-- ============================================================================
-- Vue de confort: fusion AGT + AGS
-- ============================================================================
CREATE OR REPLACE VIEW v_raw_lab_granulo AS
SELECT 
  code_site, 
  depth_m, 
  sieve_mm, 
  passants_pct, 
  'AGT'::text AS src,
  echantillon_id,
  created_at
FROM raw_lab_agt 
WHERE passants_pct IS NOT NULL
UNION ALL
SELECT 
  code_site, 
  depth_m, 
  sieve_mm, 
  passants_pct, 
  'AGS'::text AS src,
  echantillon_id,
  created_at
FROM raw_lab_ags;

COMMENT ON VIEW v_raw_lab_granulo IS 'Vue fusionnée AGT + AGS pour courbes granulométriques complètes';

-- ============================================================================
-- Triggers updated_at pour AGT/AGS (production-ready)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_raw_agt_updated_at'
  ) THEN
    CREATE TRIGGER tr_raw_agt_updated_at
    BEFORE UPDATE ON raw_lab_agt
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_raw_ags_updated_at'
  ) THEN
    CREATE TRIGGER tr_raw_ags_updated_at
    BEFORE UPDATE ON raw_lab_ags
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Fin de la migration v1.5.3
-- ============================================================================
