// @ts-nocheck — fichier orphelin LitElement (lit non installé, remplacé par components-vanilla/)
// Composant grille de données avec édition inline
import { html, css, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { TableDataResponse, ColumnInfo } from '../types'
import * as api from '../api'

@customElement('db-data-grid')
export class DataGrid extends LitElement {
  @property({ type: String }) schema!: string
  @property({ type: String }) table!: string
  @property({ type: String }) mode: 'read' | 'edit' = 'read'
  @property({ type: Object }) selection = new Set<string>()
  
  @state() private data?: TableDataResponse
  @state() private loading = false
  @state() private error?: string
  @state() private editingCell?: { rowId: string; column: string }
  
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    
    .grid-container {
      height: 100%;
      overflow: auto;
      background: var(--bg-primary, #1e2530);
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    .data-table thead {
      position: sticky;
      top: 0;
      background: var(--bg-secondary, #252d3a);
      z-index: 10;
    }
    
    .data-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: var(--text-primary, #e2e8f0);
      border-bottom: 2px solid var(--border-color, #2d3748);
      white-space: nowrap;
    }
    
    .data-table th.checkbox-col {
      width: 40px;
      padding: 12px 8px;
    }
    
    .column-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .column-type {
      font-size: 10px;
      color: var(--text-secondary, #94a3b8);
      font-weight: normal;
    }
    
    .pk-badge {
      font-size: 10px;
      background: #3b82f6;
      color: white;
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    .fk-badge {
      font-size: 10px;
      background: #8b5cf6;
      color: white;
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    .data-table tbody tr {
      border-bottom: 1px solid var(--border-color, #2d3748);
      transition: background 0.2s;
    }
    
    .data-table tbody tr:hover {
      background: var(--bg-hover, #374151);
    }
    
    .data-table tbody tr.selected {
      background: rgba(59, 130, 246, 0.1);
    }
    
    .data-table td {
      padding: 10px 16px;
      color: var(--text-primary, #e2e8f0);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .data-table td.checkbox-col {
      padding: 10px 8px;
    }
    
    .cell-editable {
      cursor: text;
      position: relative;
    }
    
    .cell-editable:hover {
      background: rgba(59, 130, 246, 0.05);
    }
    
    .cell-editing {
      padding: 0;
    }
    
    .cell-input {
      width: 100%;
      padding: 10px 16px;
      background: var(--bg-primary, #1e2530);
      border: 2px solid #3b82f6;
      color: var(--text-primary, #e2e8f0);
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    
    .cell-null {
      color: var(--text-secondary, #94a3b8);
      font-style: italic;
    }
    
    .cell-boolean {
      text-align: center;
    }
    
    .cell-number {
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
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
    
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-top: 1px solid var(--border-color, #2d3748);
      background: var(--bg-secondary, #252d3a);
    }
    
    .pagination-info {
      color: var(--text-secondary, #94a3b8);
      font-size: 13px;
    }
    
    .pagination-controls {
      display: flex;
      gap: 8px;
    }
    
    .pagination-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color, #2d3748);
      background: var(--bg-primary, #1e2530);
      color: var(--text-primary, #e2e8f0);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    
    .pagination-btn:hover:not(:disabled) {
      background: var(--bg-hover, #374151);
    }
    
    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
  `
  
  async connectedCallback() {
    super.connectedCallback()
    await this.loadData()
  }
  
  async updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('schema') || changedProperties.has('table')) {
      await this.loadData()
    }
  }
  
  async loadData() {
    this.loading = true
    this.error = undefined
    
    try {
      this.data = await api.getTableData(this.schema, this.table, {
        limit: 100,
        offset: 0
      })
    } catch (err: any) {
      this.error = err.message || 'Erreur lors du chargement des données'
      console.error('Erreur loadData:', err)
    } finally {
      this.loading = false
    }
  }
  
  private toggleRowSelection(rowId: string) {
    const newSelection = new Set(this.selection)
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId)
    } else {
      newSelection.add(rowId)
    }
    
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { selection: newSelection }
    }))
  }
  
  private toggleSelectAll() {
    if (!this.data) return
    
    const allSelected = this.data.rows.every(row => this.selection.has(row.id))
    const newSelection = new Set(this.selection)
    
    if (allSelected) {
      // Désélectionner tout
      this.data.rows.forEach(row => newSelection.delete(row.id))
    } else {
      // Sélectionner tout
      this.data.rows.forEach(row => newSelection.add(row.id))
    }
    
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { selection: newSelection }
    }))
  }
  
  private startEdit(rowId: string, column: string) {
    if (this.mode !== 'edit') return
    this.editingCell = { rowId, column }
  }
  
  private async saveEdit(rowId: string, column: string, value: string) {
    try {
      // Convertir la valeur selon le type de colonne
      const col = this.data?.columns.find(c => c.name === column)
      let parsedValue: any = value
      
      if (col) {
        if (value === '' || value.toLowerCase() === 'null') {
          parsedValue = null
        } else if (col.data_type === 'integer' || col.data_type === 'bigint') {
          parsedValue = parseInt(value, 10)
        } else if (col.data_type === 'numeric' || col.data_type === 'real' || col.data_type === 'double precision') {
          parsedValue = parseFloat(value)
        } else if (col.data_type === 'boolean') {
          parsedValue = value.toLowerCase() === 'true' || value === '1'
        }
      }
      
      await api.updateCell(this.schema, this.table, rowId, column, parsedValue)
      
      // Recharger les données
      await this.loadData()
    } catch (err) {
      console.error('Erreur saveEdit:', err)
      alert('Erreur lors de la sauvegarde')
    } finally {
      this.editingCell = undefined
    }
  }
  
  private cancelEdit() {
    this.editingCell = undefined
  }
  
  render() {
    if (this.loading) {
      return html`<div class="loading">Chargement des données...</div>`
    }
    
    if (this.error) {
      return html`<div class="error">${this.error}</div>`
    }
    
    if (!this.data) {
      return html`<div class="loading">Aucune donnée</div>`
    }
    
    return html`
      <div class="grid-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="checkbox-col">
                <input 
                  type="checkbox" 
                  @change=${this.toggleSelectAll}
                  .checked=${this.data.rows.length > 0 && this.data.rows.every(r => this.selection.has(r.id))}
                />
              </th>
              ${this.data.columns.map(col => this.renderColumnHeader(col))}
            </tr>
          </thead>
          <tbody>
            ${this.data.rows.map(row => this.renderRow(row))}
          </tbody>
        </table>
      </div>
      
      ${this.renderPagination()}
    `
  }
  
  private renderColumnHeader(column: ColumnInfo) {
    return html`
      <th>
        <div class="column-header">
          <span>${column.name}</span>
          ${column.is_primary_key ? html`<span class="pk-badge">PK</span>` : null}
          ${column.is_foreign_key ? html`<span class="fk-badge">FK</span>` : null}
          <span class="column-type">${column.data_type}</span>
        </div>
      </th>
    `
  }
  
  private renderRow(row: Record<string, any>) {
    const rowId = row.id
    const isSelected = this.selection.has(rowId)
    
    return html`
      <tr class="${isSelected ? 'selected' : ''}">
        <td class="checkbox-col">
          <input 
            type="checkbox" 
            .checked=${isSelected}
            @change=${() => this.toggleRowSelection(rowId)}
          />
        </td>
        ${this.data!.columns.map(col => this.renderCell(rowId, col, row[col.name]))}
      </tr>
    `
  }
  
  private renderCell(rowId: string, column: ColumnInfo, value: any) {
    const isEditing = this.editingCell?.rowId === rowId && this.editingCell?.column === column.name
    const isEditable = this.mode === 'edit' && !column.is_primary_key
    
    if (isEditing) {
      return html`
        <td class="cell-editing">
          <input 
            type="text" 
            class="cell-input"
            .value=${value?.toString() || ''}
            @blur=${(e: Event) => this.saveEdit(rowId, column.name, (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                this.saveEdit(rowId, column.name, (e.target as HTMLInputElement).value)
              } else if (e.key === 'Escape') {
                this.cancelEdit()
              }
            }}
            autofocus
          />
        </td>
      `
    }
    
    const cellClass = `
      ${isEditable ? 'cell-editable' : ''}
      ${value === null ? 'cell-null' : ''}
      ${column.data_type === 'boolean' ? 'cell-boolean' : ''}
      ${['integer', 'bigint', 'numeric', 'real', 'double precision'].includes(column.data_type) ? 'cell-number' : ''}
    `.trim()
    
    return html`
      <td 
        class="${cellClass}"
        @dblclick=${() => isEditable && this.startEdit(rowId, column.name)}
        title="${value?.toString() || 'NULL'}"
      >
        ${this.formatCellValue(value, column.data_type)}
      </td>
    `
  }
  
  private formatCellValue(value: any, dataType: string): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    
    if (dataType === 'boolean') {
      return value ? '✓' : '✗'
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    
    return value.toString()
  }
  
  private renderPagination() {
    if (!this.data) return null
    
    const { offset, limit, total_count } = this.data
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total_count / limit)
    const start = offset + 1
    const end = Math.min(offset + limit, total_count)
    
    return html`
      <div class="pagination">
        <div class="pagination-info">
          Affichage ${start} à ${end} sur ${total_count.toLocaleString()} lignes
        </div>
        <div class="pagination-controls">
          <button 
            class="pagination-btn"
            ?disabled=${currentPage === 1}
            @click=${() => this.goToPage(1)}
          >
            ⏮ Début
          </button>
          <button 
            class="pagination-btn"
            ?disabled=${currentPage === 1}
            @click=${() => this.goToPage(currentPage - 1)}
          >
            ◀ Précédent
          </button>
          <span class="pagination-info">
            Page ${currentPage} / ${totalPages}
          </span>
          <button 
            class="pagination-btn"
            ?disabled=${currentPage === totalPages}
            @click=${() => this.goToPage(currentPage + 1)}
          >
            Suivant ▶
          </button>
          <button 
            class="pagination-btn"
            ?disabled=${currentPage === totalPages}
            @click=${() => this.goToPage(totalPages)}
          >
            Fin ⏭
          </button>
        </div>
      </div>
    `
  }
  
  private async goToPage(page: number) {
    if (!this.data) return
    
    const offset = (page - 1) * this.data.limit
    
    this.loading = true
    try {
      this.data = await api.getTableData(this.schema, this.table, {
        limit: this.data.limit,
        offset
      })
    } catch (err) {
      console.error('Erreur pagination:', err)
    } finally {
      this.loading = false
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'db-data-grid': DataGrid
  }
}
