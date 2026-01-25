// Service API pour l'authentification et la gestion RBAC
import { API_BASE_URL } from './api'

// ============================================================================
// Types
// ============================================================================

export interface LoginRequest {
  email: string
  password: string
  device_info?: {
    user_agent?: string
    platform?: string
    browser?: string
    device_type?: string
  }
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: UserInfo
}

export interface RefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserInfo {
  id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  roles: string[]
  permissions: string[]
}

export interface SessionInfo {
  id: string
  user_agent?: string
  ip_address?: string
  created_at: string
  last_activity_at: string
  is_current: boolean
}

export interface User {
  id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  is_active: boolean
  is_verified: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
  roles: RoleInfo[]
}

export interface RoleInfo {
  id: string
  name: string
  assigned_at?: string
  expires_at?: string
}

export interface CreateUserRequest {
  email: string
  username: string
  password: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  is_verified?: boolean
  roles?: string[]
}

export interface UpdateUserRequest {
  email?: string
  username?: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  is_active?: boolean
  is_verified?: boolean
}

export interface Role {
  id: string
  name: string
  description?: string
  is_system: boolean
  created_at: string
  updated_at: string
  permissions?: Permission[]
  user_count?: number
}

export interface Permission {
  id: string
  resource: string
  action: string
  description?: string
}

export interface PermissionsByResource {
  resource: string
  permissions: Permission[]
}

export interface CreateRoleRequest {
  id: string
  name: string
  description?: string
  permissions?: string[]
}

export interface UpdateRoleRequest {
  name?: string
  description?: string
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface UserStats {
  total_users: number
  active_users: number
  verified_users: number
  users_by_role: { role_id: string; role_name: string; count: number }[]
  recent_logins: number
  locked_accounts: number
}

export interface RoleStats {
  total_roles: number
  system_roles: number
  custom_roles: number
  total_permissions: number
  permissions_by_resource: { resource: string; count: number }[]
}

// ============================================================================
// Token Storage - Clés unifiées pour toute l'application
// ============================================================================

// Clés principales (utilisées par AuthContext et toute l'app)
const TOKEN_KEY = 'atlas_token'  // Clé unifiée pour le token d'accès
const REFRESH_TOKEN_KEY = 'atlas_refresh_token'
const USER_KEY = 'atlas_user'
const AUTH_KEY = 'atlas_auth'  // Clé utilisée par AuthContext

// Anciennes clés à migrer
const LEGACY_TOKEN_KEY = 'atlas_access_token'

export const tokenStorage = {
  getAccessToken: (): string | null => {
    // Essayer d'abord la clé principale
    let token = localStorage.getItem(TOKEN_KEY)
    
    // Fallback sur l'ancienne clé si nécessaire
    if (!token) {
      token = localStorage.getItem(LEGACY_TOKEN_KEY)
      if (token) {
        // Migrer vers la nouvelle clé
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.removeItem(LEGACY_TOKEN_KEY)
      }
    }
    
    // Fallback sur atlas_auth (AuthContext)
    if (!token) {
      try {
        const authData = localStorage.getItem(AUTH_KEY)
        if (authData) {
          const parsed = JSON.parse(authData)
          token = parsed.accessToken || null
        }
      } catch {}
    }
    
    return token
  },
  
  setAccessToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    // Synchroniser avec AuthContext si présent
    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        parsed.accessToken = token
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
      }
    } catch {}
  },
  
  removeAccessToken: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  },

  getRefreshToken: (): string | null => {
    let token = localStorage.getItem(REFRESH_TOKEN_KEY)
    
    // Fallback sur atlas_auth
    if (!token) {
      try {
        const authData = localStorage.getItem(AUTH_KEY)
        if (authData) {
          const parsed = JSON.parse(authData)
          token = parsed.refreshToken || null
        }
      } catch {}
    }
    
    return token
  },
  
  setRefreshToken: (token: string) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
    // Synchroniser avec AuthContext
    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        parsed.refreshToken = token
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
      }
    } catch {}
  },
  
  removeRefreshToken: () => localStorage.removeItem(REFRESH_TOKEN_KEY),

  getUser: (): UserInfo | null => {
    // Essayer d'abord la clé directe
    let data = localStorage.getItem(USER_KEY)
    if (data) {
      try {
        return JSON.parse(data)
      } catch {}
    }
    
    // Fallback sur atlas_auth
    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        return parsed.user || null
      }
    } catch {}
    
    return null
  },
  
  setUser: (user: UserInfo) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    // Synchroniser avec AuthContext
    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        parsed.user = user
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
      }
    } catch {}
  },
  
  removeUser: () => localStorage.removeItem(USER_KEY),

  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(AUTH_KEY)
  },

  isAuthenticated: (): boolean => !!tokenStorage.getAccessToken(),
}

// ============================================================================
// Fetch with Auth
// ============================================================================

async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = tokenStorage.getAccessToken()
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })

  // Si 401, essayer de refresh le token (une seule fois)
  if (response.status === 401) {
    const refreshed = await authApi.refresh()
    if (refreshed) {
      headers.set('Authorization', `Bearer ${tokenStorage.getAccessToken()}`)
      return fetch(url, { ...options, headers })
    }
  }

  return response
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
    throw new Error(error.error || error.message || `Erreur ${response.status}`)
  }
  return response.json()
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    const data = await handleResponse<LoginResponse>(response)

    // Stocker les tokens
    tokenStorage.setAccessToken(data.access_token)
    tokenStorage.setRefreshToken(data.refresh_token)
    tokenStorage.setUser(data.user)

    return data
  },

  async logout(): Promise<void> {
    try {
      await fetchWithAuth(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
    } finally {
      tokenStorage.clear()
    }
  },

  async logoutAll(): Promise<{ sessions_revoked: number }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/logout-all`, {
      method: 'POST',
    })
    const data = await handleResponse<{ sessions_revoked: number }>(response)
    tokenStorage.clear()
    return data
  },

  async refresh(): Promise<boolean> {
    const refreshToken = (tokenStorage.getRefreshToken() || '').trim()
    if (!refreshToken) return false

    // Empêcher les refresh concurrents/boucles
    if ((authApi as any)._refreshInFlight) {
      return (authApi as any)._refreshInFlight
    }

    const p = (async (): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!response.ok) {
          tokenStorage.clear()
          return false
        }

        const data = await response.json()
        if (!data?.access_token || typeof data.access_token !== 'string') {
          tokenStorage.clear()
          return false
        }

        tokenStorage.setAccessToken(data.access_token)
        return true
      } catch {
        tokenStorage.clear()
        return false
      } finally {
        ;(authApi as any)._refreshInFlight = null
      }
    })()

    ;(authApi as any)._refreshInFlight = p
    return p
  },

  async getCurrentUser(): Promise<UserInfo> {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/me`)
    return handleResponse<UserInfo>(response)
  },

  async getSessions(): Promise<SessionInfo[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/sessions`)
    return handleResponse<SessionInfo[]>(response)
  },

  async revokeSession(sessionId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur lors du changement de mot de passe')
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Token invalide ou expiré')
    }
  },
}

// ============================================================================
// Users API
// ============================================================================

export const usersApi = {
  async list(params?: {
    page?: number
    per_page?: number
    search?: string
    role?: string
    is_active?: boolean
  }): Promise<UserListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.role) searchParams.set('role', params.role)
    if (params?.is_active !== undefined) searchParams.set('is_active', params.is_active.toString())

    const url = `${API_BASE_URL}/users?${searchParams}`
    const response = await fetchWithAuth(url)
    return handleResponse<UserListResponse>(response)
  },

  async get(userId: string): Promise<User> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`)
    return handleResponse<User>(response)
  },

  async create(request: CreateUserRequest): Promise<User> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return handleResponse<User>(response)
  },

  async update(userId: string, request: UpdateUserRequest): Promise<User> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })
    return handleResponse<User>(response)
  },

  async delete(userId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur lors de la suppression')
    }
  },

  async assignRoles(userId: string, roles: string[], expiresAt?: string): Promise<RoleInfo[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles, expires_at: expiresAt }),
    })
    return handleResponse<RoleInfo[]>(response)
  },

  async removeRole(userId: string, roleId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    })
  },

  async activate(userId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/users/${userId}/activate`, { method: 'POST' })
  },

  async deactivate(userId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/users/${userId}/deactivate`, { method: 'POST' })
  },

  async unlock(userId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/users/${userId}/unlock`, { method: 'POST' })
  },

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur lors de la réinitialisation')
    }
  },

  async getStats(): Promise<UserStats> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/stats`)
    return handleResponse<UserStats>(response)
  },

  async getSessions(userId: string): Promise<SessionInfo[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/sessions`)
    return handleResponse<SessionInfo[]>(response)
  },

  async revokeSessions(userId: string): Promise<{ sessions_revoked: number }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/sessions`, {
      method: 'DELETE',
    })
    return handleResponse<{ sessions_revoked: number }>(response)
  },
}

// ============================================================================
// Roles API
// ============================================================================

export const rolesApi = {
  async list(params?: {
    include_permissions?: boolean
    include_user_count?: boolean
  }): Promise<Role[]> {
    const searchParams = new URLSearchParams()
    if (params?.include_permissions) searchParams.set('include_permissions', 'true')
    if (params?.include_user_count) searchParams.set('include_user_count', 'true')

    const url = `${API_BASE_URL}/roles?${searchParams}`
    const response = await fetchWithAuth(url)
    return handleResponse<Role[]>(response)
  },

  async get(roleId: string): Promise<Role> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}`)
    return handleResponse<Role>(response)
  },

  async create(request: CreateRoleRequest): Promise<Role> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return handleResponse<Role>(response)
  },

  async update(roleId: string, request: UpdateRoleRequest): Promise<Role> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    })
    return handleResponse<Role>(response)
  },

  async delete(roleId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur lors de la suppression')
    }
  },

  async getPermissions(roleId: string): Promise<Permission[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}/permissions`)
    return handleResponse<Permission[]>(response)
  },

  async setPermissions(roleId: string, permissions: string[]): Promise<Permission[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    })
    return handleResponse<Permission[]>(response)
  },

  async addPermission(roleId: string, permissionId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'POST',
    })
  },

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'DELETE',
    })
  },

  async getUsers(roleId: string): Promise<{ id: string; email: string; username: string }[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/${roleId}/users`)
    return handleResponse<{ id: string; email: string; username: string }[]>(response)
  },

  async getStats(): Promise<RoleStats> {
    const response = await fetchWithAuth(`${API_BASE_URL}/roles/stats`)
    return handleResponse<RoleStats>(response)
  },
}

// ============================================================================
// Permissions API
// ============================================================================

export const permissionsApi = {
  async list(resource?: string): Promise<Permission[]> {
    const url = resource
      ? `${API_BASE_URL}/permissions?resource=${resource}`
      : `${API_BASE_URL}/permissions`
    const response = await fetchWithAuth(url)
    return handleResponse<Permission[]>(response)
  },

  async listGrouped(): Promise<PermissionsByResource[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/permissions/grouped`)
    return handleResponse<PermissionsByResource[]>(response)
  },

  async get(permissionId: string): Promise<Permission> {
    const response = await fetchWithAuth(`${API_BASE_URL}/permissions/${permissionId}`)
    return handleResponse<Permission>(response)
  },
}
