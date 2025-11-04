-- ============================================================================
-- Import manuel des données de Granulométrie
-- ============================================================================
-- Source: data/xlsx_convert/Granulométrie/Granulométrie_translated.json
-- Format: Localité | Profondeur 1m | Profondeur 1.5m | Profondeur 2m
-- ============================================================================

-- 1. Vérifier les sondages GRANULO-* existants
SELECT id, code, source FROM sondages WHERE source = 'Granulométrie' ORDER BY code;

-- ============================================================================
-- 2. IMPORT GRANULO-PITIAH
-- ============================================================================
-- Données: Pitiah | 46.42 | 49.48 | 44.6

INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 'granulo_passant', 46.42, '%', 1.0, NOW()),
  -- Profondeur 1.5m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 'granulo_passant', 49.48, '%', 1.5, NOW()),
  -- Profondeur 2m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 'granulo_passant', 44.6, '%', 2.0, NOW());

-- ============================================================================
-- 3. IMPORT GRANULO-SANFATOULE
-- ============================================================================
-- Données: Sanfatoule | 52.81 | 57.5 | 58.75

INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 'granulo_passant', 52.81, '%', 1.0, NOW()),
  -- Profondeur 1.5m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 'granulo_passant', 57.5, '%', 1.5, NOW()),
  -- Profondeur 2m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 'granulo_passant', 58.75, '%', 2.0, NOW());

-- ============================================================================
-- 4. IMPORT GRANULO-AKIÉ
-- ============================================================================
-- Données: Akié | 50.94 | 52.3 | 57.81

INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 'granulo_passant', 50.94, '%', 1.0, NOW()),
  -- Profondeur 1.5m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 'granulo_passant', 52.3, '%', 1.5, NOW()),
  -- Profondeur 2m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 'granulo_passant', 57.81, '%', 2.0, NOW());

-- ============================================================================
-- 5. IMPORT GRANULO-WOMÉ-ZONGO
-- ============================================================================
-- Données: Womé (Zongo) | 64.2 | 65.09 | 65.55

INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 'granulo_passant', 64.2, '%', 1.0, NOW()),
  -- Profondeur 1.5m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 'granulo_passant', 65.09, '%', 1.5, NOW()),
  -- Profondeur 2m
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 'granulo_passant', 65.55, '%', 2.0, NOW());

-- ============================================================================
-- 6. VÉRIFICATION
-- ============================================================================

-- Compter les essais par sondage
SELECT 
    s.code,
    COUNT(e.id) as n_essais,
    STRING_AGG(DISTINCT e.type_essai, ', ') as types_essais
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.source = 'Granulométrie'
GROUP BY s.code
ORDER BY s.code;

-- Détails des essais GRANULO-PITIAH
SELECT 
    s.code,
    e.type_essai,
    e.depth_m,
    e.valeur_numerique,
    e.unit
FROM sondages s
JOIN essais e ON e.sondage_id = s.id
WHERE s.code = 'GRANULO-PITIAH'
ORDER BY e.depth_m;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - Type d'essai: 'granulo_passant' (% de matériau passant)
-- - Profondeurs: 1m, 1.5m, 2m
-- - Unité: '%' (pourcentage)
-- - Total: 4 sondages × 3 profondeurs = 12 essais
-- ============================================================================
