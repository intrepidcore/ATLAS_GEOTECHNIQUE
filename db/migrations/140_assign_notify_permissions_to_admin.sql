-- Migration 140: Assign colab.notify permissions to admin, coordinator, and supervisor roles
-- These permissions were created (FIX-01 in AUDIT_COLAB_STUDIO_2026-06-11) but never
-- assigned to any role, making the /api/colab/attributions/notify endpoint unreachable (403).
--
-- Rules:
--   admin       -> all colab.notify permissions (full control)
--   coordinator -> colab.notify.create + colab.notify.read (can trigger notifications)
--   supervisor  -> colab.notify.read only (can monitor)

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    ('admin',       'colab.notify.create'),
    ('admin',       'colab.notify.read'),
    ('coordinator', 'colab.notify.create'),
    ('coordinator', 'colab.notify.read'),
    ('supervisor',  'colab.notify.read')
) AS assignments(role_name, perm_name)
JOIN atlas.roles r       ON r.id = assignments.role_name
JOIN atlas.permissions p ON p.id = assignments.perm_name
WHERE NOT EXISTS (
    SELECT 1
    FROM atlas.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
