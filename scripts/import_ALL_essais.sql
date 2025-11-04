-- ============================================================================
-- Import COMPLET de TOUTES les données Granulométrie, Bleu (VBS) et Atterberg
-- ============================================================================
-- Structure: sondages → echantillons → essais
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTIE 1: GRANULOMÉTRIE (4 sondages × 3 profondeurs = 12 échantillons)
-- ============================================================================

-- 1.1 GRANULO-PITIAH
INSERT INTO echantillons (sondage_id, depth_m) VALUES
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 1.0),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 1.5),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH'), 2.0)
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;

INSERT INTO granulo_points (echantillon_id, method, sieve_mm, passing_pct) VALUES
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH') AND depth_m = 1.0), 'tamisage', 1.0, 46.42),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH') AND depth_m = 1.5), 'tamisage', 1.0, 49.48),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH') AND depth_m = 2.0), 'tamisage', 1.0, 44.6)
ON CONFLICT (echantillon_id, method, sieve_mm) DO NOTHING;

-- 1.2 GRANULO-SANFATOULE
INSERT INTO echantillons (sondage_id, depth_m) VALUES
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 1.0),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 1.5),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE'), 2.0)
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;

INSERT INTO granulo_points (echantillon_id, method, sieve_mm, passing_pct) VALUES
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE') AND depth_m = 1.0), 'tamisage', 1.0, 52.81),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE') AND depth_m = 1.5), 'tamisage', 1.0, 57.5),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-SANFATOULE') AND depth_m = 2.0), 'tamisage', 1.0, 58.75)
ON CONFLICT (echantillon_id, method, sieve_mm) DO NOTHING;

-- 1.3 GRANULO-AKIÉ
INSERT INTO echantillons (sondage_id, depth_m) VALUES
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 1.0),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 1.5),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ'), 2.0)
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;

INSERT INTO granulo_points (echantillon_id, method, sieve_mm, passing_pct) VALUES
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ') AND depth_m = 1.0), 'tamisage', 1.0, 50.94),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ') AND depth_m = 1.5), 'tamisage', 1.0, 52.3),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-AKIÉ') AND depth_m = 2.0), 'tamisage', 1.0, 57.81)
ON CONFLICT (echantillon_id, method, sieve_mm) DO NOTHING;

-- 1.4 GRANULO-WOMÉ-ZONGO
INSERT INTO echantillons (sondage_id, depth_m) VALUES
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 1.0),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 1.5),
  ((SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO'), 2.0)
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;

INSERT INTO granulo_points (echantillon_id, method, sieve_mm, passing_pct) VALUES
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO') AND depth_m = 1.0), 'tamisage', 1.0, 64.2),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO') AND depth_m = 1.5), 'tamisage', 1.0, 65.09),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-WOMÉ-ZONGO') AND depth_m = 2.0), 'tamisage', 1.0, 65.55)
ON CONFLICT (echantillon_id, method, sieve_mm) DO NOTHING;

-- ============================================================================
-- PARTIE 2: BLEU DE MÉTHYLÈNE - VBS (1 sondage × 3 profondeurs = 3 échantillons)
-- ============================================================================

-- 2.1 BLEU-KOVIÉ
INSERT INTO echantillons (sondage_id, depth_m) VALUES
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 1.0),
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 1.5),
  ((SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ'), 2.0)
ON CONFLICT (sondage_id, depth_m, date) DO NOTHING;

INSERT INTO essais_vbs (echantillon_id, vbs) VALUES
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ') AND depth_m = 1.0), 5.99),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ') AND depth_m = 1.5), 7.66),
  ((SELECT id FROM echantillons WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'BLEU-KOVIÉ') AND depth_m = 2.0), 8.33)
ON CONFLICT (echantillon_id) DO NOTHING;

COMMIT;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

-- Compter les échantillons créés
SELECT 
    s.code,
    s.source,
    COUNT(DISTINCT e.id) as n_echantillons
FROM sondages s
LEFT JOIN echantillons e ON e.sondage_id = s.id
WHERE s.source IN ('Granulométrie', 'bleu')
GROUP BY s.code, s.source
ORDER BY s.source, s.code;

-- Compter les essais granulo
SELECT 
    s.code,
    COUNT(g.id) as n_points_granulo
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN granulo_points g ON g.echantillon_id = e.id
WHERE s.source = 'Granulométrie'
GROUP BY s.code
ORDER BY s.code;

-- Compter les essais VBS
SELECT 
    s.code,
    COUNT(v.id) as n_essais_vbs
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais_vbs v ON v.echantillon_id = e.id
WHERE s.source = 'bleu'
GROUP BY s.code;

-- Détails GRANULO-PITIAH
SELECT 
    s.code,
    e.depth_m,
    g.sieve_mm,
    g.passing_pct
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
JOIN granulo_points g ON g.echantillon_id = e.id
WHERE s.code = 'GRANULO-PITIAH'
ORDER BY e.depth_m;

-- Détails BLEU-KOVIÉ
SELECT 
    s.code,
    e.depth_m,
    v.vbs
FROM sondages s
JOIN echantillons e ON e.sondage_id = s.id
JOIN essais_vbs v ON v.echantillon_id = e.id
WHERE s.code = 'BLEU-KOVIÉ'
ORDER BY e.depth_m;

-- ============================================================================
-- RÉSULTAT ATTENDU:
-- ============================================================================
-- Granulométrie: 4 sondages × 3 échantillons × 1 point = 12 points
-- Bleu: 1 sondage × 3 échantillons = 3 essais VBS
-- TOTAL: 15 échantillons, 15 essais
-- ============================================================================
