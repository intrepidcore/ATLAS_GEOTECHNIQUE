/**
 * Point d'entrée pour la page DB Manager standalone
 * 
 * Cette page affiche directement le gestionnaire de base de données
 * sans passer par l'application React principale.
 */

import './design-tokens.css'
import './index.css'
import { DbManagerModalComponent } from './db-manager/components-vanilla'
import { tokenStorage } from './services/auth-api'
import { initTheme } from './theme'

// Attendre que le DOM soit prêt
document.addEventListener('DOMContentLoaded', () => {
  initTheme()
  if (!tokenStorage.isAuthenticated()) {
    window.location.href = `/login.html?returnTo=${encodeURIComponent('/db-manager.html')}`
    return
  }

  // Créer et ouvrir le modal DB Manager
  const dbManager = new DbManagerModalComponent()
  
  // Ouvrir automatiquement
  dbManager.open()
  
  // Empêcher la fermeture (on est sur une page dédiée)
  // Le bouton fermer redirigera vers la page principale
  const originalClose = dbManager.close.bind(dbManager)
  dbManager.close = () => {
    // Rediriger vers la page principale au lieu de fermer
    window.location.href = '/index.html'
  }
})

// Styles de base pour la page
const style = document.createElement('style')
style.textContent = `
  body {
    margin: 0;
    padding: 0;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  }
  
  #root {
    min-height: 100vh;
  }
`
document.head.appendChild(style)
