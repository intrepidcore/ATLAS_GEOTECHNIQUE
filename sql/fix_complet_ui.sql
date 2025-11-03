-- ============================================================================
-- FIX COMPLET UI - Géocoder tous les sondages avec ADM3 + Refresh vues
-- ============================================================================

-- 1) Appliquer toutes les suggestions accepted
WITH accepted AS (
  SELECT entity_id AS id, top_code
  FROM geocode_suggestions
  WHERE entity = 'sondages' 
    AND status = 'accepted'
    AND top_code IS NOT NULL
)
UPDATE sondages s
SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(a.top_code))
FROM accepted a
WHERE s.id = a.id
  AND (s.meta->>'adm3_code') IS NULL;

-- 2) Géocoder avec centroid tous les sondages qui ont un ADM3
UPDATE sondages s
SET geom = ST_Transform(ST_Centroid(a.geom), 25231)
FROM adm3 a
WHERE s.geom IS NULL 
  AND (s.meta->>'adm3_code') IS NOT NULL
  AND a.adm3_pcode = (s.meta->>'adm3_code');

-- 3) Vérifier résultat
SELECT 
  COUNT(*) AS total_sondages,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) AS avec_geom,
  COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3
FROM sondages;

-- 4) Refresh TOUTES les vues matérialisées dans l'ordre
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_adm3_maille_map;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;

-- 5) Vérifier le résultat final
SELECT 
  COUNT(*) AS total_mailles,
  SUM(CASE WHEN stats->>'n_sondages' IS NOT NULL THEN (stats->>'n_sondages')::int ELSE 0 END) AS total_sondages_dans_mailles,
  COUNT(*) FILTER (WHERE stats->>'n_sondages' IS NOT NULL AND (stats->>'n_sondages')::int > 0) AS mailles_avec_donnees
FROM mv_mailles_geotech;

-- 6) Détail des mailles avec données
SELECT 
  code,
  stats->>'n_sondages' AS n_sondages,
  stats->>'n_essais' AS n_essais
FROM mv_mailles_geotech
WHERE stats->>'n_sondages' IS NOT NULL 
  AND (stats->>'n_sondages')::int > 0
ORDER BY (stats->>'n_sondages')::int DESC
LIMIT 10;
