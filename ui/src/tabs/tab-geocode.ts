/**
 * Onglet "Géocoder & Suggestions"
 * Combine géocodage manuel + suggestions ADM
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs'
import { createGeocodeDrawer } from '../geocode/geocode-drawer'
import { 
  fetchSurveysWithoutGeom, 
  fetchSuggestions, 
  acceptSuggestion,
  rejectSuggestion,
  applyAcceptedSuggestions 
} from '../geocode/geocode-api'
import { toast } from '../ui/toast'
import { bus } from '../utils/event-bus'

export function createTabGeocode(apiUrl: string): TabComponent {
  let container: HTMLElement | null = null
  const drawer = createGeocodeDrawer(apiUrl)
  
  function mount(containerEl: HTMLElement) {
    container = containerEl
    render()
    loadData()
  }
  
  function unmount() {
    drawer.close()
    if (container) {
      container.innerHTML = ''
    }
  }
  
  function render() {
    if (!container) return
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div class="tab-toolbar">
          <button id="btn-apply-suggestions" class="btn-primary" disabled>
            ✅ Appliquer les suggestions (<span id="count-accepted">0</span>)
          </button>
          <button id="btn-refresh-geocode" class="btn-icon" title="Rafraîchir" style="padding: 6px 10px; background: transparent; border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text); font-size: 14px; cursor: pointer;">
            🔄
          </button>
        </div>
        
        <div style="flex: 1; overflow-y: auto; padding: 16px;">
          <div style="margin-bottom: 32px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: var(--tab-text-primary);">📍 Géocodage Manuel</h4>
            <div id="geocode-table-container"></div>
          </div>
          
          <div>
            <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: var(--tab-text-primary);">🤖 Suggestions ADM (<span id="count-pending">0</span>)</h4>
            <div id="suggestions-container"></div>
          </div>
        </div>
      </div>
      
      <style>
        .suggestion-card {
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid var(--tab-border);
          border-radius: 8px;
          background: var(--tab-bg);
        }
        .suggestion-header {
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 600;
        }
        .suggestion-candidate {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--tab-bg-hover);
          border-radius: 4px;
          font-size: 13px;
        }
        .candidate-score {
          margin-left: auto;
          font-weight: 600;
          color: var(--tab-text-active);
        }
        .suggestion-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          font-weight: 500;
        }
        .btn-success {
          background: #0bb07b;
          color: white;
        }
        .btn-success:hover {
          background: #099966;
        }
        .btn-danger {
          background: #ff6b6b;
          color: white;
        }
        .btn-danger:hover {
          background: #ff5252;
        }
        .data-table-compact {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .data-table-compact thead {
          background: var(--tab-bg);
        }
        .data-table-compact th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: var(--tab-text-primary);
          border-bottom: 2px solid var(--tab-border);
        }
        .data-table-compact td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--tab-border);
          color: var(--tab-text);
        }
        .data-table-compact tbody tr:hover {
          background: var(--tab-bg-hover);
        }
        .empty-state-small {
          padding: 32px 16px;
          text-align: center;
          color: var(--tab-text);
          background: var(--tab-bg);
          border-radius: 8px;
          border: 1px solid var(--tab-border);
        }
      </style>
    `
    
    setupToolbar()
  }
  
  function setupToolbar() {
    container?.querySelector('#btn-apply-suggestions')?.addEventListener('click', handleApplySuggestions)
    container?.querySelector('#btn-refresh-geocode')?.addEventListener('click', loadData)
  }
  
  async function loadData() {
    await Promise.all([
      loadSurveysToGeocode(),
      loadSuggestions(),
    ])
  }
  
  async function loadSurveysToGeocode() {
    const tableContainer = container?.querySelector('#geocode-table-container')
    if (!tableContainer) return
    
    try {
      const surveys = await fetchSurveysWithoutGeom(apiUrl)
      
      if (surveys.length === 0) {
        tableContainer.innerHTML = `
          <div class="empty-state-small">
            <p>✅ Tous les sondages sont géocodés</p>
          </div>
        `
        return
      }
      
      tableContainer.innerHTML = `
        <table class="data-table-compact">
          <thead>
            <tr>
              <th>Code</th>
              <th>Source</th>
              <th>ADM</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${surveys.map(s => `
              <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.source}</td>
                <td>${s.adm3_name || '-'}</td>
                <td>
                  <button class="btn-sm btn-primary" data-id="${s.id}">
                    🗺️ Géocoder
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
      
      tableContainer.querySelectorAll('.btn-sm').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = (e.target as HTMLElement).dataset.id!
          const survey = surveys.find(s => s.id === id)!
          drawer.open(survey, loadData)
        })
      })
      
    } catch (e) {
      console.error('[TabGeocode] Failed to load surveys:', e)
      toast.error('Erreur lors du chargement des sondages')
    }
  }
  
  async function loadSuggestions() {
    const suggestionsContainer = container?.querySelector('#suggestions-container')
    const countEl = container?.querySelector('#count-pending')
    const btnApply = container?.querySelector('#btn-apply-suggestions') as HTMLButtonElement
    
    if (!suggestionsContainer) return
    
    try {
      const allSuggestions = await fetchSuggestions(apiUrl)
      const pending = allSuggestions.filter(s => s.status === 'pending')
      const accepted = allSuggestions.filter(s => s.status === 'accepted')
      
      if (countEl) countEl.textContent = pending.length.toString()
      
      const acceptedCount = container?.querySelector('#count-accepted')
      if (acceptedCount) acceptedCount.textContent = accepted.length.toString()
      if (btnApply) btnApply.disabled = accepted.length === 0
      
      if (pending.length === 0) {
        suggestionsContainer.innerHTML = `
          <div class="empty-state-small">
            <p>✅ Aucune suggestion en attente</p>
          </div>
        `
        return
      }
      
      suggestionsContainer.innerHTML = pending.map(sugg => `
        <div class="suggestion-card">
          <div class="suggestion-header">
            ${sugg.code_site} - ${sugg.localite}
          </div>
          <div class="suggestion-body">
            ${sugg.top_candidate ? `
              <div class="suggestion-candidate">
                <span>${sugg.top_candidate.adm3_name}</span>
                <span style="color: var(--tab-text); font-size: 12px;">${sugg.top_candidate.prefecture}</span>
                <span class="candidate-score">${Math.round(sugg.top_candidate.score_pct)}%</span>
              </div>
            ` : '<p style="margin: 0; color: var(--tab-text);">Aucun candidat trouvé</p>'}
          </div>
          <div class="suggestion-actions">
            <button class="btn-sm btn-success" data-id="${sugg.id}" data-action="accept">
              ✅ Accepter
            </button>
            <button class="btn-sm btn-danger" data-id="${sugg.id}" data-action="reject">
              ❌ Rejeter
            </button>
          </div>
        </div>
      `).join('')
      
      suggestionsContainer.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.target as HTMLElement
          const id = target.dataset.id!
          const action = target.dataset.action!
          
          try {
            if (action === 'accept') {
              await acceptSuggestion(apiUrl, id)
              toast.success('Suggestion acceptée')
            } else {
              await rejectSuggestion(apiUrl, id)
              toast.success('Suggestion rejetée')
            }
            await loadData()
            bus.emit('suggestion:changed', { pending: pending.length - 1 })
          } catch (err) {
            console.error('[TabGeocode] Action failed:', err)
            toast.error('Erreur lors de l\'action')
          }
        })
      })
      
    } catch (e) {
      console.error('[TabGeocode] Failed to load suggestions:', e)
      toast.error('Erreur lors du chargement des suggestions')
    }
  }
  
  async function handleApplySuggestions() {
    if (!confirm('Appliquer toutes les suggestions acceptées?')) return
    
    try {
      const result = await applyAcceptedSuggestions(apiUrl)
      toast.success(`${result.updated} sondages géocodés!`)
      await loadData()
      bus.emit('suggestion:changed', { pending: 0 })
    } catch (e) {
      console.error('[TabGeocode] Failed to apply suggestions:', e)
      toast.error('Erreur lors de l\'application')
    }
  }
  
  async function refresh() {
    await loadData()
  }
  
  function onActivate() {
    console.log('[TabGeocode] Activated')
  }
  
  return {
    mount,
    unmount,
    refresh,
    onActivate,
  }
}
