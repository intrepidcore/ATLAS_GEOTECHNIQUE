/**
 * Service API centralisé pour toutes les requêtes backend
 */

import { getApiBase } from '../api-base'
import { tokenStorage } from './token-storage'

// En dev (port 5173): utilise le proxy Vite vers localhost:8000
// En prod (port 8080): utilise le proxy nginx /api/ vers api-geo:8000
// En desktop (Tauri): peut être surchargé via window.__API_GEO__
export function getApiBaseUrl(): string {
  return getApiBase()
}

// Compat (certain code expects a string constant)
// IMPORTANT: must stay reactive, because Tauri injects `window.__API_GEO__` at runtime.
export let API_BASE_URL = getApiBaseUrl()

if (typeof window !== 'undefined') {
  window.addEventListener('atlas:api-base:updated', () => {
    API_BASE_URL = getApiBaseUrl()
  })
}

interface ApiError {
  message: string
  status: number
  details?: any
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(id)
  }
}

class ApiClient {
  private buildUrl(endpoint: string): string {
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '')
    const path = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint
    return `${baseUrl}${path}`
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint)

    const token = tokenStorage.getAccessToken()

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    }

    try {
      const response = await fetchWithTimeout(url, config, 30_000)

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('atlas:auth:expired'))
      }

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        }

        try {
          const errorData = await response.json()
          error.details = errorData
          // Backend retourne error_type (DbManagerError struct), pas code
          const code = errorData?.code || errorData?.error_code || errorData?.error || errorData?.error_type
          if (response.status === 503 && code === 'DB_MANAGER_DISABLED') {
            error.message =
              'DB Manager désactivé (ENABLE_DB_MANAGER=false). Pour activer en dev: définir ENABLE_DB_MANAGER=true + DATABASE_URL_ADMIN, puis redémarrer api-geo.'
          } else if (response.status === 403 && code === 'PERMISSION_DENIED') {
            error.message = errorData?.error || errorData?.message || 'Accès administrateur requis.'
          } else {
            const rawMsg = errorData.message || errorData.error || error.message
            error.message = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg)
          }
        } catch {
          // Ignore JSON parse errors
        }

        throw error
      }

      return await response.json()
    } catch (error: unknown) {
      // ApiError est un plain object (pas un Error instance) avec .status et .message
      if (error !== null && typeof error === 'object' && 'status' in error && 'message' in error) {
        const apiErr = error as { status: number; message: unknown }
        throw {
          ...(error as object),
          message: typeof apiErr.message === 'string' ? apiErr.message : String(apiErr.message ?? 'Erreur API'),
        }
      }

      if (error instanceof Error && 'status' in error) {
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw { message: 'Requête annulée', status: 0, type: 'abort' }
      }

      if (error instanceof TypeError) {
        throw {
          message: 'API non joignable — vérifier api-geo (port 8000)',
          status: 0,
          type: 'network',
          detail: error.message,
        }
      }

      throw {
        message: error instanceof Error ? error.message : 'Erreur inconnue — voir console',
        status: 0,
        type: 'unknown',
      }
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient()

// Types pour les réponses API
export interface Table {
  schema: string
  name: string
  row_count: number
  size_bytes: number
}

export interface Column {
  name: string
  type: string
  nullable: boolean
  default_value?: string
}

export interface StagingInfo {
  staging_id: string
  table_name: string
  schema_name: string
  created_at: string
  reason?: string
  row_count: number
  operations_count: number
}

export interface StagingLock {
  table_name: string
  locked_by: string
  user_email?: string
  locked_at: string
  expires_at: string
  staging_id?: string
  reason?: string
}

export interface DryRunResult {
  is_safe: boolean
  conflicts: ConflictDetail[]
  warnings: string[]
  estimated_duration_ms?: number
  affected_rows: number
}

export interface ConflictDetail {
  conflict_type: string
  table_name: string
  table: string
  column_name?: string
  column?: string
  constraint_name?: string
  affected_rows: number
  sample_values: string[]
  details: string
}

export interface CommitResult {
  success: boolean
  rows_affected: number
  duration_ms: number
  backup_created: boolean
  backup_path?: string
}

// API Methods
export const stagingApi = {
  create: (schema: string, table: string, reason?: string) =>
    api.post<StagingInfo>(`/api/db/table/${schema}/${table}/staging`, { reason }),

  get: (stagingId: string) =>
    api.get<StagingInfo>(`/api/db/staging/${stagingId}`),

  dryrun: (stagingId: string) =>
    api.get<DryRunResult>(`/api/db/staging/${stagingId}/preview`),

  commit: (stagingId: string) =>
    api.post<CommitResult>(`/api/db/staging/${stagingId}/commit`, {}),

  cancel: (stagingId: string) =>
    api.delete<void>(`/api/db/staging/${stagingId}`),

  acquireLock: (stagingId: string, user: string, userEmail?: string) =>
    api.post<StagingLock>(`/api/db/staging/${stagingId}/lock`, {
      user,
      user_email: userEmail,
    }),

  releaseLock: (stagingId: string) =>
    api.delete<void>(`/api/db/staging/${stagingId}/lock`),
}

export const tablesApi = {
  list: async (schema?: string) => {
    const res: any = await api.get<any>(`/db/schema`)
    const schemas = res?.schemas || []
    if (!schema) return schemas.flatMap((s: any) => s.tables || [])
    const found = schemas.find((s: any) => s.name === schema)
    return (found?.tables || []).map((t: any) => ({ name: t.name, row_count: t.row_count }))
  },

  getColumns: (schema: string, table: string) =>
    api.get<any>(`/db/table/${schema}/${table}`).then((info: any) => info.columns || []),

  getTableInfo: (schema: string, table: string) =>
    api.get<any>(`/db/table/${schema}/${table}`),

  getData: (schema: string, table: string, limit = 100, offset = 0) =>
    api.get<any>(`/db/table/${schema}/${table}/data?limit=${limit}&offset=${offset}`).then((res: any) => res.rows || []),
}

export const locksApi = {
  list: () => api.get<StagingLock[]>('/api/db/locks'),
}
