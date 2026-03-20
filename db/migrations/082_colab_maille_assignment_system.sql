-- ============================================================================
-- Migration 082: Système d'attribution automatique des mailles Colab
-- Description:
--   1. Table de staging des préférences étudiants (colab_student_prefs)
--   2. Table d'assignation maille ↔ étudiant (colab_maille_assignments)
--   3. Vue consolidée pour génération PDF (v_colab_maille_assignment_details)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Table de staging des préférences étudiants
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_student_prefs (
    student_id          TEXT PRIMARY KEY,           -- Identifiant étudiant (matricule)
    user_id             UUID NULL,                  -- FK vers atlas.users (optionnel)
    nom                 TEXT NOT NULL,
    prenom              TEXT NOT NULL,
    telephone           TEXT,
    email               TEXT,
    
    -- Préférences de zone
    adm_niveau          TEXT CHECK (adm_niveau IN ('ADM2', 'ADM3')),
    adm_code_pref_1     TEXT NOT NULL,              -- Préférence 1 (obligatoire)
    adm_code_pref_2     TEXT,                       -- Préférence 2 (optionnel)
    adm_code_pref_3     TEXT,                       -- Préférence 3 (optionnel)
    
    commentaire         TEXT,
    
    -- Métadonnées
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT fk_colab_student_prefs_user 
        FOREIGN KEY (user_id) 
        REFERENCES atlas.users(id) 
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_colab_student_prefs_user_id 
    ON atlas.colab_student_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_colab_student_prefs_email 
    ON atlas.colab_student_prefs(email);
CREATE INDEX IF NOT EXISTS idx_colab_student_prefs_adm_niveau 
    ON atlas.colab_student_prefs(adm_niveau);

COMMENT ON TABLE atlas.colab_student_prefs IS 
    'Staging des préférences étudiants pour attribution des mailles Colab';
COMMENT ON COLUMN atlas.colab_student_prefs.adm_niveau IS 
    'Niveau administratif souhaité: ADM2 (préfecture) ou ADM3 (commune)';
COMMENT ON COLUMN atlas.colab_student_prefs.adm_code_pref_1 IS 
    'Code ADM de la préférence 1 (obligatoire)';

-- ============================================================================
-- 2. Table d'assignation maille ↔ étudiant
-- ============================================================================
CREATE TABLE IF NOT EXISTS atlas.colab_maille_assignments (
    assignment_id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id          TEXT NOT NULL,
    maille_id           UUID NOT NULL,              -- FK vers atlas.mailles
    
    -- Métadonnées d'attribution
    adm_code_used       TEXT NOT NULL,              -- Code ADM utilisé pour l'attribution
    pref_rank_used      INTEGER NOT NULL            -- Rang de préférence utilisé (1, 2 ou 3)
                        CHECK (pref_rank_used IN (1, 2, 3)),
    
    -- Métadonnées
    assigned_at         TIMESTAMPTZ DEFAULT NOW(),
    assigned_by         UUID,                       -- Qui a lancé l'attribution
    notes               TEXT,
    
    -- Contraintes
    CONSTRAINT fk_colab_maille_assignments_student 
        FOREIGN KEY (student_id) 
        REFERENCES atlas.colab_student_prefs(student_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_colab_maille_assignments_maille 
        FOREIGN KEY (maille_id) 
        REFERENCES atlas.mailles(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_colab_maille_assignments_assigned_by 
        FOREIGN KEY (assigned_by) 
        REFERENCES atlas.users(id) 
        ON DELETE SET NULL
);

-- Index unique : un étudiant = une seule maille
CREATE UNIQUE INDEX IF NOT EXISTS colab_maille_assignments_student_uidx
    ON atlas.colab_maille_assignments(student_id);

-- Index pour recherche par maille
CREATE INDEX IF NOT EXISTS idx_colab_maille_assignments_maille
    ON atlas.colab_maille_assignments(maille_id);

-- Index pour statistiques
CREATE INDEX IF NOT EXISTS idx_colab_maille_assignments_adm_code
    ON atlas.colab_maille_assignments(adm_code_used);

COMMENT ON TABLE atlas.colab_maille_assignments IS 
    'Attribution des mailles nationales aux étudiants Colab';
COMMENT ON COLUMN atlas.colab_maille_assignments.pref_rank_used IS 
    'Rang de préférence utilisé: 1=pref_1, 2=pref_2, 3=pref_3';

-- ============================================================================
-- 3. Vue consolidée pour génération PDF et affichage
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_colab_maille_assignment_details AS
SELECT
    -- Identifiants
    a.assignment_id,
    a.student_id,
    
    -- Infos étudiant
    s.nom,
    s.prenom,
    s.nom || ' ' || s.prenom AS full_name,
    s.telephone,
    s.email,
    s.adm_niveau,
    
    -- Préférences
    s.adm_code_pref_1,
    s.adm_code_pref_2,
    s.adm_code_pref_3,
    
    -- Attribution
    a.adm_code_used,
    a.pref_rank_used,
    a.assigned_at,
    
    -- Infos maille
    m.id AS maille_id,
    m.code AS maille_code,
    m.pref_code AS maille_pref_code,
    m.pref_name AS maille_pref_name,
    m.adm2_name AS maille_adm2_name,
    
    -- Géométrie et BBOX (pour génération PDF)
    m.geom,
    ST_XMin(m.geom) AS bbox_xmin,
    ST_YMin(m.geom) AS bbox_ymin,
    ST_XMax(m.geom) AS bbox_xmax,
    ST_YMax(m.geom) AS bbox_ymax,
    ST_X(ST_Centroid(m.geom)) AS centroid_x,
    ST_Y(ST_Centroid(m.geom)) AS centroid_y,
    
    -- Surface
    ST_Area(m.geom) / 1000000.0 AS area_km2,
    
    -- Lien vers user si existant
    s.user_id,
    u.username,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name
    
FROM atlas.colab_maille_assignments a
JOIN atlas.colab_student_prefs s ON s.student_id = a.student_id
JOIN atlas.mailles m ON m.id = a.maille_id
LEFT JOIN atlas.users u ON s.user_id = u.id;

COMMENT ON VIEW atlas.v_colab_maille_assignment_details IS 
    'Vue consolidée des attributions maille-étudiant avec toutes les infos pour PDF';

-- ============================================================================
-- 4. Vue statistiques par zone ADM
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_colab_assignments_by_adm AS
SELECT
    a.adm_code_used,
    s.adm_niveau,
    COUNT(DISTINCT a.student_id) AS nb_etudiants,
    COUNT(DISTINCT a.maille_id) AS nb_mailles_attribuees,
    MIN(a.assigned_at) AS first_assignment,
    MAX(a.assigned_at) AS last_assignment
FROM atlas.colab_maille_assignments a
JOIN atlas.colab_student_prefs s ON s.student_id = a.student_id
GROUP BY a.adm_code_used, s.adm_niveau
ORDER BY s.adm_niveau, nb_etudiants DESC;

COMMENT ON VIEW atlas.v_colab_assignments_by_adm IS 
    'Statistiques d''attribution par zone administrative';

-- ============================================================================
-- 5. Vue étudiants sans attribution
-- ============================================================================
CREATE OR REPLACE VIEW atlas.v_colab_students_without_maille AS
SELECT
    s.student_id,
    s.nom,
    s.prenom,
    s.email,
    s.telephone,
    s.adm_niveau,
    s.adm_code_pref_1,
    s.adm_code_pref_2,
    s.adm_code_pref_3,
    s.created_at
FROM atlas.colab_student_prefs s
LEFT JOIN atlas.colab_maille_assignments a ON a.student_id = s.student_id
WHERE a.assignment_id IS NULL
ORDER BY s.created_at;

COMMENT ON VIEW atlas.v_colab_students_without_maille IS 
    'Étudiants sans maille attribuée (pour suivi)';

-- ============================================================================
-- 6. Trigger pour updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_colab_student_prefs_updated_at ON atlas.colab_student_prefs;
CREATE TRIGGER update_colab_student_prefs_updated_at
    BEFORE UPDATE ON atlas.colab_student_prefs
    FOR EACH ROW 
    EXECUTE FUNCTION atlas.update_colab_updated_at();

-- ============================================================================
-- 7. Fonction utilitaire : compter les étudiants par maille
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.count_students_per_maille(p_maille_id UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
$$;

COMMENT ON FUNCTION atlas.count_students_per_maille IS 
    'Compte le nombre d''étudiants affectés à une maille donnée';

-- ============================================================================
-- 8. Fonction utilitaire : obtenir les mailles disponibles dans une zone ADM
-- ============================================================================
CREATE OR REPLACE FUNCTION atlas.get_available_mailles_in_adm(
    p_adm_code TEXT,
    p_adm_niveau TEXT,
    p_max_students_per_maille INTEGER DEFAULT 1
)
RETURNS TABLE (
    maille_id UUID,
    maille_code TEXT,
    current_students INTEGER,
    geom GEOMETRY
)
LANGUAGE SQL STABLE
AS $$
    WITH maille_counts AS (
        SELECT
            m.id,
            m.code,
            m.geom,
            COUNT(a.student_id) AS nb_students
        FROM atlas.mailles m
        LEFT JOIN atlas.colab_maille_assignments a ON a.maille_id = m.id
        WHERE 
            CASE 
                WHEN p_adm_niveau = 'ADM2' THEN m.pref_code = p_adm_code
                WHEN p_adm_niveau = 'ADM3' THEN 
                    -- Jointure spatiale avec adm3_tg pour ADM3
                    EXISTS (
                        SELECT 1 FROM atlas.adm3_tg adm3
                        WHERE adm3.code = p_adm_code
                        AND ST_Intersects(m.geom, ST_Transform(adm3.geom, 25231))
                    )
                ELSE FALSE
            END
        GROUP BY m.id, m.code, m.geom
        HAVING COUNT(a.student_id) < p_max_students_per_maille
    )
    SELECT 
        id AS maille_id,
        code AS maille_code,
        nb_students::INTEGER AS current_students,
        geom
    FROM maille_counts
    ORDER BY nb_students, RANDOM();
$$;

COMMENT ON FUNCTION atlas.get_available_mailles_in_adm IS 
    'Retourne les mailles disponibles dans une zone ADM donnée';

-- ============================================================================
-- Vérifications finales
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 082 terminée avec succès.';
    RAISE NOTICE 'Tables créées: colab_student_prefs, colab_maille_assignments';
    RAISE NOTICE 'Vues créées: v_colab_maille_assignment_details, v_colab_assignments_by_adm, v_colab_students_without_maille';
    RAISE NOTICE 'Fonctions créées: count_students_per_maille, get_available_mailles_in_adm';
END $$;

COMMIT;
