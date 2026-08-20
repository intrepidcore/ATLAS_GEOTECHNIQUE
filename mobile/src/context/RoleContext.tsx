import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { mobileApi, type MobileProfile } from '@/api/mobile';
import { repository } from '@/db/repository';
import { useAuth } from './AuthContext';

// Profil résolu côté serveur (ADR-MOBILE-005) — jamais de rôle en dur ici.
// Mis en cache local pour rester utilisable hors-ligne après le premier login.
const CACHE_KEY = 'mobile_profile_cache';

interface RoleContextValue {
  profile: MobileProfile | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const p = await mobileApi.getProfile();
      setProfile(p);
      await repository.setSetting(CACHE_KEY, JSON.stringify(p));
    } catch {
      const cached = await repository.getSetting(CACHE_KEY);
      if (cached) setProfile(JSON.parse(cached) as MobileProfile);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasPermission = useCallback(
    (permission: string) => profile?.permissions.includes(permission) ?? false,
    [profile]
  );

  return (
    <RoleContext.Provider value={{ profile, loading, hasPermission, refresh }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole doit être utilisé sous RoleProvider');
  return ctx;
}

export function usePermission(permission: string): boolean {
  return useRole().hasPermission(permission);
}
