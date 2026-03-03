/**
 * AuthContext - Contexte d'authentification global pour Atlas
 * 
 * Gère l'état d'authentification pour toute l'application (Web + PWA)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getApiBase } from '../api-base';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'atlas_auth';
const API_BASE_URL = getApiBase();

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================================
// Storage helpers
// ============================================================================

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt: number;
}

function saveAuthToStorage(data: StoredAuth): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save auth to storage:', e);
  }
}

function loadAuthFromStorage(): StoredAuth | null {
  try {
    // Essayer d'abord la clé principale
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StoredAuth = JSON.parse(stored);
      
      // Vérifier si le token n'est pas expiré (avec 5 min de marge)
      if (data.expiresAt > Date.now() + 5 * 60 * 1000) {
        return data;
      }
    }
    
    // Fallback sur les clés individuelles (compatibilité avec tokenStorage)
    const token = localStorage.getItem('atlas_token') || localStorage.getItem('atlas_access_token');
    const refreshToken = localStorage.getItem('atlas_refresh_token');
    const userStr = localStorage.getItem('atlas_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return {
          accessToken: token,
          refreshToken: refreshToken || '',
          user,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Assume 24h si pas d'info
        };
      } catch {}
    }
    
    return null;
  } catch (e) {
    console.error('Failed to load auth from storage:', e);
    return null;
  }
}

function clearAuthFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Nettoyer toutes les clés d'authentification
    localStorage.removeItem('atlas_token');
    localStorage.removeItem('atlas_access_token');
    localStorage.removeItem('atlas_refresh_token');
    localStorage.removeItem('atlas_user');
  } catch (e) {
    console.error('Failed to clear auth from storage:', e);
  }
}

// ============================================================================
// API helpers
// ============================================================================

async function apiLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur de connexion' }));
    throw new Error(error.error || error.message || 'Identifiants incorrects');
  }

  return response.json();
}

async function apiRefreshToken(refreshToken: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Session expirée');
  }

  return response.json();
}

async function apiGetMe(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Session invalide');
  }

  const data = await response.json();
  return data.user || data;
}

// ============================================================================
// Provider
// ============================================================================

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restaurer la session au démarrage
  useEffect(() => {
    const restoreSession = async () => {
      const stored = loadAuthFromStorage();
      
      if (stored) {
        // Valider le token avec /auth/me
        try {
          const user = await apiGetMe(stored.accessToken);
          setState({
            user,
            accessToken: stored.accessToken,
            refreshToken: stored.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Mettre à jour le stockage avec les infos fraîches
          saveAuthToStorage({
            ...stored,
            user,
          });
        } catch {
          // Token invalide, essayer de refresh
          try {
            const refreshed = await apiRefreshToken(stored.refreshToken);
            const expiresAt = Date.now() + refreshed.expires_in * 1000;
            
            setState({
              user: refreshed.user,
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              isAuthenticated: true,
              isLoading: false,
            });
            
            saveAuthToStorage({
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              user: refreshed.user,
              expiresAt,
            });
          } catch {
            // Refresh échoué, déconnecter
            clearAuthFromStorage();
            setState({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await apiLogin(credentials);
      const expiresAt = Date.now() + response.expires_in * 1000;

      setState({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });

      saveAuthToStorage({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        user: response.user,
        expiresAt,
      });

      // Aussi sauvegarder dans l'ancien format pour compatibilité
      localStorage.setItem('atlas_token', response.access_token);
      localStorage.setItem('atlas_user', JSON.stringify(response.user));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthFromStorage();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!state.refreshToken) return false;

    try {
      const response = await apiRefreshToken(state.refreshToken);
      const expiresAt = Date.now() + response.expires_in * 1000;

      setState({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });

      saveAuthToStorage({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        user: response.user,
        expiresAt,
      });

      // Compatibilité
      localStorage.setItem('atlas_token', response.access_token);

      return true;
    } catch {
      logout();
      return false;
    }
  }, [state.refreshToken, logout]);

  const hasRole = useCallback((role: string): boolean => {
    return state.user?.roles.includes(role) ?? false;
  }, [state.user]);

  const hasPermission = useCallback((permission: string): boolean => {
    return state.user?.permissions.includes(permission) ?? false;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(role => state.user?.roles.includes(role));
  }, [state.user]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(perm => state.user?.permissions.includes(perm));
  }, [state.user]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshSession,
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAnyPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// HOC pour les composants protégés
// ============================================================================

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRoles?: string[],
  requiredPermissions?: string[]
): React.FC<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasAnyRole, hasAnyPermission } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null; // Le parent devrait rediriger vers login
    }

    if (requiredRoles && !hasAnyRole(requiredRoles)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Accès refusé</h2>
            <p className="text-gray-500">Vous n'avez pas les droits nécessaires.</p>
          </div>
        </div>
      );
    }

    if (requiredPermissions && !hasAnyPermission(requiredPermissions)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Accès refusé</h2>
            <p className="text-gray-500">Vous n'avez pas les permissions nécessaires.</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

export default AuthContext;
