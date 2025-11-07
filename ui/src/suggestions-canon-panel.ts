// Panel de suggestions basé sur sondages individuels
import { listSondages, getSondagesStats, Sondage, SondagesStats, extractLocaliteFromCode } from './api/sondages';

export class SuggestionsCanonPanel {
  private surveys: Sondage[] = [];
  private stats: SondagesStats | null = null;
  private loading = false;
  private filter: 'all' | 'missing_geom' | 'missing_adm3' = 'missing_geom';

  constructor(private apiUrl: string) {}

  async refresh() {
    this.loading = true;
    try {
      this.stats = await getSondagesStats();
      
      // Charger selon le filtre
      if (this.filter === 'missing_geom') {
        this.surveys = await listSondages({ missing: 'geom', limit: 500 });
      } else if (this.filter === 'missing_adm3') {
        this.surveys = await listSondages({ missing: 'adm3', limit: 500 });
      } else {
        this.surveys = await listSondages({ limit: 500 });
      }
    } catch (e: any) {
      console.error('[SONDAGES] Error refreshing suggestions:', e);
      throw e;
    } finally {
      this.loading = false;
    }
  }

  renderUI(containerId: string, onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    const missingGeom = this.stats ? this.stats.total - this.stats.with_geom : 0;
    const missingAdm3 = this.stats ? this.stats.total - this.stats.with_adm3 : 0;

    container.innerHTML = `
      <div class="suggestions-canon-panel" style="display: flex; flex-direction: column; height: 100%; background: #0a0e17;">
        <!-- Header avec KPIs -->
        <div style="padding: 24px; border-bottom: 1px solid #22304d;">
          <h2 style="margin: 0 0 24px 0; color: #ecf2f8; font-size: 20px;">🎯 Suggestions de Géocodage</h2>
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #51cf66;">${this.stats?.geocoded || 0}</div>
              <div style="font-size: 12px; color: #8b9bb3; margin-top: 4px;">Géocodés</div>
            </div>
            
            <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ff6b6b;">${missingGeom}</div>
              <div style="font-size: 12px; color: #8b9bb3; margin-top: 4px;">Sans géométrie</div>
            </div>
            
            <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ffa94d;">${missingAdm3}</div>
              <div style="font-size: 12px; color: #8b9bb3; margin-top: 4px;">Sans ADM3</div>
            </div>
            
            <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #4c6ef5;">${this.stats?.total || 0}</div>
              <div style="font-size: 12px; color: #8b9bb3; margin-top: 4px;">Total sondages</div>
            </div>
          </div>

          <!-- Filtres -->
          <div style="display: flex; gap: 8px;">
            <button 
              id="filter-missing-geom" 
              class="filter-btn ${this.filter === 'missing_geom' ? 'active' : ''}"
              style="padding: 8px 16px; background: ${this.filter === 'missing_geom' ? '#ff6b6b' : '#1a2332'}; color: #fff; border: 1px solid ${this.filter === 'missing_geom' ? '#ff6b6b' : '#22304d'}; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;"
            >
              Sans géométrie (${missingGeom})
            </button>
            
            <button 
              id="filter-missing-adm3" 
              class="filter-btn ${this.filter === 'missing_adm3' ? 'active' : ''}"
              style="padding: 8px 16px; background: ${this.filter === 'missing_adm3' ? '#ffa94d' : '#1a2332'}; color: #fff; border: 1px solid ${this.filter === 'missing_adm3' ? '#ffa94d' : '#22304d'}; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;"
            >
              Sans ADM3 (${missingAdm3})
            </button>
            
            <button 
              id="filter-all" 
              class="filter-btn ${this.filter === 'all' ? 'active' : ''}"
              style="padding: 8px 16px; background: ${this.filter === 'all' ? '#4c6ef5' : '#1a2332'}; color: #fff; border: 1px solid ${this.filter === 'all' ? '#4c6ef5' : '#22304d'}; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;"
            >
              Tous (${this.stats?.total || 0})
            </button>
          </div>
        </div>

        <!-- Liste des suggestions -->
        <div id="suggestions-list" style="flex: 1; overflow-y: auto; padding: 16px;">
          ${this.renderSuggestionsList()}
        </div>
      </div>
    `;

    this.attachEventListeners(containerId, onSuccess, onError);
  }

  private renderSuggestionsList(): string {
    if (this.surveys.length === 0) {
      return `
        <div style="text-align: center; padding: 48px 24px; color: #51cf66;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h3 style="margin: 0 0 8px 0; color: #ecf2f8;">Aucune suggestion!</h3>
          <p style="margin: 0; color: #8b9bb3; font-size: 14px;">
            Tous les sondages sont géocodés selon le filtre sélectionné
          </p>
        </div>
      `;
    }

    return this.surveys.map(survey => {
      const displayName = survey.localite || extractLocaliteFromCode(survey.code) || survey.code;
      const subtitle = [
        survey.code,
        survey.adm3_name ? `Commune: ${survey.adm3_name}` : 'Commune: —',
      ].join(' • ');

      const needsGeom = !survey.geom;
      const needsAdm3 = !survey.adm3_id;

      return `
        <div 
          class="suggestion-item" 
          data-survey-id="${survey.id}"
          style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: all 0.2s;"
        >
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #ecf2f8; font-size: 16px; margin-bottom: 4px;">${displayName}</div>
              <div style="font-size: 13px; color: #8b9bb3;">${subtitle}</div>
            </div>
            
            <div style="display: flex; gap: 4px; flex-direction: column; align-items: flex-end;">
              ${needsGeom ? '<span style="padding: 4px 8px; background: #ff6b6b; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 500;">Sans géométrie</span>' : ''}
              ${needsAdm3 ? '<span style="padding: 4px 8px; background: #ffa94d; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 500;">Sans ADM3</span>' : ''}
            </div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button 
              class="geocode-btn" 
              data-survey-id="${survey.id}"
              style="padding: 8px 16px; background: linear-gradient(135deg, #4c6ef5, #51cf66); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: transform 0.2s;"
            >
              🎯 Géocoder
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private attachEventListeners(containerId: string, onSuccess: (msg: string) => void, onError: (error: string) => void) {
    // Filtres
    const filterGeomBtn = document.getElementById('filter-missing-geom');
    const filterAdm3Btn = document.getElementById('filter-missing-adm3');
    const filterAllBtn = document.getElementById('filter-all');

    if (filterGeomBtn) {
      filterGeomBtn.addEventListener('click', async () => {
        this.filter = 'missing_geom';
        await this.refresh();
        this.renderUI(containerId, onSuccess, onError);
      });
    }

    if (filterAdm3Btn) {
      filterAdm3Btn.addEventListener('click', async () => {
        this.filter = 'missing_adm3';
        await this.refresh();
        this.renderUI(containerId, onSuccess, onError);
      });
    }

    if (filterAllBtn) {
      filterAllBtn.addEventListener('click', async () => {
        this.filter = 'all';
        await this.refresh();
        this.renderUI(containerId, onSuccess, onError);
      });
    }

    // Boutons géocoder
    document.querySelectorAll('.geocode-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const surveyId = btn.getAttribute('data-survey-id');
        const survey = this.surveys.find(s => s.id === surveyId);
        if (!survey) return;

        onError('Fonctionnalité de géocodage en cours de développement. Utilisez l\'onglet "Géocodage Amélioré" pour géocoder les villages.');
      });
    });
  }
}
