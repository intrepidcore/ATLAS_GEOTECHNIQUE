-- ============================================================================
-- Import manuel des données Limite d'Atterberg (WL, WP, IP)
-- ============================================================================
-- Source: data/xlsx_convert/limite/limite.md
-- Format: Localité | Profondeur | WL | WP | IP | Classe
-- WL = Limite de Liquidité (Liquid Limit)
-- WP = Limite de Plasticité (Plastic Limit)
-- IP = Indice de Plasticité (Plasticity Index) = WL - WP
-- ============================================================================

-- 1. Vérifier les sondages existants qui pourraient correspondre
SELECT id, code, source FROM sondages 
WHERE code LIKE '%ADJENGRÉ%' 
   OR code LIKE '%AGOTIVÉ%'
   OR code LIKE '%ANIÉ%'
ORDER BY code;

-- ============================================================================
-- EXEMPLE: Import pour un sondage (à adapter selon les sondages existants)
-- ============================================================================

-- Si un sondage "LIMITE-ADJENGRÉ" ou similaire existe:
/*
INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WL', 50.34, '%', 1.0, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WP', 22.64, '%', 1.0, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_IP', 27.7, '%', 1.0, NOW()),
  
  -- Profondeur 1.5m
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WL', 65.68, '%', 1.5, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WP', 36.64, '%', 1.5, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_IP', 29.04, '%', 1.5, NOW()),
  
  -- Profondeur 2m
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WL', 58.42, '%', 2.0, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_WP', 24.61, '%', 2.0, NOW()),
  ((SELECT id FROM sondages WHERE code = 'LIMITE-ADJENGRÉ'), 'Atterberg_IP', 33.81, '%', 2.0, NOW());
*/

-- ============================================================================
-- DONNÉES COMPLÈTES DISPONIBLES (37 lignes dans le fichier source)
-- ============================================================================

-- Localités avec données Atterberg:
-- 1. Adjengré (Pounpouni) - 3 profondeurs
-- 2. Agotivé - 3 profondeurs
-- 3. Anié - 3 profondeurs
-- 4. Apéyéyémé - 3 profondeurs
-- 5. Badomé - 3 profondeurs
-- 6. Kadambara - 3 profondeurs
-- 7. Kamina Barrage - 3 profondeurs
-- 8. Kamina Dakré - 3 profondeurs
-- 9. Kaniamboua (Bogo) - 3 profondeurs
-- 10. Nyamassila - 3 profondeurs
-- 11. Ountivou - 3 profondeurs
-- 12. Stouboua (Sondé) - 3 profondeurs

-- Total: 12 localités × 3 profondeurs × 3 paramètres (WL, WP, IP) = 108 essais

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

-- Compter les essais Atterberg existants
SELECT 
    type_essai,
    COUNT(*) as n_essais
FROM essais
WHERE type_essai LIKE 'Atterberg%'
  AND deleted_at IS NULL
GROUP BY type_essai
ORDER BY type_essai;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - Types d'essais:
--   * 'Atterberg_WL': Limite de Liquidité (%)
--   * 'Atterberg_WP': Limite de Plasticité (%)
--   * 'Atterberg_IP': Indice de Plasticité (%)
-- 
-- - Classification selon WL:
--   * < 35: Faible
--   * 35-50: Moyen
--   * > 50: Elevé
--
-- - Ces données nécessitent la création préalable des sondages correspondants
--   ou l'identification des sondages existants qui correspondent à ces localités
-- ============================================================================
