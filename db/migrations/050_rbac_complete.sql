-- Migration RBAC complète : Users, Roles, Permissions, Sessions
-- Version: 1.0.0
-- Date: 2025-11-27

BEGIN;

-- ============================================================================
-- Table: atlas.permissions
-- Permissions granulaires du système
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.permissions (
    id VARCHAR(100) PRIMARY KEY,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource, action)
);

COMMENT ON TABLE atlas.permissions IS 'Permissions granulaires du système RBAC';
COMMENT ON COLUMN atlas.permissions.id IS 'Identifiant unique (format: resource.action)';
COMMENT ON COLUMN atlas.permissions.resource IS 'Ressource concernée (tables, staging, schema, etc.)';
COMMENT ON COLUMN atlas.permissions.action IS 'Action autorisée (read, write, delete, etc.)';

-- ============================================================================
-- Table: atlas.roles
-- Rôles avec leurs permissions associées
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.roles IS 'Rôles du système RBAC';
COMMENT ON COLUMN atlas.roles.is_system IS 'Rôle système non supprimable (admin, editor, viewer)';

-- ============================================================================
-- Table: atlas.role_permissions
-- Association many-to-many entre rôles et permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.role_permissions (
    role_id VARCHAR(50) REFERENCES atlas.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) REFERENCES atlas.permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID,
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE atlas.role_permissions IS 'Association rôles-permissions';

-- ============================================================================
-- Table: atlas.users
-- Utilisateurs du système
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_-]{3,50}$')
);

COMMENT ON TABLE atlas.users IS 'Utilisateurs du système';
COMMENT ON COLUMN atlas.users.password_hash IS 'Hash Argon2id du mot de passe';
COMMENT ON COLUMN atlas.users.failed_login_attempts IS 'Compteur tentatives échouées (reset après succès)';
COMMENT ON COLUMN atlas.users.locked_until IS 'Compte verrouillé jusqu''à cette date';

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_users_email ON atlas.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON atlas.users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON atlas.users(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- Table: atlas.user_roles
-- Association many-to-many entre utilisateurs et rôles
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.user_roles (
    user_id UUID REFERENCES atlas.users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES atlas.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES atlas.users(id),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE atlas.user_roles IS 'Association utilisateurs-rôles';
COMMENT ON COLUMN atlas.user_roles.expires_at IS 'Date expiration du rôle (NULL = permanent)';

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON atlas.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON atlas.user_roles(role_id);

-- ============================================================================
-- Table: atlas.sessions
-- Sessions utilisateur avec tokens JWT
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(64) UNIQUE,
    user_agent TEXT,
    ip_address INET,
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100)
);

COMMENT ON TABLE atlas.sessions IS 'Sessions utilisateur actives';
COMMENT ON COLUMN atlas.sessions.token_hash IS 'Hash SHA-256 du JWT access token';
COMMENT ON COLUMN atlas.sessions.refresh_token_hash IS 'Hash SHA-256 du refresh token';

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON atlas.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON atlas.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON atlas.sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON atlas.sessions(expires_at);

-- ============================================================================
-- Table: atlas.password_reset_tokens
-- Tokens de réinitialisation de mot de passe
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET
);

COMMENT ON TABLE atlas.password_reset_tokens IS 'Tokens de réinitialisation mot de passe';

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON atlas.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON atlas.password_reset_tokens(token_hash);

-- ============================================================================
-- Table: atlas.auth_audit_log
-- Journal d'audit des événements d'authentification
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.auth_audit_log IS 'Journal audit authentification';
COMMENT ON COLUMN atlas.auth_audit_log.event_type IS 'Type: login, logout, password_change, password_reset, token_refresh, etc.';

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_id ON atlas.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON atlas.auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON atlas.auth_audit_log(created_at);

-- ============================================================================
-- Insertion des permissions par défaut
-- ============================================================================
INSERT INTO atlas.permissions (id, resource, action, description) VALUES
    -- Tables
    ('tables.read', 'tables', 'read', 'Voir les données des tables'),
    ('tables.write', 'tables', 'write', 'Modifier les données des tables'),
    ('tables.delete', 'tables', 'delete', 'Supprimer des données des tables'),
    ('tables.create', 'tables', 'create', 'Créer de nouvelles entrées'),
    
    -- Staging
    ('staging.create', 'staging', 'create', 'Créer un environnement de staging'),
    ('staging.commit', 'staging', 'commit', 'Valider et appliquer les changements staging'),
    ('staging.cancel', 'staging', 'cancel', 'Annuler un staging en cours'),
    ('staging.preview', 'staging', 'preview', 'Prévisualiser les changements staging'),
    
    -- Schema
    ('schema.read', 'schema', 'read', 'Voir la structure du schéma'),
    ('schema.modify', 'schema', 'modify', 'Modifier la structure (DDL)'),
    ('schema.drop', 'schema', 'drop', 'Supprimer des colonnes/tables'),
    
    -- Users
    ('users.read', 'users', 'read', 'Voir la liste des utilisateurs'),
    ('users.create', 'users', 'create', 'Créer des utilisateurs'),
    ('users.update', 'users', 'update', 'Modifier des utilisateurs'),
    ('users.delete', 'users', 'delete', 'Supprimer des utilisateurs'),
    ('users.manage', 'users', 'manage', 'Gestion complète des utilisateurs'),
    
    -- Roles
    ('roles.read', 'roles', 'read', 'Voir les rôles'),
    ('roles.create', 'roles', 'create', 'Créer des rôles'),
    ('roles.update', 'roles', 'update', 'Modifier des rôles'),
    ('roles.delete', 'roles', 'delete', 'Supprimer des rôles'),
    ('roles.assign', 'roles', 'assign', 'Assigner des rôles aux utilisateurs'),
    ('roles.manage', 'roles', 'manage', 'Gestion complète des rôles'),
    
    -- Audit
    ('audit.read', 'audit', 'read', 'Voir les logs d''audit'),
    ('audit.export', 'audit', 'export', 'Exporter les logs d''audit'),
    
    -- Backup
    ('backup.create', 'backup', 'create', 'Créer des sauvegardes'),
    ('backup.restore', 'backup', 'restore', 'Restaurer des sauvegardes'),
    ('backup.delete', 'backup', 'delete', 'Supprimer des sauvegardes'),
    ('backup.list', 'backup', 'list', 'Lister les sauvegardes'),
    
    -- Import/Export
    ('import.execute', 'import', 'execute', 'Importer des données'),
    ('export.execute', 'export', 'execute', 'Exporter des données'),
    
    -- Geocoding
    ('geocoding.read', 'geocoding', 'read', 'Voir les données de géocodage'),
    ('geocoding.execute', 'geocoding', 'execute', 'Exécuter le géocodage'),
    ('geocoding.approve', 'geocoding', 'approve', 'Approuver les suggestions'),
    
    -- Thematic
    ('thematic.read', 'thematic', 'read', 'Voir les cartes thématiques'),
    ('thematic.create', 'thematic', 'create', 'Créer des configurations thématiques'),
    ('thematic.delete', 'thematic', 'delete', 'Supprimer des configurations'),
    
    -- System
    ('system.admin', 'system', 'admin', 'Administration système complète'),
    ('system.metrics', 'system', 'metrics', 'Voir les métriques système'),
    ('system.logs', 'system', 'logs', 'Voir les logs système')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Insertion des rôles par défaut
-- ============================================================================
INSERT INTO atlas.roles (id, name, description, is_system) VALUES
    ('admin', 'Administrateur', 'Accès complet au système - tous les droits', TRUE),
    ('editor', 'Éditeur', 'Peut lire et modifier les données, gérer le staging', TRUE),
    ('viewer', 'Lecteur', 'Accès en lecture seule aux données', TRUE),
    ('data_manager', 'Gestionnaire de données', 'Gestion avancée des données et imports', FALSE),
    ('geo_analyst', 'Analyste géospatial', 'Géocodage et analyses thématiques', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Attribution des permissions aux rôles
-- ============================================================================

-- Admin: toutes les permissions
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM atlas.permissions
ON CONFLICT DO NOTHING;

-- Editor: lecture/écriture données, staging, pas de DDL ni admin
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('editor', 'tables.read'),
    ('editor', 'tables.write'),
    ('editor', 'tables.create'),
    ('editor', 'staging.create'),
    ('editor', 'staging.commit'),
    ('editor', 'staging.cancel'),
    ('editor', 'staging.preview'),
    ('editor', 'schema.read'),
    ('editor', 'audit.read'),
    ('editor', 'backup.list'),
    ('editor', 'import.execute'),
    ('editor', 'export.execute'),
    ('editor', 'geocoding.read'),
    ('editor', 'geocoding.execute'),
    ('editor', 'thematic.read'),
    ('editor', 'thematic.create')
ON CONFLICT DO NOTHING;

-- Viewer: lecture seule
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('viewer', 'tables.read'),
    ('viewer', 'schema.read'),
    ('viewer', 'audit.read'),
    ('viewer', 'backup.list'),
    ('viewer', 'export.execute'),
    ('viewer', 'geocoding.read'),
    ('viewer', 'thematic.read')
ON CONFLICT DO NOTHING;

-- Data Manager: gestion données avancée
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('data_manager', 'tables.read'),
    ('data_manager', 'tables.write'),
    ('data_manager', 'tables.delete'),
    ('data_manager', 'tables.create'),
    ('data_manager', 'staging.create'),
    ('data_manager', 'staging.commit'),
    ('data_manager', 'staging.cancel'),
    ('data_manager', 'staging.preview'),
    ('data_manager', 'schema.read'),
    ('data_manager', 'schema.modify'),
    ('data_manager', 'audit.read'),
    ('data_manager', 'audit.export'),
    ('data_manager', 'backup.create'),
    ('data_manager', 'backup.restore'),
    ('data_manager', 'backup.list'),
    ('data_manager', 'import.execute'),
    ('data_manager', 'export.execute')
ON CONFLICT DO NOTHING;

-- Geo Analyst: géocodage et thématique
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('geo_analyst', 'tables.read'),
    ('geo_analyst', 'tables.write'),
    ('geo_analyst', 'staging.create'),
    ('geo_analyst', 'staging.commit'),
    ('geo_analyst', 'staging.cancel'),
    ('geo_analyst', 'staging.preview'),
    ('geo_analyst', 'schema.read'),
    ('geo_analyst', 'audit.read'),
    ('geo_analyst', 'export.execute'),
    ('geo_analyst', 'geocoding.read'),
    ('geo_analyst', 'geocoding.execute'),
    ('geo_analyst', 'geocoding.approve'),
    ('geo_analyst', 'thematic.read'),
    ('geo_analyst', 'thematic.create'),
    ('geo_analyst', 'thematic.delete')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Créer l'utilisateur admin par défaut
-- Password: Atlas2025! (à changer immédiatement en production)
-- Hash Argon2id généré avec les paramètres recommandés
-- ============================================================================
INSERT INTO atlas.users (
    id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    is_active,
    is_verified
) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'admin@atlas.local',
    'admin',
    -- Placeholder hash - sera remplacé par le vrai hash Argon2id au premier démarrage
    '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG',
    'System',
    'Administrator',
    TRUE,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Assigner le rôle admin à l'utilisateur admin
INSERT INTO atlas.user_roles (user_id, role_id)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'admin')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Fonctions utilitaires
-- ============================================================================

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION atlas.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE atlas.sessions
    SET is_active = FALSE, revoked_at = NOW(), revoked_reason = 'expired'
    WHERE is_active = TRUE AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur a une permission
CREATE OR REPLACE FUNCTION atlas.user_has_permission(
    p_user_id UUID,
    p_permission_id VARCHAR(100)
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM atlas.user_roles ur
        JOIN atlas.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = p_user_id
        AND rp.permission_id = p_permission_id
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir toutes les permissions d'un utilisateur
CREATE OR REPLACE FUNCTION atlas.get_user_permissions(p_user_id UUID)
RETURNS TABLE(permission_id VARCHAR(100), resource VARCHAR(50), action VARCHAR(50)) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.id, p.resource, p.action
    FROM atlas.user_roles ur
    JOIN atlas.role_permissions rp ON ur.role_id = rp.role_id
    JOIN atlas.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir tous les rôles d'un utilisateur
CREATE OR REPLACE FUNCTION atlas.get_user_roles(p_user_id UUID)
RETURNS TABLE(role_id VARCHAR(50), role_name VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name
    FROM atlas.user_roles ur
    JOIN atlas.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer un événement d'audit auth
CREATE OR REPLACE FUNCTION atlas.log_auth_event(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_success BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO atlas.auth_audit_log (user_id, event_type, success, ip_address, user_agent, details)
    VALUES (p_user_id, p_event_type, p_success, p_ip_address, p_user_agent, p_details)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION atlas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON atlas.users
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON atlas.roles
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- ============================================================================
-- Vue pour faciliter les requêtes utilisateur avec rôles
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_users_with_roles AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    u.avatar_url,
    u.is_active,
    u.is_verified,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', r.id,
                'name', r.name
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
    ) AS roles
FROM atlas.users u
LEFT JOIN atlas.user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
LEFT JOIN atlas.roles r ON ur.role_id = r.id
GROUP BY u.id;

-- ============================================================================
-- Vue pour les rôles avec leurs permissions
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_roles_with_permissions AS
SELECT 
    r.id,
    r.name,
    r.description,
    r.is_system,
    r.created_at,
    r.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', p.id,
                'resource', p.resource,
                'action', p.action,
                'description', p.description
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'::json
    ) AS permissions
FROM atlas.roles r
LEFT JOIN atlas.role_permissions rp ON r.id = rp.role_id
LEFT JOIN atlas.permissions p ON rp.permission_id = p.id
GROUP BY r.id;

COMMIT;
