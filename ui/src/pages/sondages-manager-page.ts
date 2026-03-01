/**
 * Page dédiée Gestionnaire de Sondages
 * Layout 3 colonnes : Sidebar | Contenu | Carte
 */

import L from 'leaflet';
import { getGridFeatureStyle, COLORS, WEIGHT, OPACITY, ADM3_DEFAULT_STYLE, ADM3_SELECTED_STYLE, CELL_SELECTED_STYLE } from '../map-style';
import { GeocodeCanonPanel } from '../geocode-canon-panel';
import { SuggestionsAdmPanel } from '../suggestions-adm-panel';
import { SondagesListPanel } from '../sondages-list-panel';
import { ImportWizardV2 } from '../import-wizard-v2.js';
import { toast } from '../ui/toast';
import { dedupeByDepth, computeGeocodeBadge, type SurveyDetails, type GranuloSerie } from '../types/survey-details';
import { GeotechnicalFormManager } from '../geotechnical-form';

// Dev mode flag for wizard testing panel
declare global {
  interface Window {
    ATLAS_DEBUG_WIZARDS?: boolean;
  }
}

type TabId = 'nouveau' | 'geocode' | 'suggestions' | 'import' | 'liste';

export class SondagesManagerPage {
  private container: HTMLElement | null = null;
  private map: L.Map | null = null;
  private adm3Layer: L.GeoJSON | null = null;
  private maillesLayer: L.GeoJSON | null = null;
  private selectedAdm3Layer: L.GeoJSON | null = null;
  private selectedCellLayer: L.GeoJSON | null = null;
  private surveyMarker: L.CircleMarker | null = null;
  private activeTab: TabId = 'geocode';
  private geocodePanel: GeocodeCanonPanel | null = null;
  private suggestionsPanel: SuggestionsAdmPanel | null = null;
  private listPanel: SondagesListPanel | null = null;
  private nouveauFormManager: GeotechnicalFormManager | null = null;
  private currentGeocodeTargetId: string | null = null;
  private currentView: 'list' | 'details' = 'list';
  private currentDetailId: string | null = null;
  private listScrollTop: number = 0; // Preserve scroll position
  private loaded: Record<TabId, boolean> = {
    nouveau: false,
    geocode: false,
    suggestions: false,
    import: false,
    liste: false,
  };
  
  // Filtre maille depuis l'URL (workflow maille → sondages)
  private gridCodeFilter: string | null = null;

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
            <div class="sidebar-tab" data-tab="nouveau" style="padding: 16px; margin-bottom: 8px; background: #1a2332; border: 1px solid #22304d; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 24px; margin-bottom: 8px;">🧪</div>
              <div style="font-size: 14px; font-weight: 600; color: #ecf2f8; margin-bottom: 4px;">Nouveau Sondage</div>
              <div style="font-size: 11px; color: #94a3b8;">Créer un sondage géotechnique</div>
            </div>
            
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
          <div class="tab-pane" data-tab="nouveau">
            <div id="nouveau-content" style="width: 100%; height: 100%;"></div>
          </div>
          
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
      const { adm3_id, zoomToFit = true } = e.detail;
      this.highlightAdm3ById(adm3_id, zoomToFit);
    });

    // Show wizard dev panel if debug mode enabled
    if (window.ATLAS_DEBUG_WIZARDS || import.meta.env?.DEV) {
      const devPanel = this.container?.querySelector('#wizard-dev-panel') as HTMLElement;
      if (devPanel) {
        devPanel.style.display = 'block';
      }
    }

    // Lire le paramètre grid depuis l'URL (workflow maille → sondages)
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    this.gridCodeFilter = hashParams.get('grid');
    
    if (this.gridCodeFilter) {
      console.log('[SONDAGES PAGE] Filtre maille actif:', this.gridCodeFilter);
      // Si un filtre maille est actif, aller directement sur l'onglet Liste
      await this.switchTab('liste');
    } else {
      // Load first tab
      await this.switchTab('geocode');
    }
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

    // Wizard test buttons (dev mode)
    this.container?.querySelectorAll('.wizard-test-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const wizard = (e.currentTarget as HTMLElement).dataset.wizard;
        this.launchTestWizard(wizard!);
      });
    });

    // Navigation depuis la liste : créer un sondage pré-rempli depuis une maille
    window.addEventListener('navigate:create-sondage', async (e: any) => {
      try {
        const detail = e?.detail || {};
        const gridCode = detail.gridCode as string | undefined;
        const center = detail.center as { lon: number; lat: number } | null | undefined;
        if (!gridCode) return;

        await this.switchTab('nouveau');

        // Pré-remplir (après initForm)
        setTimeout(() => {
          const gtMailleCode = document.getElementById('gt-maille-code');
          const gtSelectedMaille = document.getElementById('gt-selected-maille');
          if (gtMailleCode) gtMailleCode.textContent = gridCode;
          if (gtSelectedMaille) gtSelectedMaille.style.display = 'block';

          if (center) {
            const gtLon = document.getElementById('gt-lon') as HTMLInputElement;
            const gtLat = document.getElementById('gt-lat') as HTMLInputElement;
            if (gtLon) gtLon.value = Number(center.lon).toFixed(6);
            if (gtLat) gtLat.value = Number(center.lat).toFixed(6);
          }
        }, 50);
      } catch (err) {
        console.error('[SONDAGES PAGE] navigate:create-sondage error:', err);
        toast.error('Erreur ouverture formulaire');
      }
    });
  }

  private launchTestWizard(wizard: string) {
    console.log('[SONDAGES PAGE] Launching test wizard:', wizard);
    
    try {
      // Check for global atlasWizards registry first
      const atlasWizards = (window as any).atlasWizards;
      
      switch (wizard) {
        case 'v2':
          // ImportWizard v2 (canonique)
          if (atlasWizards?.importWizardV2) {
            atlasWizards.importWizardV2();
          } else if ((window as any).ImportWizardV2?.openModal) {
            (window as any).ImportWizardV2.openModal();
          } else {
            // Try to import and use directly
            toast.info('ImportWizardV2 non disponible - utilisez l\'onglet Import');
            this.switchTab('import');
          }
          break;
          
        case 'bulk_v3':
          // ImportBulkWizard v3
          if (atlasWizards?.importBulkWizardV3) {
            atlasWizards.importBulkWizardV3();
          } else if ((window as any).ImportBulkWizard?.openModal) {
            (window as any).ImportBulkWizard.openModal();
          } else {
            toast.info('ImportBulkWizard non disponible');
          }
          break;
          
        case 'geo':
          // GeotechnicalImportWizard
          if (atlasWizards?.geotechnicalImportWizard) {
            atlasWizards.geotechnicalImportWizard();
          } else if ((window as any).GeotechnicalImportWizard?.openModal) {
            (window as any).GeotechnicalImportWizard.openModal();
          } else {
            toast.info('GeotechnicalImportWizard non disponible');
          }
          break;
          
        default:
          console.warn('[WIZARD] Unknown wizard:', wizard);
          toast.error(`Wizard "${wizard}" inconnu`);
      }
    } catch (error) {
      console.error('[WIZARD] Error launching wizard:', error);
      toast.error(`Erreur lors du lancement du wizard: ${error}`);
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
          style: ADM3_DEFAULT_STYLE,
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

    // Load mailles layer (like home page)
    await this.loadMaillesLayer();
  }

  /**
   * Load mailles layer from /coverage/mailles (same as home page)
   */
  private async loadMaillesLayer() {
    if (!this.map) return;

    try {
      const response = await fetch(`${this.apiUrl}/coverage/mailles`);
      if (!response.ok) {
        console.warn('[SONDAGES PAGE] Mailles layer not available');
        return;
      }

      const geojson = await response.json();
      
      this.maillesLayer = L.geoJSON(geojson, {
        style: (feature) => getGridFeatureStyle(feature, this.map?.getZoom()),
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const tooltip = `
            <strong>${props.code || 'N/A'}</strong><br>
            Sondages: ${props.n_sondages || 0}<br>
            ${props.adm3_name ? `ADM3: ${props.adm3_name}` : ''}
          `;
          layer.bindTooltip(tooltip, { sticky: true });
        },
      }).addTo(this.map);

      // Put mailles below ADM3 layer
      if (this.adm3Layer) {
        this.adm3Layer.bringToFront();
      }

      // Redessiner les mailles lors du zoom pour ajuster les contours (comme page d'accueil)
      this.map.on('zoomend', () => {
        if (this.maillesLayer) {
          this.maillesLayer.eachLayer((layer: any) => {
            const feature = layer.feature;
            if (feature) {
              layer.setStyle(getGridFeatureStyle(feature, this.map?.getZoom()));
            }
          });
        }
      });

      console.log('[SONDAGES PAGE] Mailles layer loaded:', geojson.features?.length, 'features');
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading mailles:', e);
    }
  }

  // Style des mailles maintenant géré par getGridFeatureStyle() dans map-style.ts

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
    if (tabId === 'nouveau') await this.ensureNouveauLoaded();
    if (tabId === 'geocode') await this.ensureGeocodeLoaded();
    if (tabId === 'suggestions') await this.ensureSuggestionsLoaded();
    if (tabId === 'import') await this.ensureImportLoaded();
    if (tabId === 'liste') await this.ensureListeLoaded();
  }
  
  private async ensureNouveauLoaded() {
    if (this.loaded.nouveau) return;
    
    const container = document.getElementById('nouveau-content');
    if (!container) return;
    
    try {
      // Utiliser le composant GeotechnicalFormManager existant
      this.nouveauFormManager = new GeotechnicalFormManager(
        this.apiUrl,
        (response: any) => {
          console.log('[SONDAGES PAGE] Survey created:', response);
          toast.success('Sondage créé avec succès');
          // Rafraîchir la liste si elle est chargée
          if (this.listPanel) {
            this.listPanel.refresh();
          }
        },
        (error: string) => {
          console.error('[SONDAGES PAGE] Error creating survey:', error);
          toast.error(error);
        }
      );
      
      // Créer un wrapper pour le formulaire avec l'ID attendu
      container.innerHTML = '<div id="nouveau-form-container" style="height: 100%; overflow-y: auto;"></div>';
      this.nouveauFormManager.initForm('nouveau-form-container');
      
      this.loaded.nouveau = true;
    } catch (e) {
      console.error('[SONDAGES PAGE] Error loading nouveau tab:', e);
      toast.error('Erreur chargement formulaire');
    }
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
      
      // Si un filtre maille est actif, le passer au panel
      if (this.gridCodeFilter) {
        this.listPanel.setGridCodeFilter(this.gridCodeFilter);
      }
      
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
   * Highlight ADM3 by ID - PERSISTENT until clearSelectionLayers() is called
   */
  private highlightAdm3ById(adm3Id: number, zoomToFit: boolean = true) {
    if (!this.adm3Layer || !this.map) return;

    // Clear previous ADM3 selection
    if (this.selectedAdm3Layer) {
      this.map.removeLayer(this.selectedAdm3Layer);
      this.selectedAdm3Layer = null;
    }

    this.adm3Layer.eachLayer((layer: any) => {
      const props = layer.feature?.properties;
      if (props?.gid === adm3Id || props?.id === adm3Id) {
        const feature = layer.feature;
        
        // Create a new layer for the highlight (persistent) - using centralized style
        this.selectedAdm3Layer = L.geoJSON(feature, {
          style: ADM3_SELECTED_STYLE,
        }).addTo(this.map!);

        // Zoom to ADM3 bounds if requested
        if (zoomToFit && layer.getBounds) {
          const bounds = layer.getBounds();
          this.map?.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
        }

        // Bring selection to front
        this.selectedAdm3Layer.bringToFront();
        
        console.log('[SONDAGES PAGE] ADM3 highlighted (persistent):', adm3Id);
      }
    });
  }

  /**
   * Highlight maille/cell by code - PERSISTENT until clearSelectionLayers() is called
   */
  private highlightCellByCode(cellCode: string) {
    if (!this.maillesLayer || !this.map) return;

    // Clear previous cell selection
    if (this.selectedCellLayer) {
      this.map.removeLayer(this.selectedCellLayer);
      this.selectedCellLayer = null;
    }

    let found = false;
    
    this.maillesLayer.eachLayer((layer: any) => {
      const props = layer.feature?.properties;
      
      if (props?.code === cellCode) {
        found = true;
        const feature = layer.feature;
        
        // Create a new layer for the highlight (persistent) - using centralized style
        this.selectedCellLayer = L.geoJSON(feature, {
          style: CELL_SELECTED_STYLE,
        }).addTo(this.map!);

        // Bring selection to front (but below ADM3 selection)
        this.selectedCellLayer.bringToFront();
        if (this.selectedAdm3Layer) {
          this.selectedAdm3Layer.bringToFront();
        }
        
        console.log('[SONDAGES PAGE] Cell highlighted (persistent):', cellCode);
      }
    });
    
    if (!found) {
      console.warn('[SONDAGES PAGE] Cell not found:', cellCode);
    }
  }

  /**
   * Highlight maille/cell by coordinates - find which cell contains the point
   */
  private highlightCellByCoordinates(lng: number, lat: number) {
    if (!this.maillesLayer || !this.map) return;

    // Clear previous cell selection
    if (this.selectedCellLayer) {
      this.map.removeLayer(this.selectedCellLayer);
      this.selectedCellLayer = null;
    }

    let found = false;
    
    this.maillesLayer.eachLayer((layer: any) => {
      if (found) return; // Stop if already found
      
      const feature = layer.feature;
      
      if (feature && feature.geometry) {
        // Use Leaflet's built-in point-in-polygon test
        const latLng = L.latLng(lat, lng);
        
        // Create a temporary layer to test if point is inside
        const tempLayer = L.geoJSON(feature);
        const bounds = tempLayer.getBounds();
        
        // Quick bounds check first
        if (bounds.contains(latLng)) {
          // More precise check: create polygon and test containment
          try {
            const polygon = L.geoJSON(feature);
            let isInside = false;
            
            polygon.eachLayer((polyLayer: any) => {
              if (polyLayer instanceof L.Polygon) {
                // Use bounds check (could be improved with proper point-in-polygon)
                const polyBounds = polyLayer.getBounds();
                if (polyBounds.contains(latLng)) {
                  isInside = true;
                }
              }
            });
            
            if (isInside) {
              found = true;
              const props = feature.properties;
              
              // Create a new layer for the highlight (persistent) - using centralized style
              this.selectedCellLayer = L.geoJSON(feature, {
                style: CELL_SELECTED_STYLE,
              }).addTo(this.map!);

              // Bring selection to front (but below ADM3 selection)
              this.selectedCellLayer.bringToFront();
              if (this.selectedAdm3Layer) {
                this.selectedAdm3Layer.bringToFront();
              }
              
              console.log('[SONDAGES PAGE] Cell highlighted by coordinates (persistent):', props?.code);
            }
          } catch (e) {
            console.warn('[SONDAGES PAGE] Error testing point in polygon:', e);
          }
        }
      }
    });
    
    if (!found) {
      console.warn('[SONDAGES PAGE] No cell found containing coordinates:', [lng, lat]);
    }
  }

  /**
   * Clear all selection layers (ADM3, cell, marker)
   */
  private clearSelectionLayers() {
    if (this.selectedAdm3Layer && this.map) {
      this.map.removeLayer(this.selectedAdm3Layer);
      this.selectedAdm3Layer = null;
    }
    if (this.selectedCellLayer && this.map) {
      this.map.removeLayer(this.selectedCellLayer);
      this.selectedCellLayer = null;
    }
    if (this.surveyMarker && this.map) {
      this.map.removeLayer(this.surveyMarker);
      this.surveyMarker = null;
    }
    console.log('[SONDAGES PAGE] Selection layers cleared');
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
    // Save scroll position before switching to details
    const listEl = document.querySelector('#list-sondages-list') as HTMLElement;
    if (listEl) {
      this.listScrollTop = listEl.scrollTop;
    }
    
    this.currentView = 'details';
    this.currentDetailId = surveyId;
    this.renderListeContent();
    this.focusSurveyOnMap(surveyId);
  }

  private backToList() {
    this.currentView = 'list';
    this.currentDetailId = null;
    
    // Clear selection layers when going back to list
    this.clearSelectionLayers();
    
    this.renderListeContent();
    
    // Restore scroll position after rendering
    requestAnimationFrame(() => {
      const listEl = document.querySelector('#list-sondages-list') as HTMLElement;
      if (listEl && this.listScrollTop > 0) {
        listEl.scrollTop = this.listScrollTop;
      }
    });
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
        
        <!-- Section 5: Classification des sols -->
        ${details.classif?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">🏷️ Classification des sols (${details.classif.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Prof. (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">HRB</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Unified</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Chassagneux</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Type Sol</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">CG</th>
                  </tr>
                </thead>
                <tbody>
                  ${details.classif.map((c, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${c.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${c.hrb || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${c.unified || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${c.class_chassagneux || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${c.type_sol || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${c.cg?.toFixed(1) || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 6: Potentiel de gonflement -->
        ${details.gonflement?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">📈 Potentiel de gonflement (${details.gonflement.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Prof. (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">CG</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Qualification</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Type Sol</th>
                  </tr>
                </thead>
                <tbody>
                  ${details.gonflement.map((g, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${g.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${g.cg?.toFixed(2) || '—'}</td>
                      <td style="padding: 10px; text-align: center;">
                        <span style="background: ${g.cg_qual === 'Faible' ? '#22c55e22' : g.cg_qual === 'Moyen' ? '#f59e0b22' : g.cg_qual === 'Fort' ? '#ef444422' : '#6b728022'}; 
                                     color: ${g.cg_qual === 'Faible' ? '#22c55e' : g.cg_qual === 'Moyen' ? '#f59e0b' : g.cg_qual === 'Fort' ? '#ef4444' : '#6b7280'}; 
                                     padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                          ${g.cg_qual || '—'}
                        </span>
                      </td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${g.type_sol || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 7: Essais physiques -->
        ${details.physiques?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">⚖️ Essais physiques (${details.physiques.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Prof. (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">ρ app. (g/cm³)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">ρ abs. (g/cm³)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">w (%)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">ρs</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Labo</th>
                  </tr>
                </thead>
                <tbody>
                  ${details.physiques.map((p, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${p.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${p.densite_apparente_gcm3?.toFixed(2) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${p.densite_absolue_gcm3?.toFixed(2) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${p.teneur_eau_pct?.toFixed(1) || p.w?.toFixed(1) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${p.rho_s?.toFixed(2) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">${p.laboratory || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 8: Essais Proctor -->
        ${details.proctor?.length > 0 ? `
          <div style="background: #0f172a; border-radius: 8px; padding: 16px;">
            <h4 style="color: #ecf2f8; margin: 0 0 12px 0; font-size: 16px;">🔨 Essais Proctor (${details.proctor.length} profondeurs)</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #22304d;">
                    <th style="padding: 10px; text-align: left; color: #ecf2f8;">Prof. (m)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">ρd max (g/cm³)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">w opt (%)</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Labo</th>
                    <th style="padding: 10px; text-align: center; color: #ecf2f8;">Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${details.proctor.map((pr, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#1a2332' : '#0f172a'};">
                      <td style="padding: 10px; color: #ecf2f8; font-weight: 500;">${pr.depth_m?.toFixed(2) || 'N/A'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${pr.rho_d_max?.toFixed(2) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8;">${pr.w_opt?.toFixed(1) || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">${pr.laboratory || '—'}</td>
                      <td style="padding: 10px; text-align: center; color: #94a3b8; font-size: 11px;">${pr.test_date || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- Section 9: Granulométrie (accordion par profondeur) -->
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
        ${!atterbergDeduped.length && !vbsDeduped.length && !details.classif?.length && !details.gonflement?.length && !details.physiques?.length && !details.proctor?.length && !details.granulometrie?.length && !details.echantillons?.length ? `
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
      // Fetch survey details to get coordinates, ADM3, and grid_code
      const response = await fetch(`${this.apiUrl}/sondages/${surveyId}/details`);
      if (!response.ok) {
        console.warn('[MAP] Failed to fetch survey details for map focus');
        return;
      }

      const survey = await response.json();

      // Try coordinates first (simpler format), then geom
      let lng: number | undefined, lat: number | undefined;
      
      if (survey.coordinates && survey.coordinates.lat && survey.coordinates.lon) {
        lng = survey.coordinates.lon;
        lat = survey.coordinates.lat;
      } else if (survey.geom && survey.geom.coordinates) {
        [lng, lat] = survey.geom.coordinates;
      }

      // Log survey data for debugging
      console.log('[SONDAGES PAGE] Survey data:', {
        grid_code: survey.grid_code,
        adm3_id: survey.adm3_id,
        hasCoordinates: lng !== undefined && lat !== undefined
      });

      // 1. Highlight ADM3 (persistent, with zoom)
      if (survey.adm3_id) {
        this.highlightAdm3ById(survey.adm3_id, true);
      }

      // 2. Highlight maille/cell (persistent) - try multiple field names
      const cellCode = survey.grid_code || survey.cell_id || survey.maille_code;
      if (cellCode) {
        // Wait a bit if mailles layer is not loaded yet
        if (!this.maillesLayer) {
          setTimeout(() => {
            if (this.maillesLayer) {
              this.highlightCellByCode(cellCode);
            }
          }, 1000);
        } else {
          this.highlightCellByCode(cellCode);
        }
      } else {
        // Fallback: find cell by coordinates
        if (lng !== undefined && lat !== undefined) {
          console.log('[SONDAGES PAGE] No grid_code, finding cell by coordinates:', [lng, lat]);
          
          if (!this.maillesLayer) {
            setTimeout(() => {
              if (this.maillesLayer) {
                this.highlightCellByCoordinates(lng, lat);
              }
            }, 1000);
          } else {
            this.highlightCellByCoordinates(lng, lat);
          }
        } else {
          console.warn('[SONDAGES PAGE] No grid_code or coordinates available for cell lookup');
        }
      }

      // 3. Add survey marker (persistent)
      if (lng !== undefined && lat !== undefined && this.map) {
        // Remove previous marker
        if (this.surveyMarker) {
          this.map.removeLayer(this.surveyMarker);
        }
        
        // Add new marker
        this.surveyMarker = L.circleMarker([lat, lng], {
          radius: 10,
          color: '#FFD60A',
          fillColor: '#FFD60A',
          fillOpacity: 0.9,
          weight: 3
        }).addTo(this.map);
        
        // Bind tooltip with survey code
        this.surveyMarker.bindTooltip(`📍 ${survey.code || 'Sondage'}`, {
          permanent: false,
          direction: 'top'
        });
        
        // Bring marker to front
        this.surveyMarker.bringToFront();
        
        console.log('[MAP] Survey marker added at', [lat, lng], 'for', survey.code);
      }

      console.log('[MAP] Focus complete for survey:', survey.code, {
        adm3_id: survey.adm3_id,
        grid_code: survey.grid_code,
        coordinates: lng && lat ? [lng, lat] : 'none'
      });

    } catch (error) {
      console.error('[MAP] Error focusing survey on map:', error);
    }
  }
}
