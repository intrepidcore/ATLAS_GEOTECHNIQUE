/**
 * Modal Central "Sondages" avec onglets verticaux
 * v2.5.0 - Approche Modal
 */

import { GeotechnicalFormManager } from '../geotechnical-form'
import { ImportWizardV2 } from '../import-wizard-v2'
import { SuggestionsPanel } from '../suggestions-panel'

type TabId = 'nouveau' | 'import' | 'liste' | 'geocode' | 'suggestions'

export class SondagesModal {
  private modal: HTMLElement | null = null
  private activeTab: TabId = 'nouveau'
  private formManager: GeotechnicalFormManager | null = null
  private importWizard: ImportWizardV2 | null = null
  private suggestionsPanel: SuggestionsPanel | null = null
  
  constructor(private apiUrl: string) {}
  
  open() {
    if (this.modal) return // Déjà ouvert
    
    this.render()
    this.initComponents()
    this.switchTab('nouveau')
  }
  
  close() {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }
  
  private render() {
    this.modal = document.createElement('div')
    this.modal.className = 'sondages-modal-overlay'
    this.modal.innerHTML = `
      <div class="sondages-modal">
        <div class="sondages-modal-header">
          <h2>📋 Panneau Sondages</h2>
          <button class="modal-close" aria-label="Fermer">×</button>
        </div>
        
        <div class="sondages-modal-body">
          <nav class="sondages-tabs-vertical">
            <button class="tab-vertical active" data-tab="nouveau">
              <span class="tab-icon">📝</span>
              <span class="tab-label">Nouveau</span>
            </button>
            <button class="tab-vertical" data-tab="import">
              <span class="tab-icon">📥</span>
              <span class="tab-label">Import</span>
            </button>
            <button class="tab-vertical" data-tab="liste">
              <span class="tab-icon">📋</span>
              <span class="tab-label">Liste</span>
            </button>
            <button class="tab-vertical" data-tab="geocode">
              <span class="tab-icon">🗺️</span>
              <span class="tab-label">Géocoder</span>
            </button>
            <button class="tab-vertical" data-tab="suggestions">
              <span class="tab-icon">🤖</span>
              <span class="tab-label">Suggestions</span>
            </button>
          </nav>
          
          <div class="sondages-content">
            <div class="tab-pane" data-tab="nouveau"></div>
            <div class="tab-pane" data-tab="import"></div>
            <div class="tab-pane" data-tab="liste"></div>
            <div class="tab-pane" data-tab="geocode"></div>
            <div class="tab-pane" data-tab="suggestions"></div>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(this.modal)
    
    // Event listeners
    this.modal.querySelector('.modal-close')?.addEventListener('click', () => this.close())
    this.modal.querySelector('.sondages-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close()
    })
    
    this.modal.querySelectorAll('.tab-vertical').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as TabId
        this.switchTab(tab)
      })
    })
    
    // Escape key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', escHandler)
  }
  
  private initComponents() {
    // Nouveau: Injecter le formulaire DANS la zone
    const nouveauPane = this.modal?.querySelector('[data-tab="nouveau"]') as HTMLElement
    if (nouveauPane) {
      nouveauPane.innerHTML = '<div id="modal-geotech-form-container"></div>'
      // Attendre que le DOM soit prêt
      setTimeout(() => {
        const container = document.getElementById('modal-geotech-form-container')
        if (container && (window as any).geotechnicalFormManager) {
          (window as any).geotechnicalFormManager.initForm('modal-geotech-form-container')
        }
      }, 100)
    }
    
    // Import: Injecter Import Wizard DANS la zone
    const importPane = this.modal?.querySelector('[data-tab="import"]') as HTMLElement
    if (importPane) {
      importPane.innerHTML = `
        <div style="padding: 24px;">
          <h3 style="margin-bottom: 16px;">📥 Import Wizard</h3>
          <div id="modal-import-wizard-container">
            <p style="color: var(--muted); margin-bottom: 16px;">Chargement...</p>
          </div>
        </div>
      `
      // Déclencher l'import wizard mais dans le container
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-import-wizard'))
      }, 100)
    }
    
    // Suggestions: Injecter panel DANS la zone
    const suggestionsPane = this.modal?.querySelector('[data-tab="suggestions"]') as HTMLElement
    if (suggestionsPane) {
      suggestionsPane.innerHTML = `
        <div style="padding: 24px;">
          <h3 style="margin-bottom: 16px;">🤖 Suggestions ADM</h3>
          <div id="modal-suggestions-container">
            <p style="color: var(--muted);">Chargement des suggestions...</p>
          </div>
        </div>
      `
      // Charger suggestions
      setTimeout(() => {
        if ((window as any).suggestionsPanel) {
          const container = document.getElementById('modal-suggestions-container')
          if (container) {
            container.innerHTML = ''
            ;(window as any).suggestionsPanel.renderUI(container)
          }
        }
      }, 100)
    }
    
    // Liste: Afficher vraie liste
    const listePane = this.modal?.querySelector('[data-tab="liste"]') as HTMLElement
    if (listePane) {
      this.renderListeTab(listePane)
    }
    
    // Géocoder: Afficher géocodage
    const geocodePane = this.modal?.querySelector('[data-tab="geocode"]') as HTMLElement
    if (geocodePane) {
      this.renderGeocodeTab(geocodePane)
    }
  }
  
  private renderListeTab(container: HTMLElement) {
    container.innerHTML = `
      <div style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">📋 Liste des Sondages</h3>
        <div style="margin-bottom: 16px;">
          <input type="text" placeholder="🔍 Rechercher..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--tab-border);" />
        </div>
        <div style="color: var(--muted); text-align: center; padding: 40px;">
          <p>Chargement de la liste...</p>
        </div>
      </div>
    `
  }
  
  private renderGeocodeTab(container: HTMLElement) {
    container.innerHTML = `
      <div style="padding: 24px;">
        <h3>🗺️ Géocodage Amélioré</h3>
        <p>TODO: Implémenter géocodage avec drawer</p>
      </div>
    `
  }
  
  private switchTab(tabId: TabId) {
    this.activeTab = tabId
    
    // Update buttons
    this.modal?.querySelectorAll('.tab-vertical').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId)
    })
    
    // Update panes
    this.modal?.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.getAttribute('data-tab') === tabId)
    })
  }
}
