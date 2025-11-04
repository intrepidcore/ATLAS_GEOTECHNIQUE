-- ============================================================================
-- PROJET: ADANDOGOU Afiwa Pamela PAS TERMINE
-- ============================================================================
-- Source: ADANDOGOU Afiwa Pamela PAS TERMINE.xlsx
-- Date import: 2025-11-03
-- Batch: MD-20251103-01
-- Localités: Kévé, Assahoum, Badja
-- Données: Atterberg (WL, WP), VBS, Densités, Teneur eau, Classifications

-- ============================================================================
-- CONTRÔLES PRÉ-IMPORT
-- ============================================================================

-- Vérifier absence de spread
SELECT COUNT(*) as count_spread FROM sondages WHERE location_mode = 'spread';
-- Attendu: 0

-- ============================================================================
-- SONDAGES (3 localités)
-- ============================================================================

-- Note: Pas de GPS, pas d'ADM3 connu → location_mode = 'unknown'
-- Les sondages sont déjà créés, on vérifie leur existence

SELECT code, location_mode, grid_code 
FROM sondages 
WHERE code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA');

-- ============================================================================
-- ESSAIS GÉOTECHNIQUES (9 essais: 3 localités × 3 profondeurs)
-- ============================================================================

-- Déjà importés avec WL, WP, VBS
-- Vérification:
SELECT s.code, eg.depth_m, eg.wl, eg.wp, eg.ip, eg.vbs
FROM essais_geotechniques eg
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA')
ORDER BY s.code, eg.depth_m;

-- ============================================================================
-- ESSAIS PHYSIQUES (9 essais avec densités + teneur eau)
-- ============================================================================

-- Déjà importés
-- Vérification:
SELECT s.code, eg.depth_m, 
       ep.densite_apparente_gcm3, 
       ep.densite_absolue_gcm3, 
       ep.teneur_eau_pct
FROM essais_physiques ep
JOIN essais_geotechniques eg ON eg.id = ep.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA')
ORDER BY s.code, eg.depth_m;

-- ============================================================================
-- CLASSIFICATIONS (AASHTO + USCS)
-- ============================================================================

-- Déjà importées
-- Vérification:
SELECT s.code, eg.depth_m, ec.systeme, ec.classe
FROM essais_classif ec
JOIN essais_geotechniques eg ON eg.id = ec.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA')
ORDER BY s.code, eg.depth_m, ec.systeme;

-- ============================================================================
-- CONTRÔLES POST-IMPORT
-- ============================================================================

-- 1. Cohérence Atterberg (IP = WL - WP ± 1)
SELECT s.code, eg.depth_m, eg.wl, eg.wp, eg.ip,
       CASE 
         WHEN ABS(eg.ip - (eg.wl - eg.wp)) <= 1 THEN 'OK'
         ELSE 'ERREUR'
       END as coherence
FROM essais_geotechniques eg
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA')
  AND eg.wl IS NOT NULL AND eg.wp IS NOT NULL
ORDER BY s.code, eg.depth_m;

-- 2. Ranges valides
SELECT 
  COUNT(*) FILTER (WHERE wl < 0 OR wl > 200) as wl_hors_range,
  COUNT(*) FILTER (WHERE wp < 0 OR wp > 200) as wp_hors_range,
  COUNT(*) FILTER (WHERE vbs < 0 OR vbs > 20) as vbs_hors_range
FROM essais_geotechniques eg
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA');
-- Attendu: 0, 0, 0

-- 3. Densités réalistes
SELECT 
  COUNT(*) FILTER (WHERE densite_apparente_gcm3 < 0.5 OR densite_apparente_gcm3 > 3) as rho_bulk_anormal,
  COUNT(*) FILTER (WHERE densite_absolue_gcm3 < 2 OR densite_absolue_gcm3 > 4) as rho_s_anormal,
  COUNT(*) FILTER (WHERE teneur_eau_pct < 0 OR teneur_eau_pct > 100) as w_anormal
FROM essais_physiques ep
JOIN essais_geotechniques eg ON eg.id = ep.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.code IN ('ADANDOGOU-KEVE', 'ADANDOGOU-ASSAHOUM', 'ADANDOGOU-BADJA');
-- Attendu: 0, 0, 0

-- ============================================================================
-- RÉSUMÉ
-- ============================================================================
-- 3 sondages (Kévé, Assahoum, Badja)
-- 9 essais géotechniques (WL, WP, IP, VBS)
-- 9 essais physiques (densités, teneur eau)
-- 12 classifications (AASHTO + USCS)
-- Location mode: unknown (pas de GPS ni ADM3)
-- ============================================================================
