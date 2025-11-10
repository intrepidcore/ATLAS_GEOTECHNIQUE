/**
 * Modal Central "Sondages" style QGIS
 * v2.5.0 - Approche Propre
 */

import { ImportWizardV2 } from '../import-wizard-v2'
import { SuggestionsCanonPanel } from '../suggestions-canon-panel'
import { GeocodeCanonPanel } from '../geocode-canon-panel'
import { listSondages, getSondage, extractLocaliteFromCode, formatGeocodeLabel } from '../api/sondages'
import { toast } from '../ui/toast'

type TabId = 'nouveau' | 'import' | 'liste' | 'geocode' | 'suggestions'

export class SondagesModal {
  private modal: HTMLElement | null = null
  private activeTab: TabId = 'nouveau'
  private importWizard: ImportWizardV2 | null = null
  private suggestionsPanel: SuggestionsCanonPanel | null = null
  private geocodeManualPanel: GeocodeCanonPanel | null = null
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

    pane.innerHTML = '<div id="modal-geotech-form-container" style="padding:20px;"><p style="color:var(--muted);">Chargement du formulaire...</p></div>'
    
    const tryInit = () => {
      const mgr = (window as any).geotechnicalFormManager
      console.log('[Nouveau] Tentative init, manager:', mgr)
      if (!mgr) return false
      
      const container = document.getElementById('modal-geotech-form-container')
      if (!container) return false
      
      container.innerHTML = '' // Clear loading message
      mgr.initForm('modal-geotech-form-container')
      this.loaded.nouveau = true
      console.log('[Nouveau] Formulaire initialisé!')
      return true
    }

    // Tente immédiatement puis réessaie (module chargé async)
    if (!tryInit()) {
      let tries = 0
      const t = setInterval(() => {
        if (tryInit() || ++tries > 30) { // 4.5s max
          clearInterval(t)
          if (tries > 30) {
            const container = document.getElementById('modal-geotech-form-container')
            if (container) {
              container.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Le gestionnaire de formulaire géotechnique n\'est pas disponible.</p><p style="font-size:11px;margin-top:8px;">Vérifiez que le module est chargé dans main.ts</p></div>'
            }
          }
        }
      }, 150)
    }
  }

  private ensureImportLoaded() {
    if (this.loaded.import) return
    const pane = this.getPane('import')
    if (!pane) return

    pane.innerHTML = '<div id="modal-import-wizard-container" style="height:100%;padding:20px;"><p style="color:var(--muted);">Chargement de l\'Import Wizard...</p></div>'
    
    try {
      // @ts-ignore - selon signature réelle
      this.importWizard = new ImportWizardV2('modal-import-wizard-container', this.apiUrl)
      console.log('[Import] ImportWizardV2 créé, appel open()...')
      // @ts-ignore
      this.importWizard.open()

      // Fallback hijack: déplace le contenu dans notre pane
      // Essaie plusieurs fois car le DOM peut mettre du temps à se créer
      let attempts = 0
      const tryHijack = () => {
        attempts++
        console.log(`[Import] Tentative hijack #${attempts}`)
        
        // Cherche tous les sélecteurs possibles
        const overlay = document.querySelector('.iw-overlay') || 
                        document.querySelector('.import-wizard-overlay') ||
                        document.querySelector('[class*="wizard"][class*="overlay"]')
        
        const dialog = overlay?.querySelector('.iw-modal') ||
                      overlay?.querySelector('.iw-dialog') ||
                      overlay?.querySelector('.import-wizard') ||
                      overlay?.querySelector('[class*="wizard"][class*="modal"]')

        console.log('[Import] Overlay:', overlay, 'Dialog:', dialog)

        if (overlay && dialog) {
          console.log('[Import] Éléments trouvés! Déplacement...')
          ;(dialog as HTMLElement).style.position = 'static'
          ;(dialog as HTMLElement).style.inset = 'auto'
          ;(dialog as HTMLElement).style.width = '100%'
          ;(dialog as HTMLElement).style.height = '100%'
          ;(dialog as HTMLElement).style.maxHeight = 'unset'
          ;(dialog as HTMLElement).style.boxShadow = 'none'
          ;(dialog as HTMLElement).style.border = '1px solid #22304d'
          ;(dialog as HTMLElement).style.borderRadius = '8px'
          
          const container = pane.querySelector('#modal-import-wizard-container')
          if (container) {
            container.innerHTML = '' // Clear loading
            container.appendChild(dialog as HTMLElement)
            ;(overlay as HTMLElement).remove() // supprime l'overlay externe
            this.loaded.import = true
            console.log('[Import] Hijack réussi!')
            return true
          }
        }
        
        if (attempts < 10) {
          setTimeout(tryHijack, 100)
        } else {
          console.error('[Import] Hijack échoué après 10 tentatives')
          pane.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Impossible d\'intégrer Import Wizard (sélecteurs introuvables)</p><p style="font-size:11px;margin-top:8px;">Vérifiez les classes CSS du wizard</p></div>'
        }
        return false
      }

      requestAnimationFrame(tryHijack)
    } catch (err) {
      console.error('[Modal] Erreur Import Wizard:', err)
      pane.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Impossible de charger l\'Import Wizard</p><pre style="font-size:10px;margin-top:8px;">' + String(err) + '</pre></div>'
    }
  }

  private ensureListeLoaded() {
    if (this.loaded.liste) return
    const pane = this.getPane('liste')
    if (!pane) return
    
    this.renderListeTab(pane)
    this.loaded.liste = true
  }

  private async ensureGeocodeLoaded() {
    if (this.loaded.geocode) return
    const pane = this.getPane('geocode')
    if (!pane) return
    
    pane.innerHTML = '<div id="modal-geocode-container" style="height:100%;"></div>'
    
    try {
      this.geocodeManualPanel = new GeocodeCanonPanel(this.apiUrl)
      await this.geocodeManualPanel.refresh()
      this.geocodeManualPanel.renderUI(
        'modal-geocode-container',
        (msg: string) => {
          console.log('[Geocode Canon]', msg)
          // Recharger la grille pour mettre à jour les couleurs des mailles
          if ((window as any).loadGrid) {
            console.log('[Geocode Canon] Rechargement de la grille...')
            ;(window as any).loadGrid(false)
          }
        },
        (err: string) => {
          console.error('[Geocode Canon]', err)
          toast.error(`❌ ${err}`)
        }
      )
      this.loaded.geocode = true
    } catch (err) {
      console.error('[Modal] Erreur Geocode Canon:', err)
      pane.innerHTML = '<div class="inline-error"><h3>❌ Erreur</h3><p>Impossible de charger le géocodage des villages</p></div>'
    }
  }

  private async ensureSuggestionsLoaded() {
    if (this.loaded.suggestions) return
    const pane = this.getPane('suggestions')
    if (!pane) return

    pane.innerHTML = '<div id="modal-suggestions-container" style="height:100%;"></div>'
    
    try {
      this.suggestionsPanel = new SuggestionsCanonPanel(this.apiUrl)
      await this.suggestionsPanel.refresh()
      this.suggestionsPanel.renderUI(
        'modal-suggestions-container',
        (msg: string) => {
          console.log('[Suggestions Canon]', msg)
          // Toast optionnel
        },
        (err: string) => {
          console.error('[Suggestions Canon]', err)
          toast.error(`❌ ${err}`)
        }
      )
      this.loaded.suggestions = true
      console.log('[Sondages] Panel suggestions chargé avec sondages individuels')
    } catch (err) {
      console.error('[Modal] Erreur Suggestions Canon:', err)
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
      // Utiliser l'API /sondages pour lister les sondages individuels (230)
      const sondages = await listSondages({ limit: 500 })
      
      if (sondages.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
            <p>Aucun sondage trouvé</p>
          </div>
        `
        return
      }
      
      listContainer.innerHTML = sondages.map((s: any) => {
        // Titre: localite ou extrait du code
        const title = s.localite || extractLocaliteFromCode(s.code) || s.code
        
        // Sous-titre: Code du sondage + Géocodé Oui/Non
        const subtitle = [
          `Code: ${s.code}`,
          `Géocodé: ${formatGeocodeLabel(s)}`,
          s.adm3_name ? `Commune: ${s.adm3_name}` : null
        ].filter(Boolean).join(' • ')
        
        const geocoded = s.is_geocoded ? '✅' : '❌'
        const mode = s.location_mode || 'unknown'
        
        return `
          <div class="survey-card" data-id="${s.id}" style="background: #0f172a; border: 1px solid #22304d; border-radius: 8px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <strong style="color: #ecf2f8; font-size: 15px; font-weight: 600;">${title}</strong>
              <span style="font-size: 11px; padding: 3px 8px; background: ${s.is_geocoded ? '#51cf66' : '#ff6b6b'}; color: #fff; border-radius: 4px;">${geocoded} ${mode}</span>
            </div>
            <div style="font-size: 13px; color: #8b9bb3; margin-bottom: 6px;">
              ${subtitle}
            </div>
          </div>
        `
      }).join('')
      
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
      // Récupérer le sondage individuel
      const s = await getSondage(id)

      const displayName = s.localite || extractLocaliteFromCode(s.code) || s.code

      panel.innerHTML = `
        <div style="padding:10px;">
          <h3 style="margin:0 0 12px 0;">🔎 ${displayName}</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="card">
              <h4>📍 Métadonnées</h4>
              <ul>
                <li><b>Village :</b> ${s.localite||'-'}</li>
                <li><b>Code :</b> ${s.code||'-'}</li>
                <li><b>Commune (ADM3) :</b> ${s.adm3_name||'-'}</li>
                <li><b>Géocodé :</b> ${s.is_geocoded ? '✅ Oui' : '❌ Non'}</li>
                <li><b>Géométrie :</b> ${s.geom ? '✅ Présente' : '❌ Absente'}</li>
                <li><b>Mode :</b> ${s.location_mode||'unknown'}</li>
                <li><b>Date :</b> ${s.date||'-'}</li>
              </ul>
            </div>
            <div class="card">
              <h4>📊 Statistiques</h4>
              <ul>
                <li><b>Source :</b> ${s.source || '-'}</li>
                <li><b>Créé le :</b> ${new Date(s.created_at).toLocaleDateString('fr-FR')}</li>
                <li><b>Mis à jour :</b> ${s.updated_at ? new Date(s.updated_at).toLocaleDateString('fr-FR') : '-'}</li>
              </ul>
            </div>
          </div>
          <div class="card" style="margin-top:12px;">
            <h4>📄 Objet sondage (JSON)</h4>
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
      
      listContainer.innerHTML = surveys.map((s: any) => {
        // Construire un titre informatif
        const title = s.code || s.localite || `Sondage ${String(s.id).slice(0,8)}`
        
        // Construire les infos secondaires
        const infos = []
        if (s.source) infos.push(`Source: ${s.source}`)
        if (s.localite && s.localite !== title) infos.push(s.localite)
        if (s.adm3_name) infos.push(`ADM3: ${s.adm3_name}`)
        if (s.date) infos.push(`Date: ${s.date}`)
        if (s.n_essais > 0) infos.push(`${s.n_essais} essais`)
        
        const subtitle = infos.length > 0 ? infos.join(' • ') : `ID: ${String(s.id).slice(0,8)}`
        
        return `
          <div class="geocode-item" data-id="${s.id}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="flex:1;min-width:0;">
                <strong style="color:#3aa6ff;display:block;margin-bottom:4px;">${title}</strong>
                <div style="font-size:11px;color:var(--muted);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${subtitle}
                </div>
              </div>
              <button class="btn-sm geocode-btn" data-id="${s.id}" style="flex-shrink:0;">🗺️ Géocoder</button>
            </div>
          </div>
        `
      }).join('')
      
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
    
    // Charger la liste des ADM3
    drawer.innerHTML = '<p style="color:var(--muted);padding:10px;">Chargement...</p>'
    const adm3List = await this.loadAdm3List()
    
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
          <select id="adm3" style="width:100%;padding:10px;border-radius:6px;border:1px solid #22304d;background:#0f172a;color:var(--text);">
            <option value="">-- Sélectionner une zone ADM3 --</option>
            ${adm3List.map(a => `
              <option value="${a.code}">${a.name} (${a.code}) - ${a.adm2_name || ''}</option>
            `).join('')}
          </select>
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
      const adm3 = (drawer.querySelector('#adm3') as HTMLSelectElement).value.trim()
      if (!adm3) return alert('Sélectionner une zone ADM3')
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

  private async loadAdm3List(): Promise<Array<{code: string, name: string, adm2_name: string}>> {
    try {
      const response = await fetch(`${this.apiUrl}/adm3`)
      if (!response.ok) return []
      const data = await response.json()
      return data
    } catch (err) {
      console.error('[Geocode] Erreur chargement ADM3:', err)
      return []
    }
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
