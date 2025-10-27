-- ============================================================================
-- REQUÊTES DE VALIDATION - Atlas Géotechnique v2.0
-- ============================================================================
-- Ces requêtes permettent de vérifier la qualité des données

-- ============================================================================
-- 1. MONOTONICITÉ GRANULOMÉTRIQUE
-- ============================================================================
-- Les passants doivent être décroissants quand les tamis augmentent
-- Retourne les essais avec des courbes non monotones

WITH granulo_check AS (
  SELECT 
    gp.essai_id,
    gp.sieve_mm,
    gp.percent_passing,
    LAG(gp.percent_passing) OVER (PARTITION BY gp.essai_id ORDER BY gp.sieve_mm DESC) AS prev_passing
  FROM granulometrie_points gp
)
SELECT 
  e.id AS essai_id,
  s.meta->>'code' AS sondage_code,
  e.depth_m,
  COUNT(*) AS nb_violations
FROM granulo_check gc
JOIN essais_geotechniques e ON e.id = gc.essai_id
JOIN sondages s ON s.id = e.sondage_id
WHERE gc.prev_passing IS NOT NULL 
  AND gc.percent_passing > gc.prev_passing  -- Violation : passant augmente
GROUP BY e.id, s.meta->>'code', e.depth_m
ORDER BY nb_violations DESC;

-- ============================================================================
-- 2. BORNES ATTERBERG
-- ============================================================================
-- WL et WP doivent être entre 0 et 100%

SELECT 
  e.id AS essai_id,
  s.meta->>'code' AS sondage_code,
  e.depth_m,
  e.wl,
  e.wp,
  e.ip,
  CASE 
    WHEN e.wl < 0 OR e.wl > 100 THEN 'WL hors bornes'
    WHEN e.wp < 0 OR e.wp > 100 THEN 'WP hors bornes'
    WHEN e.ip < 0 THEN 'IP négatif'
    WHEN e.wp > e.wl THEN 'WP > WL'
    ELSE 'Autre'
  END AS probleme
FROM essais_geotechniques e
JOIN sondages s ON s.id = e.sondage_id
WHERE 
  (e.wl IS NOT NULL AND (e.wl < 0 OR e.wl > 100))
  OR (e.wp IS NOT NULL AND (e.wp < 0 OR e.wp > 100))
  OR (e.ip IS NOT NULL AND e.ip < 0)
  OR (e.wp IS NOT NULL AND e.wl IS NOT NULL AND e.wp > e.wl)
ORDER BY s.meta->>'code', e.depth_m;

-- ============================================================================
-- 3. COHÉRENCE SPREAD VS REAL
-- ============================================================================
-- Mailles avec données mais aucun sondage réel (100% diffusé)

SELECT 
  m.code,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'real') AS nb_sondages_real,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'spread') AS nb_sondages_spread,
  COUNT(DISTINCT e.id) AS nb_essais
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom)
LEFT JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE EXISTS (
  SELECT 1 FROM essais_geotechniques e2
  JOIN sondages s2 ON s2.id = e2.sondage_id
  WHERE ST_Contains(m.geom, s2.geom)
)
GROUP BY m.code
HAVING COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'real') = 0
ORDER BY nb_essais DESC
LIMIT 20;

-- ============================================================================
-- 4. ESSAIS SANS DONNÉES
-- ============================================================================
-- Essais qui n'ont aucun champ rempli

SELECT 
  e.id AS essai_id,
  s.meta->>'code' AS sondage_code,
  e.depth_m,
  CASE 
    WHEN e.wl IS NULL AND e.wp IS NULL AND e.ip IS NULL THEN 'Pas Atterberg'
    ELSE 'Atterberg OK'
  END AS atterberg_status,
  CASE 
    WHEN e.vbs IS NULL THEN 'Pas VBS'
    ELSE 'VBS OK'
  END AS vbs_status,
  CASE 
    WHEN e.passant_80um IS NULL AND e.passant_2mm IS NULL THEN 'Pas Granulo'
    ELSE 'Granulo OK'
  END AS granulo_status
FROM essais_geotechniques e
JOIN sondages s ON s.id = e.sondage_id
WHERE 
  e.wl IS NULL 
  AND e.wp IS NULL 
  AND e.ip IS NULL
  AND e.vbs IS NULL
  AND e.passant_80um IS NULL
  AND e.passant_2mm IS NULL
  AND e.gamma_d_max IS NULL
  AND e.eg IS NULL
ORDER BY s.meta->>'code', e.depth_m
LIMIT 50;

-- ============================================================================
-- 5. POINTS GRANULO INSUFFISANTS
-- ============================================================================
-- Essais avec moins de 3 points granulo (insuffisant pour interpolation)

SELECT 
  e.id AS essai_id,
  s.meta->>'code' AS sondage_code,
  e.depth_m,
  COUNT(gp.id) AS nb_points
FROM essais_geotechniques e
JOIN sondages s ON s.id = e.sondage_id
LEFT JOIN granulometrie_points gp ON gp.essai_id = e.id
WHERE e.passant_80um IS NOT NULL OR e.passant_2mm IS NOT NULL
GROUP BY e.id, s.meta->>'code', e.depth_m
HAVING COUNT(gp.id) < 3
ORDER BY s.meta->>'code', e.depth_m;

-- ============================================================================
-- 6. STATISTIQUES GLOBALES
-- ============================================================================

SELECT 
  'Essais totaux' AS metric,
  COUNT(*) AS value
FROM essais_geotechniques
UNION ALL
SELECT 
  'Essais avec Atterberg',
  COUNT(*) 
FROM essais_geotechniques 
WHERE wl IS NOT NULL OR wp IS NOT NULL
UNION ALL
SELECT 
  'Essais avec VBS',
  COUNT(*) 
FROM essais_geotechniques 
WHERE vbs IS NOT NULL
UNION ALL
SELECT 
  'Essais avec Granulo',
  COUNT(*) 
FROM essais_geotechniques 
WHERE passant_80um IS NOT NULL OR passant_2mm IS NOT NULL
UNION ALL
SELECT 
  'Essais avec Proctor',
  COUNT(*) 
FROM essais_geotechniques 
WHERE gamma_d_max IS NOT NULL
UNION ALL
SELECT 
  'Essais avec Gonflement',
  COUNT(*) 
FROM essais_geotechniques 
WHERE eg IS NOT NULL
UNION ALL
SELECT 
  'Points granulo totaux',
  COUNT(*) 
FROM granulometrie_points
UNION ALL
SELECT 
  'Sondages totaux',
  COUNT(*) 
FROM sondages
UNION ALL
SELECT 
  'Sondages réels (GPS)',
  COUNT(*) 
FROM sondages 
WHERE location_mode = 'real'
UNION ALL
SELECT 
  'Sondages diffusés (Spread)',
  COUNT(*) 
FROM sondages 
WHERE location_mode = 'spread';
