-- Migration unification sondages
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA IF NOT EXISTS atlas;

-- Fonction normalisation
CREATE OR REPLACE FUNCTION atlas.normalize_localite(loc text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(unaccent(COALESCE(loc, ''))));
$$;

-- Vue unifiée
CREATE OR REPLACE VIEW atlas.v_sondages_unifies AS
WITH base AS (
  SELECT s.*, atlas.normalize_localite(s.adm3_name) AS localite_canon
  FROM sondages s
  WHERE s.adm3_name IS NOT NULL
),
grp AS (
  SELECT
    localite_canon,
    (array_agg(id ORDER BY created_at))[1] AS survey_id_canon,
    (array_agg(code ORDER BY created_at))[1] AS code_canon
  FROM base
  GROUP BY localite_canon
)
SELECT
  g.survey_id_canon AS id,
  g.code_canon AS code,
  b.localite_canon,
  (array_agg(b.adm3_id ORDER BY b.created_at) FILTER (WHERE b.adm3_id IS NOT NULL))[1] AS adm3_id,
  MAX(b.adm3_name) AS adm3_name,
  (array_agg(b.geom ORDER BY b.created_at) FILTER (WHERE b.geom IS NOT NULL))[1] AS geom,
  BOOL_OR(b.is_geocoded) AS is_geocoded,
  MAX(b.location_mode::text) AS location_mode,
  MAX(b.date) AS date,
  MIN(b.created_at) AS created_at,
  MAX(b.updated_at) AS updated_at,
  COUNT(*) AS nb_sondages,
  ARRAY_AGG(DISTINCT b.id) AS source_survey_ids,
  ARRAY_AGG(DISTINCT b.code) AS alias_codes
FROM base b
JOIN grp g ON g.localite_canon = b.localite_canon
GROUP BY g.survey_id_canon, g.code_canon, b.localite_canon;

-- MV
CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_sondages_unifies AS SELECT * FROM atlas.v_sondages_unifies;
CREATE UNIQUE INDEX IF NOT EXISTS mv_sondages_unifies_id_idx ON atlas.mv_sondages_unifies (id);
CREATE INDEX IF NOT EXISTS mv_sondages_unifies_localite_idx ON atlas.mv_sondages_unifies (localite_canon);

-- Tables canoniques
CREATE TABLE IF NOT EXISTS atlas.surveys (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,
  localite_canon text NOT NULL,
  adm3_id uuid,
  adm3_name text,
  geom geometry(Point, 4326),
  location_mode text,
  is_geocoded boolean DEFAULT false,
  date date,
  nb_sondages_source integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS surveys_localite_idx ON atlas.surveys (localite_canon);

CREATE TABLE IF NOT EXISTS atlas.survey_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES atlas.surveys(id) ON DELETE CASCADE,
  alias_code text UNIQUE NOT NULL,
  source text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS survey_aliases_survey_idx ON atlas.survey_aliases (survey_id);

-- Backfill
INSERT INTO atlas.surveys (id, code, localite_canon, adm3_id, adm3_name, geom, location_mode, is_geocoded, date, nb_sondages_source, created_at, updated_at)
SELECT 
  id, code, localite_canon, adm3_id, adm3_name, 
  ST_Transform(geom, 4326) as geom,
  location_mode, is_geocoded, date, nb_sondages, created_at, updated_at
FROM atlas.mv_sondages_unifies
ON CONFLICT (id) DO NOTHING;

INSERT INTO atlas.survey_aliases (survey_id, alias_code, source)
SELECT 
  u.id as survey_id,
  unnest(u.alias_codes) as alias_code,
  'legacy' as source
FROM atlas.mv_sondages_unifies u
ON CONFLICT (alias_code) DO NOTHING;

-- Permissions
GRANT USAGE ON SCHEMA atlas TO atlas;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA atlas TO atlas;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA atlas TO atlas;
ALTER ROLE atlas SET search_path TO public, atlas;
