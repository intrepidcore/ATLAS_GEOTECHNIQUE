-- ============================================================================
-- MIGRATION 123 : VUE CANONIQUE STATUT MAILLE (RÈGLES MÉTIER)
-- Objectif : Centraliser les règles métier "maille active" / "assigned" en DB
-- Référence : docs/REGLES_METIER.md (BM-01..)
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='atlas' AND table_name='mailles'
    ) THEN
        RAISE EXCEPTION 'Table atlas.mailles introuvable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='atlas' AND table_name='colab_missions'
    ) THEN
        RAISE EXCEPTION 'Table atlas.colab_missions introuvable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='atlas' AND table_name='colab_mission_assignments'
    ) THEN
        RAISE EXCEPTION 'Table atlas.colab_mission_assignments introuvable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='atlas' AND table_name='colab_maille_assignments'
    ) THEN
        RAISE EXCEPTION 'Table atlas.colab_maille_assignments introuvable';
    END IF;
END $$;

DROP VIEW IF EXISTS atlas.v_maille_status;

CREATE VIEW atlas.v_maille_status AS
SELECT
    m.id AS maille_id,
    m.code AS maille_code,
    m.geom,

    -- BM-01 : maille active si au moins 1 mission active
    CASE
        WHEN COUNT(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) > 0 THEN 'active'
        -- BM-02 : maille assigned si attribution explicite
        WHEN COUNT(ass.assignment_id) > 0 THEN 'assigned'
        ELSE 'free'
    END AS maille_status,

    -- Responsable (priorité mission active, sinon attribution explicite)
    COALESCE(
        MIN(cma.student_id::text) FILTER (WHERE cma.unassigned_at IS NULL),
        MIN(ass.student_id::text)
    ) AS responsible_student_id,

    COALESCE(
        MAX(cma.assigned_at) FILTER (WHERE cma.unassigned_at IS NULL),
        MAX(ass.assigned_at)
    ) AS responsible_assigned_at,

    CASE
        WHEN COUNT(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) > 0 THEN 'mission_active'
        WHEN COUNT(ass.assignment_id) > 0 THEN 'maille_assignment'
        ELSE NULL
    END AS responsible_source,

    -- Pour debug / stats
    COUNT(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) AS n_active_mission_assignments,
    COUNT(ass.assignment_id) AS n_explicit_maille_assignments
FROM atlas.mailles m
LEFT JOIN atlas.colab_missions cm
    ON cm.maille_id = m.id
LEFT JOIN atlas.colab_mission_assignments cma
    ON cma.mission_id = cm.id
LEFT JOIN atlas.colab_maille_assignments ass
    ON ass.maille_id = m.id
GROUP BY m.id, m.code, m.geom;

COMMIT;
