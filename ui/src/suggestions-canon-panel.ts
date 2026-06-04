// Panel de suggestions basé sur sondages individuels
import { listSondages, getSondagesStats, Sondage, SondagesStats, extractLocaliteFromCode } from './api/sondages';

// Helper functions
function formatAdmLine(survey: Sondage): string {
  const chain = [survey.adm1_name, survey.adm2_name, survey.adm3_name].filter(Boolean);
  if (chain.length === 0) return '—';
  return chain.join(' › ');
}

function formatAuditLine(survey: Sondage): string {
  const chunks = [
    survey.created_at ? `Créé le ${formatDateTime(survey.created_at)}` : null,
    survey.updated_at ? `Maj ${formatDateTime(survey.updated_at)}` : null,
    survey.deleted_at ? `Suppr ${formatDateTime(survey.deleted_at)}` : null,
  ].filter(Boolean);
  return chunks.join(' • ') || '—';
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function prettyMeta(meta: string): string {
  try {
    return JSON.stringify(JSON.parse(meta), null, 2);
  } catch (_err) {
    return meta;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
        `Code: ${survey.code}`,
        survey.localite_key ? `Localité clé: ${survey.localite_key}` : null,
        survey.maille_code ? `Maille: ${survey.maille_code}` : null,
        survey.import_id ? `Import: ${survey.import_id}` : null,
        survey.import_row_idx ? `Ligne: ${survey.import_row_idx}` : null,
      ].filter(Boolean).join(' • ');
      const admLine = formatAdmLine(survey);
      const auditLine = formatAuditLine(survey);
      const statsLine = [`Essais: ${survey.n_essais}`, survey.source ? `Source: ${survey.source}` : null]
        .filter(Boolean)
        .join(' • ');

      const badges = [
        survey.location_mode ? `<span class="tag">${survey.location_mode}</span>` : null,
        survey.is_geocoded ? '<span class="tag tag-ok">Géocodé</span>' : '<span class="tag tag-warn">À localiser</span>',
        survey.deleted_at ? '<span class="tag tag-err">Supprimé</span>' : null,
        survey.meta ? '<span class="tag tag-info">Meta</span>' : null,
      ].filter(Boolean).join(' ');

      const needsGeom = !survey.geom;
      const needsAdm3 = !survey.adm3_id;

      return `
        <div 
          class="suggestion-item" 
          data-survey-id="${survey.id}"
          style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: all 0.2s;"
        >
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px;">
                <h4 style="margin:0;color:#ecf2f8;font-size:16px;">${displayName}</h4>
                <div>${badges}</div>
              </div>
              <div style="font-size:13px;color:#8b9bb3;line-height:1.6;">
                <div>${subtitle || '—'}</div>
                <div>ADM: ${admLine}</div>
                <div>${statsLine || '—'}</div>
                <div>${auditLine}</div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
              ${needsGeom ? '<span class="tag tag-err">Sans géométrie</span>' : ''}
              ${needsAdm3 ? '<span class="tag tag-warn">Sans ADM3</span>' : ''}
            </div>
          </div>

          ${survey.meta ? `
            <details style="margin:10px 0 0;">
              <summary style="cursor:pointer;color:#9fb7d3;font-size:12px;">Voir métadonnées</summary>
              <pre style="margin:8px 0 0;background:#101828;border:1px solid #22304d;border-radius:6px;padding:10px;font-size:11px;max-height:180px;overflow:auto;">${escapeHtml(prettyMeta(typeof survey.meta === 'string' ? survey.meta : JSON.stringify(survey.meta, null, 2)))}</pre>
            </details>
          ` : ''}

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top:12px;">
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
