import { API_BASE_URL } from './config';
import { tokenStorage } from './tokenStorage';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export const authApi = {
  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connexion impossible' }));
      throw new Error(err.error || 'Identifiants invalides');
    }
    const data: LoginResponse = await res.json();
    await tokenStorage.set(data.access_token, data.refresh_token);
  },

  async refresh(): Promise<boolean> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data: LoginResponse = await res.json();
    await tokenStorage.set(data.access_token, data.refresh_token);
    return true;
  },

  async logout(): Promise<void> {
    await tokenStorage.clear();
  },
};
