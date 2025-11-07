-- 1) Enum + contraintes géocodage
DO $$ BEGIN
  CREATE TYPE atlas.location_mode AS ENUM ('unknown','exact','adm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE atlas.surveys
  ALTER COLUMN location_mode TYPE atlas.location_mode
  USING location_mode::atlas.location_mode;

ALTER TABLE atlas.surveys
  DROP CONSTRAINT IF EXISTS surveys_exact_requires_geom,
  DROP CONSTRAINT IF EXISTS surveys_adm_requires_adm3,
  ADD CONSTRAINT surveys_exact_requires_geom CHECK (
    location_mode <> 'exact' OR geom IS NOT NULL
  ),
  ADD CONSTRAINT surveys_adm_requires_adm3 CHECK (
    location_mode <> 'adm' OR adm3_id IS NOT NULL
  );

-- 2) Touch updated_at automatiquement
CREATE OR REPLACE FUNCTION atlas.tg_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_surveys ON atlas.surveys;
CREATE TRIGGER trg_touch_surveys
BEFORE UPDATE ON atlas.surveys
FOR EACH ROW EXECUTE FUNCTION atlas.tg_touch_updated_at();

-- 3) Index pour la recherche
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS surveys_code_trgm
  ON atlas.surveys USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS surveys_localite_trgm
  ON atlas.surveys USING gin (localite_canon gin_trgm_ops);

-- 4) Refresh de la MV (propre)
CREATE OR REPLACE FUNCTION atlas.refresh_sondages_unifies()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
$$;
