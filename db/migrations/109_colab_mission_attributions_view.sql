BEGIN;

CREATE OR REPLACE VIEW atlas.v_colab_mission_attributions AS
SELECT
  cm.id AS mission_id,
  cm.code AS mission_code,
  cm.title AS mission_title,
  cm.status::text AS mission_status,
  cm.maille_id,
  m.code AS maille_code,
  cma.student_id AS student_uuid,
  cs.matricule AS student_id,
  COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, cs.matricule) AS full_name,
  u.email,
  a.assignment_id,
  a.adm_code_used,
  a.pref_rank_used,
  a.assigned_at,
  n.status AS notification_status,
  n.requested_at AS notification_requested_at,
  n.sent_at AS notification_sent_at,
  n.error AS notification_error
FROM atlas.colab_missions cm
JOIN atlas.mailles m ON m.id = cm.maille_id
LEFT JOIN atlas.colab_mission_assignments cma
  ON cma.mission_id = cm.id
 AND cma.unassigned_at IS NULL
LEFT JOIN atlas.colab_students cs
  ON cs.id = cma.student_id
 AND cs.deleted_at IS NULL
LEFT JOIN atlas.users u
  ON u.id = cs.user_id
LEFT JOIN atlas.colab_maille_assignments a
  ON a.maille_id = cm.maille_id
 AND cs.id IS NOT NULL
 AND a.student_id = cs.id
LEFT JOIN atlas.v_colab_maille_notification_latest n
  ON n.assignment_id = a.assignment_id
WHERE cm.deleted_at IS NULL
  AND cm.maille_id IS NOT NULL;

COMMIT;
