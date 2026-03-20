/**
 * Module API centralisé
 * Gère toutes les requêtes vers le backend avec configuration unifiée
 */

import { getApiBase, buildApiUrl } from './api-base'

export let API_GEO = getApiBase()

if (typeof window !== 'undefined') {
  window.addEventListener('atlas:api-base:updated', () => {
    API_GEO = getApiBase()
  })
}

/**
 * Construit une URL complète pour l'API
 * @param path - Chemin relatif (ex: "/surveys" ou "surveys")
 * @returns URL complète (ex: "http://localhost:8000/surveys")
 */
export function apiUrl(path: string): string {
  return buildApiUrl(path)
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
