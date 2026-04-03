import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import LoginPage from './pages/LoginPage'
import './design-tokens.css'
import './index.css'
import { initTheme } from './theme'

try {
  const w = window as any
  const isTauri = !!(w?.__TAURI__)
  if (isTauri && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    })
  }
} catch {
  // ignore
}

initTheme()

function getReturnTo(): string {
  try {
    const u = new URL(window.location.href)
    const v = (u.searchParams.get('returnTo') || '').trim()
    if (v && v.startsWith('/')) return v
  } catch {
    // ignore
  }
  return '/index.html'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LoginPage
          onLoginSuccess={() => {
            window.location.href = getReturnTo()
          }}
          variant="desktop"
        />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
