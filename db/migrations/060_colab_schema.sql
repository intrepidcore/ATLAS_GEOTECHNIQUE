-- ============================================================================
-- Migration 060: Schéma Atlas Colab
-- Tables pour la gestion des missions terrain, étudiants et encadreurs
-- ============================================================================

BEGIN;

-- ============================================================================
-- Table: atlas.colab_students
-- Métadonnées spécifiques aux étudiants (liées à atlas.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES atlas.users(id) ON DELETE CASCADE,
    matricule VARCHAR(50) UNIQUE,
    promotion VARCHAR(20) NOT NULL, -- ex: "2024-2025"
    filiere VARCHAR(100), -- ex: "Génie civil", "Géotechnique"
    etablissement VARCHAR(200), -- ex: "ENSI Lomé", "Université de Lomé"
    niveau VARCHAR(50), -- ex: "L3", "M1", "M2", "Doctorant"
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.colab_students IS 'Métadonnées étudiants pour Atlas Colab';
COMMENT ON COLUMN atlas.colab_students.promotion IS 'Année académique (ex: 2024-2025)';
COMMENT ON COLUMN atlas.colab_students.filiere IS 'Filière d''études';

CREATE INDEX IF NOT EXISTS idx_colab_students_user_id ON atlas.colab_students(user_id);
CREATE INDEX IF NOT EXISTS idx_colab_students_promotion ON atlas.colab_students(promotion);
CREATE INDEX IF NOT EXISTS idx_colab_students_etablissement ON atlas.colab_students(etablissement);

-- ============================================================================
-- Table: atlas.colab_supervisors
-- Métadonnées spécifiques aux encadreurs/superviseurs
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_supervisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES atlas.users(id) ON DELETE CASCADE,
    specialite VARCHAR(100), -- ex: "Géotechnique", "Hydraulique", "Structures"
    institution VARCHAR(200), -- ex: "CERME", "Université de Lomé"
    titre VARCHAR(100), -- ex: "Dr.", "Pr.", "Ing."
    departement VARCHAR(200),
    telephone VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.colab_supervisors IS 'Métadonnées encadreurs pour Atlas Colab';
COMMENT ON COLUMN atlas.colab_supervisors.specialite IS 'Domaine d''expertise';

CREATE INDEX IF NOT EXISTS idx_colab_supervisors_user_id ON atlas.colab_supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_colab_supervisors_institution ON atlas.colab_supervisors(institution);

-- ============================================================================
-- Type ENUM pour le thème de mission
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE atlas.mission_theme AS ENUM ('stabilisation', 'synthese', 'reconnaissance', 'etude_detaillee', 'controle');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Type ENUM pour le statut de mission
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE atlas.mission_status AS ENUM ('draft', 'planned', 'in_progress', 'completed', 'cancelled', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: atlas.colab_missions
-- Table centrale des missions terrain
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    code VARCHAR(50) NOT NULL UNIQUE, -- ex: "M-2025-LOME-001"
    title VARCHAR(200) NOT NULL,
    theme atlas.mission_theme NOT NULL DEFAULT 'reconnaissance',
    
    -- Localisation (lien avec mailles géographiques)
    maille_id UUID REFERENCES atlas.mailles(id) ON DELETE SET NULL,
    zone_label VARCHAR(200), -- Nom de zone personnalisé si différent de maille
    commune VARCHAR(100),
    region VARCHAR(100),
    
    -- Responsable
    supervisor_id UUID REFERENCES atlas.colab_supervisors(id) ON DELETE SET NULL,
    
    -- Planification
    expected_sondages INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    
    -- Statut
    status atlas.mission_status NOT NULL DEFAULT 'draft',
    
    -- Description
    description TEXT,
    objectifs TEXT,
    notes_internal TEXT, -- Notes internes (non visibles étudiants)
    
    -- Métadonnées
    created_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.colab_missions IS 'Missions terrain Atlas Colab';
COMMENT ON COLUMN atlas.colab_missions.code IS 'Code unique de mission (ex: M-2025-LOME-001)';
COMMENT ON COLUMN atlas.colab_missions.expected_sondages IS 'Nombre de sondages attendus';
COMMENT ON COLUMN atlas.colab_missions.notes_internal IS 'Notes internes non visibles par les étudiants';

CREATE INDEX IF NOT EXISTS idx_colab_missions_code ON atlas.colab_missions(code);
CREATE INDEX IF NOT EXISTS idx_colab_missions_theme ON atlas.colab_missions(theme);
CREATE INDEX IF NOT EXISTS idx_colab_missions_status ON atlas.colab_missions(status);
CREATE INDEX IF NOT EXISTS idx_colab_missions_maille_id ON atlas.colab_missions(maille_id);
CREATE INDEX IF NOT EXISTS idx_colab_missions_supervisor_id ON atlas.colab_missions(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_colab_missions_dates ON atlas.colab_missions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_colab_missions_created_by ON atlas.colab_missions(created_by);

-- ============================================================================
-- Table: atlas.colab_mission_assignments
-- Affectation des étudiants aux missions
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_mission_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES atlas.colab_students(id) ON DELETE CASCADE,
    
    -- Rôle dans la mission
    role VARCHAR(50) NOT NULL DEFAULT 'membre', -- chef_equipe, technicien, stagiaire, membre
    
    -- Période d'affectation
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ, -- NULL = toujours affecté
    
    -- Notes
    notes TEXT,
    
    -- Contrainte: un étudiant ne peut être affecté qu'une fois activement à une mission
    CONSTRAINT unique_active_assignment UNIQUE (mission_id, student_id, unassigned_at)
);

COMMENT ON TABLE atlas.colab_mission_assignments IS 'Affectations étudiants aux missions';
COMMENT ON COLUMN atlas.colab_mission_assignments.role IS 'Rôle: chef_equipe, technicien, stagiaire, membre';

CREATE INDEX IF NOT EXISTS idx_colab_assignments_mission ON atlas.colab_mission_assignments(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_assignments_student ON atlas.colab_mission_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_colab_assignments_active ON atlas.colab_mission_assignments(mission_id) WHERE unassigned_at IS NULL;

-- ============================================================================
-- Table: atlas.colab_mission_sondages
-- Liaison missions ↔ sondages géotechniques
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_mission_sondages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    sondage_id UUID NOT NULL REFERENCES atlas.sondages(id) ON DELETE CASCADE,
    
    -- Type de liaison
    role VARCHAR(50) DEFAULT 'principal', -- principal, supplementaire, validation, reference
    
    -- Métadonnées
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    linked_by UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
    notes TEXT,
    
    CONSTRAINT unique_mission_sondage UNIQUE (mission_id, sondage_id)
);

COMMENT ON TABLE atlas.colab_mission_sondages IS 'Liaison entre missions et sondages géotechniques';

CREATE INDEX IF NOT EXISTS idx_colab_mission_sondages_mission ON atlas.colab_mission_sondages(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_mission_sondages_sondage ON atlas.colab_mission_sondages(sondage_id);

-- ============================================================================
-- Type ENUM pour le type de log terrain
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE atlas.field_log_type AS ENUM ('note', 'incident', 'meteo', 'avancee', 'observation', 'probleme', 'decision');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: atlas.colab_field_logs
-- Journal de terrain (notes, incidents, météo, avancement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_field_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Liens optionnels vers données géotechniques
    sondage_id UUID REFERENCES atlas.sondages(id) ON DELETE SET NULL,
    echantillon_id UUID REFERENCES atlas.echantillons(id) ON DELETE SET NULL,
    
    -- Contenu du log
    log_type atlas.field_log_type NOT NULL DEFAULT 'note',
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Date/heure du log terrain
    title VARCHAR(200),
    content TEXT NOT NULL,
    
    -- Localisation (optionnel)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atlas.colab_field_logs IS 'Journal de terrain des missions';
COMMENT ON COLUMN atlas.colab_field_logs.log_date IS 'Date/heure effective du log sur le terrain';

CREATE INDEX IF NOT EXISTS idx_colab_field_logs_mission ON atlas.colab_field_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_field_logs_author ON atlas.colab_field_logs(author_id);
CREATE INDEX IF NOT EXISTS idx_colab_field_logs_sondage ON atlas.colab_field_logs(sondage_id);
CREATE INDEX IF NOT EXISTS idx_colab_field_logs_type ON atlas.colab_field_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_colab_field_logs_date ON atlas.colab_field_logs(log_date);

-- ============================================================================
-- Type ENUM pour le type de document
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE atlas.document_type AS ENUM (
        'rapport_intermediaire', 
        'rapport_final', 
        'fiche_terrain', 
        'annexe', 
        'photo', 
        'plan', 
        'coupe_geologique',
        'resultats_essais',
        'autre'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: atlas.colab_documents
-- Documents liés aux missions (rapports, fiches, annexes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Métadonnées document
    title VARCHAR(300) NOT NULL,
    document_type atlas.document_type NOT NULL DEFAULT 'autre',
    description TEXT,
    
    -- Fichier
    file_path TEXT NOT NULL, -- Chemin relatif dans le stockage
    file_name VARCHAR(300) NOT NULL, -- Nom original du fichier
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Liens optionnels vers données géotechniques
    sondage_id UUID REFERENCES atlas.sondages(id) ON DELETE SET NULL,
    
    -- Versioning simple
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

COMMENT ON TABLE atlas.colab_documents IS 'Documents liés aux missions Colab';
COMMENT ON COLUMN atlas.colab_documents.file_path IS 'Chemin relatif dans le système de stockage';

CREATE INDEX IF NOT EXISTS idx_colab_documents_mission ON atlas.colab_documents(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_documents_uploaded_by ON atlas.colab_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_colab_documents_type ON atlas.colab_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_colab_documents_sondage ON atlas.colab_documents(sondage_id);
CREATE INDEX IF NOT EXISTS idx_colab_documents_current ON atlas.colab_documents(mission_id) WHERE is_current = TRUE;

-- ============================================================================
-- Triggers pour updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.update_colab_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_colab_students_updated_at
    BEFORE UPDATE ON atlas.colab_students
    FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();

CREATE TRIGGER update_colab_supervisors_updated_at
    BEFORE UPDATE ON atlas.colab_supervisors
    FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();

CREATE TRIGGER update_colab_missions_updated_at
    BEFORE UPDATE ON atlas.colab_missions
    FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();

CREATE TRIGGER update_colab_field_logs_updated_at
    BEFORE UPDATE ON atlas.colab_field_logs
    FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();

-- ============================================================================
-- Vues utilitaires
-- ============================================================================

-- Vue: Missions avec statistiques
CREATE OR REPLACE VIEW atlas.v_colab_missions_summary AS
SELECT 
    m.id,
    m.code,
    m.title,
    m.theme::TEXT as theme,
    m.status::TEXT as status,
    m.maille_id,
    m.zone_label,
    m.commune,
    m.region,
    m.start_date,
    m.end_date,
    m.expected_sondages,
    m.description,
    m.created_at,
    m.updated_at,
    -- Superviseur
    s.id as supervisor_id,
    u_sup.username as supervisor_username,
    u_sup.first_name || ' ' || u_sup.last_name as supervisor_name,
    sup.specialite as supervisor_specialite,
    -- Créateur
    u_creator.username as created_by_username,
    -- Statistiques
    (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = m.id AND a.unassigned_at IS NULL) as assigned_students_count,
    (SELECT COUNT(*) FROM atlas.colab_mission_sondages ms WHERE ms.mission_id = m.id) as linked_sondages_count,
    (SELECT COUNT(*) FROM atlas.colab_field_logs fl WHERE fl.mission_id = m.id) as field_logs_count,
    (SELECT COUNT(*) FROM atlas.colab_documents d WHERE d.mission_id = m.id AND d.is_current = TRUE) as documents_count
FROM atlas.colab_missions m
LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
LEFT JOIN atlas.users u_sup ON s.user_id = u_sup.id
LEFT JOIN atlas.colab_supervisors sup ON s.id = sup.id
LEFT JOIN atlas.users u_creator ON m.created_by = u_creator.id;

COMMENT ON VIEW atlas.v_colab_missions_summary IS 'Vue résumée des missions avec statistiques';

-- Vue: Étudiants avec infos utilisateur
CREATE OR REPLACE VIEW atlas.v_colab_students AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    u.first_name || ' ' || u.last_name as full_name,
    s.matricule,
    s.promotion,
    s.filiere,
    s.etablissement,
    s.niveau,
    s.notes,
    s.created_at,
    u.is_active,
    (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions_count
FROM atlas.colab_students s
JOIN atlas.users u ON s.user_id = u.id;

COMMENT ON VIEW atlas.v_colab_students IS 'Vue étudiants avec infos utilisateur';

-- Vue: Superviseurs avec infos utilisateur
CREATE OR REPLACE VIEW atlas.v_colab_supervisors AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    s.titre || ' ' || u.first_name || ' ' || u.last_name as full_name_with_title,
    s.specialite,
    s.institution,
    s.titre,
    s.departement,
    s.telephone,
    s.notes,
    s.created_at,
    u.is_active,
    (SELECT COUNT(*) FROM atlas.colab_missions m WHERE m.supervisor_id = s.id) as missions_count
FROM atlas.colab_supervisors s
JOIN atlas.users u ON s.user_id = u.id;

COMMENT ON VIEW atlas.v_colab_supervisors IS 'Vue superviseurs avec infos utilisateur';

COMMIT;
