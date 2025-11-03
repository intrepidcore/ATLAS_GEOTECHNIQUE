-- Vue basique SANS spread pour tester
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
DROP VIEW IF EXISTS mailles_geotechnique_stats CASCADE;

CREATE VIEW mailles_geotechnique_stats AS
SELECT 
  1 AS maille_id,
  AVG(e.water_content_w) AS w_avg,
  AVG(atter.wl - atter.wp) AS ip_avg,
  AVG(vbs.vbs) AS vbs_avg,
  COUNT(*) AS n,
  false AS has_spread
FROM echantillons e
LEFT JOIN essais_atterberg atter ON atter.echantillon_id = e.id
LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id;

CREATE MATERIALIZED VIEW mv_mailles_geotech AS 
SELECT * FROM mailles_geotechnique_stats;
