/**
 * Modal Central "Sondages" style QGIS
 * v2.5.0 - Approche Propre
 */

import { ImportWizardV2 } from '../import-wizard-v2'
import { SuggestionsPanel } from '../suggestions-panel'

type TabId = 'nouveau' | 'import' | 'liste' | 'geocode' | 'suggestions'

export class SondagesModal {
  private modal: HTMLElement | null = null
  private activeTab: TabId = 'nouveau'
  private importWizard: ImportWizardV2 | null = null
  private suggestionsPanel: SuggestionsPanel | null = null
  private escHandler?: (e: KeyboardEvent) => void
  private loaded: Record<TabId, boolean> = {
    nouveau: false,
    import: false,
    liste: false,
    geocode: false,
    suggestions: false
  }
  
  constructor(private apiUrl: string) {}
  
  open() {
    if (this.modal) return
    
    this.render()
    this.switchTab('nouveau')
    
    // ESC handler
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', this.escHandler)
  }
  
  close() {
    if (!this.modal) return
    
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler)
      this.escHandler = undefined
    }
    
    this.modal.remove()
    this.modal = null
  }
  
  private render() {
    this.modal = document.createElement('div')
    this.modal.className = 'sondages-modal-overlay'
    this.modal.innerHTML = `
      <div class="sondages-modal">
        <div class="sondages-modal-header">
          <h2>📋 Gestionnaire de Sondages</h2>
          <button class="modal-close" aria-label="Fermer">×</button>
        </div>
        
        <div class="sondages-modal-body">
          <!-- SIDEBAR VERTICALE (Style QGIS) -->
          <nav class="sondages-sidebar">
            <div class="sidebar-item active" data-tab="nouveau">
              <div class="sidebar-icon">📝</div>
              <div class="sidebar-label">Nouveau Sondage Géotechnique</div>
              <div class="sidebar-desc">Créer un nouveau sondage avec essais</div>
            </div>
            
            <div class="sidebar-item" data-tab="import">
              <div class="sidebar-icon">📥</div>
              <div class="sidebar-label">Import Wizard</div>
              <div class="sidebar-desc">Importer depuis Excel, CSV</div>
            </div>
            
            <div class="sidebar-item" data-tab="liste">
              <div class="sidebar-icon">📋</div>
              <div class="sidebar-label">Liste des Sondages</div>
              <div class="sidebar-desc">Rechercher et filtrer</div>
            </div>
            
            <div class="sidebar-item" data-tab="geocode">
              <div class="sidebar-icon">🗺️</div>
              <div class="sidebar-label">Géocodage Amélioré</div>
              <div class="sidebar-desc">Géocoder avec drawer</div>
            </div>
            
            <div class="sidebar-item" data-tab="suggestions">
              <div class="sidebar-icon">🤖</div>
              <div class="sidebar-label">Suggestions ADM</div>
              <div class="sidebar-desc">Géocodage automatique</div>
            </div>
          </nav>
          
          <!-- ZONE PRINCIPALE -->
          <div class="sondages-content">
            <div class="tab-pane active" data-tab="nouveau"></div>
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
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close()
    })
    
    this.modal.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', (e) => {
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
  
  private getPane(tab: TabId): HTMLElement | null {
    return this.modal?.querySelector<HTMLElement>(`.sondages-content .tab-pane[data-tab="${tab}"]`) || null
  }

  // Lazy loading methods
  private ensureNouveauLoaded() {
    if (this.loaded.nouveau) return
    const pane = this.getPane('nouveau')
    if (!pane) return

    pane.innerHTML = '<div id="modal-geotech-form-container"></div>'
    
    setTimeout(() => {
      const mgr = (window as any).geotechnicalFormManager
      if (mgr) mgr.initForm('modal-geotech-form-container')
    }, 0)

    this.loaded.nouveau = true
  }

  private ensureImportLoaded() {
    if (this.loaded.import) return
    const pane = this.getPane('import')
    if (!pane) return

    pane.innerHTML = '<div id="modal-import-wizard-container"></div>'
    
    try {
      this.importWizard = new ImportWizardV2('modal-import-wizard-container', this.apiUrl)
      this.importWizard.open()

      // Embed hack: move wizard content into pane
      setTimeout(() => {
        const iwOverlay = document.querySelector('.iw-overlay') as HTMLElement
        const iwModal = document.querySelector('.iw-modal') as HTMLElement
        if (iwOverlay && iwModal) {
          iwOverlay.remove()
          pane.querySelector('#modal-import-wizard-container')!.appendChild(iwModal)
          iwModal.style.width = '100%'
          iwModal.style.height = 'auto'
          iwModal.style.maxHeight = 'unset'
          iwModal.style.position = 'static'
          iwModal.style.boxShadow = 'none'
          iwModal.style.border = '1px solid #22304d'
          iwModal.style.borderRadius = '8px'
        }
      }, 50)

      this.loaded.import = true
    } catch (err) {
      console.error('[Modal] Erreur Import Wizard:', err)
      pane.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Impossible de charger l\'Import Wizard</p></div>'
    }
  }

  private ensureListeLoaded() {
    if (this.loaded.liste) return
    const pane = this.getPane('liste')
    if (!pane) return
    
    this.renderListeTab(pane)
    this.loaded.liste = true
  }

  private ensureGeocodeLoaded() {
    if (this.loaded.geocode) return
    const pane = this.getPane('geocode')
    if (!pane) return
    
    this.renderGeocodeTab(pane)
    this.loaded.geocode = true
  }

  private ensureSuggestionsLoaded() {
    if (this.loaded.suggestions) return
    const pane = this.getPane('suggestions')
    if (!pane) return

    pane.innerHTML = '<div id="modal-suggestions-container"></div>'
    
    try {
      this.suggestionsPanel = new SuggestionsPanel(this.apiUrl)
      this.suggestionsPanel.renderUI(
        'modal-suggestions-container',
        (msg) => console.log('[Suggestions]', msg),
        (err) => console.error('[Suggestions]', err)
      )
      this.loaded.suggestions = true
    } catch (err) {
      console.error('[Modal] Erreur Suggestions:', err)
      pane.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Impossible de charger les suggestions</p></div>'
    }
  }
  
  private async renderListeTab(container: HTMLElement) {
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:420px 1fr;gap:16px;height:100%;">
        <div>
          <h3 style="margin:0 0 12px 0;">📋 Liste des Sondages</h3>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input id="search-surveys" placeholder="🔍 Rechercher..." 
                   style="flex:1;padding:10px;border-radius:6px;border:1px solid #22304d;background:#0f172a;color:var(--text);"/>
            <button id="refresh-surveys" class="btn">🔄</button>
          </div>
          <div id="surveys-list-container" style="max-height:calc(80vh - 200px);overflow:auto;border:1px solid #22304d;border-radius:8px;"></div>
        </div>
        <div id="survey-details" style="overflow:auto;border:1px solid #22304d;border-radius:8px;padding:14px;">
          <p style="color:var(--muted);">Sélectionnez un sondage pour afficher les détails…</p>
        </div>
      </div>
    `
    
    this.loadSurveysList(container)
    
    container.querySelector('#search-surveys')?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value
      this.filterSurveys(container, q)
    })
    
    container.querySelector('#refresh-surveys')?.addEventListener('click', () => {
      this.loadSurveysList(container)
    })
  }
  
  private async loadSurveysList(container: HTMLElement) {
    const listContainer = container.querySelector('#surveys-list-container')
    if (!listContainer) return
    
    listContainer.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 40px;">Chargement...</p>'
    
    try {
      const response = await fetch(`${this.apiUrl}/surveys?limit=100`)
      if (!response.ok) throw new Error('Erreur API')
      
      const surveys = await response.json()
      
      if (surveys.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
            <p>Aucun sondage trouvé</p>
          </div>
        `
        return
      }
      
      listContainer.innerHTML = surveys.map((s: any) => `
        <div class="survey-card" data-id="${s.id}" style="background: #0f172a; border: 1px solid #22304d; border-radius: 8px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="color: #3aa6ff; font-size: 14px;">${s.code || 'Sans code'}</strong>
            <span style="font-size: 11px; color: var(--muted);">${s.date || ''}</span>
          </div>
          <div style="font-size: 12px; color: var(--text); margin-bottom: 4px;">
            📍 ${s.localite || 'Localité inconnue'}
          </div>
          <div style="font-size: 11px; color: var(--muted);">
            ${s.grid_code ? `Maille: ${s.grid_code}` : 'Pas de maille'}
            ${s.location_mode ? ` • ${s.location_mode}` : ''}
          </div>
        </div>
      `).join('')
      
      // Event listeners sur les cartes
      listContainer.querySelectorAll('.survey-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id')!
          this.openSurveyDetails(id)
        })
        
        card.addEventListener('mouseenter', () => {
          ;(card as HTMLElement).style.borderColor = '#3aa6ff'
        })
        
        card.addEventListener('mouseleave', () => {
          ;(card as HTMLElement).style.borderColor = '#22304d'
        })
      })
      
    } catch (err) {
      console.error('[Liste] Erreur chargement:', err)
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--err);">
          <p>❌ Erreur de chargement</p>
          <button id="retry-load" class="btn" style="margin-top: 12px;">Réessayer</button>
        </div>
      `
      listContainer.querySelector('#retry-load')?.addEventListener('click', () => {
        this.loadSurveysList(container)
      })
    }
  }
  
  private filterSurveys(container: HTMLElement, query: string) {
    const cards = container.querySelectorAll('.survey-card')
    const lowerQuery = query.toLowerCase()
    
    cards.forEach(card => {
      const text = card.textContent?.toLowerCase() || ''
      ;(card as HTMLElement).style.display = text.includes(lowerQuery) ? 'block' : 'none'
    })
  }

  private async openSurveyDetails(id: string) {
    const panel = this.modal!.querySelector('#survey-details') as HTMLElement
    panel.innerHTML = '<p style="color:var(--muted);padding:10px;">Chargement des détails…</p>'
    
    try {
      const r = await fetch(`${this.apiUrl}/surveys/${id}`)
      if (!r.ok) throw new Error('API')
      const s = await r.json()

      panel.innerHTML = `
        <div style="padding:10px;">
          <h3 style="margin:0 0 12px 0;">🔎 ${s.code || s.localite || ('Sondage '+id.slice(0,6))}</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="card">
              <h4>📍 Métadonnées</h4>
              <ul>
                <li><b>Localité :</b> ${s.localite||'-'}</li>
                <li><b>Date :</b> ${s.date||'-'}</li>
                <li><b>ADM3 :</b> ${s.adm3_name||'-'} (${s.adm3||'-'})</li>
                <li><b>Maille :</b> ${s.grid_code||'-'}</li>
                <li><b>Mode :</b> ${s.location_mode||'-'}</li>
                <li><b>Lat/Lon :</b> ${s.lat?.toFixed?.(6)||'-'} / ${s.lon?.toFixed?.(6)||'-'}</li>
              </ul>
            </div>
            <div class="card">
              <h4>🧪 Essais</h4>
              <ul>
                <li><b>Atterberg :</b> ${s.atterberg?.length||0} enregistrements</li>
                <li><b>Granulo :</b> ${s.granulo?.length||0}</li>
                <li><b>Proctor :</b> ${s.proctor?.length||0}</li>
                <li><b>VBS :</b> ${s.vbs?.length||0}</li>
              </ul>
            </div>
          </div>
          <div class="card" style="margin-top:12px;">
            <h4>📄 Détails bruts</h4>
            <pre style="white-space:pre-wrap;background:#0a1018;border:1px solid #1c2843;border-radius:6px;padding:10px;max-height:260px;overflow:auto;font-size:11px;">
${JSON.stringify(s,null,2)}
            </pre>
          </div>
        </div>
      `
    } catch (e) {
      panel.innerHTML = '<div style="color:var(--err);padding:10px;">❌ Impossible de charger les détails</div>'
    }
  }
  
  private async renderGeocodeTab(container: HTMLElement) {
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;height:100%;">
        <div>
          <h3 style="margin:0 0 12px 0;">🗺️ Géocodage Manuel</h3>
          <div class="card">
            <h4>Sondages sans géométrie</h4>
            <div id="ungeocoded-list" style="max-height:calc(80vh - 220px);overflow:auto;"></div>
          </div>
        </div>
        <div>
          <div id="geocode-drawer" class="card" style="position:sticky;top:0;">
            <h4>📍 Géocoder</h4>
            <p style="color:var(--muted);">Sélectionnez un sondage…</p>
          </div>
        </div>
      </div>
    `
    
    this.loadUngeocoded(container)
  }
  
  private async loadUngeocoded(container: HTMLElement) {
    const listContainer = container.querySelector('#ungeocoded-list')
    if (!listContainer) return
    
    try {
      const response = await fetch(`${this.apiUrl}/surveys/ungeocode`)
      if (!response.ok) throw new Error('Erreur API')
      
      const surveys = await response.json()
      
      if (surveys.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--ok);">
            <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
            <p>Tous les sondages sont géocodés!</p>
          </div>
        `
        return
      }
      
      listContainer.innerHTML = surveys.map((s: any) => `
        <div class="geocode-item" data-id="${s.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <strong style="color:#3aa6ff">${s.code || s.localite || ('Sondage '+String(s.id).slice(0,6))}</strong>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">
                ${s.localite || 'Localité inconnue'}${s.adm3_name ? ` • ${s.adm3_name}` : ''} • id:${String(s.id).slice(0,8)}
              </div>
            </div>
            <button class="btn-sm geocode-btn" data-id="${s.id}">🗺️ Géocoder</button>
          </div>
        </div>
      `).join('')
      
      // Event listeners
      listContainer.querySelectorAll('.geocode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const id = (e.currentTarget as HTMLElement).getAttribute('data-id')!
          this.openGeocodeDrawer(id)
        })
      })
      
    } catch (err) {
      console.error('[Géocodage] Erreur chargement:', err)
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--err);">
          <p>❌ Erreur de chargement</p>
          <button id="retry-geocode" class="btn" style="margin-top: 12px;">Réessayer</button>
        </div>
      `
      listContainer.querySelector('#retry-geocode')?.addEventListener('click', () => {
        this.loadUngeocoded(container)
      })
    }
  }

  private async openGeocodeDrawer(id: string) {
    const drawer = this.modal!.querySelector('#geocode-drawer') as HTMLElement
    drawer.innerHTML = `
      <h4>📍 Géocoder — <span style="font-size:12px;color:var(--muted)">${id.slice(0,8)}…</span></h4>
      <div style="display:grid;gap:10px;">
        <div class="card">
          <h5>Mode exact (Lat/Lon)</h5>
          <input id="lat" type="number" step="0.000001" placeholder="Latitude">
          <input id="lon" type="number" step="0.000001" placeholder="Longitude">
          <button id="btn-apply-exact" class="btn">✅ Enregistrer</button>
        </div>
        <div class="card">
          <h5>Mode ADM (point pseudo-aléatoire dans la maille)</h5>
          <input id="adm3" placeholder="Code ADM3 (ex: TG051515)">
          <button id="btn-apply-adm" class="btn">✅ Enregistrer</button>
        </div>
      </div>
      <p style="font-size:11px;color:var(--muted);margin-top:6px;">Les coordonnées seront validées (bbox Togo).</p>
    `

    const applyExact = async () => {
      const lat = Number((drawer.querySelector('#lat') as HTMLInputElement).value)
      const lon = Number((drawer.querySelector('#lon') as HTMLInputElement).value)
      if (!(lat>=5 && lat<=12 && lon>=-1.2 && lon<=1.8)) { alert('Coordonnées hors Togo'); return }
      await fetch(`${this.apiUrl}/surveys/${id}/geocode`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'exact', lat, lon })
      })
      alert('Enregistré')
    }

    const applyAdm = async () => {
      const adm3 = (drawer.querySelector('#adm3') as HTMLInputElement).value.trim()
      if (!adm3) return alert('Renseigner ADM3')
      await fetch(`${this.apiUrl}/surveys/${id}/geocode`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'adm', adm3 })
      })
      // Signal carte : surligner la zone
      window.dispatchEvent(new CustomEvent('atlas:flash-adm', { detail: { adm3, times:5, color:'#FFD60A' }}))
      alert('Enregistré')
    }

    drawer.querySelector('#btn-apply-exact')?.addEventListener('click', applyExact)
    drawer.querySelector('#btn-apply-adm')?.addEventListener('click', applyAdm)
  }
  
  private switchTab(tabId: TabId) {
    this.activeTab = tabId
    
    // Update sidebar items
    this.modal?.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabId)
    })
    
    // Update panes
    this.modal?.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.getAttribute('data-tab') === tabId)
    })

    // Lazy load content
    if (tabId === 'nouveau') this.ensureNouveauLoaded()
    if (tabId === 'import') this.ensureImportLoaded()
    if (tabId === 'liste') this.ensureListeLoaded()
    if (tabId === 'geocode') this.ensureGeocodeLoaded()
    if (tabId === 'suggestions') this.ensureSuggestionsLoaded()
  }
}
