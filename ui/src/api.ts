/**
 * Module API centralisé
 * Gère toutes les requêtes vers le backend avec configuration unifiée
 */

// Récupérer l'URL de base de l'API (localStorage > env > défaut)
const getApiBase = (): string => {
  const fromStorage = localStorage.getItem('API_GEO')
  const fromEnv = import.meta.env.VITE_API_GEO
  const fromWindow = (window as any).__API_GEO__
  const defaultUrl = '/api'
  
  const apiBase = (fromStorage || fromEnv || fromWindow || defaultUrl).replace(/\/$/, '')
  
  console.log('[API] Configuration:', {
    localStorage: fromStorage,
    env: fromEnv,
    window: fromWindow,
    effective: apiBase
  })
  
  return apiBase
}

export const API_GEO = getApiBase()

/**
 * Construit une URL complète pour l'API
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_GEO}${cleanPath}`
  return url
}

/**
 * GET request vers l'API
 */
export async function apiGet<T = any>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  console.log('[API] GET', url)
  
  const response = await fetch(url, {
    ...init,
    method: 'GET'
  })
  
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * POST request vers l'API
 */
export async function apiPost<T = any>(path: string, data?: any, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  console.log('[API] POST', url, data)
  
  const response = await fetch(url, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    },
    body: data ? JSON.stringify(data) : undefined
  })
  
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`API Error ${response.status}: ${text}`)
  }
  
  return response.json()
}

/**
 * DELETE request vers l'API
 */
export async function apiDelete<T = any>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  console.log('[API] DELETE', url)
  
  const response = await fetch(url, {
    ...init,
    method: 'DELETE'
  })
  
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Upload de fichier (multipart/form-data)
 */
export async function apiUpload<T = any>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  console.log('[API] UPLOAD', url)
  
  const response = await fetch(url, {
    ...init,
    method: 'POST',
    body: formData
    // Ne pas définir Content-Type, le navigateur le fait automatiquement avec boundary
  })
  
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`API Error ${response.status}: ${text}`)
  }
  
  return response.json()
}

// Export pour compatibilité avec le code existant
export default {
  API_GEO,
  apiUrl,
  apiGet,
  apiPost,
  apiDelete,
  apiUpload
}
