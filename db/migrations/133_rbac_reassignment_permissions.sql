BEGIN;

-- Ajouter les permissions de réattribution
INSERT INTO atlas.permissions (id, resource, action, description)
VALUES
    (
        'colab.missions.reassign',
        'colab_missions',
        'reassign',
        'BM-18: Désassigner et réassigner une maille opérateur'
    ),
    (
        'colab.missions.unassign',
        'colab_missions',
        'unassign',
        'BM-18: Retirer une maille sans réassigner'
    ),
    (
        'colab.missions.manage',
        'colab_missions',
        'manage',
        'BM-18: Créer/modifier/supprimer des missions Colab'
    ),
    (
        'colab.mailles.view_active',
        'colab_mailles',
        'view_active',
        'BM-19: Voir les missions actives d\''une maille sur la carte'
    )
ON CONFLICT (id) DO NOTHING;

-- Assigner au rôle admin (toutes permissions colab.missions.* et colab.mailles.*)
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT 'admin', p.id
FROM atlas.permissions p
WHERE p.id LIKE 'colab.missions.%' OR p.id LIKE 'colab.mailles.%'
ON CONFLICT DO NOTHING;

-- Créer le rôle coordinator s'il n'existe pas
INSERT INTO atlas.roles (id, name, description, is_system)
VALUES (
    'coordinator',
    'Coordinateur',
    'Coordinateur terrain : gère les missions et attributions',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Assigner les permissions coordinator
INSERT INTO atlas.role_permissions (role_id, permission_id)
VALUES
    ('coordinator', 'colab.missions.reassign'),
    ('coordinator', 'colab.missions.unassign'),
    ('coordinator', 'colab.missions.manage'),
    ('coordinator', 'colab.mailles.view_active')
ON CONFLICT DO NOTHING;

-- Les students/viewers/editors peuvent seulement voir les missions actives
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, 'colab.mailles.view_active'
FROM atlas.roles r
WHERE r.id IN ('student', 'viewer', 'editor')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE atlas.permissions IS
    'Permissions RBAC. Format id: resource.action.\nBM-18/BM-19: colab.missions.* réserve les actions de réattribution aux admins/coordinateurs.';

COMMIT;
