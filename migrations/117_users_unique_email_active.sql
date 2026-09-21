BEGIN;

ALTER TABLE atlas.users
  DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_active
  ON atlas.users (email)
  WHERE deleted_at IS NULL;

COMMIT;
