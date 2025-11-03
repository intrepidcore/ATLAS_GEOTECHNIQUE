-- ============================================================================
-- FIX UI - Creation vues completes (idempotent)
-- ============================================================================
-- Usage: psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql
-- ============================================================================

\echo '==================================================================='
\echo 'CREATION VUES POUR AFFICHAGE UI'
\echo '==================================================================='

-- ============================================================================
-- 1. Vue spread = duplique les sites SANS geom sur toutes les mailles de leur ADM3
-- ============================================================================

\echo ''
\echo '[1/4] Creation v_sondages_spread...'

CREATE OR REPLACE VIEW v_sondages_spread AS
SELECT
  m.id         AS maille_id,
  s.id         AS sondage_id,
  e.id         AS echantillon_id,
  s.code       AS code_site,
  e.depth_m,
  s.adm3_code
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
JOIN adm3 a         ON a.code = s.adm3_code
JOIN mailles m      ON ST_Intersects(m.geom, a.geom)
WHERE s.geom IS NULL;

\echo '   [OK] v_sondages_spread creee'

-- ============================================================================
-- 2. Vue d'agregation (reels + spread)
-- ============================================================================

\echo ''
\echo '[2/4] Creation v_mailles_geotech...'

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

\echo '   [OK] v_mailles_geotech creee'

-- ============================================================================
-- 3. Vue "compatibilite" si le frontend attend un nom historique
-- ============================================================================

\echo ''
\echo '[3/4] Creation mailles_geotechnique_stats (compatibilite)...'

DROP VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
CREATE VIEW mailles_geotechnique_stats AS
SELECT * FROM v_mailles_geotech;

\echo '   [OK] mailles_geotechnique_stats creee'

-- ============================================================================
-- 4. Materialiser pour la performance
-- ============================================================================

\echo ''
\echo '[4/4] Creation mv_mailles_geotech (materialisee)...'

DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech CASCADE;
CREATE MATERIALIZED VIEW mv_mailles_geotech AS
SELECT * FROM v_mailles_geotech;

-- Index unique pour REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mailles_geotech_maille_id
  ON mv_mailles_geotech(maille_id);

\echo '   [OK] mv_mailles_geotech creee'

-- ============================================================================
-- VERIFICATION
-- ============================================================================

\echo ''
\echo '==================================================================='
\echo 'VERIFICATION'
\echo '==================================================================='

\echo ''
\echo 'Compteurs:'
SELECT 'v_sondages_spread' AS vue, COUNT(*) AS nb_lignes FROM v_sondages_spread
UNION ALL
SELECT 'v_mailles_geotech', COUNT(*) FROM v_mailles_geotech
UNION ALL
SELECT 'mv_mailles_geotech', COUNT(*) FROM mv_mailles_geotech
UNION ALL
SELECT 'mailles_geotechnique_stats', COUNT(*) FROM mailles_geotechnique_stats;

\echo ''
\echo 'Exemple de donnees (3 premieres mailles):'
SELECT 
  maille_id,
  ROUND(w_avg::numeric, 2) AS w_avg,
  ROUND(ip_avg::numeric, 2) AS ip_avg,
  ROUND(vbs_avg::numeric, 2) AS vbs_avg,
  n AS nb_echantillons,
  has_spread
FROM mv_mailles_geotech
WHERE w_avg IS NOT NULL OR ip_avg IS NOT NULL OR vbs_avg IS NOT NULL
LIMIT 3;

\echo ''
\echo '==================================================================='
\echo 'VUES CREEES AVEC SUCCES'
\echo '==================================================================='
\echo ''
\echo 'Prochaine etape: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;'
\echo ''
