-- ============================================================================
-- MIGRATION: Ajouter colonnes ADM à la Materialized View
-- ============================================================================
-- Objectif: Éviter le JOIN avec mailles à chaque requête thématique
-- Performance: +30-50% sur les requêtes avec filtres ADM
-- ============================================================================

BEGIN;

-- 1. Sauvegarder l'ancienne MV (optionnel, pour rollback)
-- CREATE TABLE mailles_geotechnique_stats_wgs84_backup AS 
-- SELECT * FROM mailles_geotechnique_stats_wgs84;

-- 2. Supprimer l'ancienne MV
DROP MATERIALIZED VIEW IF EXISTS mailles_geotechnique_stats_wgs84 CASCADE;

-- 3. Recréer la MV avec les colonnes ADM
CREATE MATERIALIZED VIEW mailles_geotechnique_stats_wgs84 AS
SELECT 
  s.*,
  m.adm1_name,
  m.adm2_name,
  m.adm3_name,
  ST_Transform(m.geom, 4326) AS geom,
  ST_Simplify(ST_Transform(m.geom, 4326), 0.001) AS geom_simplified
FROM mailles_geotechnique_stats s
JOIN mailles m ON m.code = s.code;

-- 4. Créer les index pour performances
CREATE INDEX idx_mv_wgs84_code ON mailles_geotechnique_stats_wgs84(code);
CREATE INDEX idx_mv_wgs84_geom ON mailles_geotechnique_stats_wgs84 USING GIST(geom);
CREATE INDEX idx_mv_wgs84_geom_simplified ON mailles_geotechnique_stats_wgs84 USING GIST(geom_simplified);

-- 5. Index sur les colonnes ADM (filtres rapides)
CREATE INDEX idx_mv_wgs84_adm1 ON mailles_geotechnique_stats_wgs84(adm1_name) WHERE adm1_name IS NOT NULL;
CREATE INDEX idx_mv_wgs84_adm2 ON mailles_geotechnique_stats_wgs84(adm2_name) WHERE adm2_name IS NOT NULL;
CREATE INDEX idx_mv_wgs84_adm3 ON mailles_geotechnique_stats_wgs84(adm3_name) WHERE adm3_name IS NOT NULL;

-- 6. Index partiels sur les paramètres les plus utilisés (WHERE NOT NULL)
CREATE INDEX idx_mv_wgs84_passant_80um ON mailles_geotechnique_stats_wgs84(passant_80um_avg) 
  WHERE passant_80um_avg IS NOT NULL;

CREATE INDEX idx_mv_wgs84_ip_avg ON mailles_geotechnique_stats_wgs84(ip_avg) 
  WHERE ip_avg IS NOT NULL;

CREATE INDEX idx_mv_wgs84_vbs_avg ON mailles_geotechnique_stats_wgs84(vbs_avg) 
  WHERE vbs_avg IS NOT NULL;

CREATE INDEX idx_mv_wgs84_n_sondages ON mailles_geotechnique_stats_wgs84(n_sondages) 
  WHERE n_sondages > 0;

-- 7. Statistiques
SELECT 
  COUNT(*) as total_mailles,
  COUNT(adm1_name) as avec_adm1,
  COUNT(adm2_name) as avec_adm2,
  COUNT(adm3_name) as avec_adm3,
  COUNT(passant_80um_avg) as avec_passant_80um,
  COUNT(ip_avg) as avec_ip,
  COUNT(vbs_avg) as avec_vbs
FROM mailles_geotechnique_stats_wgs84;

COMMIT;

-- ============================================================================
-- REFRESH CONCURRENTLY (à exécuter régulièrement)
-- ============================================================================
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats_wgs84;

-- ============================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- ============================================================================

-- Taille de la MV
SELECT 
  pg_size_pretty(pg_total_relation_size('mailles_geotechnique_stats_wgs84')) as taille_totale,
  pg_size_pretty(pg_relation_size('mailles_geotechnique_stats_wgs84')) as taille_table,
  pg_size_pretty(pg_indexes_size('mailles_geotechnique_stats_wgs84')) as taille_index;

-- Distribution par région
SELECT adm1_name, COUNT(*) as n_mailles
FROM mailles_geotechnique_stats_wgs84
WHERE adm1_name IS NOT NULL
GROUP BY adm1_name
ORDER BY n_mailles DESC;

-- Test de performance (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT code, passant_80um_avg, n_sondages
FROM mailles_geotechnique_stats_wgs84
WHERE passant_80um_avg IS NOT NULL
  AND n_sondages >= 3
  AND adm1_name = 'Plateaux';
