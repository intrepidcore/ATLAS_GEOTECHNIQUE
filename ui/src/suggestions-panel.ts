// Panel de gestion des suggestions de géocodage
import { getStats, listSuggestions, accept, reject, updateAdm3, applyAccepted, Suggestion, GeocodeStats } from './api/geocode'

export class SuggestionsPanel {
  private stats: GeocodeStats | null = null
  private suggestions: Suggestion[] = []
  private loading = false
  private filter: 'all' | 'pending' | 'accepted' | 'rejected' = 'pending'

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

  async acceptSuggestion(id: number) {
    try {
      await accept(id)
      await this.refresh()
      return true
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error accepting:', e)
      throw e
    }
  }

  async rejectSuggestion(id: number) {
    try {
      await reject(id)
      await this.refresh()
      return true
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error rejecting:', e)
      throw e
    }
  }

  async updateSuggestion(id: number, adm3Code: string) {
    try {
      await updateAdm3(id, adm3Code)
      await this.refresh()
      return true
    } catch (e: any) {
      console.error('[SUGGESTIONS] Error updating:', e)
      throw e
    }
  }

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
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <button class="filter-btn" data-filter="pending" style="padding: 8px 16px; background: #ff9f43; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">En attente</button>
          <button class="filter-btn" data-filter="accepted" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Acceptées</button>
          <button class="filter-btn" data-filter="rejected" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Rejetées</button>
          <button class="filter-btn" data-filter="all" style="padding: 8px 16px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;">Toutes</button>
          <div style="flex: 1;"></div>
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
        const statusColor = s.status === 'accepted' ? '#0bb07b' : s.status === 'rejected' ? '#ff6b6b' : '#ff9f43'
        const statusIcon = s.status === 'accepted' ? '✅' : s.status === 'rejected' ? '❌' : '⚠️'
        
        return `
          <div class="suggestion-item" style="background: #0f172a; padding: 16px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #22304d;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div>
                <h4 style="margin: 0 0 8px 0; color: #ecf2f8;">
                  ${statusIcon} ${s.localite || '(sans localité)'}
                  <span style="font-size: 11px; color: #8aa0b5; font-weight: normal;">${s.entity_id.substring(0, 8)}...</span>
                </h4>
                <p style="margin: 4px 0; color: #8aa0b5; font-size: 13px;">
                  🎯 Top: <b>${s.top_code || '—'}</b> · Score: <b>${s.top_score?.toFixed(2) || '—'}</b> · Méthode: <b>${s.top_method || 'candidate'}</b>
                </p>
                <p style="margin: 4px 0; color: ${statusColor}; font-size: 12px;">
                  Statut: <b>${s.status.toUpperCase()}</b>
                </p>
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
            
            ${s.candidates && s.candidates.length > 0 ? `
              <details style="margin-top: 12px;">
                <summary style="cursor: pointer; color: #8aa0b5; font-size: 13px;">📋 Candidats (${s.candidates.length})</summary>
                <ul style="margin: 8px 0 0 20px; padding: 0; list-style: decimal;">
                  ${s.candidates.slice(0, 5).map(c => `
                    <li style="color: #8aa0b5; font-size: 12px; margin: 4px 0;">
                      <b>${c.name}</b> (${c.code}) — Score: ${c.score.toFixed(2)} ${c.method ? `· ${c.method}` : ''}
                    </li>
                  `).join('')}
                </ul>
              </details>
            ` : ''}
          </div>
        `
      }).join('')

      // Attacher event listeners
      document.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt((e.target as HTMLElement).dataset.id!)
          try {
            await this.acceptSuggestion(id)
            onSuccess(`✅ Suggestion ${id} acceptée`)
            this.renderList(onSuccess, onError)
          } catch (e: any) {
            onError(e.message)
          }
        })
      })

      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt((e.target as HTMLElement).dataset.id!)
          try {
            await this.rejectSuggestion(id)
            onSuccess(`❌ Suggestion ${id} rejetée`)
            this.renderList(onSuccess, onError)
          } catch (e: any) {
            onError(e.message)
          }
        })
      })

      document.querySelectorAll('.modify-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt((e.target as HTMLElement).dataset.id!)
          const adm3Code = prompt('Entrer un code ADM3 (ex: TG030709)')
          if (!adm3Code) return
          
          try {
            await this.updateSuggestion(id, adm3Code)
            onSuccess(`✏️ Suggestion ${id} modifiée`)
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
}
