-- ÉTAPE 5 : Vue API compatible (réel + spread)

-- D'abord, recréer mv_mailles_geotech avec les bonnes colonnes
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;

CREATE MATERIALIZED VIEW mv_mailles_geotech AS
WITH real AS (
  SELECT m.id AS maille_id,
         s.id AS sondage_id,
         e.id AS e_id,
         e.water_content_w,
         att.wl, att.wp, (att.wl - att.wp) AS ip,
         vbs.vbs
  FROM echantillons e
  JOIN sondages s ON s.id = e.sondage_id AND s.geom IS NOT NULL
  JOIN mailles m ON ST_Intersects(
    ST_Transform(m.geom, ST_SRID(s.geom)),
    s.geom
  )
  LEFT JOIN essais_atterberg att ON att.echantillon_id = e.id
  LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
),
spread AS (
  SELECT vs.maille_id,
         vs.sondage_id,
         e.id AS e_id,
         e.water_content_w,
         att.wl, att.wp, (att.wl - att.wp) AS ip,
         vbs.vbs
  FROM v_sondages_spread vs
  JOIN echantillons e ON e.id = vs.echantillon_id
  LEFT JOIN essais_atterberg att ON att.echantillon_id = e.id
  LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
),
combined AS (
  SELECT maille_id, sondage_id, e_id, water_content_w, ip, vbs, 'real' AS src FROM real
  UNION ALL
  SELECT maille_id, sondage_id, e_id, water_content_w, ip, vbs, 'spread' AS src FROM spread
)
SELECT 
  maille_id,
  COUNT(DISTINCT e_id) AS nb_ech_total,
  COUNT(DISTINCT e_id) FILTER (WHERE src='real') AS nb_ech_real,
  COUNT(DISTINCT e_id) FILTER (WHERE src='spread') AS nb_ech_spread,
  COUNT(DISTINCT sondage_id) AS nb_sondages_total,
  COUNT(DISTINCT sondage_id) FILTER (WHERE src='real') AS nb_sondages_real,
  COUNT(DISTINCT sondage_id) FILTER (WHERE src='spread') AS nb_sondages_spread,
  AVG(NULLIF(water_content_w,0)) AS w_avg,
  AVG(NULLIF(ip,0)) AS ip_avg,
  AVG(NULLIF(vbs,0)) AS vbs_avg,
  BOOL_OR(src='spread') AS has_spread
FROM combined
GROUP BY maille_id;

CREATE UNIQUE INDEX idx_mv_mailles_geotech_id ON mv_mailles_geotech(maille_id);

-- Vue compat dans PUBLIC
DROP VIEW IF EXISTS public.mailles_geotechnique_stats CASCADE;

CREATE OR REPLACE VIEW public.mailles_geotechnique_stats AS
SELECT
  m.id AS maille_id,
  m.code AS maille_code,
  COALESCE(g.nb_sondages_real, 0) + COALESCE(g.nb_sondages_spread, 0) AS nb_sondages,
  COALESCE(g.nb_ech_real, 0) + COALESCE(g.nb_ech_spread, 0) AS nb_echantillons,
  (COALESCE(g.nb_ech_real, 0) + COALESCE(g.nb_ech_spread, 0)) > 0 AS has_data,
  COALESCE(g.nb_ech_spread, 0) > 0 AS has_spread,
  COALESCE(g.w_avg, NULL) AS w_avg,
  COALESCE(g.ip_avg, NULL) AS ip_avg,
  COALESCE(g.vbs_avg, NULL) AS vbs_avg,
  m.geom
FROM public.mailles m
LEFT JOIN public.mv_mailles_geotech g ON g.maille_id = m.id;

-- Synonyme dans schéma API si besoin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='api') THEN
    EXECUTE 'CREATE SCHEMA api';
  END IF;
END$$;

CREATE OR REPLACE VIEW api.mailles_geotechnique_stats AS
SELECT * FROM public.mailles_geotechnique_stats;

-- Droits
GRANT USAGE ON SCHEMA public, api TO atlas;
GRANT SELECT ON public.mailles_geotechnique_stats TO atlas;
GRANT SELECT ON api.mailles_geotechnique_stats TO atlas;
GRANT SELECT ON public.mv_mailles_geotech TO atlas;

-- Test
SELECT 'Vue API créée' AS status;
SELECT
  COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
  COUNT(*) FILTER (WHERE NOT has_data) AS mailles_sans_donnees,
  COUNT(*) FILTER (WHERE has_spread) AS mailles_spread
FROM public.mailles_geotechnique_stats;
