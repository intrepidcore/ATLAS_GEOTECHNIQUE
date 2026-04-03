/**
 * Thème clair / sombre pour l’UI React (DB Manager, etc.).
 * Synchronisation globale : `document.documentElement.classList` (`dark`) + `localStorage`
 * via les helpers de `theme.ts` — même mécanisme que l’UI vanilla (`initTheme`).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { applyTheme, getStoredTheme, type ThemeMode, setStoredTheme } from '@/theme'

export type AtlasThemeContextValue = {
  /** Mode effectif affiché (light | dark). */
  theme: ThemeMode
  /** Applique et persiste le thème sur toute la page (variables CSS `design-tokens.css`). */
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<AtlasThemeContextValue | null>(null)

function readDomTheme(): ThemeMode {
  try {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = getStoredTheme()
    if (stored) return stored
    return readDomTheme()
  })

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    applyTheme(mode)
    setStoredTheme(mode)
    try {
      window.dispatchEvent(new CustomEvent('atlas:theme-changed', { detail: { mode } }))
    } catch {
      // ignore
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      setStoredTheme(next)
      try {
        window.dispatchEvent(new CustomEvent('atlas:theme-changed', { detail: { mode: next } }))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAtlasTheme(): AtlasThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useAtlasTheme doit être utilisé sous <ThemeProvider>')
  }
  return ctx
}
