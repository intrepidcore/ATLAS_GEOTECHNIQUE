BEGIN;

-- ============================================================================
-- Colab: vue canonique des attributions Mission -> Étudiant -> Maille
-- Source de vérité consommée par /api/colab/attributions*.
--
-- Objectif:
-- - éviter les 500 runtime (vue manquante)
-- - centraliser les JOINs et statuts de notification
-- ============================================================================

DROP VIEW IF EXISTS atlas.v_colab_mission_attributions;

CREATE VIEW atlas.v_colab_mission_attributions AS
SELECT
  -- Mission
  cm.id AS mission_id,
  cm.code AS mission_code,
  cm.title AS mission_title,
  cm.status::text AS mission_status,

  -- Maille
  m.id AS maille_id,
  m.code AS maille_code,

  -- Assignation mission (mission -> student)
  cma.id AS assignment_id,
  cma.student_id AS student_uuid,
  cma.assigned_at,
  cma.unassigned_at,
  (cma.unassigned_at IS NULL) AS is_active,

  -- Étudiant (id colab + identité user)
  cs.id::text AS student_id,
  COALESCE(
    NULLIF(BTRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
    NULLIF(BTRIM(CONCAT(u.last_name, ' ', u.first_name)), ''),
    u.username,
    u.email
  ) AS full_name,
  u.email,

  -- Attribution maille (maille -> student) si existante
  cmas.assignment_id AS maille_assignment_id,
  cmas.adm_code_used,
  cmas.pref_rank_used,

  -- Notification status: dernière ligne connue
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
 AND u.deleted_at IS NULL
LEFT JOIN atlas.colab_maille_assignments cmas
  ON cmas.maille_id = cm.maille_id
LEFT JOIN LATERAL (
  SELECT l.status, l.requested_at, l.sent_at, l.error
  FROM atlas.colab_maille_notification_logs l
  WHERE l.assignment_id = cmas.assignment_id
  ORDER BY l.requested_at DESC
  LIMIT 1
) n ON TRUE

WHERE cm.deleted_at IS NULL
  AND cm.maille_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app_user') THEN
    CREATE ROLE atlas_app_user LOGIN IN ROLE atlas_app;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_readonly_user') THEN
    CREATE ROLE atlas_readonly_user LOGIN IN ROLE atlas_readonly;
  END IF;
END
$$;

GRANT SELECT ON atlas.v_colab_mission_attributions TO atlas_app_user;
GRANT SELECT ON atlas.v_colab_mission_attributions TO atlas_readonly_user;

COMMIT;
