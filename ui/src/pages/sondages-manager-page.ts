/**
 * Page dédiée Gestionnaire de Sondages
 * Layout 3 colonnes : Sidebar | Contenu | Carte
 */

import L from 'leaflet';
import { GeocodeCanonPanel } from '../geocode-canon-panel';
import { SuggestionsAdmPanel } from '../suggestions-adm-panel';
import { ImportWizardV2 } from '../import-wizard-v2';
import { toast } from '../ui/toast';

type TabId = 'geocode' | 'suggestions' | 'import' | 'liste';

export class SondagesManagerPage {
  private container: HTMLElement | null = null;
  private map: L.Map | null = null;
  private adm3Layer: L.GeoJSON | null = null;
  private activeTab: TabId = 'geocode';
  private geocodePanel: GeocodeCanonPanel | null = null;
  private suggestionsPanel: SuggestionsAdmPanel | null = null;
  private importWizard: ImportWizardV2 | null = null;
  private loaded: Record<TabId, boolean> = {
    geocode: false,
    suggestions: false,
    import: false,
    liste: false,
  };

  constructor(private apiUrl: string) {}

  async render(containerId: string) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`[SONDAGES PAGE] Container #${containerId} not found`);
      return;
    }

    this.container.innerHTML = `
      <div class="sondages-page" style="display: flex; height: 100vh; background: #0a0e17; overflow: hidden;">
        <!-- SIDEBAR GAUCHE -->
        <nav class="sondages-sidebar" style="width: 280px; background: #0f172a; border-right: 1px solid #22304d; display: flex; flex-direction: column; overflow-y: auto;">
          <div style="padding: 20px; border-bottom: 1px solid #22304d;">
            <h2 style="margin: 0; color: #ecf2f8; font-size: 18px; display: flex; align-items: center; gap: 8px;">
              📋 Gestionnaire Sondages
            </h2>
          </div>
          
          <div class="sidebar-tabs" style="flex: 1; padding: 12px;">
            <div class="sidebar-tab active" data-tab="geocode" style="padding: 16px; margin-bottom: 8px; background: #1a2332; border: 1px solid #4c6ef5; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 24px; margin-bottom: 8px;">🗺️</div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">Géocodage Manuel</div>
              <div style="font-size: 11px; color: #94a3b8;">Géocoder avec ADM3 ou GPS</div>
            </div>
            
            <div class="sidebar-tab" data-tab="suggestions" style="padding: 16px; margin-bottom: 8px; background: #1a2332; border: 1px solid #22304d; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">Suggestions ADM</div>
              <div style="font-size: 11px; color: #94a3b8;">Géocodage automatique</div>
            </div>
            
            <div class="sidebar-tab" data-tab="import" style="padding: 16px; margin-bottom: 8px; background: #1a2332; border: 1px solid #22304d; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 24px; margin-bottom: 8px;">📥</div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">Import</div>
              <div style="font-size: 11px; color: #94a3b8;">Importer depuis Excel/CSV</div>
            </div>
            
            <div class="sidebar-tab" data-tab="liste" style="padding: 16px; margin-bottom: 8px; background: #1a2332; border: 1px solid #22304d; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">Liste</div>
              <div style="font-size: 11px; color: #94a3b8;">Tous les sondages</div>
            </div>
          </div>
          
          <div style="padding: 16px; border-top: 1px solid #22304d;">
            <button id="back-to-map-btn" style="width: 100%; padding: 10px; background: #22304d; color: #ecf2f8; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.2s;">
              ← Retour à la carte
            </button>
          </div>
        </nav>

        <!-- CONTENU CENTRAL -->
        <div class="sondages-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <div class="tab-pane active" data-tab="geocode" style="flex: 1; overflow: hidden;">
            <div id="geocode-content" style="height: 100%;"></div>
          </div>
          
          <div class="tab-pane" data-tab="suggestions" style="flex: 1; overflow: hidden; display: none;">
            <div id="suggestions-content" style="height: 100%;"></div>
          </div>
          
          <div class="tab-pane" data-tab="import" style="flex: 1; overflow: hidden; display: none;">
            <div id="import-content" style="height: 100%; padding: 20px; overflow-y: auto;">
              <h3 style="color: #ecf2f8; margin: 0 0 16px 0;">📥 Import de données</h3>
              <p style="color: #94a3b8; font-size: 14px;">Fonctionnalité en cours de développement...</p>
            </div>
          </div>
          
          <div class="tab-pane" data-tab="liste" style="flex: 1; overflow: hidden; display: none;">
            <div id="liste-content" style="height: 100%; padding: 20px; overflow-y: auto;">
              <h3 style="color: #ecf2f8; margin: 0 0 16px 0;">📋 Liste des sondages</h3>
              <p style="color: #94a3b8; font-size: 14px;">Fonctionnalité en cours de développement...</p>
            </div>
          </div>
        </div>

        <!-- CARTE DROITE -->
        <div class="sondages-map" style="width: 500px; background: #0f172a; border-left: 1px solid #22304d; display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #22304d;">
            <h3 style="margin: 0; color: #ecf2f8; font-size: 14px; font-weight: 600;">🗺️ Carte ADM3</h3>
          </div>
          <div id="sondages-map-container" style="flex: 1;"></div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachListeners();

    // Initialize map
    await this.initMap();

    // Load first tab
    await this.switchTab('geocode');
  }

  private attachListeners() {
    // Tab switching
    this.container?.querySelectorAll('.sidebar-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabId = (e.currentTarget as HTMLElement).dataset.tab as TabId;
        this.switchTab(tabId);
      });
    });

    // Back button
    const backBtn = this.container?.querySelector('#back-to-map-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.hash = '/';
      });
    }
  }

  private async initMap() {
    const mapContainer = this.container?.querySelector('#sondages-map-container') as HTMLElement;
    if (!mapContainer) {
      console.error('[SONDAGES PAGE] Map container not found');
      return;
    }

    // Create map
    this.map = L.map(mapContainer, { preferCanvas: true }).setView([8.6195, 0.8248], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    // Load ADM3 layer
    try {
      const response = await fetch(`${this.apiUrl}/adm3/geojson`);
      if (response.ok) {
        const geojson = await response.json();
        this.adm3Layer = L.geoJSON(geojson, {
          style: {
            color: '#4c6ef5',
            weight: 1,
            fillColor: '#1a2332',
            fillOpacity: 0.3,
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            layer.bindTooltip(`${props.name || props.adm3_fr || 'N/A'}<br>Code: ${props.code || 'N/A'}`, {
              sticky: true,
            });
          },
        }).addTo(this.map);

        console.log('[SONDAGES PAGE] ADM3 layer loaded');
      } else {
        console.warn('[SONDAGES PAGE] ADM3 layer not available');
      }
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading ADM3:', e);
    }
  }

  private async switchTab(tabId: TabId) {
    this.activeTab = tabId;

    // Update sidebar
    this.container?.querySelectorAll('.sidebar-tab').forEach((tab) => {
      const isActive = tab.getAttribute('data-tab') === tabId;
      if (isActive) {
        (tab as HTMLElement).style.border = '1px solid #4c6ef5';
        (tab as HTMLElement).style.background = '#1a2332';
      } else {
        (tab as HTMLElement).style.border = '1px solid #22304d';
        (tab as HTMLElement).style.background = '#0f172a';
      }
    });

    // Update content panes
    this.container?.querySelectorAll('.tab-pane').forEach((pane) => {
      const isActive = pane.getAttribute('data-tab') === tabId;
      (pane as HTMLElement).style.display = isActive ? 'flex' : 'none';
    });

    // Lazy load content
    if (tabId === 'geocode') await this.ensureGeocodeLoaded();
    if (tabId === 'suggestions') await this.ensureSuggestionsLoaded();
    if (tabId === 'import') await this.ensureImportLoaded();
    if (tabId === 'liste') await this.ensureListeLoaded();
  }

  private async ensureGeocodeLoaded() {
    if (this.loaded.geocode) return;

    try {
      this.geocodePanel = new GeocodeCanonPanel(this.apiUrl);
      await this.geocodePanel.refresh();
      this.geocodePanel.renderUI(
        'geocode-content',
        (msg: string) => {
          console.log('[GEOCODE]', msg);
          toast.success(msg);
        },
        (err: string) => {
          console.error('[GEOCODE]', err);
          toast.error(err);
        }
      );
      this.loaded.geocode = true;
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading geocode panel:', e);
      toast.error('Erreur chargement géocodage');
    }
  }

  private async ensureSuggestionsLoaded() {
    if (this.loaded.suggestions) return;

    try {
      this.suggestionsPanel = new SuggestionsAdmPanel(this.apiUrl);
      await this.suggestionsPanel.refresh();
      this.suggestionsPanel.renderUI(
        'suggestions-content',
        (msg: string) => {
          console.log('[SUGGESTIONS]', msg);
          toast.success(msg);
        },
        (err: string) => {
          console.error('[SUGGESTIONS]', err);
          toast.error(err);
        }
      );
      this.loaded.suggestions = true;
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading suggestions panel:', e);
      toast.error('Erreur chargement suggestions');
    }
  }

  private async ensureImportLoaded() {
    if (this.loaded.import) return;
    // TODO: Implement import wizard integration
    this.loaded.import = true;
  }

  private async ensureListeLoaded() {
    if (this.loaded.liste) return;
    // TODO: Implement liste integration
    this.loaded.liste = true;
  }

  /**
   * Public method to zoom to ADM3
   */
  zoomToAdm3(adm3Code: string) {
    if (!this.adm3Layer || !this.map) {
      console.warn('[SONDAGES PAGE] Cannot zoom: map not ready');
      return;
    }

    let found = false;
    this.adm3Layer.eachLayer((layer: any) => {
      const props = layer.feature?.properties;
      if (props?.code === adm3Code || props?.adm3_pcode === adm3Code) {
        const bounds = layer.getBounds();
        this.map!.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        
        // Highlight effect
        const originalStyle = {
          color: layer.options.color,
          weight: layer.options.weight,
        };
        
        layer.setStyle({
          color: '#FFD60A',
          weight: 3,
        });
        
        setTimeout(() => {
          layer.setStyle(originalStyle);
        }, 2000);
        
        found = true;
      }
    });

    if (!found) {
      console.warn('[SONDAGES PAGE] ADM3 not found:', adm3Code);
      toast.error(`ADM3 ${adm3Code} introuvable sur la carte`);
    }
  }

  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
