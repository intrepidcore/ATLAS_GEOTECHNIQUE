-- Synchronisation automatique des attributions de mailles (colab_maille_assignments)
-- à partir des missions (colab_missions) et des assignations de mission (colab_mission_assignments).

BEGIN;

-- 1) Contraintes: une seule attribution par maille (source-of-truth pour la carte)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'atlas'
      AND tablename = 'colab_maille_assignments'
      AND indexname = 'colab_maille_assignments_student_uidx'
  ) THEN
    EXECUTE 'DROP INDEX atlas.colab_maille_assignments_student_uidx';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'atlas'
      AND tablename = 'colab_maille_assignments'
      AND indexname = 'colab_maille_assignments_maille_uidx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX colab_maille_assignments_maille_uidx ON atlas.colab_maille_assignments(maille_id)';
  END IF;
END $$;

-- 2) Fonction: recalculer l'attribution d'une maille
CREATE OR REPLACE FUNCTION atlas.sync_colab_maille_assignment_for_maille(p_maille_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_uuid uuid;
  v_student_id text;
  v_assigned_at timestamptz;
  v_adm_code_used text;
BEGIN
  -- Dernière assignation active (unassigned_at IS NULL) sur une mission active (deleted_at IS NULL)
  SELECT
    cma.student_id,
    cma.assigned_at
  INTO v_student_uuid, v_assigned_at
  FROM atlas.colab_missions cm
  JOIN atlas.colab_mission_assignments cma
    ON cma.mission_id = cm.id
   AND cma.unassigned_at IS NULL
  WHERE cm.maille_id = p_maille_id
    AND cm.deleted_at IS NULL
  ORDER BY cma.assigned_at DESC
  LIMIT 1;

  IF v_student_uuid IS NULL THEN
    DELETE FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
    RETURN;
  END IF;

  -- colab_mission_assignments.student_id est un UUID (colab_students.id)
  -- colab_maille_assignments.student_id est un TEXT (FK vers colab_student_prefs.student_id), généralement le matricule
  SELECT cs.matricule
  INTO v_student_id
  FROM atlas.colab_students cs
  WHERE cs.id = v_student_uuid
    AND cs.deleted_at IS NULL;

  IF v_student_id IS NULL THEN
    DELETE FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
    RETURN;
  END IF;

  SELECT sp.adm_code_pref_1
  INTO v_adm_code_used
  FROM atlas.colab_student_prefs sp
  WHERE sp.student_id = v_student_id;

  IF v_adm_code_used IS NULL THEN
    -- Pas de prefs -> on ne peut pas insérer dans colab_maille_assignments (FK student_id)
    DELETE FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
    RETURN;
  END IF;

  INSERT INTO atlas.colab_maille_assignments (
    maille_id,
    student_id,
    adm_code_used,
    pref_rank_used,
    assigned_at,
    assigned_by,
    notes
  ) VALUES (
    p_maille_id,
    v_student_id,
    v_adm_code_used,
    1,
    COALESCE(v_assigned_at, now()),
    NULL,
    'sync: from colab_missions + colab_mission_assignments'
  )
  ON CONFLICT (maille_id) DO UPDATE
  SET
    student_id = EXCLUDED.student_id,
    adm_code_used = EXCLUDED.adm_code_used,
    pref_rank_used = EXCLUDED.pref_rank_used,
    assigned_at = EXCLUDED.assigned_at,
    assigned_by = EXCLUDED.assigned_by,
    notes = EXCLUDED.notes;
END;
$$;

-- 3) Fonction: recalculer depuis mission_id
CREATE OR REPLACE FUNCTION atlas.sync_colab_maille_assignment_for_mission(p_mission_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_maille_id uuid;
BEGIN
  SELECT maille_id
  INTO v_maille_id
  FROM atlas.colab_missions
  WHERE id = p_mission_id;

  IF v_maille_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM atlas.sync_colab_maille_assignment_for_maille(v_maille_id);
END;
$$;

-- 4) Trigger sur colab_mission_assignments
CREATE OR REPLACE FUNCTION atlas.trg_sync_maille_assignment_on_mission_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM atlas.sync_colab_maille_assignment_for_mission(OLD.mission_id);
  ELSE
    PERFORM atlas.sync_colab_maille_assignment_for_mission(NEW.mission_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_assignment_ins ON atlas.colab_mission_assignments;
DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_assignment_upd ON atlas.colab_mission_assignments;
DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_assignment_del ON atlas.colab_mission_assignments;

CREATE TRIGGER trg_sync_maille_assignment_on_mission_assignment_ins
AFTER INSERT ON atlas.colab_mission_assignments
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission_assignment();

CREATE TRIGGER trg_sync_maille_assignment_on_mission_assignment_upd
AFTER UPDATE OF student_id, unassigned_at, assigned_at, mission_id ON atlas.colab_mission_assignments
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission_assignment();

CREATE TRIGGER trg_sync_maille_assignment_on_mission_assignment_del
AFTER DELETE ON atlas.colab_mission_assignments
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission_assignment();

-- 5) Trigger sur colab_missions (maille_id / deleted_at)
CREATE OR REPLACE FUNCTION atlas.trg_sync_maille_assignment_on_mission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.maille_id IS NOT NULL THEN
      PERFORM atlas.sync_colab_maille_assignment_for_maille(OLD.maille_id);
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.maille_id IS NOT NULL AND OLD.maille_id IS DISTINCT FROM NEW.maille_id THEN
      PERFORM atlas.sync_colab_maille_assignment_for_maille(OLD.maille_id);
    END IF;
  END IF;

  IF NEW.maille_id IS NOT NULL THEN
    PERFORM atlas.sync_colab_maille_assignment_for_maille(NEW.maille_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_ins ON atlas.colab_missions;
DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_upd ON atlas.colab_missions;
DROP TRIGGER IF EXISTS trg_sync_maille_assignment_on_mission_del ON atlas.colab_missions;

CREATE TRIGGER trg_sync_maille_assignment_on_mission_ins
AFTER INSERT ON atlas.colab_missions
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission();

CREATE TRIGGER trg_sync_maille_assignment_on_mission_upd
AFTER UPDATE OF maille_id, deleted_at ON atlas.colab_missions
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission();

CREATE TRIGGER trg_sync_maille_assignment_on_mission_del
AFTER DELETE ON atlas.colab_missions
FOR EACH ROW EXECUTE FUNCTION atlas.trg_sync_maille_assignment_on_mission();

-- 6) Backfill: recalculer toutes les mailles ayant une mission active
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT DISTINCT cm.maille_id
    FROM atlas.colab_missions cm
    WHERE cm.deleted_at IS NULL
      AND cm.maille_id IS NOT NULL
  ) LOOP
    PERFORM atlas.sync_colab_maille_assignment_for_maille(r.maille_id);
  END LOOP;
END $$;

COMMIT;
