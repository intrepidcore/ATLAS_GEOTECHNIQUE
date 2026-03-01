// Export de tous les composants vanilla TypeScript
export { BaseComponent } from './BaseComponent'
export { SchemaTreeComponent } from './SchemaTreeComponent'
export { DataGridComponent } from './DataGridComponent'
export { DbManagerModalComponent, openDbManager } from './DbManagerModalComponent'

// Import des styles
import stylesUrl from './styles.css?url'

// Injecter les styles dans le document
if (typeof document !== 'undefined') {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = stylesUrl
  document.head.appendChild(link)
}
