-- Corriger la logique is_geocoded et ajouter flags explicites
-- is_geocoded = "a une localisation" (geom OU adm3)
-- has_geom = "a une géométrie précise"
-- has_adm3 = "a un rattachement ADM3"

-- 1. Recréer la vue avec les nouveaux flags
DROP MATERIALIZED VIEW IF EXISTS atlas.mv_sondages_unifies CASCADE;
DROP VIEW IF EXISTS atlas.v_sondages_unifies CASCADE;

CREATE OR REPLACE VIEW atlas.v_sondages_unifies AS
WITH base AS (
  SELECT s.*,
         atlas.normalize_localite(COALESCE(s.localite, s.adm3_name)) AS localite_canon
  FROM sondages s
  WHERE COALESCE(s.localite, s.adm3_name) IS NOT NULL
),
grp AS (
  SELECT
    localite_canon,
    (array_agg(id   ORDER BY created_at))[1] AS survey_id_canon,
    (array_agg(code ORDER BY created_at))[1] AS code_canon
  FROM base
  GROUP BY localite_canon
)
SELECT
  g.survey_id_canon AS id,
  g.code_canon      AS code,
  b.localite_canon,
  (array_agg(b.adm3_id  ORDER BY b.created_at)
     FILTER (WHERE b.adm3_id IS NOT NULL))[1] AS adm3_id,
  MAX(b.adm3_name)  AS adm3_name,
  MAX(b.localite)   AS localite,
  (array_agg(b.geom ORDER BY b.created_at)
     FILTER (WHERE b.geom    IS NOT NULL))[1] AS geom,
  
  -- Nouveaux flags explicites
  ((array_agg(b.geom ORDER BY b.created_at)
     FILTER (WHERE b.geom IS NOT NULL))[1] IS NOT NULL) AS has_geom,
  ((array_agg(b.adm3_id ORDER BY b.created_at)
     FILTER (WHERE b.adm3_id IS NOT NULL))[1] IS NOT NULL) AS has_adm3,
  
  -- is_geocoded recalculé = a une localisation (geom OU adm3)
  (
    ((array_agg(b.geom ORDER BY b.created_at)
       FILTER (WHERE b.geom IS NOT NULL))[1] IS NOT NULL)
    OR
    ((array_agg(b.adm3_id ORDER BY b.created_at)
       FILTER (WHERE b.adm3_id IS NOT NULL))[1] IS NOT NULL)
  ) AS is_geocoded,
  
  MAX(b.location_mode::text)      AS location_mode,
  MAX(b.date)                     AS date,
  MIN(b.created_at)               AS created_at,
  MAX(b.updated_at)               AS updated_at,
  COUNT(*)                        AS nb_sondages,
  ARRAY_AGG(DISTINCT b.id)        AS source_survey_ids,
  ARRAY_AGG(DISTINCT b.code)      AS alias_codes
FROM base b
JOIN grp  g ON g.localite_canon = b.localite_canon
GROUP BY g.survey_id_canon, g.code_canon, b.localite_canon;

-- 2. Recréer la materialized view
CREATE MATERIALIZED VIEW atlas.mv_sondages_unifies AS
SELECT * FROM atlas.v_sondages_unifies;

CREATE UNIQUE INDEX mv_sondages_unifies_id_idx
  ON atlas.mv_sondages_unifies (id);
CREATE INDEX mv_sondages_unifies_localite_idx
  ON atlas.mv_sondages_unifies (localite_canon);

-- 3. Mettre à jour la table atlas.surveys
ALTER TABLE atlas.surveys 
  DROP COLUMN IF EXISTS has_geom,
  DROP COLUMN IF EXISTS has_adm3;

ALTER TABLE atlas.surveys 
  ADD COLUMN has_geom BOOLEAN GENERATED ALWAYS AS (geom IS NOT NULL) STORED,
  ADD COLUMN has_adm3 BOOLEAN GENERATED ALWAYS AS (adm3_id IS NOT NULL) STORED;

-- 4. Mettre à jour is_geocoded dans atlas.surveys
-- (sera recalculé lors du prochain refresh, mais on peut forcer maintenant)
UPDATE atlas.surveys
SET is_geocoded = (geom IS NOT NULL OR adm3_id IS NOT NULL);

-- 5. Rafraîchir les données
SELECT atlas.refresh_surveys();

-- 6. Vérifier les résultats
SELECT 
  COUNT(*) FILTER (WHERE has_geom) as with_geom,
  COUNT(*) FILTER (WHERE has_adm3) as with_adm3,
  COUNT(*) FILTER (WHERE is_geocoded) as geocoded,
  COUNT(*) FILTER (WHERE NOT has_geom AND NOT has_adm3) as no_location,
  COUNT(*) as total
FROM atlas.surveys;
