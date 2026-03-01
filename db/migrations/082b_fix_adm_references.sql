-- ============================================================================
-- Migration 082b: Correction des références ADM
-- Utilise les vraies tables public.adm2 et public.adm3
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Recréer la fonction get_available_mailles_in_adm avec les bonnes tables
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
                    -- Jointure spatiale avec public.adm2
                    EXISTS (
                        SELECT 1 FROM public.adm2 adm2
                        WHERE adm2.adm2_pcode = p_adm_code
                        AND ST_Intersects(m.geom, adm2.geom)
                    )
                WHEN p_adm_niveau = 'ADM3' THEN 
                    -- Jointure spatiale avec public.adm3
                    EXISTS (
                        SELECT 1 FROM public.adm3 adm3
                        WHERE adm3.adm3_pcode = p_adm_code
                        AND ST_Intersects(m.geom, adm3.geom)
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
    'Retourne les mailles disponibles dans une zone ADM donnée (utilise public.adm2 et public.adm3)';

-- ============================================================================
-- Vérifications
-- ============================================================================
DO $$
DECLARE
    v_count_adm2 INTEGER;
    v_count_adm3 INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_adm2 FROM public.adm2;
    SELECT COUNT(*) INTO v_count_adm3 FROM public.adm3;
    
    RAISE NOTICE 'Migration 082b terminée.';
    RAISE NOTICE 'Données ADM2 disponibles: %', v_count_adm2;
    RAISE NOTICE 'Données ADM3 disponibles: %', v_count_adm3;
    
    IF v_count_adm2 = 0 OR v_count_adm3 = 0 THEN
        RAISE WARNING 'Attention: Certaines tables ADM sont vides!';
    END IF;
END $$;

COMMIT;
