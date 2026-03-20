-- ============================================================================
-- Migration 062: Atlas Colab - Collaboration (Phase 4)
-- Comments, Mentions, Notifications, Workflow de validation
-- ============================================================================

-- ============================================================================
-- 1. TYPES ENUM
-- ============================================================================

-- Type d'entité pour les commentaires
DO $$ BEGIN
    CREATE TYPE atlas.comment_entity_type AS ENUM (
        'mission',
        'sondage',
        'essai',
        'document'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Type de notification
DO $$ BEGIN
    CREATE TYPE atlas.notification_type AS ENUM (
        'comment_mention',
        'comment_reply',
        'comment_entity',
        'status_change',
        'mission_assigned',
        'sondage_validated',
        'document_uploaded',
        'deadline_reminder'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Statut de sondage (workflow de validation)
DO $$ BEGIN
    CREATE TYPE atlas.sondage_validation_status AS ENUM (
        'draft_field',       -- Brouillon terrain (saisi par étudiant)
        'pending_sync',      -- En attente de synchronisation
        'synced',            -- Synchronisé mais non validé
        'to_validate_lab',   -- À valider par le labo
        'validated',         -- Validé par encadrant
        'integrated',        -- Intégré dans la base finale
        'rejected'           -- Rejeté (à corriger)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. TABLE COMMENTAIRES
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entité liée
    entity_type atlas.comment_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Auteur
    author_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Contenu
    content TEXT NOT NULL,
    
    -- Fil de discussion (réponses)
    parent_comment_id UUID REFERENCES atlas.colab_comments(id) ON DELETE CASCADE,
    
    -- Métadonnées
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_colab_comments_entity ON atlas.colab_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_colab_comments_author ON atlas.colab_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_colab_comments_parent ON atlas.colab_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_colab_comments_created ON atlas.colab_comments(created_at DESC);

-- ============================================================================
-- 3. TABLE MENTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_comment_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES atlas.colab_comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_colab_mentions_user ON atlas.colab_comment_mentions(mentioned_user_id);

-- ============================================================================
-- 4. TABLE NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Destinataire
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Type et contenu
    notification_type atlas.notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    
    -- Données contextuelles
    payload JSONB DEFAULT '{}',
    
    -- Liens vers entités (optionnels)
    mission_id UUID REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    sondage_id UUID,  -- Pas de FK car sondages peut être dans public ou atlas
    comment_id UUID REFERENCES atlas.colab_comments(id) ON DELETE CASCADE,
    
    -- État
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_notifications_user ON atlas.colab_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_colab_notifications_created ON atlas.colab_notifications(created_at DESC);

-- ============================================================================
-- 5. HISTORIQUE DES STATUTS DE SONDAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_sondage_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id UUID NOT NULL,  -- Référence vers sondages (public ou atlas)
    
    old_status atlas.sondage_validation_status,
    new_status atlas.sondage_validation_status NOT NULL,
    
    changed_by UUID NOT NULL REFERENCES atlas.users(id),
    reason TEXT,  -- Raison du changement (optionnel)
    
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sondage_status_history ON atlas.colab_sondage_status_history(sondage_id, changed_at DESC);

-- ============================================================================
-- 6. AJOUT COLONNE STATUS SUR SONDAGES (si pas déjà présente)
-- ============================================================================

-- Ajouter la colonne validation_status à atlas.sondages si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'sondages') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'sondages' AND column_name = 'validation_status') THEN
            ALTER TABLE atlas.sondages ADD COLUMN validation_status atlas.sondage_validation_status DEFAULT 'synced';
        END IF;
        
        -- Ajouter mission_id si pas présent
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'sondages' AND column_name = 'mission_id') THEN
            ALTER TABLE atlas.sondages ADD COLUMN mission_id UUID REFERENCES atlas.colab_missions(id) ON DELETE SET NULL;
        END IF;
        
        -- Ajouter location_mode si pas présent
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'sondages' AND column_name = 'location_mode') THEN
            ALTER TABLE atlas.sondages ADD COLUMN location_mode TEXT DEFAULT 'manual' CHECK (location_mode IN ('manual', 'gps_field', 'geocoded'));
        END IF;
        
        -- Ajouter location_accuracy_m si pas présent
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'atlas' AND table_name = 'sondages' AND column_name = 'location_accuracy_m') THEN
            ALTER TABLE atlas.sondages ADD COLUMN location_accuracy_m REAL;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Trigger updated_at pour comments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = 'set_updated_at_colab_comments'
          AND n.nspname = 'atlas'
          AND c.relname = 'colab_comments'
    ) THEN
        CREATE TRIGGER set_updated_at_colab_comments
            BEFORE UPDATE ON atlas.colab_comments
            FOR EACH ROW
            EXECUTE FUNCTION atlas.update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- 8. VUES
-- ============================================================================

-- Vue des commentaires avec infos auteur
CREATE OR REPLACE VIEW atlas.v_colab_comments AS
SELECT 
    c.id,
    c.entity_type,
    c.entity_id,
    c.content,
    c.parent_comment_id,
    c.is_edited,
    c.created_at,
    c.updated_at,
    c.author_id,
    u.username AS author_username,
    u.email AS author_email,
    (SELECT COUNT(*) FROM atlas.colab_comments r WHERE r.parent_comment_id = c.id) AS replies_count
FROM atlas.colab_comments c
JOIN atlas.users u ON c.author_id = u.id;

-- Vue des notifications non lues par utilisateur
CREATE OR REPLACE VIEW atlas.v_colab_unread_notifications AS
SELECT 
    n.*,
    u.username,
    u.email
FROM atlas.colab_notifications n
JOIN atlas.users u ON n.user_id = u.id
WHERE n.is_read = false
ORDER BY n.created_at DESC;

-- ============================================================================
-- 9. PERMISSIONS
-- ============================================================================

-- Permissions pour les commentaires (format: id = resource.action)
INSERT INTO atlas.permissions (id, resource, action, description) VALUES
    ('colab.comments.read', 'colab.comments', 'read', 'Lire les commentaires'),
    ('colab.comments.write', 'colab.comments', 'write', 'Écrire des commentaires'),
    ('colab.comments.delete', 'colab.comments', 'delete', 'Supprimer des commentaires'),
    ('colab.comments.moderate', 'colab.comments', 'moderate', 'Modérer les commentaires'),
    ('colab.notifications.read', 'colab.notifications', 'read', 'Lire ses notifications'),
    ('colab.sondages.validate', 'colab.sondages', 'validate', 'Valider les sondages'),
    ('colab.sondages.integrate', 'colab.sondages', 'integrate', 'Intégrer les sondages validés')
ON CONFLICT (id) DO NOTHING;

-- Assigner aux rôles
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'admin' AND p.id IN (
    'colab.comments.read', 'colab.comments.write', 'colab.comments.delete', 
    'colab.comments.moderate', 'colab.notifications.read',
    'colab.sondages.validate', 'colab.sondages.integrate'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'supervisor' AND p.id IN (
    'colab.comments.read', 'colab.comments.write', 'colab.comments.delete',
    'colab.notifications.read', 'colab.sondages.validate'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'student' AND p.id IN (
    'colab.comments.read', 'colab.comments.write', 'colab.notifications.read'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name IN ('editor', 'geo_analyst', 'data_manager') AND p.id IN (
    'colab.comments.read', 'colab.comments.write', 'colab.notifications.read'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'viewer' AND p.id IN ('colab.comments.read', 'colab.notifications.read')
ON CONFLICT DO NOTHING;

COMMIT;
