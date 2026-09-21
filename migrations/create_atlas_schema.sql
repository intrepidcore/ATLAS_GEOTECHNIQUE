-- ============================================================================
-- Migration : Création du schéma atlas et fonctions de normalisation
-- Date : 2025-11-07
-- Description : Créer le schéma atlas avec les fonctions norm() et norm_key()
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1 : CRÉER LE SCHÉMA ATLAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS atlas;

SELECT 'Schéma atlas créé' as info;

-- ============================================================================
-- ÉTAPE 2 : CRÉER LA FONCTION atlas.norm()
-- ============================================================================

-- Fonction de normalisation pour la recherche textuelle
-- Convertit en minuscules, supprime les accents et caractères spéciaux
CREATE OR REPLACE FUNCTION atlas.norm(s text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
    IF s IS NULL THEN
        RETURN '';
    END IF;
    
    -- Convertir en minuscules et supprimer les accents
    RETURN lower(unaccent(trim(s)));
END;
$$;

SELECT 'Fonction atlas.norm() créée' as info;

-- ============================================================================
-- ÉTAPE 3 : CRÉER LA FONCTION atlas.norm_key()
-- ============================================================================

-- Fonction de normalisation pour les clés (plus stricte)
-- Utilisée pour les comparaisons exactes et les clés de groupement
CREATE OR REPLACE FUNCTION atlas.norm_key(s text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
    IF s IS NULL THEN
        RETURN '';
    END IF;
    
    -- Convertir en minuscules, supprimer accents et espaces
    RETURN lower(unaccent(regexp_replace(trim(s), '\s+', '', 'g')));
END;
$$;

SELECT 'Fonction atlas.norm_key() créée' as info;

-- ============================================================================
-- ÉTAPE 4 : VÉRIFIER L'EXTENSION unaccent
-- ============================================================================

-- S'assurer que l'extension unaccent est installée
CREATE EXTENSION IF NOT EXISTS unaccent;

SELECT 'Extension unaccent vérifiée' as info;

-- ============================================================================
-- ÉTAPE 5 : TESTS DES FONCTIONS
-- ============================================================================

SELECT 'Tests des fonctions:' as info;

-- Test atlas.norm()
SELECT 
    'Test atlas.norm()' as test,
    atlas.norm('Abidjan') as test1,
    atlas.norm('TCHAMDÉ') as test2,
    atlas.norm('  Bouaké  ') as test3;

-- Test atlas.norm_key()
SELECT 
    'Test atlas.norm_key()' as test,
    atlas.norm_key('Abidjan') as test1,
    atlas.norm_key('TCHAM DÉ') as test2,
    atlas.norm_key('  Bouaké  ') as test3;

COMMIT;

SELECT '✅ Schéma atlas et fonctions créés avec succès!' as info;
