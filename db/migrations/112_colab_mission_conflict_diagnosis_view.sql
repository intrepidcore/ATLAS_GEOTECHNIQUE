-- Diagnostic view for mission/mail assignment conflicts
-- A "real conflict" exists when the mission's primary active student differs from the current maille holder.

CREATE OR REPLACE VIEW atlas.v_colab_mission_conflict_diagnosis AS
WITH mission_primary_student AS (
  SELECT
    m.id AS mission_id,
    m.maille_id,
    a.student_id AS mission_student_id,
    a.assigned_at AS mission_assigned_at
  FROM atlas.colab_missions m
  JOIN atlas.colab_mission_assignments a
    ON a.mission_id = m.id
   AND a.unassigned_at IS NULL
  WHERE m.deleted_at IS NULL
    AND m.maille_id IS NOT NULL
),
maille_holder AS (
  SELECT DISTINCT ON (ma.maille_id)
    ma.maille_id,
    ma.student_id AS holder_student_id,
    ma.assigned_at AS holder_assigned_at,
    ma.assignment_id AS holder_assignment_id
  FROM atlas.colab_maille_assignments ma
  ORDER BY ma.maille_id, ma.assigned_at DESC
),
holder_user AS (
  SELECT
    cs.id AS student_id,
    u.email,
    COALESCE(NULLIF(BTRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS name
  FROM atlas.colab_students cs
  JOIN atlas.users u ON u.id = cs.user_id
  WHERE cs.deleted_at IS NULL
),
mission_user AS (
  SELECT
    cs.id AS student_id,
    u.email,
    COALESCE(NULLIF(BTRIM(u.first_name || ' ' || u.last_name), ''), u.username, u.email) AS name
  FROM atlas.colab_students cs
  JOIN atlas.users u ON u.id = cs.user_id
  WHERE cs.deleted_at IS NULL
)
SELECT
  mps.mission_id,
  mps.maille_id,
  mps.mission_student_id,
  mu.email AS mission_student_email,
  mu.name AS mission_student_name,
  mh.holder_student_id,
  hu.email AS holder_student_email,
  hu.name AS holder_student_name,
  mh.holder_assigned_at,
  (mh.holder_student_id IS NOT NULL AND mps.mission_student_id IS NOT NULL AND mh.holder_student_id <> mps.mission_student_id) AS is_real_conflict
FROM mission_primary_student mps
LEFT JOIN maille_holder mh ON mh.maille_id = mps.maille_id
LEFT JOIN holder_user hu ON hu.student_id = mh.holder_student_id
LEFT JOIN mission_user mu ON mu.student_id = mps.mission_student_id;
