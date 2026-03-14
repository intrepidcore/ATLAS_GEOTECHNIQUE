-- Migration: Rendre la table audit_log immuable
-- Date: 2025-11-10
-- Description: Empêcher UPDATE et DELETE sur audit_log pour garantir l'intégrité

-- Créer une fonction qui empêche toute modification
CREATE OR REPLACE FUNCTION atlas.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Modification interdite: la table audit_log est immuable';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Créer des triggers pour bloquer UPDATE et DELETE
DROP TRIGGER IF EXISTS prevent_audit_update ON atlas.audit_log;
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON atlas.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION atlas.prevent_audit_modification();

DROP TRIGGER IF EXISTS prevent_audit_delete ON atlas.audit_log;
CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON atlas.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION atlas.prevent_audit_modification();

-- Ajouter un index sur created_at pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
    ON atlas.audit_log(created_at DESC);

-- Ajouter un index sur table_name pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name 
    ON atlas.audit_log(table_name);

-- Ajouter un index sur operation pour statistiques
CREATE INDEX IF NOT EXISTS idx_audit_log_operation 
    ON atlas.audit_log(operation);

-- Ajouter une contrainte CHECK pour garantir que created_at ne peut pas être dans le futur
ALTER TABLE atlas.audit_log 
    ADD CONSTRAINT check_audit_created_at_not_future 
    CHECK (created_at <= NOW());

-- Commentaire sur la table
COMMENT ON TABLE atlas.audit_log IS 
    'Table d''audit immuable - Toute tentative de modification ou suppression sera rejetée';

COMMENT ON TRIGGER prevent_audit_update ON atlas.audit_log IS 
    'Empêche toute modification des enregistrements d''audit';

COMMENT ON TRIGGER prevent_audit_delete ON atlas.audit_log IS 
    'Empêche toute suppression des enregistrements d''audit';
