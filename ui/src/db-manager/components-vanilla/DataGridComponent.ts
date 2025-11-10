// Composant grille de données avec édition inline en vanilla TypeScript
import { BaseComponent } from './BaseComponent'
import type { TableDataResponse, ColumnInfo } from '../types'

interface DataGridState {
  data: TableDataResponse | null
  loading: boolean
  error: string | null
  mode: 'read' | 'edit'
  selection: Set<string>
  editingCell: { rowId: string; column: string } | null
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  currentPage: number
  pageSize: number
}

export class DataGridComponent extends BaseComponent<DataGridState> {
  private schema: string = ''
  private table: string = ''
  
  constructor(container: HTMLElement) {
    super(container, {
      data: null,
      loading: false,
      error: null,
      mode: 'read',
      selection: new Set(),
      editingCell: null,
      sortColumn: null,
      sortDirection: 'asc',
      currentPage: 1,
      pageSize: 100
    })
  }
  
  /**
   * Charge les données d'une table
   */
  public async loadData(schema: string, table: string, data: TableDataResponse): Promise<void> {
    this.schema = schema
    this.table = table
    this.setState({
      data,
      loading: false,
      error: null,
      selection: new Set(),
      editingCell: null
    })
  }
  
  /**
   * Définit l'état de chargement
   */
  public setLoading(loading: boolean): void {
    this.setState({ loading })
  }
  
  /**
   * Définit une erreur
   */
  public setError(error: string): void {
    this.setState({ error, loading: false })
  }
  
  /**
   * Change le mode lecture/édition
   */
  public setMode(mode: 'read' | 'edit'): void {
    this.setState({ mode, editingCell: null })
  }
  
  /**
   * Obtient la sélection actuelle
   */
  public getSelection(): Set<string> {
    return new Set(this.state.selection)
  }
  
  /**
   * Efface la sélection
   */
  public clearSelection(): void {
    this.setState({ selection: new Set() })
  }
  
  protected render(): string {
    if (this.state.loading) {
      return `
        <div class="data-grid-loading">
          <div class="spinner"></div>
          <p>Chargement des données...</p>
        </div>
      `
    }
    
    if (this.state.error) {
      return `
        <div class="data-grid-error">
          <span class="error-icon">⚠️</span>
          <p>${this.state.error}</p>
        </div>
      `
    }
    
    if (!this.state.data) {
      return `
        <div class="data-grid-empty">
          <span class="empty-icon">📊</span>
          <p>Sélectionnez une table dans le panneau de gauche</p>
        </div>
      `
    }
    
    return `
      <div class="data-grid">
        ${this.renderToolbar()}
        ${this.renderTable()}
        ${this.renderPagination()}
      </div>
    `
  }
  
  private renderToolbar(): string {
    const { data, mode, selection } = this.state
    const selectedCount = selection.size
    
    return `
      <div class="data-grid-toolbar">
        <div class="toolbar-left">
          <button 
            class="btn-mode ${mode === 'edit' ? 'active' : ''}" 
            data-mode="${mode}"
            title="${mode === 'read' ? 'Activer le mode édition' : 'Désactiver le mode édition'}"
          >
            ${mode === 'read' ? '🔒' : '✏️'} ${mode === 'read' ? 'Lecture' : 'Édition'}
          </button>
          
          ${mode === 'edit' ? `
            <button class="btn-add" title="Ajouter une ligne">
              ➕ Ajouter
            </button>
            <button 
              class="btn-delete ${selectedCount === 0 ? 'disabled' : ''}" 
              ${selectedCount === 0 ? 'disabled' : ''}
              title="Supprimer la sélection"
            >
              🗑️ Supprimer (${selectedCount})
            </button>
          ` : ''}
        </div>
        
        <div class="toolbar-right">
          <span class="table-info">
            ${data!.total_count.toLocaleString()} lignes · 
            ${data!.columns.length} colonnes
          </span>
          
          <button class="btn-refresh" title="Actualiser">
            🔄
          </button>
          
          <button class="btn-export" title="Exporter en CSV">
            📥 Export
          </button>
        </div>
      </div>
    `
  }
  
  private renderTable(): string {
    const { data, mode, selection, editingCell } = this.state
    
    if (!data || data.rows.length === 0) {
      return `
        <div class="data-grid-no-data">
          <p>Aucune donnée dans cette table</p>
        </div>
      `
    }
    
    const allSelected = data.rows.every(row => selection.has(row.id))
    
    return `
      <div class="data-grid-table-container">
        <table class="data-grid-table">
          <thead>
            <tr>
              ${mode === 'edit' ? `
                <th class="col-checkbox">
                  <input 
                    type="checkbox" 
                    class="checkbox-all"
                    ${allSelected ? 'checked' : ''}
                  />
                </th>
              ` : ''}
              ${data.columns.map(col => this.renderColumnHeader(col)).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.rows.map(row => this.renderRow(row)).join('')}
          </tbody>
        </table>
      </div>
    `
  }
  
  private renderColumnHeader(column: ColumnInfo): string {
    const { sortColumn, sortDirection } = this.state
    const isSorted = sortColumn === column.name
    const sortIcon = isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'
    
    return `
      <th 
        class="col-header ${isSorted ? 'sorted' : ''}"
        data-column="${column.name}"
      >
        <div class="col-header-content">
          <span class="col-name">${column.name}</span>
          ${column.is_primary_key ? '<span class="badge-pk">PK</span>' : ''}
          ${column.is_foreign_key ? '<span class="badge-fk">FK</span>' : ''}
          <span class="col-type">${column.data_type}</span>
          <span class="sort-icon">${sortIcon}</span>
        </div>
      </th>
    `
  }
  
  private renderRow(row: Record<string, any>): string {
    const { data, mode, selection, editingCell } = this.state
    const rowId = row.id
    const isSelected = selection.has(rowId)
    
    return `
      <tr class="data-row ${isSelected ? 'selected' : ''}" data-row-id="${rowId}">
        ${mode === 'edit' ? `
          <td class="col-checkbox">
            <input 
              type="checkbox" 
              class="checkbox-row"
              data-row-id="${rowId}"
              ${isSelected ? 'checked' : ''}
            />
          </td>
        ` : ''}
        ${data!.columns.map(col => this.renderCell(rowId, col, row[col.name])).join('')}
      </tr>
    `
  }
  
  private renderCell(rowId: string, column: ColumnInfo, value: any): string {
    const { mode, editingCell } = this.state
    const isEditing = editingCell?.rowId === rowId && editingCell?.column === column.name
    const isEditable = mode === 'edit' && !column.is_primary_key
    
    if (isEditing) {
      return `
        <td class="cell-editing">
          <input 
            type="text" 
            class="cell-input"
            data-row-id="${rowId}"
            data-column="${column.name}"
            value="${this.escapeHtml(value?.toString() ?? '')}"
            autofocus
          />
        </td>
      `
    }
    
    const cellClass = [
      'cell',
      isEditable ? 'cell-editable' : '',
      value === null ? 'cell-null' : '',
      column.data_type === 'boolean' ? 'cell-boolean' : '',
      this.isNumericType(column.data_type) ? 'cell-number' : ''
    ].filter(Boolean).join(' ')
    
    return `
      <td 
        class="${cellClass}"
        data-row-id="${rowId}"
        data-column="${column.name}"
        title="${this.escapeHtml(value?.toString() ?? 'NULL')}"
      >
        ${this.formatCellValue(value, column.data_type)}
      </td>
    `
  }
  
  private formatCellValue(value: any, dataType: string): string {
    if (value === null || value === undefined) {
      return '<span class="null-value">NULL</span>'
    }
    
    if (dataType === 'boolean') {
      return value ? '<span class="bool-true">✓</span>' : '<span class="bool-false">✗</span>'
    }
    
    if (typeof value === 'object') {
      return `<span class="json-value">${this.escapeHtml(JSON.stringify(value))}</span>`
    }
    
    return this.escapeHtml(value.toString())
  }
  
  private isNumericType(dataType: string): boolean {
    return ['integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint'].includes(dataType.toLowerCase())
  }
  
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  private renderPagination(): string {
    const { data, currentPage, pageSize } = this.state
    
    if (!data) return ''
    
    const totalPages = Math.ceil(data.total_count / pageSize)
    const start = data.offset + 1
    const end = Math.min(data.offset + data.rows.length, data.total_count)
    
    return `
      <div class="data-grid-pagination">
        <div class="pagination-info">
          Affichage ${start.toLocaleString()} à ${end.toLocaleString()} 
          sur ${data.total_count.toLocaleString()} lignes
        </div>
        
        <div class="pagination-controls">
          <button 
            class="btn-page btn-first"
            ${currentPage === 1 ? 'disabled' : ''}
            title="Première page"
          >
            ⏮
          </button>
          <button 
            class="btn-page btn-prev"
            ${currentPage === 1 ? 'disabled' : ''}
            title="Page précédente"
          >
            ◀
          </button>
          
          <span class="page-indicator">
            Page ${currentPage} / ${totalPages}
          </span>
          
          <button 
            class="btn-page btn-next"
            ${currentPage === totalPages ? 'disabled' : ''}
            title="Page suivante"
          >
            ▶
          </button>
          <button 
            class="btn-page btn-last"
            ${currentPage === totalPages ? 'disabled' : ''}
            title="Dernière page"
          >
            ⏭
          </button>
        </div>
      </div>
    `
  }
  
  protected attachEventListeners(): void {
    // Toggle mode
    this.addEventListener('.btn-mode', 'click', () => {
      const newMode = this.state.mode === 'read' ? 'edit' : 'read'
      this.setMode(newMode)
      this.emit('mode-changed', { mode: newMode })
    })
    
    // Select all
    this.addEventListener('.checkbox-all', 'change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      const selection = new Set<string>()
      
      if (checked && this.state.data) {
        this.state.data.rows.forEach(row => selection.add(row.id))
      }
      
      this.setState({ selection })
      this.emit('selection-changed', { selection })
    })
    
    // Select row
    this.addEventListener('.checkbox-row', 'change', (e) => {
      const target = e.target as HTMLInputElement
      const rowId = target.dataset.rowId!
      const selection = new Set(this.state.selection)
      
      if (target.checked) {
        selection.add(rowId)
      } else {
        selection.delete(rowId)
      }
      
      this.setState({ selection })
      this.emit('selection-changed', { selection })
    }, { all: true })
    
    // Edit cell
    this.addEventListener('.cell-editable', 'dblclick', (e) => {
      if (this.state.mode !== 'edit') return
      
      const target = e.currentTarget as HTMLElement
      const rowId = target.dataset.rowId!
      const column = target.dataset.column!
      
      this.setState({ editingCell: { rowId, column } })
    }, { all: true })
    
    // Save cell edit
    this.addEventListener('.cell-input', 'blur', (e) => {
      const target = e.target as HTMLInputElement
      const rowId = target.dataset.rowId!
      const column = target.dataset.column!
      const value = target.value
      
      this.emit('cell-updated', { rowId, column, value })
      this.setState({ editingCell: null })
    }, { all: true })
    
    // Save cell edit on Enter
    this.addEventListener('.cell-input', 'keydown', (e) => {
      const keyEvent = e as KeyboardEvent
      if (keyEvent.key === 'Enter') {
        (e.target as HTMLInputElement).blur()
      } else if (keyEvent.key === 'Escape') {
        this.setState({ editingCell: null })
      }
    }, { all: true })
    
    // Sort column
    this.addEventListener('.col-header', 'click', (e) => {
      const target = e.currentTarget as HTMLElement
      const column = target.dataset.column!
      
      let direction: 'asc' | 'desc' = 'asc'
      if (this.state.sortColumn === column && this.state.sortDirection === 'asc') {
        direction = 'desc'
      }
      
      this.setState({ sortColumn: column, sortDirection: direction })
      this.emit('sort-changed', { column, direction })
    }, { all: true })
    
    // Pagination
    this.addEventListener('.btn-first', 'click', () => {
      this.emit('page-changed', { page: 1 })
    })
    
    this.addEventListener('.btn-prev', 'click', () => {
      this.emit('page-changed', { page: this.state.currentPage - 1 })
    })
    
    this.addEventListener('.btn-next', 'click', () => {
      this.emit('page-changed', { page: this.state.currentPage + 1 })
    })
    
    this.addEventListener('.btn-last', 'click', () => {
      const totalPages = Math.ceil(this.state.data!.total_count / this.state.pageSize)
      this.emit('page-changed', { page: totalPages })
    })
    
    // Toolbar actions
    this.addEventListener('.btn-add', 'click', () => {
      this.emit('add-row')
    })
    
    this.addEventListener('.btn-delete', 'click', () => {
      if (this.state.selection.size > 0) {
        this.emit('delete-rows', { rowIds: Array.from(this.state.selection) })
      }
    })
    
    this.addEventListener('.btn-refresh', 'click', () => {
      this.emit('refresh')
    })
    
    this.addEventListener('.btn-export', 'click', () => {
      this.emit('export')
    })
  }
}
