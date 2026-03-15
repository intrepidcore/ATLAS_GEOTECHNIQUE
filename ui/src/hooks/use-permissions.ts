import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Permission =
  | 'colab.missions.reassign'
  | 'colab.missions.unassign'
  | 'colab.missions.manage'
  | 'colab.mailles.view_active';

interface UsePermissionsReturn {
  can: (permission: Permission) => boolean;
  isAdmin: boolean;
  isCoordinator: boolean;
  roles: string[];
  permissions: string[];
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const isAdmin = roles.includes('admin');
  const isCoordinator = roles.includes('coordinator') || isAdmin;

  const can = (permission: Permission): boolean => {
    if (isAdmin) return true;

    // Si l'API expose les permissions, elles sont la source de vérité.
    // Fallback rôle -> permissions (défense en profondeur côté UI).
    if (permissions.includes(permission)) return true;

    if (permission === 'colab.mailles.view_active') return true;

    if (permission === 'colab.missions.reassign') return isCoordinator;
    if (permission === 'colab.missions.unassign') return isCoordinator;
    if (permission === 'colab.missions.manage') return isCoordinator;

    return false;
  };

  return { can, isAdmin, isCoordinator, roles, permissions };
}
