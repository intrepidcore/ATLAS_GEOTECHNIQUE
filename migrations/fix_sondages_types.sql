-- ============================================================================
-- Migration : Correction des types de colonnes dans la table sondages
-- Date : 2025-11-07
-- Description : Conversion sécurisée de TEXT -> UUID/INTEGER/DATE
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1 : ANALYSE PRÉLIMINAIRE
-- ============================================================================

-- Afficher l'état actuel
SELECT 'État actuel de la table sondages:' as info;
\d sondages

-- Compter les lignes totales
SELECT COUNT(*) as total_sondages FROM sondages;

-- Analyser les valeurs invalides
SELECT 'Analyse des valeurs invalides:' as info;

-- IDs non-UUID
SELECT COUNT(*) as id_non_uuid 
FROM sondages 
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- adm3_id non-entier ou 'nan'
SELECT COUNT(*) as adm3_id_invalide
FROM sondages 
WHERE adm3_id IS NOT NULL 
  AND (lower(trim(adm3_id)) = 'nan' OR adm3_id !~ '^\d+$');

-- dates invalides
SELECT COUNT(*) as date_invalide
FROM sondages 
WHERE date IS NOT NULL 
  AND (lower(trim(date)) = 'nan' OR date !~ '^\d{4}-\d{2}-\d{2}$');

-- ============================================================================
-- ÉTAPE 2 : BACKUP (export des données problématiques)
-- ============================================================================

-- Créer une table de backup
DROP TABLE IF EXISTS sondages_backup_20251107;
CREATE TABLE sondages_backup_20251107 AS SELECT * FROM sondages;

SELECT 'Backup créé: sondages_backup_20251107' as info;

-- ============================================================================
-- ÉTAPE 3 : NETTOYAGE DES VALEURS 'nan'
-- ============================================================================

-- Standardiser 'nan' -> NULL
UPDATE sondages SET adm3_id = NULL WHERE lower(trim(adm3_id)) IN ('nan', '');
UPDATE sondages SET date = NULL WHERE lower(trim(date)) IN ('nan', '');

SELECT 'Valeurs "nan" nettoyées' as info;

-- ============================================================================
-- ÉTAPE 4 : SUPPRIMER is_geocoded TEMPORAIREMENT
-- ============================================================================

ALTER TABLE sondages DROP COLUMN IF EXISTS is_geocoded;

SELECT 'Colonne is_geocoded supprimée' as info;

-- ============================================================================
-- ÉTAPE 5 : CRÉER COLONNES TEMPORAIRES AVEC TYPES CORRECTS
-- ============================================================================

ALTER TABLE sondages ADD COLUMN id_uuid UUID;
ALTER TABLE sondages ADD COLUMN adm3_id_int INTEGER;
ALTER TABLE sondages ADD COLUMN date_date DATE;

SELECT 'Colonnes temporaires créées' as info;

-- ============================================================================
-- ÉTAPE 6 : CONVERTIR LES DONNÉES VERS LES NOUVELLES COLONNES
-- ============================================================================

-- Conversion sécurisée avec gestion des erreurs
UPDATE sondages
SET 
    id_uuid = CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN id::uuid 
        ELSE NULL 
    END,
    adm3_id_int = CASE 
        WHEN adm3_id IS NOT NULL AND adm3_id ~ '^\d+$' 
        THEN adm3_id::integer 
        ELSE NULL 
    END,
    date_date = CASE 
        WHEN date IS NOT NULL AND date ~ '^\d{4}-\d{2}-\d{2}$' 
        THEN date::date 
        ELSE NULL 
    END;

SELECT 'Données converties dans les colonnes temporaires' as info;

-- ============================================================================
-- ÉTAPE 7 : VÉRIFICATION DES CONVERSIONS
-- ============================================================================

SELECT 'Vérification des conversions:' as info;

SELECT 
    COUNT(*) as total,
    COUNT(id_uuid) as id_uuid_ok,
    COUNT(*) FILTER (WHERE id_uuid IS NULL) as id_uuid_null,
    COUNT(adm3_id_int) as adm3_id_int_ok,
    COUNT(*) FILTER (WHERE adm3_id IS NOT NULL AND adm3_id_int IS NULL) as adm3_id_conversion_failed,
    COUNT(date_date) as date_date_ok,
    COUNT(*) FILTER (WHERE date IS NOT NULL AND date_date IS NULL) as date_conversion_failed
FROM sondages;

-- Afficher les lignes problématiques (si présentes)
SELECT id, adm3_id, date 
FROM sondages 
WHERE id_uuid IS NULL 
   OR (adm3_id IS NOT NULL AND adm3_id_int IS NULL)
   OR (date IS NOT NULL AND date_date IS NULL)
LIMIT 10;

-- ============================================================================
-- ÉTAPE 8 : BASCULER VERS LES NOUVELLES COLONNES
-- ============================================================================

-- Supprimer la contrainte PK existante
ALTER TABLE sondages DROP CONSTRAINT IF EXISTS sondages_pkey;

-- Renommer les anciennes colonnes
ALTER TABLE sondages RENAME COLUMN id TO id_old;
ALTER TABLE sondages RENAME COLUMN adm3_id TO adm3_id_old;
ALTER TABLE sondages RENAME COLUMN date TO date_old;

-- Renommer les nouvelles colonnes
ALTER TABLE sondages RENAME COLUMN id_uuid TO id;
ALTER TABLE sondages RENAME COLUMN adm3_id_int TO adm3_id;
ALTER TABLE sondages RENAME COLUMN date_date TO date;

SELECT 'Colonnes renommées' as info;

-- ============================================================================
-- ÉTAPE 9 : RECRÉER LES CONTRAINTES ET INDEX
-- ============================================================================

-- Ajouter la contrainte PRIMARY KEY
ALTER TABLE sondages ADD PRIMARY KEY (id);

-- Note: Pas de contrainte FK pour adm3_id car la table adm3 n'a pas de colonne 'id'
-- La table adm3 utilise 'gid' comme identifiant et les valeurs sont toutes 'nan' actuellement

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_sondages_adm3_id ON sondages(adm3_id);
CREATE INDEX IF NOT EXISTS idx_sondages_date ON sondages(date);
CREATE INDEX IF NOT EXISTS idx_sondages_geom ON sondages USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_sondages_deleted_at ON sondages(deleted_at);

SELECT 'Contraintes et index recréés' as info;

-- ============================================================================
-- ÉTAPE 10 : RECRÉER LA COLONNE is_geocoded
-- ============================================================================

-- Recréer is_geocoded avec vérification de géométrie valide
ALTER TABLE sondages ADD COLUMN is_geocoded BOOLEAN 
    GENERATED ALWAYS AS (
        (geom IS NOT NULL AND NOT ST_IsEmpty(geom)) OR adm3_id IS NOT NULL
    ) STORED;

SELECT 'Colonne is_geocoded recréée' as info;

-- ============================================================================
-- ÉTAPE 11 : SUPPRIMER LA VUE MATÉRIALISÉE AVANT DE SUPPRIMER LES COLONNES
-- ============================================================================

-- Supprimer l'ancienne vue car elle dépend des anciennes colonnes
DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech;

SELECT 'Vue matérialisée supprimée' as info;

-- ============================================================================
-- ÉTAPE 12 : SUPPRIMER LES ANCIENNES COLONNES
-- ============================================================================

ALTER TABLE sondages DROP COLUMN id_old;
ALTER TABLE sondages DROP COLUMN adm3_id_old;
ALTER TABLE sondages DROP COLUMN date_old;

SELECT 'Anciennes colonnes supprimées' as info;

-- ============================================================================
-- ÉTAPE 13 : RECRÉER LA VUE MATÉRIALISÉE mv_mailles_geotech
-- ============================================================================

-- Créer la nouvelle vue matérialisée
CREATE MATERIALIZED VIEW mv_mailles_geotech AS 
SELECT 
    m.id, 
    m.code, 
    m.geom, 
    m.geom_4326,
    m.adm1_name, 
    m.adm2_name, 
    m.adm3_name,
    COUNT(DISTINCT s.id) as nb_sondages_real,
    0 as nb_sondages_spread,
    CASE WHEN COUNT(DISTINCT s.id) > 0 THEN true ELSE false END as has_data
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom) AND s.deleted_at IS NULL
GROUP BY m.id, m.code, m.geom, m.geom_4326, m.adm1_name, m.adm2_name, m.adm3_name;

-- Créer les index
CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON mv_mailles_geotech USING GIST(geom_4326);
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON mv_mailles_geotech(id);

SELECT 'Vue matérialisée mv_mailles_geotech recréée' as info;

-- ============================================================================
-- ÉTAPE 14 : VÉRIFICATION FINALE
-- ============================================================================

SELECT 'Vérification finale:' as info;

-- Structure de la table
\d sondages

-- Statistiques
SELECT 
    COUNT(*) as total_sondages,
    COUNT(id) as id_non_null,
    COUNT(adm3_id) as adm3_id_non_null,
    COUNT(date) as date_non_null,
    COUNT(geom) as geom_non_null,
    COUNT(*) FILTER (WHERE is_geocoded = true) as geocoded_count
FROM sondages;

-- Vue matérialisée
SELECT COUNT(*) as total_mailles, 
       SUM(nb_sondages_real) as total_sondages_in_mailles,
       COUNT(*) FILTER (WHERE has_data = true) as mailles_with_data
FROM mv_mailles_geotech;

COMMIT;

SELECT '✅ Migration terminée avec succès!' as info;
