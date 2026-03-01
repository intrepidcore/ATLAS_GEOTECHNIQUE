-- Operational events log for mission workflows (conflict resolution, fixes, admin actions)

BEGIN;

CREATE TABLE IF NOT EXISTS atlas.colab_mission_operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL REFERENCES atlas.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS colab_mission_operational_events_mission_idx
  ON atlas.colab_mission_operational_events(mission_id, created_at DESC);

COMMIT;
