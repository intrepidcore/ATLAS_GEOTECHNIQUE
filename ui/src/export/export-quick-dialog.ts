/**
 * Dialogue d'export rapide
 * Atlas Géotechnique v3.0
 */

import {
  ExportOptions,
  ExportFormat,
  ExportQuality,
  ExportZone,
  GridType,
  FrameStyle,
  ScrCode,
  DEFAULT_EXPORT_OPTIONS,
  ActiveThematic,
  ActiveAdmFilters,
  formatAdmPath,
  BBox,
  ThematicLegendData
} from './export-types';
import { ExportFrame, computeScaleText } from './export-frame';
import {
  captureLeafletMap,
  generatePdf,
  downloadBlob,
  downloadDataURL,
  generateExportFilename,
  waitForTilesLoaded,
  checkDependencies
} from './capture-utils';

// ============================================================================
// Styles CSS du dialogue
// ============================================================================

const DIALOG_STYLES = `
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.export-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 420px;
  max-height: 90vh;
  overflow-y: auto;
}

.export-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 8px 8px 0 0;
}

.export-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.export-dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 8px;
  border-radius: 4px;
}

.export-dialog-close:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.export-dialog-body {
  padding: 20px;
}

.export-section {
  margin-bottom: 20px;
}

.export-section:last-child {
  margin-bottom: 0;
}

.export-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.export-row {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.export-row:last-child {
  margin-bottom: 0;
}

.export-field {
  flex: 1;
}

.export-field label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.export-field select,
.export-field input[type="text"] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
}

.export-field select:focus,
.export-field input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.export-radio-group {
  display: flex;
  gap: 16px;
}

.export-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.export-radio input {
  margin: 0;
}

.export-radio span {
  font-size: 13px;
  color: #374151;
}

.export-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
}

.export-checkbox input {
  margin: 0;
  width: 16px;
  height: 16px;
}

.export-checkboxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.export-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 8px 8px;
}

.export-btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.export-btn-secondary {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.export-btn-secondary:hover {
  background: #f3f4f6;
}

.export-btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: white;
}

.export-btn-primary:hover {
  background: #2563eb;
}

.export-btn-primary:disabled {
  background: #93c5fd;
  border-color: #93c5fd;
  cursor: not-allowed;
}

.export-progress {
  text-align: center;
  padding: 20px;
}

.export-progress-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.export-progress-text {
  font-size: 14px;
  color: #6b7280;
}

.export-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 12px;
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 16px;
}

.export-collapsible {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.export-collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.export-collapsible-header:hover {
  background: #f3f4f6;
}

.export-collapsible-content {
  padding: 12px;
  display: none;
}

.export-collapsible.open .export-collapsible-content {
  display: block;
}

.export-collapsible-arrow {
  transition: transform 0.2s;
}

.export-collapsible.open .export-collapsible-arrow {
  transform: rotate(180deg);
}
`;

// ============================================================================
// Classe ExportQuickDialog
// ============================================================================

export interface ExportQuickDialogConfig {
  mapContainer: HTMLElement;
  getMapBounds: () => { north: number; south: number; east: number; west: number };
  getActiveThematic: () => ActiveThematic | null;
  getActiveAdmFilters: () => ActiveAdmFilters;
  /** Récupère les données de légende thématique (classes, couleurs, labels) */
  getThematicLegendData?: () => ThematicLegendData | null;
  /** Récupère la référence au gridLayer pour le masquer pendant l'export */
  getGridLayer?: () => any;
  /** Récupère la référence à la map Leaflet */
  getMap?: () => any;
  /** Récupère le bbox du polygone ADM actif (pour centrer l'export sur l'ADM) */
  getAdmBounds?: () => { north: number; south: number; east: number; west: number } | null;
}

export class ExportQuickDialog {
  private config: ExportQuickDialogConfig;
  private options: ExportOptions;
  private overlay: HTMLElement | null = null;
  private isExporting: boolean = false;
  
  constructor(config: ExportQuickDialogConfig) {
    this.config = config;
    this.options = { ...DEFAULT_EXPORT_OPTIONS };
    this.injectStyles();
  }
  
  /**
   * Injecte les styles CSS
   */
  private injectStyles(): void {
    if (document.getElementById('export-dialog-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'export-dialog-styles';
    style.textContent = DIALOG_STYLES;
    document.head.appendChild(style);
  }
  
  /**
   * Ouvre le dialogue
   */
  open(): void {
    if (this.overlay) return;
    
    // Vérifier les dépendances
    const deps = checkDependencies();
    if (!deps.html2canvas) {
      this.showDependencyError('html2canvas');
      return;
    }
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'export-dialog-overlay';
    this.overlay.innerHTML = this.renderDialog();
    
    document.body.appendChild(this.overlay);
    
    // Event listeners
    this.setupEventListeners();
    
    // Fermer sur clic extérieur
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    
    // Fermer sur ESC
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  /**
   * Ferme le dialogue
   */
  close(): void {
    if (!this.overlay) return;
    
    document.removeEventListener('keydown', this.handleKeyDown);
    this.overlay.remove();
    this.overlay = null;
  }
  
  /**
   * Gestion de la touche ESC
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !this.isExporting) {
      this.close();
    }
  };
  
  /**
   * Affiche une erreur de dépendance manquante
   */
  private showDependencyError(lib: string): void {
    const msg = lib === 'html2canvas'
      ? 'La bibliothèque html2canvas est requise pour l\'export.\n\nAjoutez dans index.html:\n<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>'
      : 'La bibliothèque jsPDF est requise pour l\'export PDF.\n\nAjoutez dans index.html:\n<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>';
    
    alert(msg);
  }
  
  /**
   * Rendu HTML du dialogue
   */
  private renderDialog(): string {
    const thematic = this.config.getActiveThematic();
    const admFilters = this.config.getActiveAdmFilters();
    const zonePath = formatAdmPath(admFilters);
    
    return `
      <div class="export-dialog">
        <div class="export-dialog-header">
          <h3>📤 Exporter la carte</h3>
          <button class="export-dialog-close" data-action="close">&times;</button>
        </div>
        
        <div class="export-dialog-body">
          <!-- Format et qualité -->
          <div class="export-section">
            <div class="export-section-title">📄 Format de sortie</div>
            <div class="export-row">
              <div class="export-field">
                <label>Format</label>
                <select id="export-format">
                  <option value="png" ${this.options.format === 'png' ? 'selected' : ''}>PNG (image)</option>
                  <option value="pdf" ${this.options.format === 'pdf' ? 'selected' : ''}>PDF (document)</option>
                </select>
              </div>
              <div class="export-field">
                <label>Qualité</label>
                <select id="export-quality">
                  <option value="web" ${this.options.quality === 'web' ? 'selected' : ''}>Standard (web, 72 dpi)</option>
                  <option value="print" ${this.options.quality === 'print' ? 'selected' : ''}>Impression (300 dpi)</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Zone -->
          <div class="export-section">
            <div class="export-section-title">🗺️ Zone à exporter</div>
            <div class="export-radio-group">
              <label class="export-radio">
                <input type="radio" name="export-zone" value="viewport" ${this.options.zone === 'viewport' ? 'checked' : ''}>
                <span>Vue actuelle</span>
              </label>
              <label class="export-radio">
                <input type="radio" name="export-zone" value="adm-filtered" ${this.options.zone === 'adm-filtered' ? 'checked' : ''}>
                <span>Zone filtrée (${zonePath})</span>
              </label>
            </div>
          </div>
          
          <!-- Éléments à inclure -->
          <div class="export-section">
            <div class="export-section-title">📋 Éléments à inclure</div>
            <div class="export-checkboxes">
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-title" ${this.options.includeTitle ? 'checked' : ''}>
                <span>Titre</span>
              </label>
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-legend" ${this.options.includeLegend ? 'checked' : ''}>
                <span>Légende</span>
              </label>
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-scale" ${this.options.includeScaleBar ? 'checked' : ''}>
                <span>Barre d'échelle</span>
              </label>
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-north" ${this.options.includeNorthArrow ? 'checked' : ''}>
                <span>Flèche du Nord</span>
              </label>
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-scr" ${this.options.includeScrInfo ? 'checked' : ''}>
                <span>Infos SCR</span>
              </label>
              <label class="export-checkbox">
                <input type="checkbox" id="export-include-stats" ${this.options.includeStats ? 'checked' : ''}>
                <span>Statistiques</span>
              </label>
            </div>
          </div>
          
          <!-- Options avancées (repliable) -->
          <div class="export-collapsible" id="export-advanced">
            <div class="export-collapsible-header">
              <span>⚙️ Options avancées</span>
              <span class="export-collapsible-arrow">▼</span>
            </div>
            <div class="export-collapsible-content">
              <!-- Grille -->
              <div class="export-row">
                <div class="export-field">
                  <label>Type de grille</label>
                  <select id="export-grid-type">
                    <option value="none" ${this.options.grid.type === 'none' ? 'selected' : ''}>Aucune</option>
                    <option value="cross" ${this.options.grid.type === 'cross' ? 'selected' : ''}>Croix</option>
                    <option value="continuous" ${this.options.grid.type === 'continuous' ? 'selected' : ''}>Continue</option>
                    <option value="labels-only" ${this.options.grid.type === 'labels-only' ? 'selected' : ''}>Labels uniquement</option>
                  </select>
                </div>
                <div class="export-field">
                  <label>SCR affiché</label>
                  <select id="export-scr">
                    <option value="EPSG:4326" ${this.options.grid.scr === 'EPSG:4326' ? 'selected' : ''}>WGS84 (degrés)</option>
                    <option value="EPSG:25231" ${this.options.grid.scr === 'EPSG:25231' ? 'selected' : ''}>UTM 31N (mètres)</option>
                  </select>
                </div>
              </div>
              
              <!-- Cadre -->
              <div class="export-row">
                <div class="export-field">
                  <label>Style du cadre</label>
                  <select id="export-frame-style">
                    <option value="none" ${this.options.frameStyle === 'none' ? 'selected' : ''}>Aucun</option>
                    <option value="simple" ${this.options.frameStyle === 'simple' ? 'selected' : ''}>Simple</option>
                    <option value="double" ${this.options.frameStyle === 'double' ? 'selected' : ''}>Double</option>
                    <option value="zebra" ${this.options.frameStyle === 'zebra' ? 'selected' : ''}>Zébré (QGIS)</option>
                  </select>
                </div>
              </div>
              
              <!-- Labels coordonnées -->
              <label class="export-checkbox" style="margin-top: 8px;">
                <input type="checkbox" id="export-show-labels" ${this.options.grid.showLabels ? 'checked' : ''}>
                <span>Afficher coordonnées autour du cadre</span>
              </label>
              
              <!-- Masquer grille de fond -->
              <label class="export-checkbox" style="margin-top: 8px;">
                <input type="checkbox" id="export-hide-grid-layer" checked>
                <span>Masquer grille de fond (mailles)</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="export-dialog-footer">
          <button class="export-btn export-btn-secondary" data-action="close">Annuler</button>
          <button class="export-btn export-btn-primary" data-action="export" id="export-btn">
            Exporter
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Configure les event listeners
   */
  private setupEventListeners(): void {
    if (!this.overlay) return;
    
    // Bouton fermer
    this.overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Bouton exporter
    const exportBtn = this.overlay.querySelector('[data-action="export"]');
    exportBtn?.addEventListener('click', () => this.doExport());
    
    // Section repliable
    const collapsible = this.overlay.querySelector('#export-advanced');
    const header = collapsible?.querySelector('.export-collapsible-header');
    header?.addEventListener('click', () => {
      collapsible?.classList.toggle('open');
    });
    
    // Mise à jour des options
    this.setupOptionListeners();
  }
  
  /**
   * Configure les listeners pour les options
   */
  private setupOptionListeners(): void {
    if (!this.overlay) return;
    
    // Format
    const formatSelect = this.overlay.querySelector('#export-format') as HTMLSelectElement;
    formatSelect?.addEventListener('change', () => {
      this.options.format = formatSelect.value as ExportFormat;
    });
    
    // Qualité
    const qualitySelect = this.overlay.querySelector('#export-quality') as HTMLSelectElement;
    qualitySelect?.addEventListener('change', () => {
      this.options.quality = qualitySelect.value as ExportQuality;
    });
    
    // Zone
    this.overlay.querySelectorAll('input[name="export-zone"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.options.zone = (e.target as HTMLInputElement).value as ExportZone;
      });
    });
    
    // Checkboxes éléments
    const checkboxMap: Record<string, keyof ExportOptions> = {
      'export-include-title': 'includeTitle',
      'export-include-legend': 'includeLegend',
      'export-include-scale': 'includeScaleBar',
      'export-include-north': 'includeNorthArrow',
      'export-include-scr': 'includeScrInfo',
      'export-include-stats': 'includeStats'
    };
    
    Object.entries(checkboxMap).forEach(([id, key]) => {
      const cb = this.overlay?.querySelector(`#${id}`) as HTMLInputElement;
      cb?.addEventListener('change', () => {
        (this.options as any)[key] = cb.checked;
      });
    });
    
    // Grid type
    const gridTypeSelect = this.overlay.querySelector('#export-grid-type') as HTMLSelectElement;
    gridTypeSelect?.addEventListener('change', () => {
      this.options.grid.type = gridTypeSelect.value as GridType;
    });
    
    // SCR
    const scrSelect = this.overlay.querySelector('#export-scr') as HTMLSelectElement;
    scrSelect?.addEventListener('change', () => {
      this.options.grid.scr = scrSelect.value as ScrCode;
    });
    
    // Frame style
    const frameSelect = this.overlay.querySelector('#export-frame-style') as HTMLSelectElement;
    frameSelect?.addEventListener('change', () => {
      this.options.frameStyle = frameSelect.value as FrameStyle;
    });
    
    // Show labels
    const showLabels = this.overlay.querySelector('#export-show-labels') as HTMLInputElement;
    showLabels?.addEventListener('change', () => {
      this.options.grid.showLabels = showLabels.checked;
    });
  }
  
  /**
   * Exécute l'export
   */
  private async doExport(): Promise<void> {
    if (this.isExporting || !this.overlay) return;
    
    this.isExporting = true;
    const dialog = this.overlay.querySelector('.export-dialog');
    if (!dialog) return;
    
    // Afficher le spinner
    const body = dialog.querySelector('.export-dialog-body');
    const footer = dialog.querySelector('.export-dialog-footer');
    if (body) {
      body.innerHTML = `
        <div class="export-progress">
          <div class="export-progress-spinner"></div>
          <div class="export-progress-text">Préparation de l'export...</div>
        </div>
      `;
    }
    if (footer) {
      (footer as HTMLElement).style.display = 'none';
    }
    
    try {
      // Mettre à jour le message
      const updateProgress = (msg: string) => {
        const text = this.overlay?.querySelector('.export-progress-text');
        if (text) text.textContent = msg;
      };
      
      // Récupérer les infos
      const thematic = this.config.getActiveThematic() || {
        name: 'Carte géotechnique',
        parameter: 'n_sondages'
      };
      const admFilters = this.config.getActiveAdmFilters();
      const map = this.config.getMap?.();
      
      // Sauvegarder la vue actuelle pour la restaurer après
      let originalBounds: any = null;
      let originalZoom: number | null = null;
      
      // Déterminer le bbox selon la zone sélectionnée
      let bounds: { north: number; south: number; east: number; west: number };
      
      if (this.options.zone === 'adm-filtered' && this.config.getAdmBounds) {
        // Zone filtrée : utiliser le bbox du polygone ADM avec marge
        const admBounds = this.config.getAdmBounds();
        if (admBounds) {
          // Marge réduite à 3% pour maximiser l'ADM sur la feuille
          const marginFactor = 0.03;
          const dx = admBounds.east - admBounds.west;
          const dy = admBounds.north - admBounds.south;
          bounds = {
            west: admBounds.west - marginFactor * dx,
            east: admBounds.east + marginFactor * dx,
            south: admBounds.south - marginFactor * dy,
            north: admBounds.north + marginFactor * dy
          };
          console.log('[Export] Zone filtrée ADM avec marge 3%:', bounds);
          
          // IMPORTANT: Zoomer la carte sur le bbox ADM AVANT la capture
          if (map) {
            originalBounds = map.getBounds();
            originalZoom = map.getZoom();
            
            updateProgress('Centrage sur la zone ADM...');
            // Créer un LatLngBounds Leaflet et zoomer dessus
            const L = (window as any).L;
            const targetBounds = L.latLngBounds(
              [bounds.south, bounds.west],
              [bounds.north, bounds.east]
            );
            map.fitBounds(targetBounds, { animate: false, padding: [0, 0] });
            
            // Attendre que la carte se mette à jour
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          // Fallback sur la vue actuelle si pas de bbox ADM
          bounds = this.config.getMapBounds();
        }
      } else {
        // Vue actuelle
        bounds = this.config.getMapBounds();
      }
      
      updateProgress('Attente du chargement des tuiles...');
      await waitForTilesLoaded(this.config.mapContainer, 3000);
      
      // Masquer la grille de fond si demandé
      const hideGridLayer = (this.overlay?.querySelector('#export-hide-grid-layer') as HTMLInputElement)?.checked ?? true;
      const gridLayer = this.config.getGridLayer?.();
      let gridWasVisible = false;
      
      if (hideGridLayer && gridLayer && map) {
        gridWasVisible = map.hasLayer(gridLayer);
        if (gridWasVisible) {
          map.removeLayer(gridLayer);
          // Attendre un peu pour que le rendu se mette à jour
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      updateProgress('Capture de la carte...');
      let mapCapture;
      try {
        mapCapture = await captureLeafletMap(
          this.config.mapContainer,
          this.options.quality
        );
      } finally {
        // Restaurer la grille de fond
        if (gridWasVisible && gridLayer && map) {
          gridLayer.addTo(map);
        }
        
        // Restaurer la vue originale si on l'avait changée
        if (originalBounds && map) {
          map.fitBounds(originalBounds, { animate: false });
        }
      }
      
      updateProgress('Génération du canevas...');
      
      const bbox: BBox = {
        minX: bounds.west,
        minY: bounds.south,
        maxX: bounds.east,
        maxY: bounds.north
      };
      
      // Créer le frame d'export
      const exportFrame = new ExportFrame(
        mapCapture.width,
        mapCapture.height,
        this.options
      );
      
      // Dessiner les éléments
      exportFrame.drawTitle(thematic, admFilters);
      await exportFrame.drawMapImage(mapCapture.canvas);
      exportFrame.drawGridAndFrame(bbox);
      // Récupérer les données de légende thématique
      const legendData = this.config.getThematicLegendData?.() || undefined;
      exportFrame.drawLegend(legendData);
      
      // Calculer l'échelle
      const centerLat = (bounds.north + bounds.south) / 2;
      const scaleText = computeScaleText(
        mapCapture.width,
        bounds.east - bounds.west,
        centerLat
      );
      exportFrame.drawCartouche(scaleText);
      
      // Générer le fichier
      const zoneName = formatAdmPath(admFilters);
      const filename = generateExportFilename(thematic.name, zoneName, this.options.format);
      
      if (this.options.format === 'png') {
        updateProgress('Génération du PNG...');
        const dataUrl = exportFrame.toDataURL('image/png');
        downloadDataURL(dataUrl, filename);
      } else {
        // Vérifier jsPDF
        const deps = checkDependencies();
        if (!deps.jsPDF) {
          throw new Error('jsPDF non disponible pour l\'export PDF');
        }
        
        updateProgress('Génération du PDF...');
        const pdfBlob = await generatePdf(exportFrame.getCanvas(), {
          orientation: 'landscape',
          format: 'a4',
          title: `Atlas Géotechnique - ${thematic.name}`,
          filename
        });
        downloadBlob(pdfBlob, filename);
      }
      
      // Succès - fermer le dialogue
      this.close();
      
      // Toast de succès
      this.showToast(`Export ${this.options.format.toUpperCase()} réussi !`, 'success');
      
    } catch (error) {
      console.error('Erreur export:', error);
      
      // Afficher l'erreur
      if (body) {
        body.innerHTML = `
          <div class="export-error">
            ❌ Erreur lors de l'export : ${(error as Error).message}
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 13px;">
            Vérifiez que les bibliothèques html2canvas et jsPDF sont chargées.
          </p>
        `;
      }
      if (footer) {
        (footer as HTMLElement).style.display = 'flex';
        const exportBtn = footer.querySelector('#export-btn');
        if (exportBtn) exportBtn.textContent = 'Réessayer';
      }
    } finally {
      this.isExporting = false;
    }
  }
  
  /**
   * Affiche un toast
   */
  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  }
}

// ============================================================================
// Export du module
// ============================================================================

export function createExportQuickDialog(config: ExportQuickDialogConfig): ExportQuickDialog {
  return new ExportQuickDialog(config);
}
