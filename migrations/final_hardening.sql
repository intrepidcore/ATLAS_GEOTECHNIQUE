-- ========================================
-- MICRO-AMÉLIORATIONS FINALES
-- ========================================

-- 1) Clé canonique (localite_canon, adm3_id) pour éviter homonymes
DROP INDEX IF EXISTS uq_surveys_localite_adm3;
CREATE UNIQUE INDEX uq_surveys_localite_adm3
ON atlas.surveys (localite_canon, COALESCE(adm3_id::text, 'NULL'));

CREATE INDEX IF NOT EXISTS ix_surveys_localite_canon 
ON atlas.surveys (localite_canon);

-- 2) Fonction de normalisation centralisée
CREATE OR REPLACE FUNCTION atlas.norm(text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(unaccent(coalesce($1,'')), '\s+', ' ', 'g'));
$$;

-- 3) Index trigram sur formes normalisées
DROP INDEX IF EXISTS ix_surveys_search;
CREATE INDEX ix_surveys_search
ON atlas.surveys USING gin (
  atlas.norm(code) gin_trgm_ops, 
  atlas.norm(COALESCE(localite, '')) gin_trgm_ops, 
  atlas.norm(localite_canon) gin_trgm_ops
);

-- 4) Contraintes harmonisées (exact, adm, spread)
ALTER TABLE atlas.surveys DROP CONSTRAINT IF EXISTS surveys_exact_requires_geom;
ALTER TABLE atlas.surveys DROP CONSTRAINT IF EXISTS surveys_adm_requires_adm3;
ALTER TABLE atlas.surveys DROP CONSTRAINT IF EXISTS surveys_spread_requires_area;

ALTER TABLE atlas.surveys ADD CONSTRAINT surveys_exact_requires_geom
CHECK (location_mode <> 'exact' OR geom IS NOT NULL);

ALTER TABLE atlas.surveys ADD CONSTRAINT surveys_adm_requires_adm3
CHECK (location_mode <> 'adm' OR adm3_id IS NOT NULL);

-- 5) Pipeline MV → table canon (refresh atomique)
CREATE OR REPLACE FUNCTION atlas.refresh_surveys() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
  
  TRUNCATE atlas.surveys RESTART IDENTITY CASCADE;
  
  INSERT INTO atlas.surveys (
    id, code, localite_canon, localite, adm3_id, adm3_name, geom, 
    location_mode, is_geocoded, date, nb_sondages_source, created_at, updated_at
  )
  SELECT 
    id, code, localite_canon, localite, adm3_id, adm3_name, 
    CASE WHEN geom IS NOT NULL THEN ST_Transform(geom,4326) ELSE NULL END,
    location_mode::atlas.location_mode, is_geocoded, date, nb_sondages, created_at, updated_at
  FROM atlas.mv_sondages_unifies;
  
  TRUNCATE atlas.survey_aliases;
  
  INSERT INTO atlas.survey_aliases (survey_id, alias_code, source)
  SELECT id, unnest(alias_codes), 'legacy' 
  FROM atlas.mv_sondages_unifies
  ON CONFLICT (alias_code) DO NOTHING;
END; 
$$ LANGUAGE plpgsql;

-- 6) Table de liaison essais ↔ canonique (future-proof)
CREATE TABLE IF NOT EXISTS atlas.survey_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES atlas.surveys(id) ON DELETE CASCADE,
  test_type text NOT NULL,
  raw_source_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (survey_id, test_type, raw_source_id)
);

CREATE INDEX IF NOT EXISTS ix_survey_tests_survey ON atlas.survey_tests (survey_id);
CREATE INDEX IF NOT EXISTS ix_survey_tests_type ON atlas.survey_tests (test_type);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON atlas.survey_tests TO atlas;
