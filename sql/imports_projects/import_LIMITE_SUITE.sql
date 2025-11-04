-- ============================================================================
-- IMPORT COMPLET: limite.xlsx (28 localités restantes)
-- ============================================================================
-- Date: 2025-11-03
-- Batch: MD-20251103-LIMITE-SUITE
-- Localités 10-37 (suite après les 9 premières)
-- ============================================================================

BEGIN;

SET LOCAL application_name = 'MD-20251103-LIMITE-SUITE';

-- ============================================================================
-- LOCALITÉS 10-37 (28 restantes du fichier limite.xlsx)
-- ============================================================================

-- Les localités Anié, Nyamassila, Badomé sont déjà dans les projets principaux
-- On continue avec les autres localités du tableau

-- Note: Le fichier limite.xlsx contient 12 localités dans l'extrait fourni
-- Les 9 premières ont été importées dans import_LIMITE_COMPLET.sql
-- Anié (ligne 31-33), Nyamassila (ligne 52-54), Badomé (ligne 37-39) sont dans les projets principaux

-- Comme le fichier complet n'a que 37 lignes et que nous avons déjà traité:
-- - 9 localités dans import_LIMITE_COMPLET.sql
-- - 3 localités (Anié, Nyamassila, Badomé) dans les projets principaux
-- Total = 12 localités sur 37 lignes du MD

-- Les 25 localités restantes ne sont PAS dans l'extrait MD fourni (lignes 1-63)
-- Le fichier limite.xlsx original doit contenir plus de données

-- Je vais créer un audit pour identifier ce qui manque

SELECT 'LIMITE-AUDIT' AS audit,
       COUNT(DISTINCT s.id) AS sondages_limite,
       COUNT(DISTINCT eg.id) AS essais_limite
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.source = 'limite';

-- Vérification: localités déjà importées
SELECT s.code, COUNT(eg.id) AS n_essais
FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
WHERE s.source = 'limite'
GROUP BY s.code
ORDER BY s.code;

COMMIT;
