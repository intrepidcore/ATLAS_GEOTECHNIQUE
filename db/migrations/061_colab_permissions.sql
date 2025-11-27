-- ============================================================================
-- Migration 061: Permissions Atlas Colab
-- Ajout des permissions spécifiques à Colab dans le système RBAC
-- ============================================================================

BEGIN;

-- ============================================================================
-- Nouvelles permissions Colab
-- ============================================================================
INSERT INTO atlas.permissions (id, resource, action, description) VALUES
    -- Missions
    ('colab.missions.read', 'colab.missions', 'read', 'Voir les missions Colab'),
    ('colab.missions.create', 'colab.missions', 'create', 'Créer des missions Colab'),
    ('colab.missions.update', 'colab.missions', 'update', 'Modifier des missions Colab'),
    ('colab.missions.delete', 'colab.missions', 'delete', 'Supprimer des missions Colab'),
    ('colab.missions.assign', 'colab.missions', 'assign', 'Affecter des étudiants aux missions'),
    
    -- Étudiants
    ('colab.students.read', 'colab.students', 'read', 'Voir les étudiants Colab'),
    ('colab.students.create', 'colab.students', 'create', 'Créer des profils étudiants'),
    ('colab.students.update', 'colab.students', 'update', 'Modifier des profils étudiants'),
    ('colab.students.delete', 'colab.students', 'delete', 'Supprimer des profils étudiants'),
    
    -- Superviseurs
    ('colab.supervisors.read', 'colab.supervisors', 'read', 'Voir les superviseurs Colab'),
    ('colab.supervisors.create', 'colab.supervisors', 'create', 'Créer des profils superviseurs'),
    ('colab.supervisors.update', 'colab.supervisors', 'update', 'Modifier des profils superviseurs'),
    ('colab.supervisors.delete', 'colab.supervisors', 'delete', 'Supprimer des profils superviseurs'),
    
    -- Journal de terrain
    ('colab.field_logs.read', 'colab.field_logs', 'read', 'Voir les journaux de terrain'),
    ('colab.field_logs.write', 'colab.field_logs', 'write', 'Écrire dans les journaux de terrain'),
    ('colab.field_logs.delete', 'colab.field_logs', 'delete', 'Supprimer des entrées de journal'),
    
    -- Documents
    ('colab.documents.read', 'colab.documents', 'read', 'Voir les documents Colab'),
    ('colab.documents.upload', 'colab.documents', 'upload', 'Téléverser des documents'),
    ('colab.documents.delete', 'colab.documents', 'delete', 'Supprimer des documents'),
    
    -- Sondages liés
    ('colab.sondages.link', 'colab.sondages', 'link', 'Lier des sondages aux missions'),
    ('colab.sondages.unlink', 'colab.sondages', 'unlink', 'Délier des sondages des missions')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Attribution des permissions aux rôles existants
-- ============================================================================

-- Admin: toutes les permissions Colab
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM atlas.permissions WHERE id LIKE 'colab.%'
ON CONFLICT DO NOTHING;

-- Data Manager: gestion complète des missions et documents
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('data_manager', 'colab.missions.read'),
    ('data_manager', 'colab.missions.create'),
    ('data_manager', 'colab.missions.update'),
    ('data_manager', 'colab.missions.assign'),
    ('data_manager', 'colab.students.read'),
    ('data_manager', 'colab.students.create'),
    ('data_manager', 'colab.students.update'),
    ('data_manager', 'colab.supervisors.read'),
    ('data_manager', 'colab.supervisors.create'),
    ('data_manager', 'colab.supervisors.update'),
    ('data_manager', 'colab.field_logs.read'),
    ('data_manager', 'colab.field_logs.write'),
    ('data_manager', 'colab.documents.read'),
    ('data_manager', 'colab.documents.upload'),
    ('data_manager', 'colab.sondages.link'),
    ('data_manager', 'colab.sondages.unlink')
ON CONFLICT DO NOTHING;

-- Geo Analyst: lecture missions, logs et documents
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('geo_analyst', 'colab.missions.read'),
    ('geo_analyst', 'colab.students.read'),
    ('geo_analyst', 'colab.supervisors.read'),
    ('geo_analyst', 'colab.field_logs.read'),
    ('geo_analyst', 'colab.field_logs.write'),
    ('geo_analyst', 'colab.documents.read'),
    ('geo_analyst', 'colab.documents.upload'),
    ('geo_analyst', 'colab.sondages.link')
ON CONFLICT DO NOTHING;

-- Editor: lecture + écriture logs et documents
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('editor', 'colab.missions.read'),
    ('editor', 'colab.students.read'),
    ('editor', 'colab.supervisors.read'),
    ('editor', 'colab.field_logs.read'),
    ('editor', 'colab.field_logs.write'),
    ('editor', 'colab.documents.read'),
    ('editor', 'colab.documents.upload')
ON CONFLICT DO NOTHING;

-- Viewer: lecture seule
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('viewer', 'colab.missions.read'),
    ('viewer', 'colab.students.read'),
    ('viewer', 'colab.supervisors.read'),
    ('viewer', 'colab.field_logs.read'),
    ('viewer', 'colab.documents.read')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Nouveaux rôles spécifiques Colab (optionnel)
-- ============================================================================

-- Rôle Student (étudiant)
INSERT INTO atlas.roles (id, name, description, is_system) VALUES
    ('student', 'Étudiant', 'Étudiant participant aux missions terrain', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Rôle Supervisor (encadreur)
INSERT INTO atlas.roles (id, name, description, is_system) VALUES
    ('supervisor', 'Encadreur', 'Encadreur/superviseur de missions terrain', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Permissions pour Student
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('student', 'colab.missions.read'),
    ('student', 'colab.students.read'),
    ('student', 'colab.supervisors.read'),
    ('student', 'colab.field_logs.read'),
    ('student', 'colab.field_logs.write'),
    ('student', 'colab.documents.read'),
    ('student', 'colab.documents.upload'),
    ('student', 'tables.read'),
    ('student', 'schema.read')
ON CONFLICT DO NOTHING;

-- Permissions pour Supervisor
INSERT INTO atlas.role_permissions (role_id, permission_id) VALUES
    ('supervisor', 'colab.missions.read'),
    ('supervisor', 'colab.missions.create'),
    ('supervisor', 'colab.missions.update'),
    ('supervisor', 'colab.missions.assign'),
    ('supervisor', 'colab.students.read'),
    ('supervisor', 'colab.students.create'),
    ('supervisor', 'colab.students.update'),
    ('supervisor', 'colab.supervisors.read'),
    ('supervisor', 'colab.field_logs.read'),
    ('supervisor', 'colab.field_logs.write'),
    ('supervisor', 'colab.field_logs.delete'),
    ('supervisor', 'colab.documents.read'),
    ('supervisor', 'colab.documents.upload'),
    ('supervisor', 'colab.documents.delete'),
    ('supervisor', 'colab.sondages.link'),
    ('supervisor', 'colab.sondages.unlink'),
    ('supervisor', 'tables.read'),
    ('supervisor', 'tables.write'),
    ('supervisor', 'schema.read'),
    ('supervisor', 'audit.read')
ON CONFLICT DO NOTHING;

COMMIT;
