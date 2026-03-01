// Composant arbre de schéma en vanilla TypeScript
import { BaseComponent } from './BaseComponent'
import type { SchemaInfo, TableInfo } from '../types'

interface SchemaTreeState {
  schemas: SchemaInfo[]
  expandedSchemas: Set<string>
  selectedTable: { schema: string; table: string } | null
  loading: boolean
  error: string | null
  searchQuery: string
}

export class SchemaTreeComponent extends BaseComponent<SchemaTreeState> {
  constructor(container: HTMLElement) {
    super(container, {
      schemas: [],
      expandedSchemas: new Set(),
      selectedTable: null,
      loading: false,
      error: null,
      searchQuery: ''
    })
  }
  
  /**
   * Charge les schémas depuis l'API
   */
  public async loadSchemas(schemas: SchemaInfo[]): Promise<void> {
    this.setState({ schemas, loading: false, error: null })
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
   * Filtre les schémas selon la recherche
   */
  private getFilteredSchemas(): SchemaInfo[] {
    const query = this.state.searchQuery.toLowerCase()
    if (!query) return this.state.schemas
    
    return this.state.schemas
      .map(schema => ({
        ...schema,
        tables: schema.tables.filter(table =>
          table.name.toLowerCase().includes(query) ||
          schema.name.toLowerCase().includes(query)
        )
      }))
      .filter(schema => schema.tables.length > 0)
  }
  
  protected render(): string {
    if (this.state.loading) {
      return `
        <div class="schema-tree-loading">
          <div class="spinner"></div>
          <p>Chargement du schéma...</p>
        </div>
      `
    }
    
    if (this.state.error) {
      return `
        <div class="schema-tree-error">
          <span class="error-icon">⚠️</span>
          <p>${this.state.error}</p>
          <button class="btn-retry">Réessayer</button>
        </div>
      `
    }
    
    const filteredSchemas = this.getFilteredSchemas()
    
    return `
      <div class="schema-tree">
        <div class="schema-tree-header">
          <h3>Schéma de la base</h3>
          <input 
            type="text" 
            class="schema-search" 
            placeholder="Rechercher..."
            value="${this.state.searchQuery}"
          />
        </div>
        
        <div class="schema-tree-content">
          ${filteredSchemas.length === 0 ? this.renderEmpty() : ''}
          ${filteredSchemas.map(schema => this.renderSchema(schema)).join('')}
        </div>
        
        <div class="schema-tree-footer">
          <small>${this.getTotalTablesCount()} tables au total</small>
        </div>
      </div>
    `
  }
  
  private renderEmpty(): string {
    return `
      <div class="schema-tree-empty">
        <span class="empty-icon">🔍</span>
        <p>Aucune table trouvée</p>
      </div>
    `
  }
  
  private renderSchema(schema: SchemaInfo): string {
    const isExpanded = this.state.expandedSchemas.has(schema.name)
    const tableCount = schema.tables.length
    
    return `
      <div class="schema-item" data-schema="${schema.name}">
        <div class="schema-header" data-schema="${schema.name}">
          <span class="schema-icon ${isExpanded ? 'expanded' : ''}">
            ${isExpanded ? '📂' : '📁'}
          </span>
          <span class="schema-name">${schema.name}</span>
          <span class="schema-count">${tableCount}</span>
        </div>
        
        ${isExpanded ? `
          <div class="schema-tables">
            ${schema.tables.map(table => this.renderTable(schema.name, table)).join('')}
          </div>
        ` : ''}
      </div>
    `
  }
  
  private renderTable(schemaName: string, table: TableInfo): string {
    const isSelected = 
      this.state.selectedTable?.schema === schemaName &&
      this.state.selectedTable?.table === table.name
    
    const icon = table.table_type === 'VIEW' ? '👁️' : '📊'
    const typeLabel = table.table_type === 'VIEW' ? 'Vue' : 'Table'
    
    return `
      <div 
        class="table-item ${isSelected ? 'selected' : ''}"
        data-schema="${schemaName}"
        data-table="${table.name}"
        data-type="${table.table_type}"
      >
        <span class="table-icon">${icon}</span>
        <div class="table-info">
          <span class="table-name">${table.name}</span>
          <span class="table-meta">
            ${typeLabel} · ${table.row_count?.toLocaleString() ?? '?'} lignes
          </span>
        </div>
      </div>
    `
  }
  
  private getTotalTablesCount(): number {
    return this.state.schemas.reduce((sum, schema) => sum + schema.tables.length, 0)
  }
  
  protected attachEventListeners(): void {
    // Toggle schema expansion
    this.addEventListener('.schema-header', 'click', (e) => {
      const target = e.currentTarget as HTMLElement
      const schemaName = target.dataset.schema!
      
      const expanded = new Set(this.state.expandedSchemas)
      if (expanded.has(schemaName)) {
        expanded.delete(schemaName)
      } else {
        expanded.add(schemaName)
      }
      
      this.setState({ expandedSchemas: expanded })
    }, { all: true })
    
    // Select table
    this.addEventListener('.table-item', 'click', (e) => {
      const target = e.currentTarget as HTMLElement
      const schema = target.dataset.schema!
      const table = target.dataset.table!
      
      this.setState({
        selectedTable: { schema, table }
      })
      
      this.emit('table-selected', { schema, table })
    }, { all: true })
    
    // Search
    this.addEventListener('.schema-search', 'input', (e) => {
      const target = e.target as HTMLInputElement
      this.setState({ searchQuery: target.value })
    })
    
    // Retry on error
    this.addEventListener('.btn-retry', 'click', () => {
      this.emit('retry-load')
    })
  }
}
