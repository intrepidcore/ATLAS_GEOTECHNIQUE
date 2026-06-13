-- Migration 141: Grant missing permissions to atlas user on email notification tables
-- Root cause: colab_email_jobs and colab_email_job_logs were created by postgres user
-- during FIX-01 (ALTER TABLE), not the atlas user. The atlas user was missing INSERT/SELECT.
-- Effect: log_job() calls silently failed (let _ = ...), notification logs not written.

GRANT SELECT, INSERT, UPDATE, DELETE ON atlas.colab_email_jobs TO atlas;
GRANT SELECT, INSERT, UPDATE, DELETE ON atlas.colab_email_job_logs TO atlas;
GRANT SELECT, INSERT, UPDATE ON atlas.colab_maille_notification_logs TO atlas;

-- Prevent future tables from having this issue
ALTER DEFAULT PRIVILEGES IN SCHEMA atlas FOR ROLE postgres
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas;
