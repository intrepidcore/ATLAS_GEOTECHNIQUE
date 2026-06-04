// @ts-nocheck — fichier orphelin LitElement (decorateurs @property/@state non résolus sans lit)
// Modal principal du gestionnaire de base de données
import type { DatabaseSchema, SchemaInfo, TableInfo, DbManagerState } from './types'
import * as api from './api'

export class DbManagerModal {
  @property({ type: Boolean }) open = false
  
  @state() private schema?: DatabaseSchema
  @state() private loading = false
  @state() private error?: string
  
  @state() private state: DbManagerState = {
    mode: 'read',
    selection: new Set(),
    currentPage: 0,
    pageSize: 100
  }
  
  static styles = css`
    :host {
      display: block;
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }
    
    .modal-container {
      background: var(--bg-primary, #1e2530);
      border-radius: 12px;
      width: 95vw;
      height: 90vh;
      max-width: 1800px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color, #2d3748);
      background: var(--bg-secondary, #252d3a);
    }
    
    .modal-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #e2e8f0);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .mode-badge {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .mode-badge.read {
      background: #3b82f6;
      color: white;
    }
    
    .mode-badge.edit {
      background: #f59e0b;
      color: white;
    }
    
    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary, #94a3b8);
      font-size: 24px;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .close-btn:hover {
      background: var(--bg-hover, #374151);
      color: var(--text-primary, #e2e8f0);
    }
    
    .modal-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    
    .sidebar {
      width: 280px;
      border-right: 1px solid var(--border-color, #2d3748);
      background: var(--bg-secondary, #252d3a);
      overflow-y: auto;
      padding: 16px;
    }
    
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #2d3748);
      background: var(--bg-secondary, #252d3a);
      flex-wrap: wrap;
    }
    
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border-right: 1px solid var(--border-color, #2d3748);
    }
    
    .toolbar-group:last-child {
      border-right: none;
    }
    
    .toolbar-btn {
      padding: 8px 12px;
      border: 1px solid var(--border-color, #2d3748);
      background: var(--bg-primary, #1e2530);
      color: var(--text-primary, #e2e8f0);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    
    .toolbar-btn:hover:not(:disabled) {
      background: var(--bg-hover, #374151);
      border-color: var(--border-hover, #4b5563);
    }
    
    .toolbar-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .toolbar-btn.primary {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
    
    .toolbar-btn.primary:hover:not(:disabled) {
      background: #2563eb;
    }
    
    .toolbar-btn.danger {
      background: #ef4444;
      border-color: #ef4444;
      color: white;
    }
    
    .toolbar-btn.danger:hover:not(:disabled) {
      background: #dc2626;
    }
    
    .data-grid-container {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary, #94a3b8);
    }
    
    .error {
      padding: 16px;
      background: #fee2e2;
      border: 1px solid #ef4444;
      border-radius: 8px;
      color: #991b1b;
      margin: 16px;
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary, #94a3b8);
      gap: 12px;
    }
    
    .empty-state-icon {
      font-size: 48px;
      opacity: 0.5;
    }
  `
  
  async connectedCallback() {
    super.connectedCallback()
    if (this.open) {
      await this.loadSchema()
    }
  }
  
  async loadSchema() {
    this.loading = true
    this.error = undefined
    
    try {
      this.schema = await api.getSchema()
    } catch (err: any) {
      this.error = err.message || 'Erreur lors du chargement du schéma'
      console.error('Erreur loadSchema:', err)
    } finally {
      this.loading = false
    }
  }
  
  private handleClose() {
    this.dispatchEvent(new CustomEvent('close'))
  }
  
  private toggleMode() {
    if (this.state.mode === 'read') {
      // Activer le mode édition
      if (confirm('Activer le mode Édition ? Un point de restauration sera créé.')) {
        this.state = { ...this.state, mode: 'edit' }
        this.createAutoBackup()
      }
    } else {
      // Retour en mode lecture
      this.state = { ...this.state, mode: 'read' }
    }
  }
  
  private async createAutoBackup() {
    if (!this.state.selectedSchema || !this.state.selectedTable) return
    
    try {
      const backup = await api.createBackup({
        tables: [`${this.state.selectedSchema}.${this.state.selectedTable}`],
        description: 'Backup automatique avant édition'
      })
      this.state = { ...this.state, backupBeforeEdit: backup }
      console.log('Backup créé:', backup.backup_id)
    } catch (err) {
      console.error('Erreur création backup:', err)
    }
  }
  
  render() {
    if (!this.open) return null
    
    return html`
      <div class="modal-overlay" @click=${this.handleClose}>
        <div class="modal-container" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <div class="modal-title">
              <span>🗄️ Gestionnaire de Base de Données</span>
              <span class="mode-badge ${this.state.mode}">
                ${this.state.mode === 'read' ? '🔒 Lecture' : '✏️ Édition'}
              </span>
            </div>
            <button class="close-btn" @click=${this.handleClose}>×</button>
          </div>
          
          <div class="modal-body">
            <div class="sidebar">
              ${this.renderSidebar()}
            </div>
            
            <div class="main-content">
              ${this.renderToolbar()}
              ${this.renderContent()}
            </div>
          </div>
        </div>
      </div>
    `
  }
  
  private renderSidebar() {
    if (this.loading) {
      return html`<div class="loading">Chargement...</div>`
    }
    
    if (this.error) {
      return html`<div class="error">${this.error}</div>`
    }
    
    if (!this.schema) {
      return html`<div class="empty-state">Aucun schéma</div>`
    }
    
    return html`
      <db-schema-tree
        .schema=${this.schema}
        .selectedSchema=${this.state.selectedSchema}
        .selectedTable=${this.state.selectedTable}
        @select=${this.handleTableSelect}
      ></db-schema-tree>
    `
  }
  
  private renderToolbar() {
    const isEditMode = this.state.mode === 'edit'
    const hasSelection = this.state.selection.size > 0
    const hasTable = !!this.state.selectedTable
    
    return html`
      <div class="toolbar">
        <div class="toolbar-group">
          <button 
            class="toolbar-btn ${isEditMode ? 'primary' : ''}"
            @click=${this.toggleMode}
            title="${isEditMode ? 'Mode Lecture' : 'Mode Édition'}"
          >
            ${isEditMode ? '🔒' : '✏️'}
            ${isEditMode ? 'Mode Lecture' : 'Mode Édition'}
          </button>
        </div>
        
        ${hasTable ? html`
          <div class="toolbar-group">
            <button class="toolbar-btn" title="Sélectionner tout">
              ✅ Tout
            </button>
            <button class="toolbar-btn" title="Inverser sélection">
              🔁 Inverser
            </button>
            <button class="toolbar-btn" title="Sélection par expression">
              🔍 Expression
            </button>
            ${hasSelection ? html`
              <button class="toolbar-btn" title="Zoomer sur sélection">
                🔎 Zoom
              </button>
            ` : null}
          </div>
          
          ${isEditMode ? html`
            <div class="toolbar-group">
              <button class="toolbar-btn primary" title="Ajouter une entité">
                ➕ Ajouter ligne
              </button>
              <button class="toolbar-btn" title="Ajouter un champ">
                ✚ Ajouter colonne
              </button>
              ${hasSelection ? html`
                <button class="toolbar-btn danger" title="Supprimer entité(s)">
                  🗑️ Supprimer (${this.state.selection.size})
                </button>
              ` : null}
              <button class="toolbar-btn danger" title="Supprimer champ">
                🗑️⚠️ Supprimer colonne
              </button>
              <button class="toolbar-btn" title="Organiser les champs">
                🧭 Organiser
              </button>
            </div>
          ` : null}
          
          <div class="toolbar-group">
            <button class="toolbar-btn" title="Historique">
              📋 Audit
            </button>
            <button class="toolbar-btn" title="Créer point de restauration">
              📦 Backup
            </button>
          </div>
        ` : null}
      </div>
    `
  }
  
  private renderContent() {
    if (!this.state.selectedTable) {
      return html`
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div>Sélectionnez une table dans le panneau de gauche</div>
        </div>
      `
    }
    
    return html`
      <div class="data-grid-container">
        <db-data-grid
          .schema=${this.state.selectedSchema!}
          .table=${this.state.selectedTable}
          .mode=${this.state.mode}
          .selection=${this.state.selection}
          @selection-change=${this.handleSelectionChange}
        ></db-data-grid>
      </div>
    `
  }
  
  private handleTableSelect(e: CustomEvent) {
    this.state = {
      ...this.state,
      selectedSchema: e.detail.schema,
      selectedTable: e.detail.table,
      selection: new Set(),
      currentPage: 0
    }
  }
  
  private handleSelectionChange(e: CustomEvent) {
    this.state = {
      ...this.state,
      selection: e.detail.selection
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'db-manager-modal': DbManagerModal
  }
}
