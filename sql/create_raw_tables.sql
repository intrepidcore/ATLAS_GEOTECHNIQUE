-- Création des tables RAW pour archivage fidèle des données laboratoire

-- enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'atterberg_test_type') THEN
    CREATE TYPE atterberg_test_type AS ENUM ('LL','PL');
  END IF;
END $$;

-- raw_lab_agt
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

-- raw_lab_ags
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

-- raw_lab_atterberg
CREATE TABLE IF NOT EXISTS raw_lab_atterberg (
  id                   BIGSERIAL PRIMARY KEY,
  code_site            TEXT NOT NULL,
  depth_m              NUMERIC(5,2) NOT NULL,
  test_type            atterberg_test_type NOT NULL,  -- 'LL' ou 'PL'
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

SELECT 'Tables RAW créées' AS status;
