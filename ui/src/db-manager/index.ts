// Export du gestionnaire de base de données
export * from './types'
export * from './api'
export { DbManagerModal } from './DbManagerModal'
export { SchemaTree } from './components/SchemaTree'
export { DataGrid } from './components/DataGrid'

// Fonction pour ouvrir le modal
export function openDbManager() {
  let modal = document.querySelector('db-manager-modal') as any
  
  if (!modal) {
    modal = document.createElement('db-manager-modal')
    document.body.appendChild(modal)
    
    modal.addEventListener('close', () => {
      modal.open = false
      setTimeout(() => modal.remove(), 300)
    })
  }
  
  modal.open = true
}
