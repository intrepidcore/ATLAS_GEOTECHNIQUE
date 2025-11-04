-- ============================================================================
-- Import manuel des données Bleu de Méthylène (VBS)
-- ============================================================================
-- Source: data/xlsx_convert/bleu/bleu.md
-- Format: Localité | VBS 1m | VBS 1.5m | VBS 2m | Classe 1m | Classe 1.5m | Classe 2m
-- ============================================================================

-- 1. Vérifier le sondage BLEU-KOVIÉ existant
SELECT id, code, source FROM sondages WHERE code LIKE '%KOVIÉ%' OR code LIKE '%KOVI%';

-- ============================================================================
-- 2. IMPORT BLEU-KOVIÉ
-- ============================================================================
-- Données ligne 79: Kovié | 5.99 | 7.66 | 8.33 | Moyen | Forte | Très forte

INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m, created_at)
VALUES
  -- Profondeur 1m - VBS 5.99 (Moyen)
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 'BleuMethylene_VBS', 5.99, 'g/100g', 1.0, NOW()),
  -- Profondeur 1.5m - VBS 7.66 (Forte)
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 'BleuMethylene_VBS', 7.66, 'g/100g', 1.5, NOW()),
  -- Profondeur 2m - VBS 8.33 (Très forte)
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 'BleuMethylene_VBS', 8.33, 'g/100g', 2.0, NOW());

-- ============================================================================
-- 3. VÉRIFICATION
-- ============================================================================

-- Compter les essais
SELECT 
    s.code,
    s.source,
    COUNT(e.id) as n_essais,
    STRING_AGG(DISTINCT e.type_essai, ', ') as types_essais
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.code LIKE '%KOVIÉ%'
GROUP BY s.code, s.source;

-- Détails des essais BLEU-KOVIÉ
SELECT 
    s.code,
    e.type_essai,
    e.depth_m,
    e.valeur_numerique,
    e.unit,
    CASE 
        WHEN e.valeur_numerique < 1.5 THEN 'Faible'
        WHEN e.valeur_numerique < 2.5 THEN 'Faible'
        WHEN e.valeur_numerique < 6 THEN 'Moyen'
        WHEN e.valeur_numerique < 8 THEN 'Forte'
        ELSE 'Très forte'
    END as classe
FROM sondages s
JOIN essais e ON e.sondage_id = s.id
WHERE s.code = 'BLEU-KOVIÉ'
ORDER BY e.depth_m;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - Type d'essai: 'BleuMethylene_VBS' (Valeur au Bleu de Méthylène)
-- - Profondeurs: 1m, 1.5m, 2m
-- - Unité: 'g/100g' (grammes pour 100 grammes)
-- - Classification:
--   * < 1.5: Faible
--   * 1.5-2.5: Faible
--   * 2.5-6: Moyen
--   * 6-8: Forte
--   * > 8: Très forte
-- ============================================================================
