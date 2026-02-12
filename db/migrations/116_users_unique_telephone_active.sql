-- Prevent duplicate active phone numbers (soft-deleted accounts excluded)
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_unique_telephone_active
ON atlas.users (telephone)
WHERE deleted_at IS NULL
  AND telephone IS NOT NULL
  AND BTRIM(telephone) <> '';
