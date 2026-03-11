const TOKEN_KEY = 'atlas_token'
const REFRESH_TOKEN_KEY = 'atlas_refresh_token'
const USER_KEY = 'atlas_user'
const AUTH_KEY = 'atlas_auth'

const LEGACY_TOKEN_KEY = 'atlas_access_token'

export const tokenStorage = {
  getAccessToken: (): string | null => {
    let token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      token = localStorage.getItem(LEGACY_TOKEN_KEY)
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.removeItem(LEGACY_TOKEN_KEY)
      }
    }

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

  setTokens: (accessToken: string, refreshToken?: string, user?: unknown) => {
    tokenStorage.setAccessToken(accessToken)
    localStorage.removeItem(LEGACY_TOKEN_KEY)

    if (typeof refreshToken === 'string') {
      tokenStorage.setRefreshToken(refreshToken)
    }
    if (user !== undefined) {
      tokenStorage.setUser(user)
    }
  },

  setAccessToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
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

  getUser: <T = unknown>(): T | null => {
    let data = localStorage.getItem(USER_KEY)
    if (data) {
      try {
        return JSON.parse(data)
      } catch {}
    }

    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        return parsed.user || null
      }
    } catch {}

    return null
  },

  setUser: (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    try {
      const authData = localStorage.getItem(AUTH_KEY)
      if (authData) {
        const parsed = JSON.parse(authData)
        parsed.user = user
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
      }
    } catch {}
  },

  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(AUTH_KEY)
  },

  isAuthenticated: (): boolean => !!tokenStorage.getAccessToken(),
}
