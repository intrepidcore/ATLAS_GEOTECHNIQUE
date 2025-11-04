-- ============================================================================
-- PROJET: GAMBAGA Inoussa (COMPLÉMENT)
-- ============================================================================
-- Source: GAMBAGA Inoussa.xlsx
-- Date import: 2025-11-03
-- Batch: MD-20251103-02
-- Localités: Sanfatoute, Korbongou
-- Action: Ajouter physiques (densités, teneur eau) + classifications

-- ============================================================================
-- ESSAIS PHYSIQUES - Sanfatoute
-- ============================================================================

-- Sanfatoute 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.47, 9.82, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.47,
      teneur_eau_pct = 9.82,
      updated_at = now();

-- Sanfatoute 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.39, 10.35, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.39,
      teneur_eau_pct = 10.35,
      updated_at = now();

-- Sanfatoute 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.63, 8.02, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.63,
      teneur_eau_pct = 8.02,
      updated_at = now();

-- ============================================================================
-- ESSAIS PHYSIQUES - Korbongou
-- ============================================================================

-- Korbongou 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.47, 8.17, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.47,
      teneur_eau_pct = 8.17,
      updated_at = now();

-- Korbongou 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.51, 7.52, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.51,
      teneur_eau_pct = 7.52,
      updated_at = now();

-- Korbongou 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_physiques (essai_id, densite_absolue_gcm3, teneur_eau_pct, source, created_by_batch)
SELECT e.id, 2.57, 6.21, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id) DO UPDATE
  SET densite_absolue_gcm3 = 2.57,
      teneur_eau_pct = 6.21,
      updated_at = now();

-- ============================================================================
-- CLASSIFICATIONS - Sanfatoute
-- ============================================================================

-- Sanfatoute 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-7-5', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol fin, argile peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Sanfatoute 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-7-6', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol fin, limoneux peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Sanfatoute 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-5', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%sanfatoute%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol fin, argileux limoneux peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- ============================================================================
-- CLASSIFICATIONS - Korbongou
-- ============================================================================

-- Korbongou 1m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol fin, argile peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Korbongou 1.5m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-6', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 1.5
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol fin, argile peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- Korbongou 2m
WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'AASHTO', 'A-4', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

WITH e AS (
  SELECT eg.id 
  FROM essais_geotechniques eg
  JOIN sondages s ON s.id = eg.sondage_id
  WHERE s.source = 'GAMBAGA Inoussa' 
    AND LOWER(s.code) LIKE '%korbongou%'
    AND eg.depth_m = 2.0
)
INSERT INTO essais_classif (essai_id, systeme, classe, reason, source, created_by_batch)
SELECT e.id, 'USCS', 'Sol grenue, sable argileux peu plasticité', NULL, 'GAMBAGA Inoussa', 'MD-20251103-02'
FROM e
ON CONFLICT (essai_id, systeme) DO NOTHING;

-- ============================================================================
-- CONTRÔLES
-- ============================================================================

-- Vérifier physiques ajoutés
SELECT s.code, eg.depth_m, ep.densite_absolue_gcm3, ep.teneur_eau_pct
FROM essais_physiques ep
JOIN essais_geotechniques eg ON eg.id = ep.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'GAMBAGA Inoussa'
ORDER BY s.code, eg.depth_m;

-- Vérifier classifications ajoutées
SELECT s.code, eg.depth_m, ec.systeme, ec.classe
FROM essais_classif ec
JOIN essais_geotechniques eg ON eg.id = ec.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'GAMBAGA Inoussa'
ORDER BY s.code, eg.depth_m, ec.systeme;

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================
-- 6 essais physiques ajoutés (2 localités × 3 profondeurs)
-- 12 classifications ajoutées (2 localités × 3 profondeurs × 2 systèmes)
-- ============================================================================
