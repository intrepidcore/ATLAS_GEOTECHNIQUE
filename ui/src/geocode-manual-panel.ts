// Panel de géocodage manuel (Géocodage Amélioré)
import { listWithoutGeometry, updateGeometry, getManualStats, SondageWithoutGeometry, ManualGeocodeStats } from './api/geocode';

export class GeocodeManualPanel {
  private sondages: SondageWithoutGeometry[] = [];
  private stats: ManualGeocodeStats | null = null;
  private selectedSondage: SondageWithoutGeometry | null = null;
  private loading = false;
  private searchQuery = '';
  private adm3List: any[] = [];

  constructor(private apiUrl: string) {}

  async refresh() {
    this.loading = true;
    try {
      this.stats = await getManualStats();
      this.sondages = await listWithoutGeometry({
        limit: 100,
        search: this.searchQuery || undefined,
      });
      
      // Charger la liste ADM3
      const response = await fetch(`${this.apiUrl}/adm3`);
      this.adm3List = await response.json();
    } catch (e: any) {
      console.error('[GEOCODE_MANUAL] Error refreshing:', e);
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

    container.innerHTML = `
      <div class="geocode-manual-panel" style="display: flex; height: 80vh; background: #0a0e17; border-radius: 8px; overflow: hidden;">
        <!-- Liste gauche -->
        <div class="left-panel" style="width: 400px; border-right: 1px solid #22304d; display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #22304d;">
            <h3 style="margin: 0 0 12px 0; color: #ecf2f8;">
              🗺️ Sondages sans géométrie
              <span id="count-badge" style="margin-left: 8px; padding: 2px 8px; background: #ff6b6b; color: #fff; border-radius: 12px; font-size: 12px;">0</span>
            </h3>
            <div id="progress-bar" style="height: 4px; background: #22304d; border-radius: 2px; overflow: hidden; margin-bottom: 12px;">
              <div id="progress-fill" style="height: 100%; background: #0bb07b; width: 0%; transition: width 0.3s;"></div>
            </div>
            <input 
              type="text" 
              id="search-input" 
              placeholder="🔍 Rechercher..." 
              style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #22304d; border-radius: 4px; color: #ecf2f8; font-size: 13px;"
            />
          </div>
          
          <div id="sondages-list" style="flex: 1; overflow-y: auto; padding: 8px;">
            <p style="color: #8aa0b5; text-align: center; padding: 20px;">Chargement...</p>
          </div>
        </div>

        <!-- Drawer droit -->
        <div class="right-panel" style="flex: 1; display: flex; flex-direction: column;">
          <div id="drawer-content" style="flex: 1; overflow-y: auto; padding: 20px;">
            <div style="text-align: center; padding: 60px 20px; color: #8aa0b5;">
              <p style="font-size: 18px;">← Sélectionnez un sondage</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.renderList(onSuccess, onError);
    });

    // Initial load
    this.renderList(onSuccess, onError);
  }

  private async renderList(onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const listDiv = document.getElementById('sondages-list');
    const countBadge = document.getElementById('count-badge');
    const progressFill = document.getElementById('progress-fill');

    if (!listDiv) return;

    try {
      await this.refresh();

      // Update stats
      if (countBadge && this.stats) {
        countBadge.textContent = String(this.stats.total_without_geom);
      }

      if (progressFill && this.stats) {
        progressFill.style.width = `${this.stats.percent_done}%`;
      }

      if (this.sondages.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: #8aa0b5;">
            <p style="font-size: 16px;">✅ Tous les sondages sont géocodés!</p>
          </div>
        `;
        return;
      }

      listDiv.innerHTML = this.sondages
        .map(
          (s) => `
        <div 
          class="sondage-item ${this.selectedSondage?.id === s.id ? 'selected' : ''}" 
          data-id="${s.id}"
          style="
            padding: 12px; 
            margin-bottom: 8px; 
            background: ${this.selectedSondage?.id === s.id ? '#1a2942' : '#0f172a'}; 
            border: 1px solid ${this.selectedSondage?.id === s.id ? '#3aa6ff' : '#22304d'}; 
            border-radius: 6px; 
            cursor: pointer;
            transition: all 0.2s;
          "
        >
          <div style="font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">${s.code}</div>
          <div style="font-size: 12px; color: #8aa0b5;">
            ${s.localite || s.adm3_name || 'Sans localité'}
          </div>
          ${s.location_mode ? `
            <span style="display: inline-block; margin-top: 4px; padding: 2px 6px; background: #22304d; color: #8aa0b5; border-radius: 4px; font-size: 10px;">
              ${s.location_mode.toUpperCase()}
            </span>
          ` : ''}
        </div>
      `
        )
        .join('');

      // Attach click listeners
      document.querySelectorAll('.sondage-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          const id = (e.currentTarget as HTMLElement).dataset.id!;
          const sondage = this.sondages.find((s) => s.id === id);
          if (sondage) {
            this.selectedSondage = sondage;
            this.renderDrawer(onSuccess, onError);
            this.renderList(onSuccess, onError); // Re-render to update selection
          }
        });
      });
    } catch (error: any) {
      listDiv.innerHTML = `
        <div style="padding: 20px; background: #3d1f1f; border-radius: 6px; color: #ff6b6b;">
          <p style="margin: 0; font-weight: 600;">❌ Erreur</p>
          <p style="margin: 8px 0 0 0; font-size: 13px;">${error.message}</p>
        </div>
      `;
    }
  }

  private renderDrawer(onSuccess: (msg: string) => void, onError: (error: string) => void) {
    const drawerContent = document.getElementById('drawer-content');
    if (!drawerContent || !this.selectedSondage) return;

    const s = this.selectedSondage;

    drawerContent.innerHTML = `
      <div style="max-width: 600px;">
        <h2 style="margin: 0 0 8px 0; color: #ecf2f8;">
          📍 Géocoder — ${s.code}
        </h2>
        <p style="margin: 0 0 24px 0; color: #8aa0b5; font-size: 14px;">
          ${s.localite || s.adm3_name || 'Sans localité'}
        </p>

        <!-- Mode selection -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; color: #ecf2f8; font-weight: 600;">Mode de géocodage</label>
          <div style="display: flex; gap: 12px;">
            <label style="flex: 1; padding: 12px; background: #0f172a; border: 2px solid #3aa6ff; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="location_mode" value="adm" checked style="cursor: pointer;" />
              <span style="color: #ecf2f8;">📍 Par commune (ADM3)</span>
            </label>
            <label style="flex: 1; padding: 12px; background: #0f172a; border: 2px solid #22304d; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="location_mode" value="exact" style="cursor: pointer;" />
              <span style="color: #ecf2f8;">🎯 Coordonnées exactes</span>
            </label>
          </div>
        </div>

        <!-- ADM3 mode -->
        <div id="adm-mode" style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; color: #ecf2f8; font-weight: 600;">
            Zone ADM3 <span style="color: #ff6b6b;">*</span>
          </label>
          <input 
            type="text" 
            id="adm3-search" 
            placeholder="🔍 Tapez pour filtrer (ex. Kamina)..." 
            style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #22304d; border-radius: 4px; color: #ecf2f8; margin-bottom: 8px;"
          />
          <select 
            id="adm3-select" 
            size="8" 
            style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #22304d; border-radius: 4px; color: #ecf2f8;"
          >
            <option value="">-- Sélectionnez une commune --</option>
            ${this.adm3List.map(adm => `<option value="${adm.gid}">${adm.name} (${adm.adm2_name || ''})</option>`).join('')}
          </select>
          <div id="adm-error" style="display: none; margin-top: 8px; padding: 8px; background: #3d1f1f; border-radius: 4px; color: #ff6b6b; font-size: 13px;"></div>
        </div>

        <!-- Exact mode -->
        <div id="exact-mode" style="display: none; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; margin-bottom: 8px; color: #ecf2f8; font-weight: 600;">
                Latitude <span style="color: #ff6b6b;">*</span>
              </label>
              <input 
                type="number" 
                id="lat-input" 
                step="0.000001" 
                placeholder="ex: 6.172" 
                style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #22304d; border-radius: 4px; color: #ecf2f8;"
              />
              <div id="lat-error" style="display: none; margin-top: 4px; color: #ff6b6b; font-size: 12px;"></div>
            </div>
            <div>
              <label style="display: block; margin-bottom: 8px; color: #ecf2f8; font-weight: 600;">
                Longitude <span style="color: #ff6b6b;">*</span>
              </label>
              <input 
                type="number" 
                id="lon-input" 
                step="0.000001" 
                placeholder="ex: 1.214" 
                style="width: 100%; padding: 10px; background: #0f172a; border: 1px solid #22304d; border-radius: 4px; color: #ecf2f8;"
              />
              <div id="lon-error" style="display: none; margin-top: 4px; color: #ff6b6b; font-size: 12px;"></div>
            </div>
          </div>
          <button 
            id="swap-coords" 
            style="margin-top: 8px; padding: 6px 12px; background: #22304d; color: #8aa0b5; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
          >
            ↔ Inverser lat/lon
          </button>
        </div>

        <!-- Footer sticky -->
        <div style="position: sticky; bottom: 0; display: flex; gap: 12px; align-items: center; padding: 16px; background: rgba(10,14,23,0.95); border-top: 1px solid #22304d; margin: 0 -20px -20px -20px; backdrop-filter: blur(6px);">
          <div style="flex: 1; font-size: 12px; color: #8aa0b5;">
            Les coordonnées seront validées (bbox Togo).
          </div>
          <button 
            id="save-next-btn" 
            style="padding: 10px 16px; background: #3aa6ff; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;"
          >
            Enregistrer & suivant →
          </button>
          <button 
            id="save-btn" 
            style="padding: 10px 20px; background: #0bb07b; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;"
          >
            Enregistrer
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const modeRadios = document.querySelectorAll('input[name="location_mode"]');
    const admMode = document.getElementById('adm-mode')!;
    const exactMode = document.getElementById('exact-mode')!;
    const adm3Search = document.getElementById('adm3-search') as HTMLInputElement;
    const adm3Select = document.getElementById('adm3-select') as HTMLSelectElement;
    const latInput = document.getElementById('lat-input') as HTMLInputElement;
    const lonInput = document.getElementById('lon-input') as HTMLInputElement;
    const swapBtn = document.getElementById('swap-coords')!;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const saveNextBtn = document.getElementById('save-next-btn') as HTMLButtonElement;

    // Mode toggle
    modeRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value;
        if (mode === 'adm') {
          admMode.style.display = 'block';
          exactMode.style.display = 'none';
        } else {
          admMode.style.display = 'none';
          exactMode.style.display = 'block';
        }
        validateForm();
      });
    });

    // ADM3 search
    adm3Search.addEventListener('input', () => {
      const query = adm3Search.value.toLowerCase();
      Array.from(adm3Select.options).forEach((option, idx) => {
        if (idx === 0) return;
        const text = option.textContent?.toLowerCase() || '';
        option.style.display = text.includes(query) ? '' : 'none';
      });
    });

    // Swap coords
    swapBtn.addEventListener('click', () => {
      const temp = latInput.value;
      latInput.value = lonInput.value;
      lonInput.value = temp;
      validateForm();
    });

    // Validation
    const validateForm = () => {
      const mode = (document.querySelector('input[name="location_mode"]:checked') as HTMLInputElement).value;
      let valid = false;

      if (mode === 'adm') {
        valid = !!adm3Select.value;
        const admError = document.getElementById('adm-error')!;
        if (!valid && adm3Select.value === '') {
          admError.style.display = 'block';
          admError.textContent = 'Sélectionnez une zone ADM';
        } else {
          admError.style.display = 'none';
        }
      } else {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        const latValid = Number.isFinite(lat) && lat >= -90 && lat <= 90;
        const lonValid = Number.isFinite(lon) && lon >= -180 && lon <= 180;
        valid = latValid && lonValid;

        const latError = document.getElementById('lat-error')!;
        const lonError = document.getElementById('lon-error')!;

        if (!latValid && latInput.value) {
          latError.style.display = 'block';
          latError.textContent = 'Latitude invalide (−90 à 90)';
        } else {
          latError.style.display = 'none';
        }

        if (!lonValid && lonInput.value) {
          lonError.style.display = 'block';
          lonError.textContent = 'Longitude invalide (−180 à 180)';
        } else {
          lonError.style.display = 'none';
        }
      }

      saveBtn.disabled = !valid;
      saveNextBtn.disabled = !valid;
      saveBtn.style.opacity = valid ? '1' : '0.5';
      saveNextBtn.style.opacity = valid ? '1' : '0.5';
    };

    adm3Select.addEventListener('change', validateForm);
    latInput.addEventListener('input', validateForm);
    lonInput.addEventListener('input', validateForm);

    // Save handlers
    const handleSave = async (andNext: boolean) => {
      const mode = (document.querySelector('input[name="location_mode"]:checked') as HTMLInputElement).value as 'adm' | 'exact';

      try {
        if (mode === 'adm') {
          await updateGeometry(s.id, {
            adm3_id: adm3Select.value,
            location_mode: 'adm',
          });
        } else {
          await updateGeometry(s.id, {
            lat: parseFloat(latInput.value),
            lon: parseFloat(lonInput.value),
            location_mode: 'exact',
          });
        }

        onSuccess('✅ Coordonnées enregistrées');

        if (andNext) {
          // Select next sondage
          const currentIndex = this.sondages.findIndex((x) => x.id === s.id);
          if (currentIndex < this.sondages.length - 1) {
            this.selectedSondage = this.sondages[currentIndex + 1];
            this.renderDrawer(onSuccess, onError);
          }
        }

        await this.renderList(onSuccess, onError);
      } catch (error: any) {
        onError(`❌ ${error.message}`);
      }
    };

    saveBtn.addEventListener('click', () => handleSave(false));
    saveNextBtn.addEventListener('click', () => handleSave(true));

    validateForm();
  }
}
