import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './design-tokens.css'
import './index.css'
import { initTheme } from './theme'
// Feuilles de style Leaflet (nécessaire pour les contrôles et tuiles)
import 'leaflet/dist/leaflet.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
