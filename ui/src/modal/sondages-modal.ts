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
    // Nouveau: Déclenche le formulaire existant
    const nouveauPane = this.modal?.querySelector('[data-tab="nouveau"]') as HTMLElement
    if (nouveauPane) {
      nouveauPane.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <div style="font-size: 64px; margin-bottom: 16px;">📝</div>
          <h3>Nouveau Sondage Géotechnique</h3>
          <p style="color: var(--muted); margin-bottom: 24px;">Créer un nouveau sondage avec essais géotechniques</p>
          <button id="trigger-new-geotech" class="btn-primary" style="padding: 12px 24px;">
            ➕ Créer un Sondage
          </button>
        </div>
      `
      nouveauPane.querySelector('#trigger-new-geotech')?.addEventListener('click', () => {
        // Déclenche le bouton existant
        document.getElementById('newGeotechBtn')?.click()
      })
    }
    
    // Import: Déclenche Import Wizard existant
    const importPane = this.modal?.querySelector('[data-tab="import"]') as HTMLElement
    if (importPane) {
      importPane.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <div style="font-size: 64px; margin-bottom: 16px;">📥</div>
          <h3>Import Wizard</h3>
          <p style="color: var(--muted); margin-bottom: 24px;">Importez vos données depuis Excel, CSV ou autres formats</p>
          <button id="trigger-import-wizard" class="btn-primary" style="padding: 12px 24px;">
            📥 Ouvrir Import Wizard
          </button>
        </div>
      `
      importPane.querySelector('#trigger-import-wizard')?.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-import-wizard'))
      })
    }
    
    // Suggestions: Déclenche panel existant
    const suggestionsPane = this.modal?.querySelector('[data-tab="suggestions"]') as HTMLElement
    if (suggestionsPane) {
      suggestionsPane.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <div style="font-size: 64px; margin-bottom: 16px;">🤖</div>
          <h3>Suggestions ADM</h3>
          <p style="color: var(--muted); margin-bottom: 24px;">Géocodage automatique par correspondance administrative</p>
          <button id="trigger-suggestions" class="btn-primary" style="padding: 12px 24px;">
            🤖 Voir Suggestions
          </button>
        </div>
      `
      suggestionsPane.querySelector('#trigger-suggestions')?.addEventListener('click', () => {
        document.getElementById('suggestionsBtn')?.click()
      })
    }
    
    // Liste: Nouveau (simple pour l'instant)
    const listePane = this.modal?.querySelector('[data-tab="liste"]') as HTMLElement
    if (listePane) {
      listePane.innerHTML = `
        <div style="padding: 24px;">
          <h3>📋 Liste des Sondages</h3>
          <p>TODO: Implémenter liste filtrable</p>
        </div>
      `
    }
    
    // Géocoder: Nouveau (amélioré)
    const geocodePane = this.modal?.querySelector('[data-tab="geocode"]') as HTMLElement
    if (geocodePane) {
      this.renderGeocodeTab(geocodePane)
    }
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
