/**
 * Service API centralisé pour toutes les requêtes backend
 */

// En dev (port 5173): utilise le proxy Vite vers localhost:8000
// En prod (port 8080): utilise le proxy nginx /api/ vers api-geo:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface ApiError {
  message: string
  status: number
  details?: any
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        }

        try {
          const errorData = await response.json()
          error.details = errorData
          error.message = errorData.message || error.message
        } catch {
          // Ignore JSON parse errors
        }

        throw error
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error
      }
      throw {
        message: error instanceof Error ? error.message : 'Network error',
        status: 0,
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

export const api = new ApiClient(API_BASE_URL)

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
  list: (schema?: string) =>
    api.get<any>(`/db/schema${schema ? `?schema=${schema}` : ''}`).then((res: any) => res.tables || []),

  getColumns: (schema: string, table: string) =>
    api.get<any>(`/db/table/${schema}/${table}`).then((info: any) => info.columns || []),

  getData: (schema: string, table: string, limit = 100, offset = 0) =>
    api.get<any>(`/db/table/${schema}/${table}/data?limit=${limit}&offset=${offset}`).then((res: any) => res.rows || []),
}

export const locksApi = {
  list: () => api.get<StagingLock[]>('/api/db/locks'),
}
