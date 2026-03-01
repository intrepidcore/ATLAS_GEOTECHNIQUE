/**
 * Module UI pour la gestion des suggestions de géocodage et vue unifiée
 */

export interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  reason: string;
  status: string;
  payload: {
    code: string;
    source: string;
    adm3_id: string | null;
    adm3_name: string | null;
    localite_key: string;
    localite_base: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GeocodeStats {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  no_suggestion: number;
}

export interface UnifiedSurvey {
  localite_key: string;
  localite: string;
  survey_ids: string[];
  survey_codes: string[];
  has_bleu: boolean;
  has_limite: boolean;
  has_granulo: boolean;
  has_vbs: boolean;
  variants: number;
  adm3_id: string | null;
  adm3_name: string | null;
  has_geometry: boolean;
  latest_date: string | null;
  atterberg_count: number;
  granulo_count: number;
  vbs_count: number;
  echantillons_count: number;
  total_essais: number;
}

export interface UnifiedStats {
  total_localites: number;
  total_sondages: number;
  localites_avec_doublons: number;
  total_essais: number;
  sondages_sans_geom: number;
}

/**
 * API Client pour les suggestions de géocodage
 */
export class GeocodeAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async getSuggestions(params: {
    status?: string;
    reason?: string;
    limit?: number;
  } = {}): Promise<GeocodeSuggestion[]> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.reason) query.append('reason', params.reason);
    query.append('limit', String(params.limit || 100));

    const response = await fetch(`${this.baseUrl}/geocode/suggestions?${query}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async getStats(): Promise<GeocodeStats> {
    const response = await fetch(`${this.baseUrl}/geocode/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async acceptSuggestion(
    id: string,
    payload: { adm3_id?: string; lon?: number; lat?: number }
  ): Promise<GeocodeSuggestion> {
    const response = await fetch(`${this.baseUrl}/geocode/suggestions/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    return response.json();
  }

  async rejectSuggestion(id: string): Promise<GeocodeSuggestion> {
    const response = await fetch(`${this.baseUrl}/geocode/suggestions/${id}/reject`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async applyAccepted(): Promise<{ applied_count: number; refreshed: boolean }> {
    const response = await fetch(`${this.baseUrl}/geocode/apply-accepted`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

/**
 * API Client pour la vue unifiée
 */
export class UnifiedSurveysAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async getSurveys(params: {
    q?: string;
    adm3_id?: string;
    has_geometry?: boolean;
    limit?: number;
  } = {}): Promise<UnifiedSurvey[]> {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.adm3_id) query.append('adm3_id', params.adm3_id);
    if (params.has_geometry !== undefined) {
      query.append('has_geometry', String(params.has_geometry));
    }
    query.append('limit', String(params.limit || 100));

    const response = await fetch(`${this.baseUrl}/surveys/unified?${query}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async getStats(): Promise<UnifiedStats> {
    const response = await fetch(`${this.baseUrl}/surveys/unified/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async refreshView(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/surveys/unified/refresh`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

/**
 * Crée l'UI pour les suggestions de géocodage
 */
export function createGeocodeSuggestionsUI(container: HTMLElement) {
  const api = new GeocodeAPI();
  let suggestions: GeocodeSuggestion[] = [];
  let stats: GeocodeStats | null = null;

  // HTML Structure
  container.innerHTML = `
    <div class="geocode-panel">
      <div class="panel-header">
        <h2>🎯 Suggestions de Géocodage</h2>
        <button id="refresh-btn" class="btn-refresh">🔄 Rafraîchir</button>
      </div>
      <div id="stats-container"></div>
      <div id="filters-container">
        <select id="status-filter">
          <option value="">Tous les statuts</option>
          <option value="pending" selected>En attente</option>
          <option value="done">Acceptées</option>
          <option value="rejected">Rejetées</option>
        </select>
      </div>
      <div id="suggestions-list"></div>
    </div>
  `;

  // Event Listeners
  const refreshBtn = container.querySelector('#refresh-btn') as HTMLButtonElement;
  const statusFilter = container.querySelector('#status-filter') as HTMLSelectElement;

  refreshBtn.addEventListener('click', loadData);
  statusFilter.addEventListener('change', loadSuggestions);

  async function loadData() {
    await Promise.all([loadSuggestions(), loadStats()]);
  }

  async function loadSuggestions() {
    try {
      suggestions = await api.getSuggestions({
        status: statusFilter.value || undefined,
      });
      renderSuggestions();
    } catch (error) {
      console.error('Erreur chargement suggestions:', error);
    }
  }

  async function loadStats() {
    try {
      stats = await api.getStats();
      renderStats();
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  }

  function renderStats() {
    if (!stats) return;
    const statsContainer = container.querySelector('#stats-container')!;
    statsContainer.innerHTML = `
      <div class="stats-row">
        <div class="stat-item">Total: <strong>${stats.total}</strong></div>
        <div class="stat-item pending">En attente: <strong>${stats.pending}</strong></div>
        <div class="stat-item success">Acceptées: <strong>${stats.accepted}</strong></div>
        <div class="stat-item danger">Rejetées: <strong>${stats.rejected}</strong></div>
      </div>
    `;
  }

  function renderSuggestions() {
    const listContainer = container.querySelector('#suggestions-list')!;

    if (suggestions.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">Aucune suggestion trouvée</div>';
      return;
    }

    listContainer.innerHTML = suggestions
      .map(
        (s) => `
      <div class="suggestion-card ${s.status}">
        <div class="suggestion-header">
          <div>
            <h3>${s.payload.code}</h3>
            <p>${s.payload.localite_base || 'N/A'}</p>
          </div>
          <span class="status-badge ${s.status}">${getStatusLabel(s.status)}</span>
        </div>
        <div class="suggestion-meta">
          <span>📍 ${s.reason}</span>
          <span>🏷️ ${s.payload.source}</span>
          <span>📅 ${new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        ${
          s.status === 'pending'
            ? `
          <div class="suggestion-actions">
            <button class="btn-accept" data-id="${s.id}">✅ Accepter</button>
            <button class="btn-reject" data-id="${s.id}">❌ Rejeter</button>
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('');

    // Attach event listeners
    listContainer.querySelectorAll('.btn-accept').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        handleAccept(id);
      });
    });

    listContainer.querySelectorAll('.btn-reject').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id!;
        handleReject(id);
      });
    });
  }

  async function handleAccept(id: string) {
    const adm3Id = prompt('Entrez l\'ID ADM3 (ou laissez vide pour coordonnées):');
    if (adm3Id === null) return; // Cancelled

    try {
      if (adm3Id) {
        await api.acceptSuggestion(id, { adm3_id: adm3Id });
      } else {
        const lon = parseFloat(prompt('Longitude:') || '');
        const lat = parseFloat(prompt('Latitude:') || '');
        if (isNaN(lon) || isNaN(lat)) {
          alert('Coordonnées invalides');
          return;
        }
        await api.acceptSuggestion(id, { lon, lat });
      }
      alert('✅ Suggestion acceptée!');
      await loadData();
    } catch (error) {
      alert(`❌ Erreur: ${error}`);
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Rejeter cette suggestion?')) return;

    try {
      await api.rejectSuggestion(id);
      alert('✅ Suggestion rejetée');
      await loadData();
    } catch (error) {
      alert(`❌ Erreur: ${error}`);
    }
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      done: 'Acceptée',
      rejected: 'Rejetée',
    };
    return labels[status] || status;
  }

  // Initial load
  loadData();

  return {
    refresh: loadData,
    api,
  };
}

/**
 * Crée l'UI pour la vue unifiée
 */
export function createUnifiedSurveysUI(container: HTMLElement) {
  const api = new UnifiedSurveysAPI();
  let surveys: UnifiedSurvey[] = [];
  let stats: UnifiedStats | null = null;

  container.innerHTML = `
    <div class="unified-panel">
      <div class="panel-header">
        <h2>📍 Localités Unifiées</h2>
        <div class="header-actions">
          <button id="refresh-btn" class="btn-refresh">🔄 Rafraîchir</button>
          <button id="refresh-view-btn" class="btn-primary">⚡ Refresh Vue</button>
        </div>
      </div>
      <div id="stats-container"></div>
      <div id="filters-container">
        <input id="search-input" type="text" placeholder="🔍 Rechercher..." />
        <select id="geom-filter">
          <option value="">Toutes</option>
          <option value="true">Avec géométrie</option>
          <option value="false">Sans géométrie</option>
        </select>
      </div>
      <div id="surveys-list"></div>
    </div>
  `;

  const refreshBtn = container.querySelector('#refresh-btn') as HTMLButtonElement;
  const refreshViewBtn = container.querySelector('#refresh-view-btn') as HTMLButtonElement;
  const searchInput = container.querySelector('#search-input') as HTMLInputElement;
  const geomFilter = container.querySelector('#geom-filter') as HTMLSelectElement;

  refreshBtn.addEventListener('click', loadData);
  refreshViewBtn.addEventListener('click', handleRefreshView);

  let searchTimeout: number;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(loadSurveys, 300);
  });

  geomFilter.addEventListener('change', loadSurveys);

  async function loadData() {
    await Promise.all([loadSurveys(), loadStats()]);
  }

  async function loadSurveys() {
    try {
      const params: any = {};
      if (searchInput.value) params.q = searchInput.value;
      if (geomFilter.value) params.has_geometry = geomFilter.value === 'true';

      surveys = await api.getSurveys(params);
      renderSurveys();
    } catch (error) {
      console.error('Erreur chargement localités:', error);
    }
  }

  async function loadStats() {
    try {
      stats = await api.getStats();
      renderStats();
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  }

  async function handleRefreshView() {
    try {
      await api.refreshView();
      alert('✅ Vue matérialisée rafraîchie!');
      await loadData();
    } catch (error) {
      alert(`❌ Erreur: ${error}`);
    }
  }

  function renderStats() {
    if (!stats) return;
    const statsContainer = container.querySelector('#stats-container')!;
    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.total_localites}</div>
          <div class="stat-label">Localités Uniques</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.total_sondages}</div>
          <div class="stat-label">Sondages Total</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${stats.localites_avec_doublons}</div>
          <div class="stat-label">Avec Doublons</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${stats.total_essais}</div>
          <div class="stat-label">Essais Total</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${stats.sondages_sans_geom}</div>
          <div class="stat-label">Sans Géométrie</div>
        </div>
      </div>
    `;
  }

  function renderSurveys() {
    const listContainer = container.querySelector('#surveys-list')!;

    if (surveys.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">Aucune localité trouvée</div>';
      return;
    }

    listContainer.innerHTML = surveys
      .map(
        (s) => `
      <div class="survey-card">
        <div class="survey-header">
          <h3>${s.localite}</h3>
          ${s.variants > 1 ? `<span class="badge">${s.variants} variantes</span>` : ''}
        </div>
        <div class="survey-meta">
          ${s.adm3_name ? `<span>📍 ${s.adm3_name}</span>` : ''}
          <span class="${s.has_geometry ? 'text-success' : 'text-danger'}">
            ${s.has_geometry ? '✅ Géocodé' : '❌ Non géocodé'}
          </span>
        </div>
        <div class="survey-types">
          ${s.has_granulo ? `<span class="type-badge granulo">🪨 Granulo (${s.granulo_count})</span>` : ''}
          ${s.has_bleu ? `<span class="type-badge vbs">💧 VBS (${s.vbs_count})</span>` : ''}
          ${s.has_limite ? `<span class="type-badge atterberg">📊 Atterberg (${s.atterberg_count})</span>` : ''}
        </div>
        <div class="survey-footer">
          ${s.total_essais} essais • ${s.echantillons_count} échantillons
        </div>
      </div>
    `
      )
      .join('');
  }

  loadData();

  return {
    refresh: loadData,
    api,
  };
}
