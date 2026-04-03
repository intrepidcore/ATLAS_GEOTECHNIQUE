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
  activeTab: 'data' | 'infer_opti' | 'audit' | 'expert_scientifique'
  aiStatus: string | null
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
      currentTable: null,
      activeTab: 'data',
      aiStatus: null
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
    
    const isData = this.state.activeTab === 'data'
    const isInferOpti = this.state.activeTab === 'infer_opti'
    const isAudit = this.state.activeTab === 'audit'
    const isExpertScientific = this.state.activeTab === 'expert_scientifique'
    return `
      <div class="db-modal-body">
        <div class="db-sidebar">
          <div class="db-tabs">
            <button class="db-tab ${isData ? 'active' : ''}" data-tab="data">Données</button>
            <button class="db-tab ${isInferOpti ? 'active' : ''}" data-tab="infer_opti">Pipeline</button>
            <button class="db-tab ${isAudit ? 'active' : ''}" data-tab="audit">Audit</button>
            <button class="db-tab ${isExpertScientific ? 'active' : ''}" data-tab="expert_scientifique">Expert scientifique avancé</button>
          </div>
          <div id="schema-tree-container" style="${isData ? '' : 'display:none'}"></div>
          <div id="infer-opti-container" style="${isInferOpti ? '' : 'display:none'}">
            ${this.renderInferOptiPanel()}
          </div>
          <div id="audit-container" style="${isAudit ? '' : 'display:none'}">
            <div style="padding:16px;color:#94a3b8;font-size:12px">
              Audit: métriques (LOO / CV) à partir des tables <code style="color:#e2e8f0">atlas.ai_variograms</code>.
            </div>
          </div>
          <div id="expert-scientifique-container" style="${isExpertScientific ? '' : 'display:none'}"></div>
        </div>
        <div class="db-main" id="data-grid-container" style="${isData ? '' : 'display:none'}"></div>
        <div class="db-main" id="infer-opti-main" style="${isInferOpti ? '' : 'display:none'}">
          ${this.renderInferOptiMain()}
        </div>
        <div class="db-main" id="audit-main" style="${isAudit ? '' : 'display:none'}">
          ${this.renderAuditMain()}
        </div>
        <div class="db-main" id="expert-scientifique-main" style="${isExpertScientific ? '' : 'display:none'}">
          ${this.renderExpertScientificMain()}
        </div>
      </div>
    `
  }

  private renderInferOptiPanel(): string {
    const status = this.state.aiStatus
    return `
      <div class="infer-opti-sidebar">
        <div class="infer-opti-title">Pipeline</div>
        <div class="infer-opti-sub">Pilotage IA (recalculs, jobs) + historique runs.</div>
        <div class="infer-opti-actions">
          <button class="btn-ai" data-action="refresh-sources">Recalculer sources IA/AG</button>
          <button class="btn-ai" data-action="kriging">Recalculer Kriging (GP)</button>
          <button class="btn-ai primary" data-action="train">Entraîner + Inférer (supervisé)</button>
          <button class="btn-ai" data-action="jobs-run">Exécuter 1 job en file</button>
          <button class="btn-ai" data-action="jobs-refresh">Rafraîchir jobs</button>
        </div>
        <div class="infer-opti-status">
          <div class="label">Statut</div>
          <pre class="status-box">${status ? this.escapeHtml(status) : '—'}</pre>
        </div>
      </div>
    `
  }

  private renderInferOptiMain(): string {
    return `
      <div class="infer-opti-main">
        <div class="infer-opti-main-header">
          <div>
            <div class="infer-opti-h1">Pipeline</div>
            <div class="infer-opti-h2">Jobs récents + historique des runs d'interpolation.</div>
          </div>
          <div class="infer-opti-main-cta">
            <button class="btn-ai small" data-action="jobs-refresh">Rafraîchir</button>
          </div>
        </div>
        <div class="infer-opti-jobs">
          <div class="infer-opti-subtitle" style="margin:10px 0 6px;color:#94a3b8;font-size:12px">Jobs récents</div>
          <table class="jobs-table">
            <thead>
              <tr>
                <th>Demandé</th>
                <th>Cible</th>
                <th>Statut</th>
                <th>Raison</th>
              </tr>
            </thead>
            <tbody id="ai-jobs-tbody">
              <tr><td colspan="4" style="color:#94a3b8">Charge les jobs…</td></tr>
            </tbody>
          </table>
        </div>
        <div class="infer-opti-run-history" style="margin-top:18px">
          <div class="infer-opti-subtitle" style="margin:10px 0 6px;color:#94a3b8;font-size:12px">Historique interpolation (runs)</div>
          <table class="jobs-table">
            <thead>
              <tr>
                <th>run_id</th>
                <th>parameter</th>
                <th>zone</th>
                <th>statut</th>
              </tr>
            </thead>
            <tbody id="pipeline-runs-tbody">
              <tr><td colspan="4" style="color:#94a3b8">Charge les runs…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  private renderAuditMain(): string {
    return `
      <div class="infer-opti-main">
        <div class="infer-opti-main-header">
          <div>
            <div class="infer-opti-h1">Audit</div>
            <div class="infer-opti-h2">Métriques variogrammes (ai_variograms) — LOO / CV.</div>
          </div>
          <div class="infer-opti-main-cta">
            <button class="btn-ai small" data-action="jobs-refresh">Rafraîchir</button>
          </div>
        </div>

        <div id="audit-status" style="margin:10px 0 8px 0;color:#94a3b8;font-size:12px">Prêt.</div>

        <div class="infer-opti-run-history">
          <table class="jobs-table">
            <thead>
              <tr>
                <th>parameter_id</th>
                <th>kriging_domain_id</th>
                <th>loo_rmse</th>
                <th>block_cv_rmse</th>
                <th>spatial_kfold_rmse</th>
              </tr>
            </thead>
            <tbody id="audit-variograms-tbody">
              <tr><td colspan="5" style="color:#94a3b8">Charge les variogrammes…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  private renderExpertScientificMain(): string {
    return `
      <div class="infer-opti-main">
        <div class="infer-opti-main-header">
          <div>
            <div class="infer-opti-h1">Expert scientifique avancé</div>
            <div class="infer-opti-h2">P8: catalogue de paramètres, file de jobs et cache des plots.</div>
          </div>
          <div class="infer-opti-main-cta">
            <button class="btn-ai small" data-action="expert-refresh">Rafraîchir</button>
          </div>
        </div>

        <div id="expert-scientifique-status" style="margin:10px 0 8px 0;color:#94a3b8;font-size:12px">Prêt.</div>

        <div class="infer-opti-run-history" style="margin-top:12px">
          <table class="jobs-table">
            <thead>
              <tr>
                <th>parameter_id</th>
                <th>category</th>
                <th>source</th>
                <th>min_pts_strat</th>
              </tr>
            </thead>
            <tbody id="expert-parameter-catalog-tbody">
              <tr><td colspan="4" style="color:#94a3b8">Charge les paramètres…</td></tr>
            </tbody>
          </table>
        </div>

        <div class="infer-opti-run-history" style="margin-top:14px">
          <table class="jobs-table">
            <thead>
              <tr>
                <th>requested_at</th>
                <th>parameter_id</th>
                <th>job_type</th>
                <th>status</th>
              </tr>
            </thead>
            <tbody id="expert-job-queue-tbody">
              <tr><td colspan="4" style="color:#94a3b8">Charge la file de jobs…</td></tr>
            </tbody>
          </table>
        </div>

        <div class="infer-opti-run-history" style="margin-top:14px">
          <table class="jobs-table">
            <thead>
              <tr>
                <th>updated_at</th>
                <th>cache_key</th>
                <th>parameter_id</th>
                <th>horizon_label</th>
              </tr>
            </thead>
            <tbody id="expert-plot-cache-tbody">
              <tr><td colspan="4" style="color:#94a3b8">Charge le cache des plots…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  private escapeHtml(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
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

        .db-tabs {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid #2d3748;
          position: sticky;
          top: 0;
          background: #252d3a;
          z-index: 2;
        }
        .db-tab {
          flex: 1;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #2d3748;
          background: #1e2530;
          color: #cbd5e1;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }
        .db-tab.active {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.14);
          color: #e2e8f0;
        }

        /* Infer/Opti UI */
        .infer-opti-sidebar { padding: 12px; }
        .infer-opti-title { color:#e2e8f0; font-weight:800; font-size:14px; letter-spacing:0.2px; }
        .infer-opti-sub { color:#94a3b8; font-size:12px; margin-top:4px; margin-bottom:12px; }
        .infer-opti-actions { display:flex; flex-direction:column; gap:8px; }
        .btn-ai {
          padding: 10px 10px;
          border-radius: 10px;
          border: 1px solid #2d3748;
          background: #111827;
          color: #e2e8f0;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          text-align:left;
        }
        .btn-ai.primary { border-color:#3b82f6; background: rgba(59,130,246,0.18); }
        .btn-ai.small { padding: 8px 10px; font-size: 12px; }
        .btn-ai:hover { background:#0b1220; }
        .infer-opti-status { margin-top:12px; }
        .infer-opti-status .label { color:#94a3b8; font-size:12px; margin-bottom:6px; }
        .status-box {
          background:#0b1220;
          border:1px solid #2d3748;
          border-radius:10px;
          padding:10px;
          color:#e2e8f0;
          font-size:11px;
          max-height:160px;
          overflow:auto;
          white-space:pre-wrap;
        }
        .infer-opti-main { padding: 16px; overflow:auto; }
        .infer-opti-main-header { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; }
        .infer-opti-h1 { color:#e2e8f0; font-weight:900; font-size:18px; }
        .infer-opti-h2 { color:#94a3b8; font-size:12px; margin-top:4px; }
        .jobs-table {
          width:100%;
          border-collapse:collapse;
          margin-top:14px;
          background:#0b1220;
          border:1px solid #2d3748;
          border-radius:12px;
          overflow:hidden;
        }
        .jobs-table th, .jobs-table td {
          padding: 10px 10px;
          border-bottom: 1px solid #1f2937;
          color:#e2e8f0;
          font-size: 12px;
        }
        .jobs-table th { color:#94a3b8; font-weight:700; text-transform:uppercase; font-size:11px; letter-spacing:0.08em; }
        .jobs-table tr:last-child td { border-bottom:none; }
        
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

    // Tabs
    this.addEventListener('.db-tab', 'click', (e) => {
      const el = e.currentTarget as HTMLElement
      const tab = (el.getAttribute('data-tab') || 'data') as 'data' | 'infer_opti' | 'audit' | 'expert_scientifique'
      this.setState({ activeTab: tab })
      if (tab === 'infer_opti') void this.refreshAiJobs()
      if (tab === 'infer_opti') void this.refreshPipelineRuns()
      if (tab === 'audit') void this.refreshAuditVariograms()
      if (tab === 'expert_scientifique') void this.refreshExpertScientific()
    })

    // Infer/Opti actions
    this.addEventListener('.btn-ai', 'click', async (e) => {
      const el = e.currentTarget as HTMLElement
      const action = el.getAttribute('data-action') || ''
      await this.handleAiAction(action)
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

  private async handleAiAction(action: string): Promise<void> {
    try {
      this.setState({ aiStatus: `⏳ ${action}…` })
      if (action === 'refresh-sources') {
        const r = await api.aiRefreshSources()
        this.setState({ aiStatus: JSON.stringify(r, null, 2) })
      } else if (action === 'kriging') {
        const r = await api.aiRecomputeKriging()
        this.setState({ aiStatus: JSON.stringify(r, null, 2) })
      } else if (action === 'train') {
        const r = await api.aiTrainSupervised()
        this.setState({ aiStatus: JSON.stringify(r, null, 2) })
      } else if (action === 'jobs-run') {
        const r = await api.aiJobsRunOnce(1)
        this.setState({ aiStatus: JSON.stringify(r, null, 2) })
        await this.refreshAiJobs()
        await this.refreshPipelineRuns()
        await this.refreshAuditVariograms()
      } else if (action === 'jobs-refresh') {
        await this.refreshAiJobs()
        await this.refreshPipelineRuns()
        await this.refreshAuditVariograms()
      } else if (action === 'expert-refresh') {
        await this.refreshExpertScientific()
      } else {
        this.setState({ aiStatus: `Action inconnue: ${action}` })
      }
    } catch (err: any) {
      this.setState({ aiStatus: `❌ ${err?.message || String(err)}` })
    }
  }

  private async refreshAiJobs(): Promise<void> {
    try {
      const data = await api.aiJobsRecent()
      const tbody = this.container.querySelector('#ai-jobs-tbody') as HTMLElement | null
      if (!tbody) return
      const jobs = data?.jobs || []
      if (!Array.isArray(jobs) || jobs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#94a3b8">Aucun job.</td></tr>`
        return
      }
      tbody.innerHTML = jobs.slice(0, 30).map((j: any) => {
        const req = (j.requested_at || '').replace('T', ' ').slice(0, 19)
        const status = (j.status || '—')
        const target = (j.model_target || '—')
        const reason = (j.trigger_reason || '—')
        return `<tr>
          <td>${this.escapeHtml(req)}</td>
          <td>${this.escapeHtml(target)}</td>
          <td>${this.escapeHtml(status)}</td>
          <td>${this.escapeHtml(reason)}</td>
        </tr>`
      }).join('')
    } catch (err: any) {
      this.setState({ aiStatus: `❌ jobs: ${err?.message || String(err)}` })
    }
  }

  private async refreshPipelineRuns(): Promise<void> {
    try {
      const data = await api.getTableData('atlas', 'ai_interpolation_runs', {
        limit: 30,
        offset: 0,
        // ordering best-effort: may fail if column name differs
        order_by: 'created_at',
        order_dir: 'DESC',
      })

      const tbody = this.container.querySelector('#pipeline-runs-tbody') as HTMLElement | null
      if (!tbody) return

      const rows = data?.rows || []
      if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#94a3b8">Aucun run.</td></tr>`
        return
      }

      const toStr = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

      tbody.innerHTML = rows
        .slice(0, 30)
        .map((r: any) => {
          const runId = r.id ?? r.run_id ?? '—'
          const param = r.parameter_id ?? '—'
          const zone = r.zone_id ?? r.kriging_domain_id ?? '—'
          const status = r.status ?? '—'

          return `
            <tr>
              <td>${this.escapeHtml(toStr(runId))}</td>
              <td>${this.escapeHtml(toStr(param))}</td>
              <td>${this.escapeHtml(toStr(zone))}</td>
              <td>${this.escapeHtml(toStr(status))}</td>
            </tr>
          `
        })
        .join('')
    } catch (err: any) {
      this.setState({ aiStatus: `❌ runs: ${err?.message || String(err)}` })
    }
  }

  private async refreshAuditVariograms(): Promise<void> {
    try {
      const data = await api.getTableData('atlas', 'ai_variograms', {
        limit: 40,
        offset: 0,
      })

      const tbody = this.container.querySelector('#audit-variograms-tbody') as HTMLElement | null
      if (!tbody) return

      const rows = data?.rows || []
      if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#94a3b8">Aucun résultat.</td></tr>`
        return
      }

      const fmt = (v: any) => {
        if (v === null || v === undefined || v === '') return '—'
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n)) return String(v)
        return n.toFixed(3)
      }

      tbody.innerHTML = rows
        .slice(0, 40)
        .map((r: any) => {
          const param = r.parameter_id ?? '—'
          const domain = r.kriging_domain_id ?? '—'
          return `
            <tr>
              <td>${this.escapeHtml(String(param))}</td>
              <td>${this.escapeHtml(String(domain))}</td>
              <td>${fmt(r.loo_rmse)}</td>
              <td>${fmt(r.block_cv_rmse)}</td>
              <td>${fmt(r.spatial_kfold_rmse)}</td>
            </tr>
          `
        })
        .join('')
    } catch (err: any) {
      this.setState({ aiStatus: `❌ audit: ${err?.message || String(err)}` })
    }
  }

  private async refreshExpertScientific(): Promise<void> {
    try {
      const statusEl = this.container.querySelector('#expert-scientifique-status') as HTMLElement | null
      if (statusEl) statusEl.textContent = 'Chargement…'

      const [catalog, jobQueue, plotCache] = await Promise.all([
        api.getTableData('atlas', 'ai_parameter_catalog', {
          limit: 40,
          offset: 0,
          order_by: 'parameter_id',
          order_dir: 'ASC',
        }),
        api.getTableData('atlas', 'ai_job_queue', {
          limit: 40,
          offset: 0,
          order_by: 'requested_at',
          order_dir: 'DESC',
        }),
        api.getTableData('atlas', 'ai_plot_cache', {
          limit: 40,
          offset: 0,
          order_by: 'updated_at',
          order_dir: 'DESC',
        }),
      ])

      const catalogTbody = this.container.querySelector('#expert-parameter-catalog-tbody') as HTMLElement | null
      if (catalogTbody) {
        const rows = catalog?.rows || []
        catalogTbody.innerHTML =
          !Array.isArray(rows) || rows.length === 0
            ? `<tr><td colspan="4" style="color:#94a3b8">Aucun param.</td></tr>`
            : rows
                .slice(0, 40)
                .map((r: any) => {
                  return `
                    <tr>
                      <td>${this.escapeHtml(String(r.parameter_id ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.category ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.source ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.min_pts_stratified ?? '—'))}</td>
                    </tr>
                  `
                })
                .join('')
      }

      const jobTbody = this.container.querySelector('#expert-job-queue-tbody') as HTMLElement | null
      if (jobTbody) {
        const rows = jobQueue?.rows || []
        jobTbody.innerHTML =
          !Array.isArray(rows) || rows.length === 0
            ? `<tr><td colspan="4" style="color:#94a3b8">Aucun job.</td></tr>`
            : rows
                .slice(0, 40)
                .map((r: any) => {
                  return `
                    <tr>
                      <td>${this.escapeHtml(String(r.requested_at ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.parameter_id ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.job_type ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.status ?? '—'))}</td>
                    </tr>
                  `
                })
                .join('')
      }

      const cacheTbody = this.container.querySelector('#expert-plot-cache-tbody') as HTMLElement | null
      if (cacheTbody) {
        const rows = plotCache?.rows || []
        cacheTbody.innerHTML =
          !Array.isArray(rows) || rows.length === 0
            ? `<tr><td colspan="4" style="color:#94a3b8">Cache vide.</td></tr>`
            : rows
                .slice(0, 40)
                .map((r: any) => {
                  return `
                    <tr>
                      <td>${this.escapeHtml(String(r.updated_at ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.cache_key ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.parameter_id ?? '—'))}</td>
                      <td>${this.escapeHtml(String(r.horizon_label ?? '—'))}</td>
                    </tr>
                  `
                })
                .join('')
      }

      if (statusEl) statusEl.textContent = 'Chargé.'
    } catch (err: any) {
      this.setState({ aiStatus: `❌ expert_scientifique: ${err?.message || String(err)}` })
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
