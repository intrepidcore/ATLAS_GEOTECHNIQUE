-- Statut d'une maille : tenir compte de TOUTES les mailles d'une mission.
--
-- La vue ne rattachait une mission qu'à sa maille principale
-- (`colab_missions.maille_id`). Une mission couvrant plusieurs mailles n'en
-- colorait donc qu'une sur la carte ; les autres apparaissaient libres alors
-- qu'un opérateur y est envoyé — et le plan de sondage y est posé.
--
-- À appliquer avec le rôle `postgres` (propriétaire de la vue). L'endpoint
-- /coverage/mailles calcule déjà le statut corrigé de son côté ; cette
-- migration ramène la correction à la source, pour tous les autres lecteurs.
CREATE OR REPLACE VIEW atlas.v_maille_status AS
SELECT m.id AS maille_id,
    m.code AS maille_code,
    m.geom,
    CASE
        WHEN count(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) > 0 THEN 'active'::text
        WHEN count(ass.assignment_id) > 0 THEN 'assigned'::text
        ELSE 'free'::text
    END AS maille_status,
    COALESCE(min(cma.student_id::text) FILTER (WHERE cma.unassigned_at IS NULL),
             min(ass.student_id::text)) AS responsible_student_id,
    COALESCE(max(cma.assigned_at) FILTER (WHERE cma.unassigned_at IS NULL),
             max(ass.assigned_at)) AS responsible_assigned_at,
    CASE
        WHEN count(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) > 0 THEN 'mission_active'::text
        WHEN count(ass.assignment_id) > 0 THEN 'maille_assignment'::text
        ELSE NULL::text
    END AS responsible_source,
    count(cma.id) FILTER (WHERE cma.unassigned_at IS NULL) AS n_active_mission_assignments,
    count(ass.assignment_id) AS n_explicit_maille_assignments
FROM atlas.mailles m
    LEFT JOIN atlas.v_mission_mailles vmm ON vmm.maille_id = m.id
    LEFT JOIN atlas.colab_mission_assignments cma ON cma.mission_id = vmm.mission_id
    LEFT JOIN atlas.colab_maille_assignments ass ON ass.maille_id = m.id
GROUP BY m.id, m.code, m.geom;
