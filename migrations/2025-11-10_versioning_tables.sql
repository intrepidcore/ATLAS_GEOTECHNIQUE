-- Migration: Tables pour versioning et undo/redo
-- Date: 2025-11-10
-- Description: Ajoute les tables pour tracking des changesets et versions de tables

-- Table des changesets (historique des modifications)
CREATE TABLE IF NOT EXISTS atlas.changesets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete', 'ddl')),
    changes JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    undone_at TIMESTAMPTZ,
    CONSTRAINT changesets_table_name_check CHECK (table_name ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_changesets_table_name ON atlas.changesets(table_name);
CREATE INDEX IF NOT EXISTS idx_changesets_created_at ON atlas.changesets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_changesets_undone_at ON atlas.changesets(undone_at) WHERE undone_at IS NOT NULL;

COMMENT ON TABLE atlas.changesets IS 'Historique des modifications pour undo/redo';
COMMENT ON COLUMN atlas.changesets.operation IS 'Type d''opération: insert, update, delete, ddl';
COMMENT ON COLUMN atlas.changesets.changes IS 'Détails des modifications (format dépend de l''opération)';
COMMENT ON COLUMN atlas.changesets.undone_at IS 'Date d''annulation du changeset (NULL si non annulé)';

-- Table des versions de tables (snapshots)
CREATE TABLE IF NOT EXISTS atlas.table_versions (
    version SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    schema_snapshot JSONB NOT NULL,
    row_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT,
    CONSTRAINT table_versions_table_name_check CHECK (table_name ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_table_versions_table_name ON atlas.table_versions(table_name);
CREATE INDEX IF NOT EXISTS idx_table_versions_created_at ON atlas.table_versions(created_at DESC);

COMMENT ON TABLE atlas.table_versions IS 'Versions/snapshots des schémas de tables';
COMMENT ON COLUMN atlas.table_versions.schema_snapshot IS 'Snapshot du schéma de la table (colonnes, types, contraintes)';
COMMENT ON COLUMN atlas.table_versions.row_count IS 'Nombre de lignes au moment du snapshot';

-- Fonction helper pour créer un changeset automatiquement
CREATE OR REPLACE FUNCTION atlas.track_changeset(
    p_table_name TEXT,
    p_operation TEXT,
    p_changes JSONB,
    p_user TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO atlas.changesets (table_name, operation, changes, created_by)
    VALUES (p_table_name, p_operation, p_changes, p_user)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atlas.track_changeset IS 'Helper pour créer un changeset';

-- Vue pour les changesets récents
CREATE OR REPLACE VIEW atlas.recent_changesets AS
SELECT 
    id,
    table_name,
    operation,
    created_at,
    created_by,
    undone_at IS NOT NULL as is_undone,
    CASE 
        WHEN undone_at IS NOT NULL THEN 'undone'
        WHEN created_at > NOW() - INTERVAL '1 hour' THEN 'recent'
        ELSE 'old'
    END as status
FROM atlas.changesets
ORDER BY created_at DESC
LIMIT 100;

COMMENT ON VIEW atlas.recent_changesets IS 'Vue des 100 derniers changesets';

-- Permissions
GRANT SELECT, INSERT ON atlas.changesets TO atlas;
GRANT SELECT, INSERT ON atlas.table_versions TO atlas;
GRANT USAGE ON SEQUENCE atlas.table_versions_version_seq TO atlas;
GRANT EXECUTE ON FUNCTION atlas.track_changeset TO atlas;
GRANT SELECT ON atlas.recent_changesets TO atlas;
