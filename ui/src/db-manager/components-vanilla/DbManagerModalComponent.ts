// Modal principal du gestionnaire de BDD en vanilla TypeScript
import { BaseComponent } from './BaseComponent'
import { SchemaTreeComponent } from './SchemaTreeComponent'
import { DataGridComponent } from './DataGridComponent'
import * as api from '../api-simple'
import type { DatabaseSchema, TableDataResponse } from '../types'
import { APP_VERSION } from '../../version'

interface ModalState {
  open: boolean
  loading: boolean
  error: string | null
  currentSchema: string | null
  currentTable: string | null
}

export class DbManagerModalComponent extends BaseComponent<ModalState> {
  private schemaTree: SchemaTreeComponent | null = null
  private dataGrid: DataGridComponent | null = null
  private modalElement: HTMLElement | null = null
  
  constructor() {
    // Créer un container temporaire
    const container = document.createElement('div')
    container.id = 'db-manager-modal-root'
    document.body.appendChild(container)
    
    super(container, {
      open: false,
      loading: false,
      error: null,
      currentSchema: null,
      currentTable: null
    })
  }
  
  /**
   * Ouvre le modal
   */
  public async open(): Promise<void> {
    this.setState({ open: true, loading: true })
    
    try {
      const schema = await api.getSchema()
      
      // Attendre le rendu
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Initialiser les composants enfants
      this.initializeComponents(schema)
      
      this.setState({ loading: false })
    } catch (err: any) {
      this.setState({
        error: err.message || 'Erreur lors du chargement du schéma',
        loading: false
      })
    }
  }
  
  /**
   * Ferme le modal
   */
  public close(): void {
    this.setState({ open: false })
    
    // Nettoyer les composants
    if (this.schemaTree) {
      this.schemaTree.destroy()
      this.schemaTree = null
    }
    
    if (this.dataGrid) {
      this.dataGrid.destroy()
      this.dataGrid = null
    }
    
    // Supprimer le modal après l'animation
    setTimeout(() => {
      this.destroy()
      this.container.remove()
    }, 300)
  }
  
  private initializeComponents(schema: DatabaseSchema): void {
    const treeContainer = this.container.querySelector('#schema-tree-container') as HTMLElement
    const gridContainer = this.container.querySelector('#data-grid-container') as HTMLElement
    
    if (treeContainer && !this.schemaTree) {
      this.schemaTree = new SchemaTreeComponent(treeContainer)
      this.schemaTree.loadSchemas(schema.schemas)
      
      // Écouter la sélection de table
      treeContainer.addEventListener('table-selected', ((e: CustomEvent) => {
        this.handleTableSelected(e.detail.schema, e.detail.table)
      }) as EventListener)
      
      // Écouter le retry
      treeContainer.addEventListener('retry-load', (() => {
        this.open()
      }) as EventListener)
    }
    
    if (gridContainer && !this.dataGrid) {
      this.dataGrid = new DataGridComponent(gridContainer)
      
      // Écouter les événements de la grille
      gridContainer.addEventListener('mode-changed', ((e: CustomEvent) => {
        console.log('Mode changed:', e.detail.mode)
      }) as EventListener)
      
      gridContainer.addEventListener('cell-updated', ((e: CustomEvent) => {
        this.handleCellUpdate(e.detail)
      }) as EventListener)
      
      gridContainer.addEventListener('page-changed', ((e: CustomEvent) => {
        this.handlePageChange(e.detail.page)
      }) as EventListener)
      
      gridContainer.addEventListener('refresh', (() => {
        this.refreshCurrentTable()
      }) as EventListener)
      
      gridContainer.addEventListener('export', (() => {
        this.exportCurrentTable()
      }) as EventListener)
    }
  }
  
  private async handleTableSelected(schema: string, table: string): Promise<void> {
    this.setState({ currentSchema: schema, currentTable: table })
    
    if (!this.dataGrid) return
    
    this.dataGrid.setLoading(true)
    
    try {
      const data = await api.getTableData(schema, table, {
        limit: 100,
        offset: 0
      })
      
      this.dataGrid.loadData(schema, table, data)
    } catch (err: any) {
      this.dataGrid.setError(err.message || 'Erreur lors du chargement des données')
    }
  }
  
  private async handleCellUpdate(detail: { rowId: string; column: string; value: string }): Promise<void> {
    const { currentSchema, currentTable } = this.state
    
    if (!currentSchema || !currentTable) return
    
    console.log('Cell update:', detail)
    
    // TODO: Implémenter l'update via l'API
    // await api.updateCell(currentSchema, currentTable, detail.rowId, detail.column, detail.value)
    
    // Recharger les données
    await this.refreshCurrentTable()
  }
  
  private async handlePageChange(page: number): Promise<void> {
    const { currentSchema, currentTable } = this.state
    
    if (!currentSchema || !currentTable || !this.dataGrid) return
    
    this.dataGrid.setLoading(true)
    
    try {
      const data = await api.getTableData(currentSchema, currentTable, {
        limit: 100,
        offset: (page - 1) * 100
      })
      
      this.dataGrid.loadData(currentSchema, currentTable, data)
    } catch (err: any) {
      this.dataGrid.setError(err.message || 'Erreur lors du chargement de la page')
    }
  }
  
  private async refreshCurrentTable(): Promise<void> {
    const { currentSchema, currentTable } = this.state
    
    if (!currentSchema || !currentTable) return
    
    await this.handleTableSelected(currentSchema, currentTable)
  }
  
  private exportCurrentTable(): void {
    const { currentSchema, currentTable } = this.state
    
    if (!currentSchema || !currentTable || !this.dataGrid) return
    
    // TODO: Implémenter l'export CSV
    console.log('Export table:', currentSchema, currentTable)
    alert('Export CSV à implémenter')
  }
  
  protected render(): string {
    if (!this.state.open) {
      return ''
    }
    
    return `
      <div class="db-modal-overlay ${this.state.open ? 'open' : ''}">
        <div class="db-modal-container">
          ${this.renderHeader()}
          ${this.renderBody()}
        </div>
      </div>
      
      ${this.renderStyles()}
    `
  }
  
  private renderHeader(): string {
    return `
      <div class="db-modal-header">
        <div class="header-left">
          <h2>🗄️ Gestionnaire de Base de Données</h2>
          <span class="version-badge">${APP_VERSION}</span>
        </div>
        <div class="header-right">
          <button class="btn-help" title="Aide">❓</button>
          <button class="btn-close" title="Fermer">×</button>
        </div>
      </div>
    `
  }
  
  private renderBody(): string {
    if (this.state.loading) {
      return `
        <div class="db-modal-body">
          <div class="modal-loading">
            <div class="spinner"></div>
            <p>Chargement du gestionnaire...</p>
          </div>
        </div>
      `
    }
    
    if (this.state.error) {
      return `
        <div class="db-modal-body">
          <div class="modal-error">
            <span class="error-icon">⚠️</span>
            <p>${this.state.error}</p>
            <button class="btn-retry">Réessayer</button>
          </div>
        </div>
      `
    }
    
    return `
      <div class="db-modal-body">
        <div class="db-sidebar" id="schema-tree-container"></div>
        <div class="db-main" id="data-grid-container"></div>
      </div>
    `
  }
  
  private renderStyles(): string {
    return `
      <style id="db-manager-styles">
        /* Modal overlay */
        .db-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .db-modal-overlay.open {
          opacity: 1;
        }
        
        /* Modal container */
        .db-modal-container {
          background: #1e2530;
          border-radius: 12px;
          width: 95vw;
          height: 90vh;
          max-width: 1800px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          transform: scale(0.9);
          transition: transform 0.3s ease;
        }
        
        .db-modal-overlay.open .db-modal-container {
          transform: scale(1);
        }
        
        /* Header */
        .db-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #2d3748;
          background: #252d3a;
          border-radius: 12px 12px 0 0;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .db-modal-header h2 {
          margin: 0;
          color: #e2e8f0;
          font-size: 20px;
          font-weight: 600;
        }
        
        .version-badge {
          font-size: 11px;
          background: #3b82f6;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .header-right {
          display: flex;
          gap: 8px;
        }
        
        .btn-help,
        .btn-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 24px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .btn-help:hover,
        .btn-close:hover {
          background: #374151;
          color: #e2e8f0;
        }
        
        /* Body */
        .db-modal-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .db-sidebar {
          width: 300px;
          border-right: 1px solid #2d3748;
          background: #252d3a;
          overflow-y: auto;
        }
        
        .db-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        /* Loading & Error states */
        .modal-loading,
        .modal-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #94a3b8;
        }
        
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #2d3748;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .btn-retry {
          margin-top: 16px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .btn-retry:hover {
          background: #2563eb;
        }
      </style>
    `
  }
  
  protected attachEventListeners(): void {
    // Close modal
    this.addEventListener('.btn-close', 'click', () => {
      this.close()
    })
    
    // Close on overlay click
    this.addEventListener('.db-modal-overlay', 'click', (e) => {
      if (e.target === e.currentTarget) {
        this.close()
      }
    })
    
    // Help
    this.addEventListener('.btn-help', 'click', () => {
      alert('Aide du gestionnaire de BDD\n\n' +
        '- Cliquez sur une table pour voir ses données\n' +
        '- Double-cliquez sur une cellule pour l\'éditer (mode édition)\n' +
        '- Utilisez les boutons de pagination pour naviguer\n' +
        '- Le mode édition permet d\'ajouter/supprimer des lignes')
    })
    
    // Retry
    this.addEventListener('.btn-retry', 'click', () => {
      this.open()
    })
    
    // Escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.state.open) {
        this.close()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    
    // Cleanup on destroy
    const originalDestroy = this.destroy.bind(this)
    this.destroy = () => {
      document.removeEventListener('keydown', handleEscape)
      originalDestroy()
    }
  }
}

/**
 * Fonction helper pour ouvrir le modal
 */
export function openDbManager(): void {
  const modal = new DbManagerModalComponent()
  modal.open()
}
