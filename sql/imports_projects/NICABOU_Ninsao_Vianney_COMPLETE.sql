-- ============================================================================
-- PROJET: NICABOU Ninsao Vianney (COMPLÉMENT)
-- ============================================================================
-- Source: NICABOU Ninsao Vianney.xlsx
-- Date import: 2025-11-03
-- Batch: MD-20251103-03
-- Localités: Apéhémé, Dzogbécopé, Tekpo
-- Action: Ajouter physiques (densités, teneur eau) + classifications

-- ============================================================================
-- ESSAIS PHYSIQUES - Apéhémé
-- ============================================================================

-- Apéhémé 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%apeheme%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.606, 14.79, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.606,
      teneur_eau_pct = 14.79,
      updated_at = now();

-- Apéhémé 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%apeheme%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.562, 16.21, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.562,
      teneur_eau_pct = 16.21,
      updated_at = now();

-- Apéhémé 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%apeheme%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.484, 15.45, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.484,
      teneur_eau_pct = 15.45,
      updated_at = now();

-- ============================================================================
-- ESSAIS PHYSIQUES - Dzogbécopé
-- ============================================================================

-- Dzogbécopé 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%dzogbecope%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.572, 3.39, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.572,
      teneur_eau_pct = 3.39,
      updated_at = now();

-- Dzogbécopé 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%dzogbecope%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.552, 5.3, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.552,
      teneur_eau_pct = 5.3,
      updated_at = now();

-- Dzogbécopé 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%dzogbecope%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.507, 6.19, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.507,
      teneur_eau_pct = 6.19,
      updated_at = now();

-- ============================================================================
-- ESSAIS PHYSIQUES - Tekpo
-- ============================================================================

-- Tekpo 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%tekpo%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.63, 9.69, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.63,
      teneur_eau_pct = 9.69,
      updated_at = now();

-- Tekpo 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%tekpo%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.604, 8.57, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.604,
      teneur_eau_pct = 8.57,
      updated_at = now();

-- Tekpo 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'NICABOU Ninsao Vianney' 
    AND LOWER(s.code) LIKE '%tekpo%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.625, 9.41, 'NICABOU Ninsao Vianney', 'MD-20251103-03'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.625,
      teneur_eau_pct = 9.41,
      updated_at = now();

-- ============================================================================
-- CLASSIFICATIONS - Apéhémé
-- ============================================================================

-- Apéhémé 1m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-4', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Apéhémé 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Apéhémé 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%apeheme%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- ============================================================================
-- CLASSIFICATIONS - Dzogbécopé
-- ============================================================================

-- Dzogbécopé 1m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Dzogbécopé 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-7-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Dzogbécopé 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%dzogbecope%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- ============================================================================
-- CLASSIFICATIONS - Tekpo
-- ============================================================================

-- Tekpo 1m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Tekpo 1.5m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 1.5)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Tekpo 2m
WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (SELECT eg.id FROM essais_geotechniques eg JOIN sondages s ON s.id = eg.sondage_id WHERE s.source = 'NICABOU Ninsao Vianney' AND LOWER(s.code) LIKE '%tekpo%' AND eg.depth_m = 2.0)
INSERT INTO essais_classif (essai_id, systeme, classe, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol argileux peu plastique', 'NICABOU Ninsao Vianney', 'MD-20251103-03' FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- ============================================================================
-- CONTRÔLES
-- ============================================================================

SELECT s.code, eg.depth_m, ep.densite_absolue_gcm3, ep.teneur_eau_pct
FROM essais_physiques ep
JOIN essais_geotechniques eg ON eg.id = ep.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney'
ORDER BY s.code, eg.depth_m;

SELECT s.code, eg.depth_m, ec.systeme, ec.classe
FROM essais_classif ec
JOIN essais_geotechniques eg ON eg.id = ec.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney'
ORDER BY s.code, eg.depth_m, ec.systeme;

-- ============================================================================
-- RÉSUMÉ: 9 physiques + 18 classifications ajoutées
-- ============================================================================
