CREATE OR REPLACE VIEW v_sondages_spread AS
SELECT
  m.id         AS maille_id,
  s.id         AS sondage_id,
  e.id         AS echantillon_id,
  s.meta->>'code' AS code_site,
  e.depth_m,
  s.meta->>'adm3_code' AS adm3_code
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
JOIN adm3 a         ON (a.adm3_fr = s.meta->>'adm3_code' OR a.adm3_pcode = s.meta->>'adm3_code')
JOIN mailles m      ON ST_Intersects(m.geom, a.geom)
WHERE s.geom IS NULL;

CREATE OR REPLACE VIEW v_mailles_geotech AS
WITH real AS (
  SELECT m.id AS maille_id, e.id AS e_id,
         e.water_content_w,
         atter.wl, atter.wp, (atter.wl - atter.wp) AS ip,
         vbs.vbs
  FROM echantillons e
  JOIN sondages s ON s.id = e.sondage_id AND s.geom IS NOT NULL
  JOIN mailles m  ON ST_Intersects(m.geom, s.geom)
  LEFT JOIN essais_atterberg atter ON atter.echantillon_id = e.id
  LEFT JOIN essais_vbs       vbs   ON vbs.echantillon_id = e.id
),
spread AS (
  SELECT vs.maille_id, e.id AS e_id,
         e.water_content_w,
         atter.wl, atter.wp, (atter.wl - atter.wp) AS ip,
         vbs.vbs
  FROM v_sondages_spread vs
  JOIN echantillons e            ON e.id = vs.echantillon_id
  LEFT JOIN essais_atterberg atter ON atter.echantillon_id = e.id
  LEFT JOIN essais_vbs       vbs   ON vbs.echantillon_id = e.id
)
SELECT maille_id,
       AVG(NULLIF(water_content_w,0)) AS w_avg,
       AVG(NULLIF(ip,0))              AS ip_avg,
       AVG(NULLIF(vbs,0))             AS vbs_avg,
       COUNT(*)                        AS n,
       BOOL_OR(src='spread')           AS has_spread
FROM (
  SELECT maille_id, e_id, water_content_w, ip, vbs, 'real'   AS src FROM real
  UNION ALL
  SELECT maille_id, e_id, water_content_w, ip, vbs, 'spread' AS src FROM spread
) x
GROUP BY maille_id;

DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
DROP VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
CREATE VIEW mailles_geotechnique_stats AS SELECT * FROM v_mailles_geotech;

DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
CREATE MATERIALIZED VIEW mv_mailles_geotech AS SELECT * FROM v_mailles_geotech;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mailles_geotech_maille_id ON mv_mailles_geotech(maille_id);
