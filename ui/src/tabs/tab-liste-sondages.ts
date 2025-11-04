/**
 * Onglet "Liste Sondages"
 * Tableau filtrable avec recherche
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs'
import { httpJSON } from '../utils/http'
import { bus } from '../utils/event-bus'

interface Survey {
  id: string
  code: string
  source: string
  location_mode: string
  adm3_name: string | null
  has_geom: boolean
  created_at: string
}

interface Filters {
  search: string
  location_mode: string
  has_geom: string
}

export function createTabListeSondages(apiUrl: string): TabComponent {
  let container: HTMLElement | null = null
  let surveys: Survey[] = []
  let filteredSurveys: Survey[] = []
  let filters: Filters = {
    search: '',
    location_mode: 'all',
    has_geom: 'all',
  }
  
  function mount(containerEl: HTMLElement) {
    container = containerEl
    render()
    loadSurveys()
    
    const cleanup = bus.on('survey:created', () => {
      loadSurveys()
    })
    
    return cleanup
  }
  
  function unmount() {
    if (container) {
      container.innerHTML = ''
    }
  }
  
  function render() {
    if (!container) return
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div class="tab-toolbar">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input 
              type="search" 
              id="search-surveys" 
              placeholder="🔍 Rechercher par code ou source..."
              style="min-width: 300px; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary); font-size: 13px;"
              value="${filters.search}"
            />
          </div>
          
          <div style="width: 1px; height: 24px; background: var(--tab-border); margin: 0 4px;"></div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="filter-mode" style="font-size: 13px;">Mode:</label>
            <select id="filter-mode" style="padding: 6px 10px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary); font-size: 13px; cursor: pointer;">
              <option value="all">Tous</option>
              <option value="exact">Exact</option>
              <option value="adm_random_cell">ADM random</option>
              <option value="spread">Spread</option>
            </select>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="filter-geom" style="font-size: 13px;">Géométrie:</label>
            <select id="filter-geom" style="padding: 6px 10px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary); font-size: 13px; cursor: pointer;">
              <option value="all">Tous</option>
              <option value="true">Avec</option>
              <option value="false">Sans</option>
            </select>
          </div>
          
          <div style="width: 1px; height: 24px; background: var(--tab-border); margin: 0 4px;"></div>
          
          <button id="btn-refresh" class="btn-icon" title="Rafraîchir" style="padding: 6px 10px; background: transparent; border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text); font-size: 14px; cursor: pointer;">
            🔄
          </button>
        </div>
        
        <div style="flex: 1; overflow: auto; padding: 16px;">
          <div id="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; color: var(--tab-text);">
            <div style="width: 40px; height: 40px; border: 4px solid var(--tab-border); border-top-color: var(--tab-text-active); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
            <p>Chargement des sondages...</p>
          </div>
          
          <div id="empty-state" style="display: none; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; text-align: center; color: var(--tab-text);">
            <div style="font-size: 56px; margin-bottom: 16px; opacity: 0.4;">📋</div>
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--tab-text-primary);">Aucun sondage</h3>
            <p style="font-size: 14px; max-width: 400px;">Aucun sondage ne correspond à vos critères de recherche.</p>
          </div>
          
          <table id="surveys-table" style="display: none; width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead style="position: sticky; top: 0; background: var(--tab-bg); z-index: 10;">
              <tr>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">Code</th>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">Source</th>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">Mode</th>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">ADM3</th>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">Géom</th>
                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: var(--tab-text-primary); border-bottom: 2px solid var(--tab-border);">Date</th>
              </tr>
            </thead>
            <tbody id="surveys-tbody"></tbody>
          </table>
        </div>
        
        <div style="padding: 12px 16px; border-top: 1px solid var(--tab-border); background: var(--tab-bg); font-size: 13px; color: var(--tab-text);">
          <span id="surveys-count">0 sondages</span>
        </div>
      </div>
      
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        #surveys-table tbody tr:hover {
          background: var(--tab-bg-hover);
        }
        #surveys-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--tab-border);
          color: var(--tab-text);
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-exact { background: #0bb07b; color: white; }
        .badge-adm_random_cell { background: #3aa6ff; color: white; }
        .badge-spread { background: #ff9f43; color: white; }
      </style>
    `
    
    setupFilters()
    setupRefreshButton()
  }
  
  function setupFilters() {
    if (!container) return
    
    const searchInput = container.querySelector('#search-surveys') as HTMLInputElement
    const modeSelect = container.querySelector('#filter-mode') as HTMLSelectElement
    const geomSelect = container.querySelector('#filter-geom') as HTMLSelectElement
    
    let searchTimeout: number
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = window.setTimeout(() => {
        filters.search = (e.target as HTMLInputElement).value.toLowerCase()
        applyFilters()
      }, 300)
    })
    
    modeSelect?.addEventListener('change', (e) => {
      filters.location_mode = (e.target as HTMLSelectElement).value
      applyFilters()
    })
    
    geomSelect?.addEventListener('change', (e) => {
      filters.has_geom = (e.target as HTMLSelectElement).value
      applyFilters()
    })
  }
  
  function setupRefreshButton() {
    const btn = container?.querySelector('#btn-refresh')
    if (btn) {
      btn.addEventListener('click', () => {
        loadSurveys()
      })
    }
  }
  
  async function loadSurveys() {
    if (!container) return
    
    const loadingState = container.querySelector('#loading-state') as HTMLElement
    const emptyState = container.querySelector('#empty-state') as HTMLElement
    const table = container.querySelector('#surveys-table') as HTMLElement
    
    loadingState.style.display = 'flex'
    emptyState.style.display = 'none'
    table.style.display = 'none'
    
    try {
      surveys = await httpJSON<Survey[]>(`${apiUrl}/surveys`)
      filteredSurveys = surveys
      
      applyFilters()
      
    } catch (e) {
      console.error('[TabListeSondages] Failed to load surveys:', e)
      loadingState.style.display = 'none'
      emptyState.style.display = 'flex'
      emptyState.querySelector('p')!.textContent = '❌ Erreur lors du chargement des sondages'
    }
  }
  
  function applyFilters() {
    if (!container) return
    
    filteredSurveys = surveys.filter(survey => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchCode = survey.code.toLowerCase().includes(searchLower)
        const matchSource = survey.source.toLowerCase().includes(searchLower)
        if (!matchCode && !matchSource) return false
      }
      
      if (filters.location_mode !== 'all') {
        if (survey.location_mode !== filters.location_mode) return false
      }
      
      if (filters.has_geom !== 'all') {
        const hasGeom = filters.has_geom === 'true'
        if (survey.has_geom !== hasGeom) return false
      }
      
      return true
    })
    
    renderTable()
  }
  
  function renderTable() {
    if (!container) return
    
    const tbody = container.querySelector('#surveys-tbody')
    const loadingState = container.querySelector('#loading-state') as HTMLElement
    const emptyState = container.querySelector('#empty-state') as HTMLElement
    const table = container.querySelector('#surveys-table') as HTMLElement
    const countEl = container.querySelector('#surveys-count')
    
    loadingState.style.display = 'none'
    
    if (filteredSurveys.length === 0) {
      table.style.display = 'none'
      emptyState.style.display = 'flex'
      if (countEl) countEl.textContent = '0 sondages'
      return
    }
    
    emptyState.style.display = 'none'
    table.style.display = 'table'
    
    if (tbody) {
      tbody.innerHTML = filteredSurveys.map(survey => `
        <tr data-survey-id="${survey.id}">
          <td><strong>${survey.code}</strong></td>
          <td>${survey.source}</td>
          <td>
            <span class="badge badge-${survey.location_mode}">
              ${formatLocationMode(survey.location_mode)}
            </span>
          </td>
          <td>${survey.adm3_name || '-'}</td>
          <td style="font-size: 16px;">
            ${survey.has_geom ? '✅' : '❌'}
          </td>
          <td>${formatDate(survey.created_at)}</td>
        </tr>
      `).join('')
    }
    
    if (countEl) {
      countEl.textContent = `${filteredSurveys.length} sondage${filteredSurveys.length > 1 ? 's' : ''}`
    }
  }
  
  function formatLocationMode(mode: string): string {
    const modes: Record<string, string> = {
      'exact': 'Exact',
      'adm_random_cell': 'ADM random',
      'spread': 'Spread',
    }
    return modes[mode] || mode
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }
  
  async function refresh() {
    await loadSurveys()
  }
  
  function onActivate() {
    console.log('[TabListeSondages] Activated')
    if (surveys.length === 0) {
      loadSurveys()
    }
  }
  
  return {
    mount,
    unmount,
    refresh,
    onActivate,
  }
}
