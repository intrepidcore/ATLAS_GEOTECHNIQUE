-- Recréer les vues avec has_geom et has_adm3
-- Date: 2025-11-06

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
  -- Flags calculés
  (array_agg(b.geom ORDER BY b.created_at)
     FILTER (WHERE b.geom IS NOT NULL))[1] IS NOT NULL AS has_geom,
  (array_agg(b.adm3_id ORDER BY b.created_at)
     FILTER (WHERE b.adm3_id IS NOT NULL))[1] IS NOT NULL AS has_adm3,
  BOOL_OR(b.is_geocoded)          AS is_geocoded,
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

-- Materialized view
CREATE MATERIALIZED VIEW atlas.mv_sondages_unifies AS
SELECT * FROM atlas.v_sondages_unifies;

CREATE UNIQUE INDEX mv_sondages_unifies_id_idx
  ON atlas.mv_sondages_unifies (id);
CREATE INDEX mv_sondages_unifies_localite_idx
  ON atlas.mv_sondages_unifies (localite_canon);

-- Refresh
REFRESH MATERIALIZED VIEW atlas.mv_sondages_unifies;

-- Vérifier
SELECT 
  COUNT(*) as total_localites,
  COUNT(*) FILTER (WHERE has_geom) as avec_geom,
  COUNT(*) FILTER (WHERE has_adm3) as avec_adm3,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes
FROM atlas.mv_sondages_unifies;
