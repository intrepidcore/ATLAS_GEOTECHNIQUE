import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Feuilles de style Leaflet (nécessaire pour les contrôles et tuiles)
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
