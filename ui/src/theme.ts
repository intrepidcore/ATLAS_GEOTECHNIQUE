export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'atlas_theme_mode'

function getSystemPref(): ThemeMode {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  } catch {
    return 'light'
  }
}

export function getStoredTheme(): ThemeMode | null {
  try {
    const v = (localStorage.getItem(STORAGE_KEY) || '').trim()
    if (v === 'dark' || v === 'light') return v
  } catch {
    // ignore
  }
  return null
}

export function setStoredTheme(mode: ThemeMode | null) {
  try {
    if (mode) localStorage.setItem(STORAGE_KEY, mode)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function initTheme() {
  const stored = getStoredTheme()
  const initial = stored ?? getSystemPref()
  applyTheme(initial)

  // Si l'utilisateur n'a pas forcé un thème, suivre le système en live.
  if (!stored) {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme(mq.matches ? 'dark' : 'light')
      mq.addEventListener?.('change', handler)
      ;(mq as any).addListener?.(handler)
    } catch {
      // ignore
    }
  }
}
