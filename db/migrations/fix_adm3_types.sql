-- ============================================================================
-- Migration : Correction des types de colonnes dans la table adm3
-- Date : 2025-11-07
-- Description : Conversion TEXT -> INTEGER pour gid
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1 : ANALYSE
-- ============================================================================

SELECT 'État actuel de la table adm3:' as info;
\d adm3

SELECT COUNT(*) as total_adm3 FROM adm3;

-- Vérifier les valeurs de gid
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE gid ~ '^\d+$') as gid_valid,
    COUNT(*) FILTER (WHERE gid IS NULL OR gid !~ '^\d+$') as gid_invalid
FROM adm3;

-- ============================================================================
-- ÉTAPE 2 : CRÉER COLONNE TEMPORAIRE
-- ============================================================================

ALTER TABLE adm3 ADD COLUMN gid_int INTEGER;

SELECT 'Colonne temporaire créée' as info;

-- ============================================================================
-- ÉTAPE 3 : CONVERTIR LES DONNÉES
-- ============================================================================

UPDATE adm3
SET gid_int = CASE 
    WHEN gid IS NOT NULL AND gid ~ '^\d+$' 
    THEN gid::integer 
    ELSE NULL 
END;

SELECT 'Données converties' as info;

-- Vérification
SELECT 
    COUNT(*) as total,
    COUNT(gid_int) as gid_int_ok,
    COUNT(*) FILTER (WHERE gid IS NOT NULL AND gid_int IS NULL) as conversion_failed
FROM adm3;

-- ============================================================================
-- ÉTAPE 4 : BASCULER VERS LA NOUVELLE COLONNE
-- ============================================================================

ALTER TABLE adm3 RENAME COLUMN gid TO gid_old;
ALTER TABLE adm3 RENAME COLUMN gid_int TO gid;

SELECT 'Colonnes renommées' as info;

-- ============================================================================
-- ÉTAPE 5 : AJOUTER CONTRAINTES ET INDEX
-- ============================================================================

-- Ajouter une clé primaire sur gid
ALTER TABLE adm3 ADD PRIMARY KEY (gid);

-- Créer des index pour les recherches
CREATE INDEX IF NOT EXISTS idx_adm3_adm3_fr ON adm3(adm3_fr);
CREATE INDEX IF NOT EXISTS idx_adm3_adm3_pcode ON adm3(adm3_pcode);
CREATE INDEX IF NOT EXISTS idx_adm3_adm2_fr ON adm3(adm2_fr);

SELECT 'Contraintes et index créés' as info;

-- ============================================================================
-- ÉTAPE 6 : SUPPRIMER L'ANCIENNE COLONNE
-- ============================================================================

ALTER TABLE adm3 DROP COLUMN gid_old;

SELECT 'Ancienne colonne supprimée' as info;

-- ============================================================================
-- ÉTAPE 7 : VÉRIFICATION FINALE
-- ============================================================================

SELECT 'Vérification finale:' as info;

\d adm3

SELECT COUNT(*) as total, COUNT(gid) as gid_non_null FROM adm3;

-- Exemples
SELECT gid, adm3_fr, adm3_pcode, adm2_fr FROM adm3 LIMIT 5;

COMMIT;

SELECT '✅ Migration adm3 terminée avec succès!' as info;
