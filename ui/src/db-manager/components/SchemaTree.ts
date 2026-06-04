// @ts-nocheck — fichier orphelin LitElement (lit non installé, remplacé par components-vanilla/)
// Composant arbre de schéma (sidebar gauche)
import { html, css, LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { DatabaseSchema, SchemaInfo, TableInfo } from '../types'

@customElement('db-schema-tree')
export class SchemaTree extends LitElement {
  @property({ type: Object }) schema?: DatabaseSchema
  @property({ type: String }) selectedSchema?: string
  @property({ type: String }) selectedTable?: string
  
  @state() private expandedSchemas = new Set<string>()
  
  static styles = css`
    :host {
      display: block;
    }
    
    .schema-item {
      margin-bottom: 8px;
    }
    
    .schema-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      cursor: pointer;
      border-radius: 6px;
      transition: background 0.2s;
      user-select: none;
    }
    
    .schema-header:hover {
      background: var(--bg-hover, #374151);
    }
    
    .schema-icon {
      font-size: 14px;
      transition: transform 0.2s;
    }
    
    .schema-icon.expanded {
      transform: rotate(90deg);
    }
    
    .schema-name {
      font-weight: 500;
      color: var(--text-primary, #e2e8f0);
      flex: 1;
    }
    
    .schema-count {
      font-size: 11px;
      color: var(--text-secondary, #94a3b8);
      background: var(--bg-primary, #1e2530);
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .tables-list {
      margin-left: 20px;
      margin-top: 4px;
    }
    
    .table-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
      margin-bottom: 2px;
    }
    
    .table-item:hover {
      background: var(--bg-hover, #374151);
    }
    
    .table-item.selected {
      background: #3b82f6;
      color: white;
    }
    
    .table-icon {
      font-size: 12px;
    }
    
    .table-name {
      flex: 1;
      font-size: 13px;
    }
    
    .table-rows {
      font-size: 10px;
      color: var(--text-secondary, #94a3b8);
    }
    
    .table-item.selected .table-rows {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .geom-badge {
      font-size: 10px;
      background: #10b981;
      color: white;
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    .views-section {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-color, #2d3748);
    }
    
    .section-title {
      font-size: 11px;
      color: var(--text-secondary, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      margin-bottom: 4px;
    }
    
    .view-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 13px;
      color: var(--text-secondary, #94a3b8);
      margin-bottom: 2px;
    }
    
    .view-icon {
      font-size: 12px;
    }
    
    .empty {
      padding: 16px;
      text-align: center;
      color: var(--text-secondary, #94a3b8);
      font-size: 13px;
    }
  `
  
  private toggleSchema(schemaName: string) {
    if (this.expandedSchemas.has(schemaName)) {
      this.expandedSchemas.delete(schemaName)
    } else {
      this.expandedSchemas.add(schemaName)
    }
    this.requestUpdate()
  }
  
  private selectTable(schemaName: string, tableName: string) {
    this.dispatchEvent(new CustomEvent('select', {
      detail: { schema: schemaName, table: tableName }
    }))
  }
  
  render() {
    if (!this.schema || this.schema.schemas.length === 0) {
      return html`<div class="empty">Aucun schéma disponible</div>`
    }
    
    return html`
      ${this.schema.schemas.map(schema => this.renderSchema(schema))}
    `
  }
  
  private renderSchema(schema: SchemaInfo) {
    const isExpanded = this.expandedSchemas.has(schema.name)
    const tableCount = schema.tables.length
    const viewCount = schema.views.length
    
    return html`
      <div class="schema-item">
        <div class="schema-header" @click=${() => this.toggleSchema(schema.name)}>
          <span class="schema-icon ${isExpanded ? 'expanded' : ''}">▶</span>
          <span class="schema-name">${schema.name}</span>
          <span class="schema-count">${tableCount + viewCount}</span>
        </div>
        
        ${isExpanded ? html`
          <div class="tables-list">
            ${tableCount > 0 ? html`
              <div class="section-title">Tables</div>
              ${schema.tables.map(table => this.renderTable(schema.name, table))}
            ` : null}
            
            ${viewCount > 0 ? html`
              <div class="views-section">
                <div class="section-title">Vues</div>
                ${schema.views.map(view => this.renderView(view))}
              </div>
            ` : null}
          </div>
        ` : null}
      </div>
    `
  }
  
  private renderTable(schemaName: string, table: TableInfo) {
    const isSelected = this.selectedSchema === schemaName && this.selectedTable === table.name
    
    return html`
      <div 
        class="table-item ${isSelected ? 'selected' : ''}"
        @click=${() => this.selectTable(schemaName, table.name)}
      >
        <span class="table-icon">📊</span>
        <span class="table-name">${table.name}</span>
        ${table.has_geom ? html`<span class="geom-badge">🗺️</span>` : null}
        <span class="table-rows">${table.row_count.toLocaleString()}</span>
      </div>
    `
  }
  
  private renderView(view: any) {
    return html`
      <div class="view-item">
        <span class="view-icon">${view.is_materialized ? '📦' : '👁️'}</span>
        <span>${view.name}</span>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'db-schema-tree': SchemaTree
  }
}
