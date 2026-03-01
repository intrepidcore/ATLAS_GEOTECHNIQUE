BEGIN;

-- 1) Cleanup one-shot: missions deleted => unassign all active assignments
UPDATE atlas.colab_mission_assignments cma
SET unassigned_at = NOW()
FROM atlas.colab_missions cm
WHERE cma.mission_id = cm.id
  AND cma.unassigned_at IS NULL
  AND cm.deleted_at IS NOT NULL;

-- 2) Trigger: when a mission is soft-deleted (deleted_at set), unassign active assignments
CREATE OR REPLACE FUNCTION atlas.on_colab_mission_soft_delete_unassign()
RETURNS trigger AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE atlas.colab_mission_assignments
    SET unassigned_at = NOW()
    WHERE mission_id = NEW.id
      AND unassigned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_colab_mission_soft_delete_unassign ON atlas.colab_missions;

CREATE TRIGGER trg_colab_mission_soft_delete_unassign
AFTER UPDATE OF deleted_at ON atlas.colab_missions
FOR EACH ROW
EXECUTE FUNCTION atlas.on_colab_mission_soft_delete_unassign();

COMMIT;
