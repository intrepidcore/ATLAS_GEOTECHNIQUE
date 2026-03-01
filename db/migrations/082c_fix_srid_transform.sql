-- ============================================================================
-- Migration 082c: Correction transformation SRID
-- Les tables public.adm2 et public.adm3 sont en SRID 4326
-- Les mailles sont en SRID 25231
-- ============================================================================

BEGIN;

-- ============================================================================
-- Recréer la fonction avec transformation SRID correcte
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
                WHEN p_adm_niveau = 'ADM2' THEN 
                    -- Jointure spatiale avec public.adm2 (transformation 4326 -> 25231)
                    EXISTS (
                        SELECT 1 FROM public.adm2 adm2
                        WHERE adm2.adm2_pcode = p_adm_code
                        AND ST_Intersects(m.geom, ST_Transform(adm2.geom, 25231))
                    )
                WHEN p_adm_niveau = 'ADM3' THEN 
                    -- Jointure spatiale avec public.adm3 (transformation 4326 -> 25231)
                    EXISTS (
                        SELECT 1 FROM public.adm3 adm3
                        WHERE adm3.adm3_pcode = p_adm_code
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
    'Retourne les mailles disponibles dans une zone ADM donnée (avec transformation SRID 4326->25231)';

-- ============================================================================
-- Test de la fonction
-- ============================================================================
DO $$
DECLARE
    v_test_count INTEGER;
    v_adm2_code TEXT;
BEGIN
    -- Récupérer un code ADM2 de test
    SELECT adm2_pcode INTO v_adm2_code FROM public.adm2 LIMIT 1;
    
    -- Tester la fonction
    SELECT COUNT(*) INTO v_test_count
    FROM atlas.get_available_mailles_in_adm(v_adm2_code, 'ADM2', 10);
    
    RAISE NOTICE 'Migration 082c terminée.';
    RAISE NOTICE 'Test avec code ADM2 %: % mailles trouvées', v_adm2_code, v_test_count;
    
    IF v_test_count = 0 THEN
        RAISE WARNING 'Aucune maille trouvée - vérifier les géométries';
    END IF;
END $$;

COMMIT;
