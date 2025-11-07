// Panel de gestion des suggestions de géocodage - NOUVELLE VERSION
import { getStats, listSuggestions, accept, reject, applyAccepted, Suggestion, GeocodeStats } from './api/geocode'

// Helper pour afficher un modal avec dropdown ADM3
async function showAdm3Modal(): Promise<string | null> {
  // Charger la liste des ADM3
  const response = await fetch('/api/adm3')
  const adm3List = await response.json()
  
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
    
    const modal = document.createElement('div')
    modal.style.cssText = 'background: white; padding: 24px; border-radius: 8px; min-width: 500px; max-width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
    
    const options = adm3List.map((adm: any) => 
      `<option value="${adm.gid}">${adm.name} (${adm.adm2_name || ''}) - ${adm.code || ''}</option>`
    ).join('')
    
    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">🎯 Sélectionner une commune (ADM3)</h3>
      <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">Choisissez la commune correspondant à la localité</p>
      
      <input type="text" id="search-input" placeholder="🔍 Rechercher une commune..." 
        style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; margin-bottom: 12px;" />
      
      <select id="adm3-select" size="10" 
        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; margin-bottom: 16px;">
        <option value="">-- Ou laissez vide pour coordonnées --</option>
        ${options}
      </select>
      
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="modal-cancel" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Annuler</button>
        <button id="modal-ok" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      </div>
    `
    
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    
    const searchInput = modal.querySelector('#search-input') as HTMLInputElement
    const select = modal.querySelector('#adm3-select') as HTMLSelectElement
    const okBtn = modal.querySelector('#modal-ok') as HTMLButtonElement
    const cancelBtn = modal.querySelector('#modal-cancel') as HTMLButtonElement
    
    // Recherche en temps réel
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase()
      Array.from(select.options).forEach((option, idx) => {
        if (idx === 0) return // Skip first option
        const text = option.textContent?.toLowerCase() || ''
        option.style.display = text.includes(query) ? '' : 'none'
      })
    })
    
    searchInput.focus()
    
    const cleanup = (value: string | null) => {
      overlay.remove()
      resolve(value)
    }
    
    okBtn.onclick = () => cleanup(select.value || null)
    cancelBtn.onclick = () => cleanup(null)
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null) }
    select.ondblclick = () => cleanup(select.value || null)
  })
}

// Helper pour input simple (coordonnées)
function showInputModal(title: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;'
    
    const modal = document.createElement('div')
    modal.style.cssText = 'background: white; padding: 24px; border-radius: 8px; min-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
    
    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">${title}</h3>
      <input type="text" id="modal-input" placeholder="${placeholder}" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; margin-bottom: 16px;" />
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="modal-cancel" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Annuler</button>
        <button id="modal-ok" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      </div>
    `
    
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    
    const input = modal.querySelector('#modal-input') as HTMLInputElement
    const okBtn = modal.querySelector('#modal-ok') as HTMLButtonElement
    const cancelBtn = modal.querySelector('#modal-cancel') as HTMLButtonElement
    
    input.focus()
    
    const cleanup = (value: string | null) => {
      overlay.remove()
      resolve(value)
    }
    
    okBtn.onclick = () => cleanup(input.value || null)
    cancelBtn.onclick = () => cleanup(null)
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null) }
    input.onkeydown = (e) => {
      if (e.key === 'Enter') cleanup(input.value || null)
      if (e.key === 'Escape') cleanup(null)
    }
  })
}

export class SuggestionsPanel {
  private stats: GeocodeStats | null = null
  private suggestions: Suggestion[] = []
  private loading = false
  private filter: 'all' | 'pending' | 'done' | 'rejected' = 'pending'

  constructor(private apiUrl: string) {}

  async refresh() {
    this.loading = true
    try {
      this.stats = await getStats()
      const params = this.filter === 'all' ? {} : { status: this.filter }
      this.suggestions = await listSuggestions(params)
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error refreshing:', e)
      throw e
    } finally {
      this.loading = false
    }
  }

  async acceptSuggestion(id: string, payload: { adm3_id?: string; lon?: number; lat?: number }) {
    try {
      await accept(id, payload)
      await this.refresh()
      return true
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error accepting:', e)
      throw e
    }
  }

  async rejectSuggestion(id: string) {
    try {
      await reject(id)
      await this.refresh()
      return true
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error rejecting:', e)
      throw e
    }
  }

  // updateSuggestion supprimée - utilisez acceptSuggestion avec payload

  async applyAll() {
    try {
      const result = await applyAccepted()
      await this.refresh()
      return result
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error applying:', e)
      throw e
    }
  }

  renderUI(containerId: string, onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const container = document.getElementById(containerId)
    if (!container) {
      console.error(`Container #${containerId} not found`)
      return
    }

    container.innerHTML = `
      <div class="suggestions-panel" style="padding: 20px; background: #111a2a; border-radius: 8px; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #ecf2f8;">🤖 Suggestions de Géocodage</h2>
          <button id="suggestions-close" style="background: transparent; border: none; color: #8aa0b5; font-size: 32px; cursor: pointer;">&times;</button>
        </div>

        <!-- Stats -->
        <div id="suggestions-stats" style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #0bb07b;">-</div>
            <div style="font-size: 12px; color: #8aa0b5;">Acceptées</div>
          </div>
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #ff9f43;">-</div>
            <div style="font-size: 12px; color: #8aa0b5;">En attente</div>
          </div>
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #ff6b6b;">-</div>
            <div style="font-size: 12px; color: #8aa0b5;">Sans suggestion</div>
          </div>
        </div>

        <!-- Filtres -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <button class="filter-btn" data-filter="pending" style="padding: 8px 16px; background: #ff9f43; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">En attente</button>
          <button class="filter-btn" data-filter="accepted" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Acceptées</button>
          <button class="filter-btn" data-filter="rejected" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Rejetées</button>
          <button class="filter-btn" data-filter="all" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Toutes</button>
          <div style="flex: 1;"></div>
          <button id="bulk-accept-btn" style="padding: 8px 16px; background: #3aa6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-weight: 600;">⚡ Accepter tout ≥80%</button>
          <button id="apply-accepted-btn" style="padding: 8px 16px; background: #0bb07b; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-weight: 600;">✅ Appliquer les acceptées</button>
        </div>

        <!-- Liste -->
        <div id="suggestions-list" style="margin-top: 20px;">
          <p style="color: #8aa0b5;">Chargement...</p>
        </div>
      </div>
    `

    container.classList.add('active')

    // Bouton fermer
    const closeBtn = document.getElementById('suggestions-close')
    closeBtn?.addEventListener('click', () => {
      container.classList.remove('active')
      setTimeout(() => container.innerHTML = '', 300)
    })

    // Bouton bulk accept
    const bulkBtn = document.getElementById('bulk-accept-btn')
    bulkBtn?.addEventListener('click', async () => {
      const toAccept = this.suggestions.filter(s => s.status === 'pending')
      
      if (toAccept.length === 0) {
        onError('Aucune suggestion en attente')
        return
      }
      
      if (!confirm(`Accepter ${toAccept.length} suggestion(s) ?`)) {
        return
      }
      
      onError('Fonctionnalité désactivée - utilisez le bouton Accepter individuellement')
    })
    
    // Bouton appliquer
    const applyBtn = document.getElementById('apply-accepted-btn')
    applyBtn?.addEventListener('click', async () => {
      try {
        const result = await this.applyAll()
        onSuccess(`✅ ${result.applied_count} suggestion(s) appliquée(s)${result.refreshed ? ' et vue rafraîchie' : ''}`)
        this.renderList(onSuccess, onError)
      } catch (e: any) {
        onError(e.message)
      }
    })

    // Filtres
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement
        const filter = target.dataset.filter as any
        this.filter = filter
        
        // Update UI
        document.querySelectorAll('.filter-btn').forEach(b => {
          (b as HTMLElement).style.background = '#3d3d3d'
        })
        target.style.background = filter === 'pending' ? '#ff9f43' : filter === 'accepted' ? '#0bb07b' : filter === 'rejected' ? '#ff6b6b' : '#3aa6ff'
        
        this.renderList(onSuccess, onError)
      })
    })

    // Charger
    this.renderList(onSuccess, onError)
  }

  private async renderList(onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const listDiv = document.getElementById('suggestions-list')
    const statsDiv = document.getElementById('suggestions-stats')
    
    if (!listDiv) return

    try {
      await this.refresh()

      // Update stats
      if (statsDiv && this.stats) {
        const unnormalizedCount = this.suggestions.filter(s => s.is_unnormalized).length;
        
        statsDiv.innerHTML = `
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #0bb07b;">${this.stats.accepted}</div>
            <div style="font-size: 12px; color: #8aa0b5;">Acceptées</div>
          </div>
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #ff9f43;">${this.stats.pending}</div>
            <div style="font-size: 12px; color: #8aa0b5;">En attente</div>
          </div>
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d;">
            <div style="font-size: 24px; font-weight: 600; color: #ff6b6b;">${this.stats.no_suggestion}</div>
            <div style="font-size: 12px; color: #8aa0b5;">Sans suggestion</div>
          </div>
          ${unnormalizedCount > 0 ? `
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #22304d; border-left: 4px solid #ff9f43;">
            <div style="font-size: 24px; font-weight: 600; color: #ff9f43;">${unnormalizedCount}</div>
            <div style="font-size: 12px; color: #8aa0b5;">Non normalisés</div>
          </div>
          ` : ''}
        `
      }

      if (this.suggestions.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #8aa0b5;">
            <p style="font-size: 18px;">✅ Aucune suggestion ${this.filter !== 'all' ? this.filter : ''}</p>
          </div>
        `
        return
      }

      listDiv.innerHTML = this.suggestions.map(s => {
        const statusColor = s.status === 'done' ? '#0bb07b' : s.status === 'rejected' ? '#ff6b6b' : '#ff9f43'
        const statusIcon = s.status === 'done' ? '✅' : s.status === 'rejected' ? '❌' : '⚠️'
        
        return `
          <div class="suggestion-item" style="background: #0f172a; padding: 16px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #22304d;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div>
                <h4 style="margin: 0 0 8px 0; color: #ecf2f8;">
                  ${statusIcon} ${s.payload.code}
                  <span style="font-size: 11px; color: #8aa0b5; font-weight: normal;">${s.sondage_id.substring(0, 8)}...</span>
                </h4>
                <p style="margin: 4px 0; color: #8aa0b5; font-size: 13px;">
                  📍 Localité: <b>${s.payload.localite_base || '—'}</b> · Source: <b>${s.payload.source}</b> · Raison: <b>${s.reason}</b>
                </p>
                <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                  <span style="color: ${statusColor}; font-size: 12px;">
                    Statut: <b>${s.status.toUpperCase()}</b>
                  </span>
                  ${s.is_unnormalized ? `
                    <span style="padding: 2px 8px; background: #ff9f43; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      NON NORMALISÉ
                    </span>
                  ` : ''}
                </div>
              </div>
              ${s.status === 'pending' ? `
                <div style="display: flex; gap: 8px;">
                  <button 
                    class="accept-btn" 
                    data-id="${s.id}"
                    style="padding: 6px 12px; background: #0bb07b; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px;"
                  >
                    ✅ Accepter
                  </button>
                  <button 
                    class="modify-btn" 
                    data-id="${s.id}"
                    style="padding: 6px 12px; background: #3aa6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px;"
                  >
                    ✏️ Modifier
                  </button>
                  <button 
                    class="reject-btn" 
                    data-id="${s.id}"
                    style="padding: 6px 12px; background: #ff6b6b; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 12px;"
                  >
                    ❌ Rejeter
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `
      }).join('')

      // Attacher event listeners
      
      // Bouton accepter
      document.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = (e.target as HTMLElement).dataset.id!
          const adm3_code = await showAdm3Modal()
          
          if (adm3_code === null) return // Annulé
          
          try {
            if (adm3_code) {
              await this.acceptSuggestion(id, { adm3_id: adm3_code })
              onSuccess(`✅ Suggestion acceptée avec commune: ${adm3_code}`)
            } else {
              // Pas de commune sélectionnée → demander coordonnées
              const lonStr = await showInputModal('Longitude:', 'Ex: 1.234567')
              if (!lonStr) return
              const latStr = await showInputModal('Latitude:', 'Ex: 6.123456')
              if (!latStr) return
              
              const lon = parseFloat(lonStr)
              const lat = parseFloat(latStr)
              if (isNaN(lon) || isNaN(lat)) {
                onError('Coordonnées invalides')
                return
              }
              await this.acceptSuggestion(id, { lon, lat })
              onSuccess(`✅ Suggestion acceptée avec coordonnées`)
            }
            this.renderList(onSuccess, onError)
          } catch (e: any) {
            onError(e.message)
          }
        })
      })

      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = (e.target as HTMLElement).dataset.id!
          if (!confirm('Rejeter cette suggestion?')) return
          
          try {
            await this.rejectSuggestion(id)
            onSuccess(`❌ Suggestion rejetée`)
            this.renderList(onSuccess, onError)
          } catch (e: any) {
            onError(e.message)
          }
        })
      })

      document.querySelectorAll('.modify-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = (e.target as HTMLElement).dataset.id!
          const adm3_code = await showAdm3Modal()
          if (!adm3_code) return
          
          try {
            await this.acceptSuggestion(id, { adm3_id: adm3_code })
            onSuccess(`✏️ Suggestion acceptée avec commune: ${adm3_code}`)
            this.renderList(onSuccess, onError)
          } catch (e: any) {
            onError(e.message)
          }
        })
      })

    } catch (error: any) {
      listDiv.innerHTML = `
        <div style="padding: 20px; background: #3d1f1f; border-radius: 6px; color: #ff6b6b;">
          ❌ Erreur: ${error.message}
        </div>
      `
    }
  }
  
  private previewAdm3OnMap(code: string, name: string) {
    // Émettre un événement custom pour que la carte puisse écouter
    const event = new CustomEvent('preview-adm3', {
      detail: { code, name }
    })
    window.dispatchEvent(event)
    console.log(`[SUGGESTIONS] Preview ADM3: ${code} (${name})`)
  }
}
