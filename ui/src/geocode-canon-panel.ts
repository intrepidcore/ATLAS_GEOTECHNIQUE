// Panel de géocodage pour sondages individuels
import { 
  listSondages, 
  getSondagesStats, 
  getAdm3Candidates,
  updateSondageGeometry,
  Sondage, 
  SondagesStats,
  Adm3Candidate,
  extractLocaliteFromCode 
} from './api/sondages';
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

    const missingGeom = this.stats ? this.stats.total - this.stats.with_geom : 0;
    const allGeocoded = missingGeom === 0;
    
    // Stocker les callbacks pour réattacher les listeners
    this.onSuccessCallback = onSuccess;
    this.onErrorCallback = onError;
    this.currentContainerId = containerId;

    container.innerHTML = `
      <div class="geocode-canon-panel" style="display: flex; height: 80vh; background: #0a0e17; border-radius: 8px; overflow: hidden;">
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
        survey.code,
        survey.adm3_name ? `Commune: ${survey.adm3_name}` : null,
      ].filter(Boolean).join(' • ');
      
      const isSelected = this.selectedSurvey?.id === survey.id;

      return `
        <div 
          class="survey-item" 
          data-survey-id="${survey.id}"
          style="padding: 12px; margin-bottom: 8px; background: ${isSelected ? '#1e3a5f' : '#1a2332'}; border: 1px solid ${isSelected ? '#4c6ef5' : '#22304d'}; border-radius: 6px; cursor: pointer; transition: all 0.2s;"
        >
          <div style="font-weight: 500; color: #ecf2f8; margin-bottom: 4px;">${displayName}</div>
          <div style="font-size: 12px; color: #8b9bb3;">${subtitle}</div>
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

    return `
      <div>
        <h2 style="margin: 0 0 24px 0; color: #ecf2f8;">${displayName}</h2>
        
        <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px; font-size: 14px;">
            <div style="color: #8b9bb3;">Code:</div>
            <div style="color: #ecf2f8; font-family: monospace;">${s.code}</div>
            
            <div style="color: #8b9bb3;">Village:</div>
            <div style="color: #ecf2f8;">${s.localite || '-'}</div>
            
            <div style="color: #8b9bb3;">Commune:</div>
            <div style="color: #ecf2f8;">${s.adm3_name || '-'}</div>
            
            <div style="color: #8b9bb3;">Mode:</div>
            <div style="color: #ecf2f8;">${s.location_mode || 'unknown'}</div>
          </div>
        </div>

        <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 16px;">
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
            console.log('[GEOCODE] Sending payload:', { mode: 'adm', adm3_id: adm3IdNum });
            
            // Call API (adm3_id = gid for adm3 table)
            await updateSondageGeometry(this.selectedSurvey!.id, {
              mode: 'adm',
              adm3_id: adm3IdNum
            });
            
            toast.success(`✅ Sondage "${this.selectedSurvey!.localite || this.selectedSurvey!.code}" géocodé avec ADM3${adm ? ': ' + adm.name : ''}`);
          } else {
            const lat = parseFloat((document.getElementById('lat-input') as HTMLInputElement).value);
            const lon = parseFloat((document.getElementById('lon-input') as HTMLInputElement).value);
            
            if (isNaN(lat) || isNaN(lon)) {
              toast.error('❌ Coordonnées invalides');
              return;
            }
            
            // Call API
            await updateSondageGeometry(this.selectedSurvey!.id, {
              mode: 'exact',
              geom: {
                type: 'Point',
                coordinates: [lon, lat]
              }
            });
            
            toast.success(`✅ Sondage "${this.selectedSurvey!.localite || this.selectedSurvey!.code}" géocodé avec coordonnées (${lat}, ${lon})`);
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
