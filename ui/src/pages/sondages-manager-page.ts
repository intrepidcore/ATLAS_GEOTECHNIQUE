/**
 * Page dédiée Gestionnaire de Sondages
 * Layout 3 colonnes : Sidebar | Contenu | Carte
 */

import L from 'leaflet';
import { GeocodeCanonPanel } from '../geocode-canon-panel';
import { SuggestionsAdmPanel } from '../suggestions-adm-panel';
import { SondagesListPanel } from '../sondages-list-panel';
import { ImportWizardV2 } from '../import-wizard-v2.js';
import { toast } from '../ui/toast';
import { dedupeByDepth, computeGeocodeBadge, type SurveyDetails, type GranuloSerie } from '../types/survey-details';

// Dev mode flag for wizard testing panel
declare global {
  interface Window {
    ATLAS_DEBUG_WIZARDS?: boolean;
  }
}

type TabId = 'geocode' | 'suggestions' | 'import' | 'liste';

export class SondagesManagerPage {
  private container: HTMLElement | null = null;
  private map: L.Map | null = null;
  private adm3Layer: L.GeoJSON | null = null;
  private activeTab: TabId = 'geocode';
  private geocodePanel: GeocodeCanonPanel | null = null;
  private suggestionsPanel: SuggestionsAdmPanel | null = null;
  private listPanel: SondagesListPanel | null = null;
  private currentGeocodeTargetId: string | null = null;
  private currentView: 'list' | 'details' = 'list';
  private currentDetailId: string | null = null;
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
      <style>
        .tab-pane {
          display: none;
          flex: 1;
          overflow: hidden;
        }
        .tab-pane.active {
          display: flex;
          flex-direction: column;
        }
      </style>
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
          <div class="tab-pane active" data-tab="geocode">
            <div id="geocode-content" style="width: 100%; height: 100%;"></div>
          </div>
          
          <div class="tab-pane" data-tab="suggestions">
            <div id="suggestions-content" style="width: 100%; height: 100%;"></div>
          </div>
          
          <div class="tab-pane" data-tab="import">
            <div id="import-content" style="width: 100%; height: 100%;"></div>
          </div>
          
          <div class="tab-pane" data-tab="liste">
            <div id="liste-content" style="width: 100%; height: 100%;"></div>
          </div>
        </div>

        <!-- CARTE DROITE -->
        <div class="sondages-map" style="width: 500px; background: #0f172a; border-left: 1px solid #22304d; display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid #22304d;">
            <h3 style="margin: 0; color: #ecf2f8; font-size: 14px; font-weight: 600;">🗺️ Carte ADM3</h3>
          </div>
          <div id="sondages-map-container" style="flex: 1;"></div>
          
          <!-- Panneau dev wizards (visible seulement en mode debug) -->
          <div id="wizard-dev-panel" style="display: none; padding: 12px; border-top: 1px solid #22304d; background: #1a2332;">
            <h4 style="margin: 0 0 8px 0; color: #fbbf24; font-size: 12px;">🧪 Test Wizards (DEV)</h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <button class="wizard-test-btn" data-wizard="v2" style="padding: 6px 10px; background: #22304d; color: #ecf2f8; border: 1px solid #4c6ef5; border-radius: 4px; cursor: pointer; font-size: 11px;">
                ImportWizard v2 (canonique)
              </button>
              <button class="wizard-test-btn" data-wizard="bulk_v3" style="padding: 6px 10px; background: #22304d; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px; cursor: pointer; font-size: 11px;">
                ImportBulkWizard v3
              </button>
              <button class="wizard-test-btn" data-wizard="geo" style="padding: 6px 10px; background: #22304d; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px; cursor: pointer; font-size: 11px;">
                GeotechnicalImportWizard
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachListeners();

    // Initialize map
    await this.initMap();

    // Listen for zoom ADM3 events
    window.addEventListener('atlas:zoom-adm3', (e: any) => {
      const { code } = e.detail;
      this.zoomToAdm3(code);
    });

    // Listen for focus survey events (Chantier D)
    window.addEventListener('atlas:focus-survey', (e: any) => {
      const { coordinates, adm3_id } = e.detail;
      if (coordinates && this.map) {
        const [lng, lat] = coordinates;
        this.map.setView([lat, lng], 13);
        
        // Add temporary marker
        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          color: '#FFD60A',
          fillColor: '#FFD60A',
          fillOpacity: 0.8,
          weight: 3
        }).addTo(this.map);
        
        // Remove marker after 5 seconds
        setTimeout(() => marker.remove(), 5000);
      }
    });

    // Listen for ADM3 highlight events
    window.addEventListener('atlas:highlight-adm3', (e: any) => {
      const { adm3_id, duration = 3000 } = e.detail;
      this.highlightAdm3ById(adm3_id, duration);
    });

    // Show wizard dev panel if debug mode enabled
    if (window.ATLAS_DEBUG_WIZARDS || import.meta.env?.DEV) {
      const devPanel = this.container?.querySelector('#wizard-dev-panel') as HTMLElement;
      if (devPanel) {
        devPanel.style.display = 'block';
      }
    }

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

    // Update sidebar tabs
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

    // Update content panes - USE CLASS TOGGLE INSTEAD OF INLINE STYLES
    this.container?.querySelectorAll('.tab-pane').forEach((pane) => {
      const isActive = pane.getAttribute('data-tab') === tabId;
      if (isActive) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
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

    const container = document.getElementById('import-content');
    if (!container) return;

    try {
      // Créer un container pour le wizard embedded
      container.innerHTML = `
        <div style="width: 100%; height: 100%; background: #0a0e17; padding: 20px; overflow-y: auto;">
          <div style="max-width: 1000px; margin: 0 auto;">
            <div style="margin-bottom: 24px;">
              <h2 style="color: #ecf2f8; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">
                📥 Import de sondages géotechniques
              </h2>
              <p style="color: #94a3b8; margin: 0; font-size: 16px;">
                Importez vos données depuis Excel ou CSV avec validation automatique et géocodage
              </p>
            </div>
            <div id="import-wizard-embedded"></div>
          </div>
        </div>
      `;
      
      // Initialiser le wizard V2 directement dans le container
      const wizard = new ImportWizardV2('import-wizard-embedded', this.apiUrl);
      
      // Modifier le wizard pour qu'il s'affiche sans overlay modal
      const wizardContainer = document.getElementById('import-wizard-embedded');
      if (wizardContainer) {
        // Ouvrir le wizard et modifier son style pour l'embedded
        wizard.open();
        
        // Supprimer l'overlay modal et adapter les styles
        setTimeout(() => {
          const overlay = wizardContainer.querySelector('.wizard-overlay') as HTMLElement;
          if (overlay) {
            overlay.style.position = 'relative';
            overlay.style.background = 'transparent';
            overlay.style.display = 'block';
            overlay.style.alignItems = 'stretch';
            overlay.style.justifyContent = 'stretch';
            
            const modal = overlay.querySelector('.wizard-modal') as HTMLElement;
            if (modal) {
              modal.style.width = '100%';
              modal.style.maxWidth = 'none';
              modal.style.maxHeight = 'none';
              modal.style.margin = '0';
              modal.style.borderRadius = '8px';
            }
          }
        }, 100);
      }
      
      console.log('[SONDAGES PAGE] Import Wizard V2 embedded initialisé');
      this.loaded.import = true;
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading import wizard:', e);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ff6b6b;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <h3 style="margin: 0 0 8px 0;">Erreur de chargement</h3>
          <p style="margin: 0; color: #94a3b8;">Impossible de charger l'Import Wizard</p>
        </div>
      `;
    }
  }

  private async ensureListeLoaded() {
    if (this.loaded.liste) return;

    try {
      this.listPanel = new SondagesListPanel(this.apiUrl);
      await this.listPanel.refresh();
      
      // Set geocode request handler
      this.listPanel.setOnGeocodeRequest((surveyId: string) => {
        this.openGeocodeForSurvey(surveyId);
      });
      
      // Set details view handler
      this.listPanel.setOnDetailsRequest((surveyId: string) => {
        this.showDetailsView(surveyId);
      });
      
      // Initial render
      this.renderListeContent();
      this.loaded.liste = true;
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading list panel:', e);
      toast.error('Erreur chargement liste');
    }
  }

  /**
   * Public method to open geocoding for a specific survey
   */
  async openGeocodeForSurvey(surveyId: string) {
    console.log('[SONDAGES PAGE] Opening geocode for survey:', surveyId);
    this.currentGeocodeTargetId = surveyId;
    
    // Switch to geocode tab
    await this.switchTab('geocode');
    
    // Load the survey in the geocode panel
    if (this.geocodePanel) {
      this.geocodePanel.loadSurveyById(surveyId);
    }
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

  /**
   * Highlight ADM3 by ID with temporary effect
   */
  private highlightAdm3ById(adm3Id: number, duration: number = 3000) {
    if (!this.adm3Layer || !this.map) return;

    this.adm3Layer.eachLayer((layer: any) => {
      const props = layer.feature?.properties;
      if (props?.gid === adm3Id || props?.id === adm3Id) {
        const originalStyle = {
          color: layer.options.color || '#4c6ef5',
          weight: layer.options.weight || 1,
          fillColor: layer.options.fillColor || '#1a2332',
          fillOpacity: layer.options.fillOpacity || 0.3,
        };

        // Apply highlight style
        layer.setStyle({
          color: '#51cf66',
          weight: 3,
          fillColor: '#51cf66',
          fillOpacity: 0.3,
        });

        // Revert after duration
        setTimeout(() => {
          layer.setStyle(originalStyle);
        }, duration);
      }
    });
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

  private showDetailsView(surveyId: string) {
    this.currentView = 'details';
    this.currentDetailId = surveyId;
    this.renderListeContent();
    this.focusSurveyOnMap(surveyId);
  }

  private backToList() {
    this.currentView = 'list';
    this.currentDetailId = null;
    this.renderListeContent();
  }

  private async renderListeContent() {
    const container = document.getElementById('liste-content');
    if (!container) return;

    if (this.currentView === 'details' && this.currentDetailId) {
      // Render details view
      try {
        const response = await fetch(`${this.apiUrl}/sondages/${this.currentDetailId}/details`);
        if (!response.ok) throw new Error('Failed to fetch details');
        
        const details = await response.json();
        
        container.innerHTML = `
          <div style="padding: 20px; height: 100%; overflow-y: auto;">
            <div style="margin-bottom: 20px;">
              <button id="backToList" style="padding: 8px 16px; background: #22304d; color: #ecf2f8; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 16px;">
                ← Retour à la liste
              </button>
              <h2 style="color: #ecf2f8; margin: 0; font-size: 20px;">
                📋 Détails du sondage ${details.code || 'N/A'}
              </h2>
            </div>
            
            <div style="background: #1a2332; border: 1px solid #22304d; border-radius: 8px; padding: 20px;">
              ${this.renderDetailsContent(details)}
            </div>
          </div>
        `;
        
        // Attach back button listener
        const backBtn = document.getElementById('backToList');
        if (backBtn) {
          backBtn.addEventListener('click', () => this.backToList());
        }
        
        // Attach zoom button listener
        const zoomBtn = document.getElementById('zoomOnMapBtn');
        if (zoomBtn) {
          zoomBtn.addEventListener('click', () => {
            this.focusSurveyOnMap(this.currentDetailId!);
          });
        }
        
        // Attach granulometrie accordion listeners
        container.querySelectorAll('.granulo-header').forEach((header) => {
          header.addEventListener('click', () => {
            const idx = (header as HTMLElement).dataset.idx;
            const body = container.querySelector(`.granulo-body[data-idx="${idx}"]`) as HTMLElement;
            const chevron = header.querySelector('.granulo-chevron') as HTMLElement;
            if (body) {
              const isOpen = body.style.display !== 'none';
              body.style.display = isOpen ? 'none' : 'block';
              if (chevron) chevron.textContent = isOpen ? '▼' : '▲';
            }
          });
        });
        
      } catch (error) {
        console.error('[DETAILS] Error loading details:', error);
        container.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #ff6b6b;">
            <h3>Erreur de chargement</h3>
            <p>Impossible de charger les détails du sondage</p>
            <button id="backToList" style="padding: 8px 16px; background: #22304d; color: #ecf2f8; border: none; border-radius: 6px; cursor: pointer;">
              ← Retour à la liste
            </button>
          </div>
        `;
        
        const backBtn = document.getElementById('backToList');
        if (backBtn) {
          backBtn.addEventListener('click', () => this.backToList());
        }
      }
    } else {
      // Render list view
      if (this.listPanel) {
        this.listPanel.renderUI(
          'liste-content',
          (msg: string) => console.log('[LISTE]', msg),
          (err: string) => {
            console.error('[LISTE]', err);
            toast.error(err);
          }
        );
      }
    }
  }

  private renderDetailsContent(details: SurveyDetails): string {
    const isGeocoded = details.is_geocoded || false;
    const coords = details.coordinates || (details.geom ? { lat: details.geom.coordinates[1], lon: details.geom.coordinates[0] } : null);
    
    // Compute geocode badge (Chantier C)
    const geocodeBadge = computeGeocodeBadge(details.location_mode, details.meta?.geocoded_mode);
    const badgeClass = geocodeBadge.type === 'auto' ? 'background: #22c55e;' : 
                       geocodeBadge.type === 'manual' ? 'background: #3b82f6;' : 'background: #6b7280;';
    
    // Deduplicate essais by depth (Chantier F)
    const atterbergDeduped = details.atterberg ? dedupeByDepth(details.atterberg) : [];
    const vbsDeduped = details.vbs ? dedupeByDepth(details.vbs) : [];
    
    return `
      <div style="display: grid; gap: 24px;">
        <!-- Section 1: Localisation avec badges -->
        <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h4 style="color: #ecf2f8; margin: 0; font-size: 16px;">📍 Localisation</h4>
            <div style="display: flex; gap: 8px;">
              <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: white; ${isGeocoded ? 'background: #22c55e;' : 'background: #ef4444;'}">
                ${isGeocoded ? '✓ GÉOCODÉ' : '✗ NON GÉOCODÉ'}
              </span>
              ${isGeocoded ? `<span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: white; ${badgeClass}">
                ${geocodeBadge.label}
              </span>` : ''}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px; color: #94a3b8;">
            <div><strong style="color: #ecf2f8;">Code:</strong> ${details.code || 'N/A'}</div>
            <div><strong style="color: #ecf2f8;">Localité:</strong> ${details.localite || 'N/A'}</div>
            <div><strong style="color: #ecf2f8;">ADM3:</strong> ${details.adm3_name || 'N/A'}</div>
            ${coords ? `<div><strong style="color: #ecf2f8;">Coords (WGS84):</strong> ${coords.lat?.toFixed(6)}, ${coords.lon?.toFixed(6)}</div>` : ''}
          </div>
          ${isGeocoded && coords ? `
            <button id="zoomOnMapBtn" style="margin-top: 12px; padding: 8px 16px; background: #22304d; color: #ecf2f8; border: 1px solid #4c6ef5; border-radius: 6px; cursor: pointer; font-size: 13px;">
              🔍 Zoomer sur la carte
            </button>
          ` : ''}
        </div>
        
        <!-- Section 2: Métadonnées -->
        <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
          <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">📊 Métadonnées</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px; color: #94a3b8;">
            <div><strong style="color: #ecf2f8;">Source:</strong> ${details.source || 'N/A'}</div>
            <div><strong style="color: #ecf2f8;">Mode localisation:</strong> ${details.location_mode || 'N/A'}</div>
            <div><strong style="color: #ecf2f8;">Créé le:</strong> ${details.created_at ? new Date(details.created_at).toLocaleDateString('fr-FR') : 'N/A'}</div>
            <div><strong style="color: #ecf2f8;">Modifié le:</strong> ${details.updated_at ? new Date(details.updated_at).toLocaleDateString('fr-FR') : 'N/A'}</div>
          </div>
        </div>
        
        <!-- Section 3: Essais Atterberg (dédupliqués par profondeur) -->
        ${atterbergDeduped.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">🧪 Essais Atterberg (${atterbergDeduped.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8; border-radius: 4px 0 0 0;">Profondeur (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">WL (%)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">WP (%)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8; border-radius: 0 4px 0 0;">IP (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${atterbergDeduped.map((a, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${a.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${a.wl?.toFixed(1) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${a.wp?.toFixed(1) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${a.ip?.toFixed(1) || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 4: Essais VBS (dédupliqués par profondeur) -->
        ${vbsDeduped.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">🧪 Essais VBS (${vbsDeduped.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Profondeur (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Valeur VBS</th>
                  </tr>
                </thead>
                <tbody>
                  ${vbsDeduped.map((v, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${v.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${v.vbs?.toFixed(2) || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 5: Granulométrie (accordion par profondeur) -->
        ${details.granulometrie?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">📊 Granulométrie (${details.granulometrie.length} profondeurs)</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${details.granulometrie.map((serie: GranuloSerie, idx: number) => `
                <div class="granulo-card" style="background: #1a2332; border-radius: 6px; overflow: hidden;">
                  <div class="granulo-header" data-idx="${idx}" style="padding: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #22304d;">
                    <span style="color: #ecf2f8; font-weight: 500;">Profondeur ${serie.depth_m?.toFixed(2) || 'N/A'} m</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span style="color: #94a3b8; font-size: 12px;">${serie.method || 'Méthode non spécifiée'}</span>
                      <span style="background: #22304d; padding: 2px 8px; border-radius: 10px; font-size: 11px; color: #94a3b8;">${serie.points?.length || 0} points</span>
                      <span class="granulo-chevron" style="color: #94a3b8;">▼</span>
                    </div>
                  </div>
                  <div class="granulo-body" data-idx="${idx}" style="display: none; padding: 12px;">
                    ${serie.points?.length > 0 ? `
                      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                          <tr style="background: #22304d;">
                            <th style="padding: 8px; text-align: left; color: #ecf2f8;">Tamis (mm)</th>
                            <th style="padding: 8px; text-align: right; color: #ecf2f8;">Passant (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${serie.points.map((p, pi) => `
                            <tr style="background: ${pi % 2 === 0 ? '#0f172a' : '#1a2332'};">
                              <td style="padding: 6px 8px; color: #94a3b8;">${p.sieve_mm}</td>
                              <td style="padding: 6px 8px; text-align: right; color: #94a3b8;">${p.passing_pct?.toFixed(2)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : '<p style="color: #94a3b8; margin: 0;">Aucun point de mesure</p>'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Section 6: Échantillons -->
        ${details.echantillons?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">🧫 Échantillons (${details.echantillons.length})</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Profondeur (m)</th>
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Laboratoire</th>
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Norme</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">W (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${details.echantillons.map((e, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${e.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; color: #94a3b8;">${e.laboratory || '—'}</td>
                      <td style="padding: 10px; color: #94a3b8;">${e.norm || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${e.water_content_w?.toFixed(1) || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Message si aucun essai -->
        ${!atterbergDeduped.length && !vbsDeduped.length && !details.granulometrie?.length && !details.echantillons?.length ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 24px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
            <p style="color: #94a3b8; margin: 0;">Aucun essai géotechnique enregistré pour ce sondage</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  private async focusSurveyOnMap(surveyId: string) {
    try {
      // Fetch survey details to get coordinates and ADM3
      const response = await fetch(`${this.apiUrl}/sondages/${surveyId}/details`);
      if (!response.ok) {
        console.warn('[MAP] Failed to fetch survey details for map focus');
        return;
      }

      const details = await response.json();
      const survey = details.sondage;

      if (!survey.geom || !survey.geom.coordinates) {
        console.warn('[MAP] Survey has no coordinates for map focus');
        return;
      }

      const [lng, lat] = survey.geom.coordinates;
      
      // Emit event for map to focus on survey
      const focusEvent = new CustomEvent('atlas:focus-survey', {
        detail: {
          surveyId,
          coordinates: [lng, lat],
          adm3_id: survey.adm3_id,
          adm3_name: survey.adm3_name,
          code: survey.code
        }
      });
      
      window.dispatchEvent(focusEvent);
      console.log('[MAP] Focus event dispatched for survey:', survey.code, 'at', [lng, lat]);

      // If ADM3 available, also highlight the ADM3 polygon
      if (survey.adm3_id) {
        setTimeout(() => {
          const highlightEvent = new CustomEvent('atlas:highlight-adm3', {
            detail: {
              adm3_id: survey.adm3_id,
              adm3_name: survey.adm3_name,
              duration: 3000 // 3 seconds highlight
            }
          });
          window.dispatchEvent(highlightEvent);
        }, 500); // Small delay to let map focus first
      }

    } catch (error) {
      console.error('[MAP] Error focusing survey on map:', error);
    }
  }
}
