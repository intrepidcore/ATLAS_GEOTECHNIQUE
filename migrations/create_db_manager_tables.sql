-- Migration pour créer les tables de métadonnées du gestionnaire de BDD
-- Date: 2025-11-10
-- Objectif: Tables pour staging, audit et backup

BEGIN;

-- ============================================================================
-- 1. Table de métadonnées pour les staging
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.staging_metadata (
    staging_id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    staging_table_name TEXT NOT NULL,
    reason TEXT,
    operations_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staging_metadata_table 
ON atlas.staging_metadata(schema_name, table_name);

CREATE INDEX IF NOT EXISTS idx_staging_metadata_created 
ON atlas.staging_metadata(created_at DESC);

COMMENT ON TABLE atlas.staging_metadata IS 
'Métadonnées des tables de staging pour les modifications en attente';

-- ============================================================================
-- 2. Table d''audit pour tracer toutes les opérations
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.audit_log (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id TEXT,
    sql_query TEXT,
    rows_affected BIGINT DEFAULT 0,
    staging_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table 
ON atlas.audit_log(schema_name, table_name);

CREATE INDEX IF NOT EXISTS idx_audit_log_operation 
ON atlas.audit_log(operation);

CREATE INDEX IF NOT EXISTS idx_audit_log_created 
ON atlas.audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user 
ON atlas.audit_log(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE atlas.audit_log IS 
'Journal d''audit de toutes les opérations effectuées via le gestionnaire de BDD';

-- ============================================================================
-- 3. Table de métadonnées pour les backups
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.backup_metadata (
    backup_id TEXT PRIMARY KEY,
    backup_schema TEXT NOT NULL,
    tables TEXT[] NOT NULL,
    description TEXT,
    size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_metadata_created 
ON atlas.backup_metadata(created_at DESC);

COMMENT ON TABLE atlas.backup_metadata IS 
'Métadonnées des points de restauration (backups)';

-- ============================================================================
-- 4. Table de métadonnées UI pour les colonnes
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.column_ui_metadata (
    id SERIAL PRIMARY KEY,
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    ui_order INTEGER,
    ui_visible BOOLEAN DEFAULT TRUE,
    ui_label TEXT,
    ui_unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(schema_name, table_name, column_name)
);

CREATE INDEX IF NOT EXISTS idx_column_ui_metadata_table 
ON atlas.column_ui_metadata(schema_name, table_name);

COMMENT ON TABLE atlas.column_ui_metadata IS 
'Métadonnées UI pour personnaliser l''affichage des colonnes dans le gestionnaire';

-- ============================================================================
-- 5. Fonction pour nettoyer les anciens staging (> 24h)
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.cleanup_old_staging()
RETURNS INTEGER AS $$
DECLARE
    staging_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    FOR staging_record IN 
        SELECT staging_id, schema_name, staging_table_name
        FROM atlas.staging_metadata
        WHERE created_at < NOW() - INTERVAL '24 hours'
    LOOP
        -- Supprimer la table de staging
        EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
            staging_record.schema_name, 
            staging_record.staging_table_name);
        
        -- Supprimer les métadonnées
        DELETE FROM atlas.staging_metadata 
        WHERE staging_id = staging_record.staging_id;
        
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.cleanup_old_staging() IS 
'Nettoie les tables de staging de plus de 24 heures';

-- ============================================================================
-- 6. Fonction pour nettoyer les anciens backups (> 7 jours)
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
    backup_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    FOR backup_record IN 
        SELECT backup_id, backup_schema
        FROM atlas.backup_metadata
        WHERE created_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Supprimer le schéma de backup
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', 
            backup_record.backup_schema);
        
        -- Supprimer les métadonnées
        DELETE FROM atlas.backup_metadata 
        WHERE backup_id = backup_record.backup_id;
        
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.cleanup_old_backups() IS 
'Nettoie les backups de plus de 7 jours';

-- ============================================================================
-- 7. Trigger pour mettre à jour updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staging_metadata_updated_at
    BEFORE UPDATE ON atlas.staging_metadata
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

CREATE TRIGGER update_column_ui_metadata_updated_at
    BEFORE UPDATE ON atlas.column_ui_metadata
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- ============================================================================
-- 8. Vue pour les statistiques d''audit
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_audit_stats AS
SELECT 
    schema_name,
    table_name,
    operation,
    COUNT(*) as operation_count,
    SUM(rows_affected) as total_rows_affected,
    MAX(created_at) as last_operation,
    COUNT(DISTINCT user_id) as unique_users
FROM atlas.audit_log
GROUP BY schema_name, table_name, operation;

COMMENT ON VIEW atlas.v_audit_stats IS 
'Statistiques agrégées des opérations d''audit par table et opération';

-- ============================================================================
-- 9. Vue pour les staging actifs
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_active_staging AS
SELECT 
    s.staging_id,
    s.schema_name,
    s.table_name,
    s.staging_table_name,
    s.reason,
    s.operations_count,
    s.created_at,
    EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 as age_hours,
    pg_size_pretty(pg_total_relation_size(s.schema_name || '.' || s.staging_table_name)) as size
FROM atlas.staging_metadata s
ORDER BY s.created_at DESC;

COMMENT ON VIEW atlas.v_active_staging IS 
'Vue des staging actifs avec leur âge et taille';

COMMIT;

-- Afficher un résumé
DO $$
BEGIN
    RAISE NOTICE '✅ Tables de métadonnées du gestionnaire de BDD créées avec succès';
    RAISE NOTICE '   - atlas.staging_metadata';
    RAISE NOTICE '   - atlas.audit_log';
    RAISE NOTICE '   - atlas.backup_metadata';
    RAISE NOTICE '   - atlas.column_ui_metadata';
    RAISE NOTICE '   - Fonctions de nettoyage automatique';
    RAISE NOTICE '   - Vues de statistiques';
END $$;
