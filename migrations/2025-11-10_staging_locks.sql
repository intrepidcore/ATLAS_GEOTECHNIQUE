-- Migration: Table de verrouillage pour staging
-- Prévient les éditions concurrentes sur la même table

CREATE TABLE IF NOT EXISTS atlas.staging_locks (
    table_name TEXT PRIMARY KEY,
    locked_by TEXT NOT NULL,
    user_email TEXT,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    staging_id TEXT,
    reason TEXT
);

-- Index pour cleanup des locks expirés
CREATE INDEX IF NOT EXISTS idx_staging_locks_expires 
    ON atlas.staging_locks(expires_at);

-- Fonction pour nettoyer automatiquement les locks expirés
CREATE OR REPLACE FUNCTION atlas.cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM atlas.staging_locks
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE atlas.staging_locks IS 'Verrouillage des tables en cours d''édition pour éviter conflits';
COMMENT ON COLUMN atlas.staging_locks.table_name IS 'Nom complet de la table (schema.table)';
COMMENT ON COLUMN atlas.staging_locks.locked_by IS 'Identifiant utilisateur';
COMMENT ON COLUMN atlas.staging_locks.expires_at IS 'Date d''expiration du lock (défaut 15 min)';
COMMENT ON COLUMN atlas.staging_locks.staging_id IS 'ID du staging associé';

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON atlas.staging_locks TO atlas;
