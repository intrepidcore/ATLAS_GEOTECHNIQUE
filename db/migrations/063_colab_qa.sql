-- ============================================================================
-- Migration 063: Atlas Colab - Q&A / Base de connaissances (Phase 5)
-- Questions, Réponses, Tags, Gamification
-- ============================================================================

-- ============================================================================
-- 1. TABLE TAGS
-- ============================================================================

CREATE TABLE atlas.colab_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,  -- Version URL-friendly
    description TEXT,
    color TEXT DEFAULT '#6B7280',  -- Couleur pour l'affichage
    usage_count INTEGER DEFAULT 0,  -- Compteur d'utilisation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags initiaux
INSERT INTO atlas.colab_tags (name, slug, description, color) VALUES
    ('Sol gonflant', 'sol-gonflant', 'Questions relatives aux sols gonflants et expansifs', '#EF4444'),
    ('Atterberg', 'atterberg', 'Limites d''Atterberg et plasticité', '#F59E0B'),
    ('Proctor', 'proctor', 'Essais Proctor et compactage', '#10B981'),
    ('Granulométrie', 'granulometrie', 'Analyse granulométrique', '#3B82F6'),
    ('Classification GTR', 'classification-gtr', 'Classification des sols selon GTR', '#8B5CF6'),
    ('Stabilisation', 'stabilisation', 'Techniques de stabilisation des sols', '#EC4899'),
    ('Fondations', 'fondations', 'Fondations et portance', '#14B8A6'),
    ('Terrassement', 'terrassement', 'Travaux de terrassement', '#F97316'),
    ('Hydrogéologie', 'hydrogeologie', 'Nappes et eaux souterraines', '#06B6D4'),
    ('Sismique', 'sismique', 'Risques sismiques et liquéfaction', '#DC2626'),
    ('Méthodologie', 'methodologie', 'Méthodes de travail et bonnes pratiques', '#6366F1'),
    ('Équipement', 'equipement', 'Matériel et équipements de terrain', '#84CC16');

-- ============================================================================
-- 2. TABLE QUESTIONS
-- ============================================================================

CREATE TABLE atlas.colab_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contenu
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    
    -- Auteur
    author_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Liens contextuels (optionnels)
    mission_id UUID REFERENCES atlas.colab_missions(id) ON DELETE SET NULL,
    sondage_id UUID,  -- Pas de FK stricte
    maille_id UUID,   -- Référence vers mailles
    essai_id UUID,    -- Référence vers essais
    
    -- État et scores
    is_closed BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,  -- Question épinglée
    score INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    answers_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES atlas.users(id)
);

CREATE INDEX idx_colab_questions_author ON atlas.colab_questions(author_id);
CREATE INDEX idx_colab_questions_mission ON atlas.colab_questions(mission_id);
CREATE INDEX idx_colab_questions_score ON atlas.colab_questions(score DESC);
CREATE INDEX idx_colab_questions_created ON atlas.colab_questions(created_at DESC);
CREATE INDEX idx_colab_questions_search ON atlas.colab_questions USING gin(to_tsvector('french', title || ' ' || body));

-- ============================================================================
-- 3. TABLE QUESTION_TAGS (relation N:N)
-- ============================================================================

CREATE TABLE atlas.colab_question_tags (
    question_id UUID NOT NULL REFERENCES atlas.colab_questions(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES atlas.colab_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

CREATE INDEX idx_question_tags_tag ON atlas.colab_question_tags(tag_id);

-- ============================================================================
-- 4. TABLE RÉPONSES
-- ============================================================================

CREATE TABLE atlas.colab_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Question parente
    question_id UUID NOT NULL REFERENCES atlas.colab_questions(id) ON DELETE CASCADE,
    
    -- Auteur
    author_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Contenu
    body TEXT NOT NULL,
    
    -- État
    is_best BOOLEAN DEFAULT false,  -- Meilleure réponse
    is_accepted BOOLEAN DEFAULT false,  -- Acceptée par l'auteur de la question
    score INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_colab_answers_question ON atlas.colab_answers(question_id);
CREATE INDEX idx_colab_answers_author ON atlas.colab_answers(author_id);
CREATE INDEX idx_colab_answers_best ON atlas.colab_answers(question_id, is_best) WHERE is_best = true;

-- ============================================================================
-- 5. TABLE VOTES
-- ============================================================================

CREATE TABLE atlas.colab_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Votant
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Cible du vote
    target_type TEXT NOT NULL CHECK (target_type IN ('question', 'answer')),
    target_id UUID NOT NULL,
    
    -- Vote (+1 ou -1)
    vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_colab_votes_target ON atlas.colab_votes(target_type, target_id);

-- ============================================================================
-- 6. TABLE STATISTIQUES UTILISATEUR (Gamification)
-- ============================================================================

CREATE TABLE atlas.colab_user_stats (
    user_id UUID PRIMARY KEY REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Compteurs
    questions_count INTEGER DEFAULT 0,
    answers_count INTEGER DEFAULT 0,
    best_answers_count INTEGER DEFAULT 0,
    accepted_answers_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    -- Points de réputation
    reputation_points INTEGER DEFAULT 0,
    
    -- Badges (stockés en JSONB)
    badges JSONB DEFAULT '[]',
    
    -- Activité
    last_question_at TIMESTAMPTZ,
    last_answer_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. TABLE BADGES
-- ============================================================================

CREATE TABLE atlas.colab_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,  -- Emoji ou nom d'icône
    category TEXT CHECK (category IN ('bronze', 'silver', 'gold', 'platinum')),
    points INTEGER DEFAULT 0,  -- Points accordés
    condition_type TEXT,  -- Type de condition (questions_count, answers_count, etc.)
    condition_value INTEGER,  -- Valeur seuil
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges initiaux
INSERT INTO atlas.colab_badges (code, name, description, icon, category, points, condition_type, condition_value) VALUES
    ('first_question', 'Curieux', 'A posé sa première question', '❓', 'bronze', 10, 'questions_count', 1),
    ('first_answer', 'Contributeur', 'A donné sa première réponse', '💬', 'bronze', 10, 'answers_count', 1),
    ('helpful', 'Utile', 'A reçu 5 votes positifs', '👍', 'bronze', 25, 'reputation_points', 50),
    ('teacher', 'Pédagogue', 'A 3 meilleures réponses', '🎓', 'silver', 50, 'best_answers_count', 3),
    ('expert', 'Expert', 'A 10 meilleures réponses', '🏆', 'gold', 100, 'best_answers_count', 10),
    ('prolific', 'Prolifique', 'A posé 25 questions', '📚', 'silver', 50, 'questions_count', 25),
    ('guru', 'Gourou', 'A 500 points de réputation', '⭐', 'gold', 100, 'reputation_points', 500),
    ('legend', 'Légende', 'A 1000 points de réputation', '🌟', 'platinum', 200, 'reputation_points', 1000);

-- ============================================================================
-- 8. TABLE USER_BADGES (relation N:N)
-- ============================================================================

CREATE TABLE atlas.colab_user_badges (
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES atlas.colab_badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Trigger updated_at pour questions
CREATE TRIGGER set_updated_at_colab_questions
    BEFORE UPDATE ON atlas.colab_questions
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- Trigger updated_at pour answers
CREATE TRIGGER set_updated_at_colab_answers
    BEFORE UPDATE ON atlas.colab_answers
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- Trigger updated_at pour user_stats
CREATE TRIGGER set_updated_at_colab_user_stats
    BEFORE UPDATE ON atlas.colab_user_stats
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- Fonction pour mettre à jour le compteur de réponses
CREATE OR REPLACE FUNCTION atlas.update_question_answers_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE atlas.colab_questions SET answers_count = answers_count + 1 WHERE id = NEW.question_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE atlas.colab_questions SET answers_count = answers_count - 1 WHERE id = OLD.question_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_answers_count
    AFTER INSERT OR DELETE ON atlas.colab_answers
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_question_answers_count();

-- Fonction pour mettre à jour le compteur d'utilisation des tags
CREATE OR REPLACE FUNCTION atlas.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE atlas.colab_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE atlas.colab_tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tag_usage
    AFTER INSERT OR DELETE ON atlas.colab_question_tags
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_tag_usage_count();

-- ============================================================================
-- 10. VUES
-- ============================================================================

-- Vue des questions avec infos complètes
CREATE OR REPLACE VIEW atlas.v_colab_questions AS
SELECT 
    q.id,
    q.title,
    q.body,
    q.author_id,
    u.username AS author_username,
    q.mission_id,
    m.title AS mission_title,
    q.is_closed,
    q.is_pinned,
    q.score,
    q.views_count,
    q.answers_count,
    q.created_at,
    q.updated_at,
    (SELECT array_agg(t.name) FROM atlas.colab_question_tags qt 
     JOIN atlas.colab_tags t ON qt.tag_id = t.id 
     WHERE qt.question_id = q.id) AS tags,
    EXISTS(SELECT 1 FROM atlas.colab_answers a WHERE a.question_id = q.id AND a.is_best = true) AS has_best_answer
FROM atlas.colab_questions q
JOIN atlas.users u ON q.author_id = u.id
LEFT JOIN atlas.colab_missions m ON q.mission_id = m.id;

-- Vue des réponses avec infos auteur
CREATE OR REPLACE VIEW atlas.v_colab_answers AS
SELECT 
    a.id,
    a.question_id,
    a.body,
    a.author_id,
    u.username AS author_username,
    a.is_best,
    a.is_accepted,
    a.score,
    a.created_at,
    a.updated_at,
    us.reputation_points AS author_reputation
FROM atlas.colab_answers a
JOIN atlas.users u ON a.author_id = u.id
LEFT JOIN atlas.colab_user_stats us ON a.author_id = us.user_id;

-- Vue du leaderboard
CREATE OR REPLACE VIEW atlas.v_colab_leaderboard AS
SELECT 
    us.user_id,
    u.username,
    u.email,
    us.reputation_points,
    us.questions_count,
    us.answers_count,
    us.best_answers_count,
    us.last_active_at,
    (SELECT COUNT(*) FROM atlas.colab_user_badges ub WHERE ub.user_id = us.user_id) AS badges_count
FROM atlas.colab_user_stats us
JOIN atlas.users u ON us.user_id = u.id
ORDER BY us.reputation_points DESC;

-- ============================================================================
-- 11. PERMISSIONS
-- ============================================================================

INSERT INTO atlas.permissions (id, resource, action, description) VALUES
    ('colab.questions.read', 'colab.questions', 'read', 'Lire les questions'),
    ('colab.questions.create', 'colab.questions', 'create', 'Créer des questions'),
    ('colab.questions.update', 'colab.questions', 'update', 'Modifier ses questions'),
    ('colab.questions.delete', 'colab.questions', 'delete', 'Supprimer des questions'),
    ('colab.questions.close', 'colab.questions', 'close', 'Fermer des questions'),
    ('colab.questions.pin', 'colab.questions', 'pin', 'Épingler des questions'),
    ('colab.answers.read', 'colab.answers', 'read', 'Lire les réponses'),
    ('colab.answers.create', 'colab.answers', 'create', 'Créer des réponses'),
    ('colab.answers.update', 'colab.answers', 'update', 'Modifier ses réponses'),
    ('colab.answers.delete', 'colab.answers', 'delete', 'Supprimer des réponses'),
    ('colab.answers.mark_best', 'colab.answers', 'mark_best', 'Marquer comme meilleure réponse'),
    ('colab.votes.create', 'colab.votes', 'create', 'Voter sur questions/réponses'),
    ('colab.tags.manage', 'colab.tags', 'manage', 'Gérer les tags')
ON CONFLICT (id) DO NOTHING;

-- Assigner aux rôles
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'admin' AND p.id LIKE 'colab.questions.%' OR p.id LIKE 'colab.answers.%' OR p.id LIKE 'colab.votes.%' OR p.id LIKE 'colab.tags.%'
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'supervisor' AND p.id IN (
    'colab.questions.read', 'colab.questions.create', 'colab.questions.update', 'colab.questions.close',
    'colab.answers.read', 'colab.answers.create', 'colab.answers.update', 'colab.answers.mark_best',
    'colab.votes.create'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'student' AND p.id IN (
    'colab.questions.read', 'colab.questions.create', 'colab.questions.update',
    'colab.answers.read', 'colab.answers.create', 'colab.answers.update',
    'colab.votes.create'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name IN ('editor', 'geo_analyst', 'data_manager', 'viewer') AND p.id IN (
    'colab.questions.read', 'colab.answers.read'
)
ON CONFLICT DO NOTHING;

COMMIT;
