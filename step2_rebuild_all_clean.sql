-- ============================================================================
-- REBUILD COMPLET ET PROPRE
-- ============================================================================

-- 1) Recréer mv_adm3_maille_map
DROP MATERIALIZED VIEW IF EXISTS mv_adm3_maille_map CASCADE;
CREATE MATERIALIZED VIEW mv_adm3_maille_map AS
SELECT 
  a.adm3_pcode AS adm3_code,
  a.adm3_fr AS adm3_name,
  m.id AS maille_id,
  m.code AS maille_code,
  ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) AS overlap_ratio
FROM adm3 a
JOIN mailles m ON ST_Intersects(a.geom, m.geom)
WHERE ST_Area(ST_Intersection(a.geom, m.geom)) / ST_Area(m.geom) > 0.01;

CREATE INDEX idx_adm3_maille_map_adm3 ON mv_adm3_maille_map(adm3_code);
CREATE INDEX idx_adm3_maille_map_maille ON mv_adm3_maille_map(maille_id);

-- Vérifier
SELECT COUNT(*) AS total_map FROM mv_adm3_maille_map;
SELECT COUNT(*) AS davie_mailles FROM mv_adm3_maille_map WHERE adm3_code = 'TG030805';

-- 2) Recréer v_maille_sondages_all (ROBUSTE avec meta->>'adm3_code')
DROP VIEW IF EXISTS v_maille_sondages_all CASCADE;
CREATE VIEW v_maille_sondages_all AS
-- RÉEL (GPS)
SELECT
  m.id   AS maille_id,
  m.code AS maille_code,
  s.id   AS sondage_id,
  'real'::text AS source
FROM mailles m
JOIN sondages s
  ON s.geom IS NOT NULL
 AND ST_Within(s.geom, m.geom)

UNION ALL

-- SPREAD (ADM3 → mailles) - UTILISE meta->>'adm3_code'
SELECT
  m.id AS maille_id,
  m.code AS maille_code,
  s.id AS sondage_id,
  'spread'::text AS source
FROM sondages s
JOIN mv_adm3_maille_map map
  ON TRIM(UPPER(s.meta->>'adm3_code')) = TRIM(UPPER(map.adm3_code))
JOIN mailles m ON m.id = map.maille_id
WHERE s.geom IS NULL
  AND COALESCE(s.loc_mode, 'spread') = 'spread';

-- Vérifier
SELECT COUNT(*) AS total_associations FROM v_maille_sondages_all;
SELECT source, COUNT(*) FROM v_maille_sondages_all GROUP BY source;

-- 3) Recréer mv_mailles_geotech
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
CREATE MATERIALIZED VIEW mv_mailles_geotech AS
SELECT
  m.id,
  m.code,
  m.geom,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source = 'real')   AS nb_sondages_real,
  COUNT(DISTINCT v.sondage_id) FILTER (WHERE v.source = 'spread') AS nb_sondages_spread,
  (COUNT(v.sondage_id) > 0) AS has_data
FROM mailles m
LEFT JOIN v_maille_sondages_all v ON v.maille_id = m.id
GROUP BY m.id, m.code, m.geom, m.adm1_name, m.adm2_name, m.adm3_name;

CREATE UNIQUE INDEX ON mv_mailles_geotech (id);
CREATE INDEX ON mv_mailles_geotech (code);
CREATE INDEX ON mv_mailles_geotech USING GIST(geom);

-- 4) Vérifier résultat final
SELECT
 COUNT(*) AS mailles_total,
 COUNT(*) FILTER (WHERE has_data) AS mailles_avec_donnees,
 SUM(nb_sondages_real)  AS sondages_real,
 SUM(nb_sondages_spread) AS sondages_spread
FROM mv_mailles_geotech;

-- Voir exemples Davie
SELECT code, nb_sondages_real, nb_sondages_spread, has_data, adm3_name
FROM mv_mailles_geotech
WHERE has_data = true
LIMIT 10;
