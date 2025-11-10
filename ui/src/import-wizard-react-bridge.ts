/**
 * Bridge entre le wizard d'import existant et le nouveau composant React ImportExport
 */

import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { ImportExport } from './components/ImportExport'

export function openImportWizardReact(tableName: string, columns: any[], data: any[]) {
  // Créer un conteneur modal
  const container = document.createElement('div')
  container.id = 'import-wizard-react-modal'
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.5);
  `
  document.body.appendChild(container)

  // Créer root React
  const root = createRoot(container)

  const handleClose = () => {
    root.unmount()
    document.body.removeChild(container)
  }

  const handleImport = async (importedData: any[], mapping: any) => {
    console.log('Import data:', importedData, mapping)
    
    // TODO: Appeler l'API backend pour importer
    try {
      const response = await fetch(`/api/db/table/atlas/${tableName}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: importedData, mapping }),
      })

      if (response.ok) {
        alert('Import réussi !')
        handleClose()
        // Recharger les données
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Erreur import: ${error.message}`)
      }
    } catch (err) {
      console.error('Import error:', err)
      alert('Erreur réseau lors de l\'import')
    }
  }

  // Render le composant React
  root.render(
    createElement(ImportExport, {
      open: true,
      onClose: handleClose,
      tableName,
      columns,
      data,
      onImport: handleImport,
    })
  )
}

// Exposer globalement pour utilisation depuis le code existant
;(window as any).openImportWizardReact = openImportWizardReact
