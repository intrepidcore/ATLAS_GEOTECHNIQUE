BEGIN;

ALTER TABLE atlas.colab_missions
  ADD COLUMN IF NOT EXISTS ex_maille_code TEXT,
  ADD COLUMN IF NOT EXISTS reassigned_from UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'atlas'
      AND t.relname = 'colab_missions'
      AND c.conname = 'colab_missions_reassigned_from_fkey'
  ) THEN
    ALTER TABLE atlas.colab_missions
      ADD CONSTRAINT colab_missions_reassigned_from_fkey
      FOREIGN KEY (reassigned_from) REFERENCES atlas.colab_missions(id);
  END IF;
END $$;

CREATE OR REPLACE VIEW atlas.v_operator_mission_history AS
SELECT
  cs.id AS student_id,
  COALESCE(NULLIF(BTRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS operateur,
  cm.id AS mission_id,
  cm.code AS mission_code,
  m.code AS maille_actuelle,
  cm.ex_maille_code,
  (cm.deleted_at IS NULL) AS is_active,
  cma.assigned_at,
  cma.unassigned_at,
  cm.reassigned_from,
  cm.notes_internal
FROM atlas.colab_students cs
JOIN atlas.users u ON u.id = cs.user_id
JOIN atlas.colab_mission_assignments cma ON cma.student_id = cs.id
JOIN atlas.colab_missions cm ON cm.id = cma.mission_id
LEFT JOIN atlas.mailles m ON m.id = cm.maille_id
ORDER BY cs.id, cma.assigned_at DESC;

COMMIT;
