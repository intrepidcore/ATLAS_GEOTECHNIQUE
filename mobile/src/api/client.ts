import { API_BASE_URL } from './config';
import { tokenStorage } from './tokenStorage';
import { authApi } from './auth';

// Même comportement que ui/src/services/colab-api.ts fetchWithAuth : retry
// une fois sur 401 après refresh silencieux, sinon on propage l'échec.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const token = await tokenStorage.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  };

  const res = await doFetch();
  if (res.status !== 401) return res;

  const refreshed = await authApi.refresh();
  if (!refreshed) {
    await tokenStorage.clear();
    return res;
  }
  return doFetch();
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}
