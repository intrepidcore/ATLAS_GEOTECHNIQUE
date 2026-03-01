/**
 * DB Manager - Ouvre l'application React de gestion de base de données
 */

export function openDbManager() {
  // Déterminer l'URL correcte selon l'environnement
  const isDev = window.location.port === '5173'
  const baseUrl = isDev ? 'http://localhost:5173' : window.location.origin
  
  // Ouvrir la nouvelle application React dans un nouvel onglet
  window.open(`${baseUrl}/db-manager.html`, '_blank')
}
