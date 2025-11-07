-- Vider et re-remplir les tables canoniques
TRUNCATE atlas.surveys CASCADE;

-- Ajouter colonne localite dans surveys
ALTER TABLE atlas.surveys ADD COLUMN IF NOT EXISTS localite text;

INSERT INTO atlas.surveys (
  id, code, localite_canon, localite, adm3_id, adm3_name, geom,
  location_mode, is_geocoded, date, nb_sondages_source, created_at, updated_at
)
SELECT
  id, code, localite_canon, localite, adm3_id, adm3_name, 
  CASE 
    WHEN geom IS NOT NULL THEN ST_Transform(geom, 4326)
    ELSE NULL
  END as geom,
  location_mode::atlas.location_mode, is_geocoded, date, nb_sondages, created_at, updated_at
FROM atlas.mv_sondages_unifies
ON CONFLICT (id) DO NOTHING;

TRUNCATE atlas.survey_aliases;

INSERT INTO atlas.survey_aliases (survey_id, alias_code, source)
SELECT u.id, unnest(u.alias_codes), 'legacy'
FROM atlas.mv_sondages_unifies u
ON CONFLICT (alias_code) DO NOTHING;
