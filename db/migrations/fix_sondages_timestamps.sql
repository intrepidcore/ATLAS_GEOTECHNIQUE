-- ============================================================================
-- Migration : Correction des colonnes timestamps dans la table sondages
-- Date : 2025-11-07
-- Description : Conversion TEXT -> TIMESTAMPTZ pour created_at, updated_at, deleted_at
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1 : ANALYSE PRÉLIMINAIRE
-- ============================================================================

SELECT 'État actuel des colonnes timestamps:' as info;

SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE created_at IS NOT NULL) as created_at_non_null,
    COUNT(*) FILTER (WHERE updated_at IS NOT NULL) as updated_at_non_null,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_at_non_null
FROM sondages;

-- Exemples de valeurs
SELECT created_at, updated_at, deleted_at FROM sondages LIMIT 3;

-- ============================================================================
-- ÉTAPE 2 : CRÉER COLONNES TEMPORAIRES
-- ============================================================================

ALTER TABLE sondages ADD COLUMN created_at_ts TIMESTAMPTZ;
ALTER TABLE sondages ADD COLUMN updated_at_ts TIMESTAMPTZ;
ALTER TABLE sondages ADD COLUMN deleted_at_ts TIMESTAMPTZ;

SELECT 'Colonnes temporaires créées' as info;

-- ============================================================================
-- ÉTAPE 3 : CONVERTIR LES DONNÉES
-- ============================================================================

-- Nettoyer les valeurs 'nan' et vides
UPDATE sondages SET created_at = NULL WHERE lower(trim(created_at)) IN ('nan', '', 'null');
UPDATE sondages SET updated_at = NULL WHERE lower(trim(updated_at)) IN ('nan', '', 'null');
UPDATE sondages SET deleted_at = NULL WHERE lower(trim(deleted_at)) IN ('nan', '', 'null');

-- Convertir les valeurs valides
-- Si created_at est NULL, utiliser NOW() par défaut
UPDATE sondages
SET 
    created_at_ts = COALESCE(
        CASE 
            WHEN created_at ~ '^\d{4}-\d{2}-\d{2}' THEN created_at::timestamptz
            ELSE NULL 
        END,
        NOW()  -- Valeur par défaut si NULL ou invalide
    ),
    updated_at_ts = CASE 
        WHEN updated_at IS NOT NULL AND updated_at ~ '^\d{4}-\d{2}-\d{2}' 
        THEN updated_at::timestamptz 
        ELSE NULL 
    END,
    deleted_at_ts = CASE 
        WHEN deleted_at IS NOT NULL AND deleted_at ~ '^\d{4}-\d{2}-\d{2}' 
        THEN deleted_at::timestamptz 
        ELSE NULL 
    END;

SELECT 'Données converties' as info;

-- ============================================================================
-- ÉTAPE 4 : VÉRIFICATION
-- ============================================================================

SELECT 
    COUNT(*) as total,
    COUNT(created_at_ts) as created_at_ts_ok,
    COUNT(updated_at_ts) as updated_at_ts_ok,
    COUNT(deleted_at_ts) as deleted_at_ts_ok
FROM sondages;

-- ============================================================================
-- ÉTAPE 5 : BASCULER VERS LES NOUVELLES COLONNES
-- ============================================================================

ALTER TABLE sondages RENAME COLUMN created_at TO created_at_old;
ALTER TABLE sondages RENAME COLUMN updated_at TO updated_at_old;
ALTER TABLE sondages RENAME COLUMN deleted_at TO deleted_at_old;

ALTER TABLE sondages RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE sondages RENAME COLUMN updated_at_ts TO updated_at;
ALTER TABLE sondages RENAME COLUMN deleted_at_ts TO deleted_at;

SELECT 'Colonnes renommées' as info;

-- ============================================================================
-- ÉTAPE 6 : AJOUTER CONTRAINTES
-- ============================================================================

-- created_at ne doit jamais être NULL
ALTER TABLE sondages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE sondages ALTER COLUMN created_at SET DEFAULT NOW();

SELECT 'Contraintes ajoutées' as info;

-- ============================================================================
-- ÉTAPE 7 : RECRÉER L'INDEX SUR deleted_at
-- ============================================================================

DROP INDEX IF EXISTS idx_sondages_deleted_at;
CREATE INDEX idx_sondages_deleted_at ON sondages(deleted_at) WHERE deleted_at IS NOT NULL;

SELECT 'Index recréé' as info;

-- ============================================================================
-- ÉTAPE 8 : SUPPRIMER LA VUE MATÉRIALISÉE AVANT DE SUPPRIMER LES COLONNES
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_mailles_geotech;

SELECT 'Vue matérialisée supprimée' as info;

-- ============================================================================
-- ÉTAPE 9 : SUPPRIMER LES ANCIENNES COLONNES
-- ============================================================================

ALTER TABLE sondages DROP COLUMN created_at_old;
ALTER TABLE sondages DROP COLUMN updated_at_old;
ALTER TABLE sondages DROP COLUMN deleted_at_old;

SELECT 'Anciennes colonnes supprimées' as info;

-- ============================================================================
-- ÉTAPE 10 : RECRÉER LA VUE MATÉRIALISÉE
-- ============================================================================

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

CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON mv_mailles_geotech USING GIST(geom_4326);
CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON mv_mailles_geotech(id);

SELECT 'Vue matérialisée recréée' as info;

-- ============================================================================
-- ÉTAPE 11 : VÉRIFICATION FINALE
-- ============================================================================

SELECT 'Vérification finale:' as info;

\d sondages

SELECT 
    COUNT(*) as total,
    COUNT(created_at) as created_at_non_null,
    COUNT(updated_at) as updated_at_non_null,
    COUNT(deleted_at) as deleted_at_non_null
FROM sondages;

COMMIT;

SELECT '✅ Migration timestamps terminée avec succès!' as info;
