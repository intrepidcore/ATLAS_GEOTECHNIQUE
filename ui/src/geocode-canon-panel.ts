// Panel de géocodage pour sondages individuels
import {
  listSondages,
  getSondagesStats,
  getAdm3Candidates,
  Sondage,
  SondagesStats,
  Adm3Candidate,
  extractLocaliteFromCode,
} from './api/sondages';
import { geocodeSondageAdm3, geocodeSondageCoords } from './api/geocode';
import { toast } from './ui/toast';

export class GeocodeCanonPanel {
  private surveys: Sondage[] = [];
  private stats: SondagesStats | null = null;
  private selectedSurvey: Sondage | null = null;
  private candidates: Adm3Candidate[] = [];
  private loading = false;
  private searchQuery = '';
  private adm3List: any[] = [];
  private onSuccessCallback?: (msg: string) => void;
  private onErrorCallback?: (error: string) => void;
  private currentContainerId?: string;

  constructor(private apiUrl: string) {}

  async refresh() {
    this.loading = true;
    try {
      this.stats = await getSondagesStats();
      this.surveys = await listSondages({
        missing: 'geom',
        limit: 500,
        search: this.searchQuery || undefined,
      });
      
      // Charger la liste ADM3
      const response = await fetch(`${this.apiUrl}/adm3`);
      this.adm3List = await response.json();
    } catch (e: any) {
      console.error('[SONDAGES] Error refreshing geocode panel:', e);
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

    // Listen for refresh events
    window.addEventListener('atlas:refresh-stats', async () => {
      console.log('[GEOCODE PANEL] Refreshing after WebSocket event...');
      try {
        await this.refresh();
        this.renderUI(containerId, onSuccess, onError);
      } catch (e) {
        console.error('[GEOCODE PANEL] Error refreshing:', e);
      }
    });

    const missingGeom = this.stats ? this.stats.total - this.stats.with_geom : 0;
    const allGeocoded = missingGeom === 0;
    
    // Stocker les callbacks pour réattacher les listeners
    this.onSuccessCallback = onSuccess;
    this.onErrorCallback = onError;
    this.currentContainerId = containerId;

    container.innerHTML = `
      <div class="geocode-canon-panel" style="display: flex; height: 100%; background: #0a0e17; overflow: hidden;">
        <!-- Liste gauche -->
        <div class="left-panel" style="width: 400px; border-right: 1px solid #22304d; display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #22304d;">
            <h3 style="margin: 0 0 12px 0; color: #ecf2f8;">
              🗺️ Sondages sans géométrie
              <span id="count-badge" style="margin-left: 8px; padding: 2px 8px; background: ${allGeocoded ? '#51cf66' : '#ff6b6b'}; color: #fff; border-radius: 12px; font-size: 12px;">${missingGeom}</span>
            </h3>
            <div id="progress-bar" style="height: 4px; background: #22304d; border-radius: 2px; overflow: hidden; margin-bottom: 12px;">
              <div style="height: 100%; background: linear-gradient(90deg, #4c6ef5, #51cf66); width: ${this.stats ? (this.stats.with_geom / this.stats.total * 100) : 0}%; transition: width 0.3s;"></div>
            </div>
            <input 
              type="text" 
              id="search-input" 
              placeholder="🔍 Rechercher un sondage..." 
              style="width: 100%; padding: 8px 12px; background: #1a2332; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; font-size: 14px;"
              value="${this.searchQuery}"
            />
          </div>
          
          <div id="surveys-list" style="flex: 1; overflow-y: auto; padding: 8px;">
            ${allGeocoded ? this.renderAllGeocoded() : this.renderSurveysList()}
          </div>
        </div>

        <!-- Panneau droit -->
        <div class="right-panel" style="flex: 1; display: flex; flex-direction: column;">
          <div id="survey-details" style="flex: 1; overflow-y: auto; padding: 24px; color: #ecf2f8;">
            ${this.selectedSurvey ? this.renderSurveyDetails() : this.renderEmptyState()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners(onSuccess, onError);
  }

  private renderAllGeocoded(): string {
    return `
      <div style="text-align: center; padding: 48px 24px; color: #51cf66;">
        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
        <h3 style="margin: 0 0 8px 0; color: #ecf2f8;">Tous les sondages sont géocodés!</h3>
        <p style="margin: 0; color: #8b9bb3; font-size: 14px;">
          ${this.stats?.total || 0} sondages avec géométrie
        </p>
      </div>
    `;
  }

  private renderSurveysList(): string {
    if (this.surveys.length === 0) {
      return `
        <div style="text-align: center; padding: 24px; color: #8b9bb3;">
          <p>Aucun village sans géométrie trouvé</p>
        </div>
      `;
    }

    return this.surveys.map(survey => {
      const displayName = survey.localite || extractLocaliteFromCode(survey.code) || survey.code;
      const subtitle = [
        `Code: ${survey.code}`,
        survey.localite_key ? `Localité clé: ${survey.localite_key}` : null,
        survey.maille_code ? `Maille: ${survey.maille_code}` : null,
      ].filter(Boolean).join(' • ');
      const admLine = [survey.adm1_name, survey.adm2_name, survey.adm3_name].filter(Boolean).join(' › ') || '—';
      const importLine = [
        survey.import_id ? `Import: ${survey.import_id}` : null,
        survey.import_row_idx ? `Ligne: ${survey.import_row_idx}` : null,
        `Essais: ${survey.n_essais}`,
      ].filter(Boolean).join(' • ');
      const auditLine = `Créé: ${formatDateTime(survey.created_at)}${survey.updated_at ? ` • Maj: ${formatDateTime(survey.updated_at)}` : ''}`;
      const badges = [
        survey.location_mode ? `<span class="tag">${survey.location_mode}</span>` : null,
        survey.is_geocoded ? '<span class="tag tag-ok">Géocodé</span>' : '<span class="tag tag-warn">À localiser</span>',
        survey.deleted_at ? '<span class="tag tag-err">Supprimé</span>' : null,
        survey.meta ? '<span class="tag tag-info">Meta</span>' : null,
      ].filter(Boolean).join(' ');
      const isSelected = this.selectedSurvey?.id === survey.id;

      return `
        <div 
          class="survey-item" 
          data-survey-id="${survey.id}"
          style="padding: 12px; margin-bottom: 8px; background: ${isSelected ? '#1e3a5f' : '#1a2332'}; border: 1px solid ${isSelected ? '#4c6ef5' : '#22304d'}; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
        >
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px;">
            <div style="font-weight: 600; color: #ecf2f8; font-size: 14px;">${displayName}</div>
            <div>${badges}</div>
          </div>
          <div style="font-size:12px;color:#8b9bb3;line-height:1.4;">
            <div>${subtitle}</div>
            <div>ADM: ${admLine}</div>
            <div>${importLine}</div>
            <div>${auditLine}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderEmptyState(): string {
    return `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; color: #8b9bb3;">
        <div>
          <div style="font-size: 48px; margin-bottom: 16px;">📍</div>
          <p style="margin: 0;">Sélectionnez un sondage pour le géocoder</p>
        </div>
      </div>
    `;
  }

  private renderSurveyDetails(): string {
    if (!this.selectedSurvey) return this.renderEmptyState();

    const s = this.selectedSurvey;
    const displayName = s.localite || extractLocaliteFromCode(s.code) || s.code;
    const badges = [
      s.location_mode ? `<span class="tag">${s.location_mode}</span>` : null,
      s.is_geocoded ? '<span class="tag tag-ok">Géocodé</span>' : '<span class="tag tag-warn">À localiser</span>',
      s.deleted_at ? '<span class="tag tag-err">Supprimé</span>' : null,
      s.meta ? '<span class="tag tag-info">Meta</span>' : null,
    ].filter(Boolean).join(' ');

    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px;">
          <h2 style="margin: 0; color: #ecf2f8;">${displayName}</h2>
          <div>${badges}</div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px;">
          ${renderInfoCard('🔖 Identifiants', [
            ['Code', s.code || '-'],
            ['Localité clé', s.localite_key || '—'],
            ['Maille', s.maille_code || '—'],
            ['Localité base', s.localite_base || '—'],
            ['Import ID', s.import_id || '—'],
            ['Import ligne', s.import_row_idx || '—'],
          ])}
          ${renderInfoCard('🌍 Localisation', [
            ['ADM1', formatAdmField(s.adm1_name, s.adm1_id)],
            ['ADM2', formatAdmField(s.adm2_name, s.adm2_id)],
            ['ADM3', formatAdmField(s.adm3_name, s.adm3_id?.toString())],
            ['Mode', s.location_mode || 'unknown'],
            ['Précision', s.location_accuracy || '—'],
            ['Géométrie', s.geom ? '✅ Oui' : '❌ Non'],
          ])}
          ${renderInfoCard('📦 Import & Batch', [
            ['Source', s.source || '—'],
            ['Opérateur', s.operator || '—'],
            ['Essais', s.n_essais?.toString() || '0'],
            ['Batch création', s.created_by_batch || '—'],
            ['Batch mise à jour', s.updated_by_batch || '—'],
            ['Batch suppression', s.deleted_by_batch || '—'],
          ])}
          ${renderInfoCard('🕒 Audit', [
            ['Créé le', formatDateTime(s.created_at)],
            ['Mis à jour', formatDateTime(s.updated_at)],
            ['Supprimé le', formatDateTime(s.deleted_at)],
          ])}
        </div>

        <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0; color: #ecf2f8; font-size: 16px;">🧾 Meta & Notes</h3>
          ${formatMetaBlock(s.meta)}
          ${s.notes ? `<p style="margin-top:12px;color:#ecf2f8;"><strong>Notes:</strong> ${escapeHtml(s.notes)}</p>` : ''}
          ${s.comment ? `<p style="margin-top:8px;color:#8b9bb3;"><strong>Commentaire:</strong> ${escapeHtml(s.comment)}</p>` : ''}
        </div>

        <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0; color: #ecf2f8; font-size: 16px;">🎯 Géocodage</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; color: #8b9bb3; font-size: 14px;">Mode de géocodage</label>
            <select id="location-mode" style="width: 100%; padding: 8px 12px; background: #0a0e17; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8;">
              <option value="adm">ADM3 (Commune)</option>
              <option value="exact">Coordonnées exactes</option>
            </select>
          </div>

          <div id="adm3-section" style="margin-bottom: 16px;">
            ${this.candidates.length > 0 ? `
              <div style="margin-bottom: 16px; padding: 12px; background: #0f172a; border: 1px solid #4c6ef5; border-radius: 6px;">
                <div style="color: #4c6ef5; font-weight: 600; margin-bottom: 8px; font-size: 13px;">💡 Suggestions (basées sur similarité)</div>
                ${this.candidates.slice(0, 3).map(c => `
                  <div 
                    class="candidate-item" 
                    data-adm3-id="${c.adm3_id}"
                    style="padding: 8px; margin-bottom: 6px; background: #1a2332; border: 1px solid #22304d; border-radius: 4px; cursor: pointer; transition: all 0.2s;"
                  >
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="color: #ecf2f8; font-weight: 500; font-size: 13px;">${c.name}</div>
                        <div style="color: #8b9bb3; font-size: 11px;">${c.adm2_name || ''} ${c.code ? `• ${c.code}` : ''}</div>
                      </div>
                      <div style="padding: 4px 8px; background: #4c6ef5; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600;">
                        ${Math.round(c.score * 100)}%
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <label style="display: block; margin-bottom: 8px; color: #8b9bb3; font-size: 14px;">Ou choisir manuellement:</label>
            <select id="adm3-select" style="width: 100%; padding: 8px 12px; background: #0a0e17; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8;">
              <option value="">-- Sélectionner une commune --</option>
              ${this.adm3List.map(adm => `<option value="${adm.gid}">${adm.name} (${adm.code})</option>`).join('')}
            </select>
          </div>

          <div id="coords-section" style="display: none; margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; color: #8b9bb3; font-size: 14px;">Latitude</label>
            <input type="number" id="lat-input" step="0.000001" placeholder="Ex: 6.1234" style="width: 100%; padding: 8px 12px; background: #0a0e17; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8; margin-bottom: 12px;" />
            
            <label style="display: block; margin-bottom: 8px; color: #8b9bb3; font-size: 14px;">Longitude</label>
            <input type="number" id="lon-input" step="0.000001" placeholder="Ex: 1.2345" style="width: 100%; padding: 8px 12px; background: #0a0e17; border: 1px solid #22304d; border-radius: 6px; color: #ecf2f8;" />
          </div>

          <button 
            id="save-geocode-btn" 
            style="width: 100%; padding: 12px; background: linear-gradient(135deg, #4c6ef5, #51cf66); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s;"
          >
            💾 Enregistrer le géocodage
          </button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(onSuccess: (msg: string) => void, onError: (error: string) => void) {
    // Search
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', async (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        await this.refresh();
        this.renderUI(searchInput.closest('.geocode-canon-panel')?.parentElement?.id || '', onSuccess, onError);
      });
    }

    // Survey selection
    document.querySelectorAll('.survey-item').forEach(item => {
      item.addEventListener('click', async () => {
        const surveyId = item.getAttribute('data-survey-id');
        this.selectedSurvey = this.surveys.find(s => s.id === surveyId) || null;
        
        // Charger les candidats ADM3
        if (this.selectedSurvey) {
          try {
            const response = await getAdm3Candidates(this.selectedSurvey.id);
            this.candidates = response.candidates;
          } catch (e) {
            console.error('Error loading candidates:', e);
            this.candidates = [];
          }
        }
        
        const containerId = item.closest('.geocode-canon-panel')?.parentElement?.id || '';
        this.renderUI(containerId, onSuccess, onError);
      });
    });

    // Mode toggle
    const modeSelect = document.getElementById('location-mode') as HTMLSelectElement;
    const adm3Section = document.getElementById('adm3-section');
    const coordsSection = document.getElementById('coords-section');
    
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'adm') {
          adm3Section!.style.display = 'block';
          coordsSection!.style.display = 'none';
        } else {
          adm3Section!.style.display = 'none';
          coordsSection!.style.display = 'block';
        }
      });
    }

    // Candidate selection (click on suggestion)
    document.querySelectorAll('.candidate-item').forEach(item => {
      item.addEventListener('click', () => {
        const adm3Id = item.getAttribute('data-adm3-id');
        const select = document.getElementById('adm3-select') as HTMLSelectElement;
        if (select && adm3Id) {
          // Find the corresponding option by adm3_id
          const candidate = this.candidates.find(c => c.adm3_id === parseInt(adm3Id));
          if (candidate) {
            // Set the select value to gid
            select.value = candidate.gid.toString();
            // Trigger change event
            select.dispatchEvent(new Event('change', { bubbles: true }));
            // Visual feedback
            (item as HTMLElement).style.borderColor = '#51cf66';
            (item as HTMLElement).style.background = '#1e3a5f';
            // Reset other items
            document.querySelectorAll('.candidate-item').forEach(other => {
              if (other !== item) {
                (other as HTMLElement).style.borderColor = '#22304d';
                (other as HTMLElement).style.background = '#1a2332';
              }
            });
            console.log('[SONDAGES] Suggestion sélectionnée:', candidate.name, 'gid:', candidate.gid);
          }
        }
      });
      
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.borderColor = '#4c6ef5';
      });
      
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.borderColor = '#22304d';
      });
    });

    // Save button
    const saveBtn = document.getElementById('save-geocode-btn');
    if (saveBtn && this.selectedSurvey) {
      saveBtn.addEventListener('click', async () => {
        try {
          const mode = (document.getElementById('location-mode') as HTMLSelectElement).value;
          
          if (mode === 'adm') {
            const adm3Gid = (document.getElementById('adm3-select') as HTMLSelectElement).value;
            console.log('[GEOCODE] ADM3 select value:', adm3Gid);
            
            if (!adm3Gid || adm3Gid === '') {
              toast.error('❌ Veuillez sélectionner une commune');
              return;
            }
            
            const adm3IdNum = parseInt(adm3Gid);
            if (isNaN(adm3IdNum)) {
              toast.error('❌ ID commune invalide');
              console.error('[GEOCODE] Invalid adm3_id:', adm3Gid);
              return;
            }
            
            // Find ADM3 name for success message
            const adm = this.adm3List.find(a => a.gid === adm3IdNum);
            console.log('[GEOCODE] Sending payload:', { mode: 'adm3', adm3_id: adm3IdNum });
            
            // Call new API endpoint
            const result = await geocodeSondageAdm3(this.selectedSurvey!.id, adm3IdNum);
            
            toast.success(`✅ Sondage "${result.code}" géocodé avec ADM3: ${result.adm3_name || adm?.name || ''}`);
          } else {
            const lat = parseFloat((document.getElementById('lat-input') as HTMLInputElement).value);
            const lon = parseFloat((document.getElementById('lon-input') as HTMLInputElement).value);
            
            if (isNaN(lat) || isNaN(lon)) {
              toast.error('❌ Coordonnées invalides');
              return;
            }
            
            // Call new API endpoint
            const result = await geocodeSondageCoords(this.selectedSurvey!.id, lon, lat);
            
            toast.success(`✅ Sondage "${result.code}" géocodé avec coordonnées (${lat.toFixed(6)}, ${lon.toFixed(6)})`);
          }
          
          // Rafraîchir stats et liste
          await this.refresh();
          this.selectedSurvey = null;
          this.candidates = [];
          this.renderUI(saveBtn.closest('.geocode-canon-panel')?.parentElement?.id || '', onSuccess, onError);
        } catch (e: any) {
          toast.error(e.message || '❌ Erreur lors du géocodage');
        }
      });
    }
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function renderInfoCard(title: string, rows: Array<[string, string]>): string {
  return `
    <div style="background:#1a2332;border:1px solid #22304d;border-radius:8px;padding:14px;min-height:170px;">
      <h3 style="margin:0 0 10px 0;font-size:14px;color:#8b9bb3;">${title}</h3>
      <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;row-gap:6px;column-gap:12px;font-size:13px;">
        ${rows.map(([label, value]) => `
          <dt style="color:#6c7a99;">${label}</dt>
          <dd style="margin:0;color:#ecf2f8;">${value || '—'}</dd>
        `).join('')}
      </dl>
    </div>
  `;
}

function formatAdmField(name?: string | null, code?: string | null): string {
  if (!name && !code) return '—';
  if (name && code) return `${name} <span style="color:#6c7a99;">(${code})</span>`;
  return name || code || '—';
}

function formatMetaBlock(meta: string | null): string {
  if (!meta) {
    return '<p style="color:#8b9bb3;margin:0;">Pas de métadonnées</p>';
  }

  let pretty = meta;
  try {
    pretty = JSON.stringify(JSON.parse(meta), null, 2);
  } catch (_err) {
    // keep raw string
  }

  return `
    <pre style="background:#0f172a;border:1px solid #22304d;border-radius:6px;padding:12px;font-size:12px;max-height:220px;overflow:auto;">${escapeHtml(pretty)}</pre>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
