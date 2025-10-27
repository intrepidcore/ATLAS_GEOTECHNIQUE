-- ÉTAPE 4 : Vue d'agrégation finale

DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
DROP VIEW IF EXISTS mailles_geotechnique_stats CASCADE;

-- Vue agrégée (real + spread)
CREATE MATERIALIZED VIEW mv_mailles_geotech AS
WITH real AS (
  SELECT m.id AS maille_id,
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
         e.id AS e_id,
         e.water_content_w,
         att.wl, att.wp, (att.wl - att.wp) AS ip,
         vbs.vbs
  FROM v_sondages_spread vs
  JOIN echantillons e ON e.id = vs.echantillon_id
  LEFT JOIN essais_atterberg att ON att.echantillon_id = e.id
  LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
)
SELECT maille_id,
       COUNT(*) AS nb_ech,
       AVG(NULLIF(water_content_w,0)) AS w_avg,
       AVG(NULLIF(ip,0)) AS ip_avg,
       AVG(NULLIF(vbs,0)) AS vbs_avg,
       BOOL_OR(src='spread') AS has_spread
FROM (
  SELECT maille_id, e_id, water_content_w, ip, vbs, 'real' AS src FROM real
  UNION ALL
  SELECT maille_id, e_id, water_content_w, ip, vbs, 'spread' AS src FROM spread
) x
GROUP BY maille_id;

CREATE UNIQUE INDEX idx_mv_mailles_geotech_id ON mv_mailles_geotech(maille_id);

-- Vue compatible API (avec toutes les mailles)
CREATE VIEW mailles_geotechnique_stats AS
SELECT
  m.id AS maille_id,
  m.code AS maille_code,
  COALESCE(g.nb_ech, 0) AS nb_ech,
  g.w_avg,
  g.ip_avg,
  g.vbs_avg,
  COALESCE(g.has_spread, false) AS has_spread,
  (g.nb_ech > 0) AS has_data
FROM mailles m
LEFT JOIN mv_mailles_geotech g ON g.maille_id = m.id;

SELECT 'Vues finales créées' AS status;
SELECT COUNT(*) AS mailles_avec_data FROM mv_mailles_geotech;
