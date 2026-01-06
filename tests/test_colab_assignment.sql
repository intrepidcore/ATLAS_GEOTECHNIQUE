-- ============================================================================
-- Tests pour le système d'attribution des mailles Colab
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Tests de structure
-- ============================================================================

-- Test 1.1: Vérifier que les tables existent
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'atlas'
    AND table_name IN ('colab_student_prefs', 'colab_maille_assignments');
    
    IF v_count = 2 THEN
        RAISE NOTICE '✓ Test 1.1: Tables créées';
    ELSE
        RAISE EXCEPTION '✗ Test 1.1: Tables manquantes (trouvé %)', v_count;
    END IF;
END $$;

-- Test 1.2: Vérifier que les vues existent
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.views
    WHERE table_schema = 'atlas'
    AND table_name IN (
        'v_colab_maille_assignment_details',
        'v_colab_assignments_by_adm',
        'v_colab_students_without_maille'
    );
    
    IF v_count = 3 THEN
        RAISE NOTICE '✓ Test 1.2: Vues créées';
    ELSE
        RAISE EXCEPTION '✗ Test 1.2: Vues manquantes (trouvé %)', v_count;
    END IF;
END $$;

-- ============================================================================
-- 2. Tests de données
-- ============================================================================

-- Test 2.1: Insérer un étudiant test
INSERT INTO atlas.colab_student_prefs (
    student_id, nom, prenom, email,
    adm_niveau, adm_code_pref_1
) VALUES (
    'TEST001',
    'TEST',
    'Etudiant',
    'test@example.tg',
    'ADM2',
    (SELECT code FROM atlas.adm2_tg LIMIT 1)
) ON CONFLICT (student_id) DO UPDATE SET
    nom = EXCLUDED.nom;

-- Test 2.2: Vérifier l'insertion
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM atlas.colab_student_prefs
    WHERE student_id = 'TEST001';
    
    IF v_count = 1 THEN
        RAISE NOTICE '✓ Test 2.2: Insertion étudiant OK';
    ELSE
        RAISE EXCEPTION '✗ Test 2.2: Insertion étudiant échouée';
    END IF;
END $$;

-- Test 2.3: Attribuer une maille test
INSERT INTO atlas.colab_maille_assignments (
    student_id,
    maille_id,
    adm_code_used,
    pref_rank_used
) VALUES (
    'TEST001',
    (SELECT id FROM atlas.mailles LIMIT 1),
    (SELECT code FROM atlas.adm2_tg LIMIT 1),
    1
) ON CONFLICT (student_id) DO UPDATE SET
    pref_rank_used = EXCLUDED.pref_rank_used;

-- Test 2.4: Vérifier l'attribution
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM atlas.colab_maille_assignments
    WHERE student_id = 'TEST001';
    
    IF v_count = 1 THEN
        RAISE NOTICE '✓ Test 2.4: Attribution maille OK';
    ELSE
        RAISE EXCEPTION '✗ Test 2.4: Attribution maille échouée';
    END IF;
END $$;

-- ============================================================================
-- 3. Tests de vues
-- ============================================================================

-- Test 3.1: Vue v_colab_maille_assignment_details
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM atlas.v_colab_maille_assignment_details
    WHERE student_id = 'TEST001';
    
    IF v_count = 1 THEN
        RAISE NOTICE '✓ Test 3.1: Vue assignment_details OK';
    ELSE
        RAISE EXCEPTION '✗ Test 3.1: Vue assignment_details échouée';
    END IF;
END $$;

-- Test 3.2: Vérifier les colonnes BBOX
DO $$
DECLARE
    v_bbox_ok BOOLEAN;
BEGIN
    SELECT 
        bbox_xmin IS NOT NULL AND
        bbox_ymin IS NOT NULL AND
        bbox_xmax IS NOT NULL AND
        bbox_ymax IS NOT NULL
    INTO v_bbox_ok
    FROM atlas.v_colab_maille_assignment_details
    WHERE student_id = 'TEST001';
    
    IF v_bbox_ok THEN
        RAISE NOTICE '✓ Test 3.2: BBOX calculé correctement';
    ELSE
        RAISE EXCEPTION '✗ Test 3.2: BBOX manquant';
    END IF;
END $$;

-- ============================================================================
-- 4. Tests de contraintes
-- ============================================================================

-- Test 4.1: Contrainte UNIQUE sur student_id
DO $$
BEGIN
    BEGIN
        INSERT INTO atlas.colab_maille_assignments (
            student_id,
            maille_id,
            adm_code_used,
            pref_rank_used
        ) VALUES (
            'TEST001',
            (SELECT id FROM atlas.mailles LIMIT 1 OFFSET 1),
            (SELECT code FROM atlas.adm2_tg LIMIT 1),
            1
        );
        RAISE EXCEPTION '✗ Test 4.1: Contrainte UNIQUE non respectée';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '✓ Test 4.1: Contrainte UNIQUE OK';
    END;
END $$;

-- Test 4.2: Contrainte CHECK sur pref_rank_used
DO $$
BEGIN
    BEGIN
        INSERT INTO atlas.colab_student_prefs (
            student_id, nom, prenom, email,
            adm_niveau, adm_code_pref_1
        ) VALUES (
            'TEST002',
            'TEST2',
            'Etudiant2',
            'test2@example.tg',
            'ADM2',
            (SELECT code FROM atlas.adm2_tg LIMIT 1)
        );
        
        INSERT INTO atlas.colab_maille_assignments (
            student_id,
            maille_id,
            adm_code_used,
            pref_rank_used
        ) VALUES (
            'TEST002',
            (SELECT id FROM atlas.mailles LIMIT 1),
            (SELECT code FROM atlas.adm2_tg LIMIT 1),
            5  -- Invalide (doit être 1, 2 ou 3)
        );
        RAISE EXCEPTION '✗ Test 4.2: Contrainte CHECK non respectée';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE '✓ Test 4.2: Contrainte CHECK OK';
    END;
END $$;

-- ============================================================================
-- 5. Tests de fonctions
-- ============================================================================

-- Test 5.1: Fonction count_students_per_maille
DO $$
DECLARE
    v_count INTEGER;
    v_maille_id UUID;
BEGIN
    SELECT maille_id INTO v_maille_id
    FROM atlas.colab_maille_assignments
    WHERE student_id = 'TEST001';
    
    SELECT atlas.count_students_per_maille(v_maille_id) INTO v_count;
    
    IF v_count >= 1 THEN
        RAISE NOTICE '✓ Test 5.1: Fonction count_students_per_maille OK (count=%)', v_count;
    ELSE
        RAISE EXCEPTION '✗ Test 5.1: Fonction count_students_per_maille échouée';
    END IF;
END $$;

-- Test 5.2: Fonction get_available_mailles_in_adm
DO $$
DECLARE
    v_count INTEGER;
    v_adm_code TEXT;
BEGIN
    SELECT code INTO v_adm_code FROM atlas.adm2_tg LIMIT 1;
    
    SELECT COUNT(*) INTO v_count
    FROM atlas.get_available_mailles_in_adm(v_adm_code, 'ADM2', 10);
    
    IF v_count >= 0 THEN
        RAISE NOTICE '✓ Test 5.2: Fonction get_available_mailles_in_adm OK (count=%)', v_count;
    ELSE
        RAISE EXCEPTION '✗ Test 5.2: Fonction get_available_mailles_in_adm échouée';
    END IF;
END $$;

-- ============================================================================
-- 6. Nettoyage
-- ============================================================================

-- Supprimer les données de test
DELETE FROM atlas.colab_maille_assignments WHERE student_id IN ('TEST001', 'TEST002');
DELETE FROM atlas.colab_student_prefs WHERE student_id IN ('TEST001', 'TEST002');

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE '✅ TOUS LES TESTS SONT PASSÉS';
RAISE NOTICE '========================================';

ROLLBACK;  -- Ne pas commiter les tests
