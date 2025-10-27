-- ============================================================================
-- REQUÊTES POUR TROUVER DES MAILLES AVEC DONNÉES
-- ============================================================================

-- ============================================================================
-- 1. TOP 10 MAILLES AVEC LE PLUS D'ESSAIS
-- ============================================================================
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT e.id) AS n_essais,
  ROUND(AVG(CASE WHEN s.location_mode = 'spread' THEN 100 ELSE 0 END), 1) AS pct_spread
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;

-- ============================================================================
-- 2. MAILLES AVEC ESSAIS RÉELS (PAS DE SPREAD)
-- ============================================================================
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT e.id) AS n_essais,
  COUNT(DISTINCT e.id) FILTER (WHERE e.wl IS NOT NULL) AS n_atterberg,
  COUNT(DISTINCT e.id) FILTER (WHERE e.vbs IS NOT NULL) AS n_vbs,
  COUNT(DISTINCT e.id) FILTER (WHERE e.passant_80um IS NOT NULL) AS n_granulo
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom) AND s.location_mode = 'real'
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;

-- ============================================================================
-- 3. MAILLES AVEC ESSAIS COMPLETS (ATTERBERG + VBS + GRANULO)
-- ============================================================================
SELECT 
  m.code,
  COUNT(DISTINCT e.id) AS n_essais,
  COUNT(DISTINCT e.id) FILTER (WHERE e.wl IS NOT NULL AND e.vbs IS NOT NULL AND e.passant_80um IS NOT NULL) AS n_complets
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) FILTER (WHERE e.wl IS NOT NULL AND e.vbs IS NOT NULL AND e.passant_80um IS NOT NULL) > 0
ORDER BY n_complets DESC
LIMIT 10;

-- ============================================================================
-- 4. MAILLES SPREAD-ONLY (POUR TESTER L'ALERTE)
-- ============================================================================
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages_spread,
  COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom) AND s.location_mode = 'spread'
JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM sondages s2 
  WHERE ST_Contains(m.geom, s2.geom) AND s2.location_mode = 'real'
)
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;

-- ============================================================================
-- 5. RECHERCHE PAR NOM DE SITE (APEHEME, DZOGBECOPE, TEKPO)
-- ============================================================================
SELECT 
  m.code,
  s.meta->>'code' AS site_code,
  COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE s.meta->>'code' ILIKE '%APEHEME%'
   OR s.meta->>'code' ILIKE '%DZOGBECOPE%'
   OR s.meta->>'code' ILIKE '%TEKPO%'
GROUP BY m.code, s.meta->>'code'
ORDER BY n_essais DESC;

-- ============================================================================
-- 6. STATISTIQUES PAR MAILLE (POUR DEBUG)
-- ============================================================================
-- Utiliser avec WHERE m.code = 'TG-xxxx-xxxx-xx'
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'real') AS n_real,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'spread') AS n_spread,
  COUNT(DISTINCT e.id) AS n_essais,
  COUNT(DISTINCT e.id) FILTER (WHERE e.wl IS NOT NULL) AS n_atterberg,
  COUNT(DISTINCT e.id) FILTER (WHERE e.vbs IS NOT NULL) AS n_vbs,
  COUNT(DISTINCT e.id) FILTER (WHERE e.passant_80um IS NOT NULL) AS n_granulo,
  ARRAY_AGG(DISTINCT s.meta->>'code') AS sites
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom)
LEFT JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE m.code = 'TG-0496-0212-01'  -- Remplacer par le code souhaité
GROUP BY m.code;
