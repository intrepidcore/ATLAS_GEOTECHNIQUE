import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '@/api/auth';
import { tokenStorage } from '@/api/tokenStorage';

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const token = await tokenStorage.getAccessToken();
      setIsAuthenticated(Boolean(token));
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
