-- Migration 184 — Fix notification status lookup in v_colab_mission_attributions
-- Problème : la vue cherchait les notification_logs via colab_maille_assignments.assignment_id
--            mais cette table est vide pour les étudiants sans matricule (NULL).
--            L'email worker utilisait aussi colab_maille_assignments comme point d'entrée.
-- Correctif : faire pointer le JOIN LATERAL vers cma.id (colab_mission_assignments.id)
--             qui est toujours disponible et correspond aux IDs exposés par l'UI.
-- Appliqué par : PGPASSWORD=atlas psql -h host.docker.internal -p 5433 -U postgres -d atlas_clean

SET search_path = atlas, public;

-- La vue appartient à postgres, il faut être postgres pour la recréer
DROP VIEW IF EXISTS atlas.v_colab_mission_attributions CASCADE;

CREATE VIEW atlas.v_colab_mission_attributions AS
SELECT
    cm.id                                                                  AS mission_id,
    cm.code                                                                AS mission_code,
    cm.title                                                               AS mission_title,
    cm.status::text                                                        AS mission_status,
    m.id                                                                   AS maille_id,
    m.code                                                                 AS maille_code,
    cma.id                                                                 AS assignment_id,
    cma.student_id                                                         AS student_uuid,
    cma.assigned_at,
    cma.unassigned_at,
    (cma.unassigned_at IS NULL)                                            AS is_active,
    cs.id::text                                                            AS student_id,
    COALESCE(
        NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
        NULLIF(TRIM(u.last_name  || ' ' || u.first_name), ''),
        u.username::text,
        u.email::text
    )                                                                      AS full_name,
    u.email,
    -- Gardé pour compatibilité avec l'ancien code qui accède maille_assignment_id
    cmas.assignment_id                                                     AS maille_assignment_id,
    cmas.adm_code_used,
    cmas.pref_rank_used,
    -- Notification status : maintenant tracé via cma.id (colab_mission_assignments)
    n.status                                                               AS notification_status,
    n.requested_at                                                         AS notification_requested_at,
    n.sent_at                                                              AS notification_sent_at,
    n.error                                                                AS notification_error
FROM atlas.colab_missions cm
JOIN  atlas.mailles m            ON m.id  = cm.maille_id
LEFT JOIN atlas.colab_mission_assignments cma
                                 ON cma.mission_id = cm.id
                                AND cma.unassigned_at IS NULL
LEFT JOIN atlas.colab_students cs
                                 ON cs.id = cma.student_id
                                AND cs.deleted_at IS NULL
LEFT JOIN atlas.users u          ON u.id  = cs.user_id
                                AND u.deleted_at IS NULL
-- Gardé pour compatibilité (maille_assignment_id, adm_code_used, pref_rank_used)
LEFT JOIN atlas.colab_maille_assignments cmas
                                 ON cmas.maille_id = cm.maille_id
-- Notification : via cma.id au lieu de cmas.assignment_id
LEFT JOIN LATERAL (
    SELECT l.status, l.requested_at, l.sent_at, l.error
    FROM atlas.colab_maille_notification_logs l
    WHERE l.assignment_id = cma.id        -- ← FIX : était cmas.assignment_id
    ORDER BY l.requested_at DESC
    LIMIT 1
) n ON true
WHERE cm.deleted_at IS NULL
  AND cm.maille_id IS NOT NULL;

GRANT SELECT ON atlas.v_colab_mission_attributions TO atlas;
