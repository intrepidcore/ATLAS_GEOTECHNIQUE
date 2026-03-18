/**
 * Point d'entrée pour la page DB Manager standalone
 * 
 * Cette page affiche directement le gestionnaire de base de données
 * sans passer par l'application React principale.
 */

import './index.css'
import { DbManagerModalComponent } from './db-manager/components-vanilla'
import { tokenStorage } from './services/token-storage'

// Attendre que le DOM soit prêt
document.addEventListener('DOMContentLoaded', () => {
  const token = tokenStorage.getAccessToken()
  if (!token) {
    const returnTo = encodeURIComponent('/db-manager.html')
    window.location.href = `/?returnTo=${returnTo}`
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
    window.location.href = '/'
  }
})

// Styles de base pour la page
const style = document.createElement('style')
style.textContent = `
  body {
    margin: 0;
    padding: 0;
    background: #0f1419;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  }
  
  #root {
    min-height: 100vh;
  }
`
document.head.appendChild(style)
