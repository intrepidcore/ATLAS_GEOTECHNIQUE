-- ============================================================================
-- VUES POUR PANNEAU GAUCHE - RÉEL ∪ SPREAD
-- ============================================================================

-- 1) Vue union : tous les sondages d'une maille (réel + spread)
CREATE OR REPLACE VIEW v_maille_sondages_all AS
-- Sondages réels (avec GPS)
SELECT 
  m.id AS maille_id,
  m.code AS maille_code,
  s.id AS sondage_id,
  'real' AS source
FROM mailles m
JOIN sondages s ON s.geom IS NOT NULL 
  AND ST_Within(s.geom, m.geom)
UNION ALL
-- Sondages spread (sans GPS, via ADM3)
SELECT 
  m.id AS maille_id,
  m.code AS maille_code,
  s.id AS sondage_id,
  'spread' AS source
FROM mailles m
JOIN mv_adm3_maille_map map ON map.maille_id = m.id
JOIN sondages s ON s.geom IS NULL 
  AND (s.meta->>'adm3_code') = map.adm3_code
  AND s.loc_mode = 'spread';

-- 2) Vue Atterberg (WL/WP) par profondeur
CREATE OR REPLACE VIEW v_chart_atterberg AS
SELECT 
  v.maille_code,
  v.source,
  e.depth_m,
  a.wl,
  a.wp
FROM v_maille_sondages_all v
JOIN echantillons e ON e.sondage_id = v.sondage_id
JOIN essais_atterberg a ON a.echantillon_id = e.id
WHERE a.wl IS NOT NULL OR a.wp IS NOT NULL;

-- 3) Vue VBS par profondeur
CREATE OR REPLACE VIEW v_chart_vbs AS
SELECT 
  v.maille_code,
  v.source,
  e.depth_m,
  vbs.vbs
FROM v_maille_sondages_all v
JOIN echantillons e ON e.sondage_id = v.sondage_id
JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
WHERE vbs.vbs IS NOT NULL;

-- 4) Vue Granulométrie (points) par profondeur
CREATE OR REPLACE VIEW v_chart_granulo AS
SELECT 
  v.maille_code,
  v.source,
  e.depth_m,
  gp.sieve_mm,
  gp.pass_percent
FROM v_maille_sondages_all v
JOIN echantillons e ON e.sondage_id = v.sondage_id
JOIN granulometrie_points gp ON gp.echantillon_id = e.id
WHERE gp.pass_percent IS NOT NULL;

-- 5) Vue Histogramme profondeurs
CREATE OR REPLACE VIEW v_chart_depth_hist AS
SELECT 
  v.maille_code,
  v.source,
  width_bucket(e.depth_m, 0, 30, 6) AS bin,
  COUNT(*) AS n
FROM v_maille_sondages_all v
JOIN echantillons e ON e.sondage_id = v.sondage_id
WHERE e.depth_m IS NOT NULL
GROUP BY v.maille_code, v.source, width_bucket(e.depth_m, 0, 30, 6);

-- 6) Vue détails sondages pour liste accordéon
CREATE OR REPLACE VIEW v_maille_sondages_details AS
SELECT 
  v.maille_code,
  v.source,
  s.id AS sondage_id,
  s.meta->>'code' AS code_site,
  s.meta->>'localite' AS localite,
  s.meta->>'adm3_code' AS adm3_code,
  s.meta->>'date' AS date_sondage,
  s.meta->>'source' AS source_data,
  s.loc_mode,
  s.created_at,
  COUNT(DISTINCT e.id) AS n_echantillons,
  COUNT(DISTINCT CASE WHEN ea.id IS NOT NULL THEN ea.id END) AS n_atterberg,
  COUNT(DISTINCT CASE WHEN ev.id IS NOT NULL THEN ev.id END) AS n_vbs,
  COUNT(DISTINCT CASE WHEN gp.id IS NOT NULL THEN gp.id END) AS n_granulo
FROM v_maille_sondages_all v
JOIN sondages s ON s.id = v.sondage_id
LEFT JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
LEFT JOIN essais_vbs ev ON ev.echantillon_id = e.id
LEFT JOIN granulometrie_points gp ON gp.echantillon_id = e.id
GROUP BY v.maille_code, v.source, s.id, s.meta, s.loc_mode, s.created_at;

-- Vérifier
SELECT 'Vues créées avec succès' AS status;
SELECT COUNT(*) AS total_associations FROM v_maille_sondages_all;
