BEGIN;

-- ============================================================================
-- Fix grants for runtime role on schema public
--
-- Context:
-- - Some runtime endpoints read legacy/core tables in schema public.
-- - atlas_app_user must be able to SELECT these tables/views.
--
-- This migration is idempotent.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO atlas_app;
GRANT USAGE ON SCHEMA public TO atlas_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas_readonly;

GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO atlas_app;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO atlas_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO atlas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO atlas_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO atlas_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO atlas_readonly;

COMMIT;
