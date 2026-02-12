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
  ThematicLegendData,
  QUALITY_SETTINGS
} from './export-types';
import { ExportFrame, computeScaleText, getA4Layout } from './export-frame';
import { BoundsOptimizer, type ADMGeometry, type BoundsRect } from './bounds-optimizer';
import {
  captureLeafletMap,
  generatePdf,
  downloadBlob,
  downloadDataURL,
  generateExportFilename,
  waitForTilesLoaded,
  waitForFrames,
  validateCapture,
  checkDependencies,
  generateZipWithMetadata,
  ExportMetadata
} from './capture-utils';
import { buildExportStats, ExportStats } from './export-stats';
import { createExportTelemetry, ExportTelemetry } from './export-telemetry';
import { API_BASE_URL } from '../services/api';

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
// Helper Auth pour les appels API export
// ============================================================================

/**
 * Récupère le token d'authentification depuis localStorage/sessionStorage
 * Cherche dans plusieurs clés possibles, y compris les objets JSON
 * Ordre de priorité:
 * 1. atlas_token (clé principale unifiée)
 * 2. atlas_auth.accessToken (AuthContext)
 * 3. atlas_access_token (legacy)
 * 4. access_token, token (fallback)
 */
function getAuthToken(): { key: string; token: string } | null {
  // Clés simples (valeur = token directement)
  const simpleKeys = ['atlas_token', 'atlas_access_token', 'access_token', 'token'];
  
  for (const k of simpleKeys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v && v.length > 10 && !v.startsWith('{')) {
      return { key: k, token: v };
    }
  }
  
  // Clés JSON (valeur = objet avec accessToken)
  const jsonKeys = ['atlas_auth'];
  for (const k of jsonKeys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) {
      try {
        const parsed = JSON.parse(v);
        const token = parsed.accessToken || parsed.access_token || parsed.token;
        if (token && token.length > 10) {
          return { key: `${k}.accessToken`, token };
        }
      } catch {}
    }
  }
  
  return null;
}

/**
 * Crée les options fetch avec authentification
 * Inclut le header Authorization et credentials
 */
function withAuth(init: RequestInit = {}): RequestInit {
  const t = getAuthToken();
  const headers = new Headers(init.headers || {});
  
  if (t) {
    headers.set('Authorization', `Bearer ${t.token}`);
  }
  
  console.log('[Export][AUTH]', {
    found: !!t,
    key: t?.key || 'none',
    tokenLen: t?.token.length || 0,
    tokenPrefix: t?.token.slice(0, 8) || 'N/A'
  });
  
  // NOTE: Ne PAS utiliser credentials:'include' avec Bearer token
  // car ça déclenche un CORS strict (wildcard '*' interdit avec credentials)
  return { 
    ...init, 
    headers
  };
}

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
  /** Récupère les coordonnées du polygone ADM pour le masque */
  getAdmPolygon?: () => number[][] | null;
  /** Récupère la géométrie GeoJSON complète de l'ADM pour calcul clearance */
  getAdmGeometry?: () => ADMGeometry | null;
  /** 
   * Récupère les features thématiques actuellement affichées à l'écran
   * C'est la SOURCE DE VÉRITÉ pour l'export (mêmes valeurs que l'écran)
   */
  getThematicFeatures?: () => Array<{ properties: { code?: string; value?: number; grid_id?: string }; geometry: any }> | null;
}

// Cache global des mailles ADM (partagé entre exports)
const admCellsCache = new Map<string, Array<{ geometry: any; has_data: boolean }>>();

export class ExportQuickDialog {
  private config: ExportQuickDialogConfig;
  private options: ExportOptions;
  private overlay: HTMLElement | null = null;
  private isExporting: boolean = false;
  private neighborsAuthWarningShown: boolean = false; // ÉTAPE 2: Flag pour log unique 401
  
  constructor(config: ExportQuickDialogConfig) {
    this.config = config;
    this.options = { ...DEFAULT_EXPORT_OPTIONS };
    this.injectStyles();
  }
  
  /**
   * Génère une clé de cache pour les mailles ADM
   */
  private static getAdmCacheKey(admFilters: ActiveAdmFilters): string {
    const parts: string[] = [];
    if (admFilters.adm1) parts.push(`adm1:${admFilters.adm1.name}`);
    if (admFilters.adm2) parts.push(`adm2:${admFilters.adm2.name}`);
    if (admFilters.adm3) parts.push(`adm3:${admFilters.adm3.name}`);
    return parts.join('|') || 'all';
  }
  
  /**
   * Vide le cache des mailles ADM
   */
  static clearCache(): void {
    admCellsCache.clear();
    console.log('[Export] Cache mailles ADM vidé');
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
  
  // ============================================================================
  // API PUBLIQUE POUR EXPORT PROGRAMMATIQUE (utilisé par Export Complet)
  // ============================================================================
  
  /**
   * Interface pour les options d'export programmatique
   */
  public static readonly SingleExportOptionsDefaults = {
    quality: 'hd' as ExportQuality,
    maskMode: 'context' as 'none' | 'context' | 'focus' | 'clip',
    showEmptyCells: true,
    onlyAdmCells: true,
    includeStats: true,
    includeLegend: true,
    includeNeighbors: true,
    boundaryLevel: 'none' as 'none' | 'adm1' | 'adm2'
  };
  
  /**
   * Exporte une carte unique de manière programmatique (sans UI)
   * Utilisé par Export Complet pour générer chaque carte du batch
   * 
   * @param options Options d'export
   * @returns Blob PNG de la carte exportée, ou null en cas d'erreur
   */
  async exportSingle(options: {
    quality?: ExportQuality;
    maskMode?: 'none' | 'context' | 'focus' | 'clip';
    showEmptyCells?: boolean;
    onlyAdmCells?: boolean;
    includeStats?: boolean;
    includeLegend?: boolean;
    includeNeighbors?: boolean;
    boundaryLevel?: 'none' | 'adm1' | 'adm2';
    gridType?: GridType;
    frameStyle?: FrameStyle;
    onProgress?: (message: string) => void;
  } = {}): Promise<Blob | null> {
    // Fusionner avec les options par défaut
    const opts = { ...ExportQuickDialog.SingleExportOptionsDefaults, ...options };
    const onProgress = opts.onProgress || (() => {});
    
    // Configurer les options internes (v3.5.3: grille et cadre)
    this.options = {
      ...this.options,
      quality: opts.quality,
      zone: 'adm-filtered',
      showEmptyCells: opts.showEmptyCells,
      onlyAdmCells: opts.onlyAdmCells,
      maskMode: opts.maskMode,
      includeStats: opts.includeStats,
      includeLegend: opts.includeLegend,
      grid: {
        ...this.options.grid,
        type: opts.gridType || this.options.grid.type
      },
      frameStyle: opts.frameStyle || this.options.frameStyle
    };
    
    try {
      // 1. Récupérer les infos thématiques et ADM
      const map = this.config.getMap?.();
      
      if (!map) {
        console.error('[ExportSingle] Map non disponible');
        return null;
      }

      const thematic = this.config.getActiveThematic() || {
        name: 'Carte géotechnique',
        parameter: 'n_sondages'
      };
      const admFilters = this.config.getActiveAdmFilters();

      // 2. Construire le nom ADM pour les logs (v3.5.2)
      const admFiltersResolved = admFilters || {};
      const admNameRaw = admFiltersResolved.adm3 || admFiltersResolved.adm2 || admFiltersResolved.adm1;
      // v4.5.1: Conversion de type plus sûre pour admName
      const admName: string = (admNameRaw && typeof admNameRaw === 'object' && 'name' in admNameRaw) 
        ? (admNameRaw as any).name 
        : (typeof admNameRaw === 'string' ? admNameRaw : 'National');

      // v4.5.1: Forcer le style discret pour l'export choroplèthe
      const thematicAny = thematic as any;
      if (thematicAny.style) {
        thematicAny.style.stroke_width = 0.1;
        thematicAny.style.stroke_color = '#F0F0F0';
      }
      console.log(`[Composer][${admName}] Export thematic style (FORCED v4.5.1): stroke_width=0.1, stroke_color=#F0F0F0`);
      
      // 3. Sauvegarder la vue actuelle pour la restaurer après
      let originalBounds: any = null;
      let originalContainerStyle: { width: string; height: string } | null = null;
      
      // 4. Calculer le bbox optimal pour l'ADM
      const admBounds = this.config.getAdmBounds?.();
      // v4.5.1: Initialiser avec des valeurs par défaut pour éviter null
      let bounds: { north: number; south: number; east: number; west: number } = this.config.getMapBounds();
      let restoreMapInteractions: (() => void) | null = null;
      let restoreFractionalZoom: (() => void) | null = null;
      
      if (admBounds) {
        // v4.5.1: Utiliser les bounds optimisées
        bounds = await this.computeOptimalBoundsForSheet(admBounds, opts.quality, admName);
        console.log(`[Composer][${admName}] Using optimized bounds from BoundsOptimizer:`, bounds);
        
        // Calculer l'AR cible de la zone carte A4
        const dpi = QUALITY_SETTINGS[opts.quality].dpi;
        const a4Layout = getA4Layout(dpi, 'portrait');
        const targetMapAreaAR = a4Layout.targetAspectRatio;
        
        // PHASE 2 FIX: Forcer taille container AVANT fitBounds
        const container = this.config.mapContainer;
        if (container && map) {
          originalBounds = map.getBounds();
          originalContainerStyle = {
            width: container.style.width,
            height: container.style.height
          };
          
          // Log taille AVANT
          console.log(`[PHASE2][${admName}] Container AVANT: ${container.clientWidth}x${container.clientHeight}px`);
          console.log(`[PHASE2][${admName}] Map size AVANT: ${map.getSize().x}x${map.getSize().y}px`);
          console.log(`[PHASE2][${admName}] Map zoom AVANT: ${map.getZoom()}`);
          
          // Forcer dimensions entières
          const containerWidth = Math.round(container.clientWidth);
          const newContainerHeight = Math.round(containerWidth / targetMapAreaAR);
          
          container.style.width = `${containerWidth}px`;
          container.style.height = `${newContainerHeight}px`;
          container.style.transition = 'none';
          
          // invalidateSize + attendre 2 frames
          map.invalidateSize({ animate: false });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          
          // Log taille APRÈS
          console.log(`[PHASE2][${admName}] Container APRÈS: ${container.clientWidth}x${container.clientHeight}px`);
          console.log(`[PHASE2][${admName}] Map size APRÈS: ${map.getSize().x}x${map.getSize().y}px`);
        }
        
        // Zoomer sur le bbox ADM
        onProgress('Centrage sur la zone ADM...');
        const L = (window as any).L;
        const targetBounds = L.latLngBounds(
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        );
        
        // PHASE 2 FIX: fitBounds avec maxZoom élevé + logs
        console.log(`[PHASE2][${admName}] fitBounds: [${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)}] → [${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}]`);

        restoreMapInteractions = this.disableMapInteractionsForExport(map);
        restoreFractionalZoom = this.enableFractionalZoomForExport(map);
        
        map.fitBounds(targetBounds, { 
          animate: false, 
          padding: [0, 0], 
          maxZoom: 18,
          duration: 0
        });

        const effective1 = await this.waitForStableBounds(map, {
          admName,
          timeoutMs: 10000,
          stableSamples: 6,
          sampleIntervalMs: 120
        });

        const requestedWidth = Math.abs(bounds.east - bounds.west);
        const requestedHeight = Math.abs(bounds.north - bounds.south);
        const effectiveWidth1 = Math.abs(effective1.east - effective1.west);
        const effectiveHeight1 = Math.abs(effective1.north - effective1.south);

        const isAberrant = (
          (requestedWidth > 0 && effectiveWidth1 > requestedWidth * 2.5) ||
          (requestedHeight > 0 && effectiveHeight1 > requestedHeight * 2.5) ||
          effectiveWidth1 > 6 ||
          effectiveHeight1 > 6
        );

        if (isAberrant) {
          console.warn(`[PHASE2][${admName}] Bounds effectifs aberrants détectés, re-fitBounds...`, {
            requested: bounds,
            effective: effective1,
            requestedWidth,
            requestedHeight,
            effectiveWidth: effectiveWidth1,
            effectiveHeight: effectiveHeight1
          });

          map.fitBounds(targetBounds, {
            animate: false,
            padding: [0, 0],
            maxZoom: 18,
            duration: 0
          });

          bounds = await this.waitForStableBounds(map, {
            admName,
            timeoutMs: 10000,
            stableSamples: 6,
            sampleIntervalMs: 120
          });
        } else {
          bounds = effective1;
        }
        
        // PHASE 3 FIX: Pan bias pour Maritime (réduire vide océan)
        await this.applyPanBiasIfNeeded(map, bounds, admBounds, admName);

        bounds = await this.waitForStableBounds(map, {
          admName,
          timeoutMs: 7000,
          stableSamples: 4,
          sampleIntervalMs: 120
        });
        
        // v4.5.1: On NE réinitialise PLUS bounds avec effectiveBounds.
        // On veut garder les bounds optimisées calculées par BoundsOptimizer
        // pour que la projection sur le canvas soit exacte.
        console.log(`[Composer][${admName}] Effective bounds preserved:`, bounds);
      } else {
        bounds = this.config.getMapBounds();
      }
      
      // PHASE 2 FIX: Attendre tiles avec logs
      onProgress('Chargement des tuiles...');
      const tilesStart = performance.now();
      const tilesReady = await waitForTilesLoaded(this.config.mapContainer, 5000);
      const tilesDuration = performance.now() - tilesStart;
      console.log(`[TILES][${admName}] ${tilesReady ? '✅ Loaded' : '⚠️ Timeout'} après ${tilesDuration.toFixed(0)}ms`);
      
      await waitForFrames(2);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Masquer tous les panes non-tuiles avant capture
      onProgress('Capture du fond de carte...');
      const hiddenPanes: Record<string, string> = {};
      const panes = map.getPanes();
      const panesToHide = ['overlayPane', 'markerPane', 'tooltipPane', 'popupPane', 'shadowPane', 'thematicPane', 'thematicCirclesPane', 'gridPane'];
      
      for (const paneName of panesToHide) {
        const pane = panes[paneName];
        if (pane?.style) {
          hiddenPanes[paneName] = pane.style.display;
          pane.style.display = 'none';
        }
      }
      await new Promise(resolve => setTimeout(resolve, 80));
      
      // Capturer le fond de carte
      let mapCapture: Awaited<ReturnType<typeof captureLeafletMap>> | null = null;
      try {
        mapCapture = await captureLeafletMap(this.config.mapContainer, opts.quality);
        
        // Valider la capture
        const validation = validateCapture(mapCapture.canvas);
        if (!validation.valid) {
          console.warn('[ExportSingle] Capture potentiellement invalide, retry...');
          await waitForTilesLoaded(this.config.mapContainer, 2000);
          await waitForFrames(3);
          mapCapture = await captureLeafletMap(this.config.mapContainer, opts.quality);
        }
      } finally {
        if (restoreFractionalZoom) {
          restoreFractionalZoom();
          restoreFractionalZoom = null;
        }

        if (restoreMapInteractions) {
          restoreMapInteractions();
          restoreMapInteractions = null;
        }

        // Restaurer les panes
        for (const [paneName, originalDisplay] of Object.entries(hiddenPanes)) {
          const pane = panes[paneName];
          if (pane?.style) pane.style.display = originalDisplay;
        }
        
        // Restaurer le container
        if (originalContainerStyle && this.config.mapContainer) {
          this.config.mapContainer.style.width = originalContainerStyle.width;
          this.config.mapContainer.style.height = originalContainerStyle.height;
          map.invalidateSize({ animate: false });
        }
        
        // Restaurer la vue
        if (originalBounds) {
          map.fitBounds(originalBounds, { animate: false });
        }
      }
      
      if (!mapCapture) {
        console.error('[ExportSingle] Échec de la capture');
        return null;
      }
      
      // Créer le frame d'export A4
      onProgress('Génération du canevas...');
      const bbox: BBox = { minX: bounds.west, minY: bounds.south, maxX: bounds.east, maxY: bounds.north };
      const exportFrame = ExportFrame.createA4(this.options, 'portrait');
      
      // Dessiner les éléments
      exportFrame.drawTitle(thematic, admFilters);
      await exportFrame.drawMapImage(mapCapture.canvas);
      
      // Charger et dessiner les mailles
      let admCells: Array<{ geometry: any; has_data: boolean; value?: number; n_sondages?: number }> = [];
      let cellsWithData = 0;
      let cellsWithoutData = 0;
      let classUsageCount: Map<number, number> | undefined;
      const legendData = this.config.getThematicLegendData?.() || undefined;
      
      if (admFilters) {
        onProgress('Chargement des mailles...');
        try {
          admCells = await this.fetchAdmCells(admFilters, thematic.parameter);
          cellsWithData = admCells.filter(c => c.has_data).length;
          cellsWithoutData = admCells.filter(c => !c.has_data).length;
          
          // Dessiner les mailles vides
          if (opts.showEmptyCells && admCells.length > 0) {
            exportFrame.drawEmptyCells(admCells, bbox);
          }
          
          // Dessiner les mailles colorées
          if (legendData?.classes && cellsWithData > 0) {
            classUsageCount = exportFrame.drawColoredCells(admCells, bbox, legendData.classes);
          }
        } catch (e) {
          console.warn('[ExportSingle] Erreur chargement mailles:', e);
        }
      }
      
      // Dessiner le masque ADM
      const admPolygon = this.config.getAdmPolygon?.();
      if (admPolygon && admPolygon.length >= 3) {
        if (opts.maskMode !== 'none') {
          exportFrame.drawAdmMask(admPolygon, bbox, opts.maskMode);
        } else {
          exportFrame.drawAdmBoundary(admPolygon, bbox, '#3366cc', 2.5);
        }
      }
      
      // Dessiner la grille et le cadre
      exportFrame.drawGridAndFrame(bbox);
      
      // Re-dessiner la bordure si masque=none
      if (admPolygon && admPolygon.length >= 3 && opts.maskMode === 'none') {
        exportFrame.drawAdmBoundary(admPolygon, bbox, '#3366cc', 2.5);
      }
      
      // Dessiner les voisins
      if (opts.includeNeighbors && admFilters) {
        try {
          const neighbors = await this.fetchAdmNeighbors(admFilters);
          if (neighbors.length > 0) {
            exportFrame.drawNeighborLabels(neighbors, bbox, admPolygon);
          }
        } catch (e) {
          console.warn('[ExportSingle] Erreur voisins:', e);
        }
      }
      
      // Dessiner la légende
      const hasAdmBoundary = opts.maskMode !== 'none' && !!admPolygon && admPolygon.length >= 3;
      const emptyCellsDrawn = opts.showEmptyCells && cellsWithoutData > 0;
      exportFrame.drawLegend(legendData, emptyCellsDrawn, hasAdmBoundary, classUsageCount);
      
      // Dessiner les statistiques
      if (opts.includeStats && legendData) {
        onProgress('Calcul des statistiques...');
        const cellValues = admCells
          .filter(c => c.has_data && c.value != null)
          .map(c => c.value as number)
          .filter(v => typeof v === 'number' && Number.isFinite(v));
        
        const localStats = admCells.length > 0 ? {
          count: cellsWithData,
          null_count: cellsWithoutData,
          count_total: admCells.length,
          sum: cellValues.reduce((acc, v) => acc + v, 0),
          mean: cellValues.length > 0 ? cellValues.reduce((acc, v) => acc + v, 0) / cellValues.length : 0
        } : undefined;
        
        const featuresForStats = cellValues.map(v => ({ value: v }));
        const statsData = buildExportStats({
          parameterId: legendData.parameterId || thematic.parameter,
          parameterLabel: legendData.parameterLabel || thematic.name,
          unit: legendData.unit || '',
          features: featuresForStats,
          totalCellCount: admCells.length || legendData.totalCellCount || 0,
          classes: legendData.classes || [],
          admFilters: admFilters || {},
          apiStats: localStats || legendData.apiStats
        });
        
        exportFrame.drawStats(statsData);
      }
      
      // Dessiner le cartouche avec l'échelle
      const centerLat = (bounds.north + bounds.south) / 2;
      const scaleText = computeScaleText(mapCapture.width, bounds.east - bounds.west, centerLat);
      exportFrame.drawCartouche(scaleText);
      
      // Générer le blob PNG avec métadonnées DPI correctes (v3.4.4)
      onProgress('Encodage PNG...');
      const dpi = QUALITY_SETTINGS[opts.quality].dpi;
      const blob = await exportFrame.toBlobWithDpi(dpi);
      
      console.log(`[ExportSingle] ✅ Export réussi: ${(blob.size / 1024 / 1024).toFixed(2)} Mo (${dpi} DPI)`);
      return blob;
      
    } catch (error) {
      console.error('[ExportSingle] Erreur:', error);
      return null;
    }
  }
  
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
                  <option value="web" ${this.options.quality === 'web' ? 'selected' : ''}>Web (72 DPI)</option>
                  <option value="standard" ${this.options.quality === 'standard' ? 'selected' : ''}>Standard (150 DPI)</option>
                  <option value="print" ${this.options.quality === 'print' ? 'selected' : ''}>HD (300 DPI)</option>
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
              
              <!-- Afficher mailles sans données -->
              <label class="export-checkbox" style="margin-top: 8px;">
                <input type="checkbox" id="export-show-empty-cells">
                <span>Afficher mailles sans données</span>
              </label>
              
              <!-- Uniquement mailles dans l'ADM -->
              <label class="export-checkbox" style="margin-top: 8px;">
                <input type="checkbox" id="export-only-adm-cells" checked>
                <span>Uniquement mailles dans l'ADM</span>
              </label>
              
              <!-- Afficher ADM/pays limitrophes -->
              <label class="export-checkbox" style="margin-top: 8px;">
                <input type="checkbox" id="export-show-neighbors" checked>
                <span>Afficher ADM/pays limitrophes</span>
              </label>
              
              <!-- Masque hors ADM -->
              <div class="export-field" style="margin-top: 12px;">
                <label>Masque hors ADM</label>
                <select id="export-mask-mode">
                  <option value="none">Aucun</option>
                  <option value="context" selected>Contexte léger (45%)</option>
                  <option value="focus">Focus fort (85%)</option>
                  <option value="clip">Découpage strict (100%)</option>
                </select>
              </div>
              
              <!-- Export avec métadonnées -->
              <label class="export-checkbox" style="margin-top: 12px;">
                <input type="checkbox" id="export-include-metadata">
                <span>Inclure métadonnées (ZIP avec logs)</span>
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
    
    // ========== TÉLÉMÉTRIE: Créer une nouvelle instance pour cet export ==========
    const telemetry = createExportTelemetry();
    telemetry.startConsoleCapture(); // Capturer les console.log [Export]
    telemetry.startStage('UI');
    
    // ========== SAUVEGARDER TOUTES LES OPTIONS AVANT DE MODIFIER LE DOM ==========
    // C'est CRITIQUE car body.innerHTML va détruire les éléments du formulaire
    const savedOptions = {
      hideGridLayer: (this.overlay.querySelector('#export-hide-grid-layer') as HTMLInputElement)?.checked ?? true,
      showEmptyCells: (this.overlay.querySelector('#export-show-empty-cells') as HTMLInputElement)?.checked ?? false,
      onlyAdmCells: (this.overlay.querySelector('#export-only-adm-cells') as HTMLInputElement)?.checked ?? true,
      showNeighbors: (this.overlay.querySelector('#export-show-neighbors') as HTMLInputElement)?.checked ?? true,
      maskMode: ((this.overlay.querySelector('#export-mask-mode') as HTMLSelectElement)?.value || 'context') as 'none' | 'context' | 'focus' | 'clip',
      includeMetadata: (this.overlay.querySelector('#export-include-metadata') as HTMLInputElement)?.checked ?? false
    };
    
    // Enregistrer les options dans la télémétrie
    const dpi = QUALITY_SETTINGS[this.options.quality].dpi;
    telemetry.setOptions({
      format: this.options.format,
      quality: this.options.quality,
      zone: this.options.zone,
      dpi,
      maskMode: savedOptions.maskMode,
      showEmptyCells: savedOptions.showEmptyCells,
      onlyAdmCells: savedOptions.onlyAdmCells,
      showNeighbors: savedOptions.showNeighbors,
      includeStats: this.options.includeStats,
      includeLegend: this.options.includeLegend
    });
    
    console.log('[Export] Options sauvegardées AVANT modification DOM:', savedOptions);
    console.log('[Export] includeMetadata sauvegardé:', savedOptions.includeMetadata);
    
    // IMPORTANT: Mettre à jour this.options avec les valeurs du DOM pour que fetchAdmCells les utilise
    this.options = {
      ...this.options,
      showEmptyCells: savedOptions.showEmptyCells,
      onlyAdmCells: savedOptions.onlyAdmCells,
      maskMode: savedOptions.maskMode
    };
    
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
      
      // Enregistrer thématique et filtres ADM
      telemetry.setThematic({
        id: thematic.parameter,
        name: thematic.name,
        unit: thematic.unit
      });
      telemetry.setAdmFilters({
        adm1: admFilters.adm1?.name,
        adm2: admFilters.adm2?.name,
        adm3: admFilters.adm3?.name
      });
      telemetry.endStage();
      
      // Sauvegarder la vue actuelle pour la restaurer après
      let originalBounds: any = null;
      let originalZoom: number | null = null;
      
      // Déterminer le bbox selon la zone sélectionnée
      let bounds: { north: number; south: number; east: number; west: number };
      
      // Calculer l'AR cible de la zone carte A4 (SOURCE DE VÉRITÉ UNIQUE)
      const dpi = QUALITY_SETTINGS[this.options.quality].dpi;
      const a4Layout = getA4Layout(dpi, 'portrait');
      const targetMapAreaAR = a4Layout.targetAspectRatio;
      console.log('[Export] AR cible zone carte A4 (getA4Layout):', targetMapAreaAR.toFixed(4));
      
      // Sauvegarder la taille originale du container pour restauration
      let originalContainerStyle: { width: string; height: string } | null = null;
      
      if (this.options.zone === 'adm-filtered' && this.config.getAdmBounds) {
        // Zone filtrée : utiliser le bbox du polygone ADM optimisé pour la feuille
        const admBounds = this.config.getAdmBounds();
        if (admBounds) {
          // Construire le nom ADM pour les logs (v3.5.2)
          const admFilters = this.config.getActiveAdmFilters?.();
          const admNameRaw = admFilters?.adm3 || admFilters?.adm2 || admFilters?.adm1;
          const admName: string = (typeof admNameRaw === 'object' && admNameRaw !== null ? (admNameRaw as any).name : (admNameRaw as unknown as string)) || 'National';
          
          // Calculer l'emprise "pro serrée" adaptée au ratio de la zone carte
          bounds = await this.computeOptimalBoundsForSheet(admBounds, this.options.quality, admName);
          console.log('[Export] Zone filtrée ADM optimisée pour feuille:', bounds);
          
          // IMPORTANT: Zoomer la carte sur le bbox ADM AVANT la capture
          if (map) {
            originalBounds = map.getBounds();
            originalZoom = map.getZoom();
            
            updateProgress('Centrage sur la zone ADM...');
            telemetry.startStage('FIT');
            
            // ========== ÉTAPE 4: Normaliser le viewport Leaflet ==========
            // Redimensionner temporairement le container pour matcher l'AR cible
            const container = this.config.mapContainer;
            if (container) {
              originalContainerStyle = {
                width: container.style.width,
                height: container.style.height
              };
              
              // Calculer les nouvelles dimensions du container
              // On garde la largeur et on ajuste la hauteur pour avoir le bon AR
              const containerWidth = container.clientWidth;
              const newContainerHeight = Math.round(containerWidth / targetMapAreaAR);
              
              console.log('[Export] Resize container pour AR cible:', {
                originalW: containerWidth,
                originalH: container.clientHeight,
                originalAR: (containerWidth / container.clientHeight).toFixed(3),
                newH: newContainerHeight,
                targetAR: targetMapAreaAR.toFixed(3)
              });
              
              container.style.height = `${newContainerHeight}px`;
              map.invalidateSize({ animate: false });
              
              // Attendre le resize
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Créer un LatLngBounds Leaflet et zoomer dessus
            const L = (window as any).L;
            const targetBounds = L.latLngBounds(
              [bounds.south, bounds.west],
              [bounds.north, bounds.east]
            );
            
            // ========== FIT BOUNDS ROBUSTE ==========
            // IMPORTANT: maxZoom:18 pour éviter le clamp par un zoom restrictif
            const z0 = map.getZoom();
            map.fitBounds(targetBounds, { 
              animate: false, 
              padding: [0, 0],
              maxZoom: 18  // CRITIQUE: pas de restriction de zoom
            });
            
            // Attendre BOTH moveend ET zoomend (pas juste moveend)
            const waitForEvent = (ev: string) => new Promise<void>(resolve => {
              const handler = () => {
                map.off(ev, handler);
                resolve();
              };
              map.on(ev, handler);
              // Timeout de sécurité
              setTimeout(() => {
                map.off(ev, handler);
                resolve();
              }, 2000);
            });
            
            await Promise.all([
              waitForEvent('moveend'),
              waitForEvent('zoomend')
            ]);
            
            // Attendre 2 frames pour que le navigateur peigne
            await waitForFrames(2);
            
            // Log les dimensions finales du container
            const z1 = map.getZoom();
            if (container) {
              console.log('[Export] Container après resize:', {
                w: container.clientWidth,
                h: container.clientHeight,
                ar: (container.clientWidth / container.clientHeight).toFixed(3)
              });
            }
            
            // ========== ALIGNEMENT FOND/OVERLAYS ==========
            // Récupérer les VRAIS bounds du viewport Leaflet après fitBounds
            // C'est la SOURCE DE VÉRITÉ pour la projection (pas le bbox ADM demandé)
            const effectiveBounds = map.getBounds();
            bounds = {
              north: effectiveBounds.getNorth(),
              south: effectiveBounds.getSouth(),
              east: effectiveBounds.getEast(),
              west: effectiveBounds.getWest()
            };
            
            telemetry.endStage(); // FIT
            telemetry.log('FIT', {
              z0,
              z1,
              requested: { 
                north: targetBounds.getNorth().toFixed(4), 
                south: targetBounds.getSouth().toFixed(4), 
                east: targetBounds.getEast().toFixed(4), 
                west: targetBounds.getWest().toFixed(4) 
              },
              effective: {
                north: bounds.north.toFixed(4),
                south: bounds.south.toFixed(4),
                east: bounds.east.toFixed(4),
                west: bounds.west.toFixed(4)
              }
            });
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
      telemetry.startStage('TILES_WAIT');
      const tileResult = await waitForTilesLoaded(this.config.mapContainer, 5000);
      telemetry.endStage(); // TILES_WAIT
      telemetry.log('TILES_WAIT', { 
        tiles: tileResult,
        message: tileResult.timedOut ? 'Timeout tuiles' : 'Tuiles stables'
      });
      
      // Attendre 2 frames d'animation pour laisser le navigateur peindre
      await waitForFrames(2);
      
      // Attendre le rendu complet des layers thématiques (Canvas/SVG)
      // Optimisé: 300ms au lieu de 500ms (suffisant pour la plupart des cas)
      updateProgress('Attente du rendu thématique...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      telemetry.startStage('CAPTURE');
      
      // Masquer la grille de fond si demandé (utiliser savedOptions)
      const gridLayer = this.config.getGridLayer?.();
      let gridWasVisible = false;
      
      if (savedOptions.hideGridLayer && gridLayer && map) {
        gridWasVisible = map.hasLayer(gridLayer);
        if (gridWasVisible) {
          map.removeLayer(gridLayer);
          // Attendre un peu pour que le rendu se mette à jour
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      updateProgress('Capture de la carte...');
      
      // ========== CAPTURE FOND UNIQUEMENT: Cacher TOUS les panes non-fond ==========
      // On ne capture QUE les tuiles (tilePane). Tout le reste sera redessiné par l'export.
      // Cela évite: double limite, mailles "temps réel" vs "export", incohérences visuelles.
      const hiddenPanes: Record<string, string> = {};
      
      if (map) {
        const panes = map.getPanes();
        
        // Log tous les panes disponibles pour debug
        console.log('[Export] Panes Leaflet disponibles:', Object.keys(panes));
        
        // Liste des panes à cacher (tout sauf tilePane et mapPane)
        const panesToHide = [
          'overlayPane',      // GeoJSON, polygones ADM
          'markerPane',       // Markers
          'tooltipPane',      // Tooltips
          'popupPane',        // Popups
          'shadowPane',       // Ombres des markers
          'thematicPane',     // Couche thématique custom
          'thematicCirclesPane', // Cercles thématiques
          'gridPane',         // Grille de fond
        ];
        
        for (const paneName of panesToHide) {
          const pane = panes[paneName];
          if (pane && pane.style) {
            hiddenPanes[paneName] = pane.style.display;
            pane.style.display = 'none';
          }
        }
        
        telemetry.log('CAPTURE', { 
          hiddenPanes: Object.keys(hiddenPanes),
          message: 'All non-tile panes hidden - capturing background only'
        });
        
        // Attendre le re-rendu (optimisé: 80ms au lieu de 150ms)
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      
      telemetry.logAdmOverlayState(false, Object.keys(hiddenPanes).length > 0);
      
      let mapCapture: Awaited<ReturnType<typeof captureLeafletMap>> | null = null;
      let captureAttempt = 0;
      const MAX_CAPTURE_ATTEMPTS = 2;
      
      try {
        // Boucle de retry pour captures noires/invalides
        while (captureAttempt < MAX_CAPTURE_ATTEMPTS) {
          captureAttempt++;
          
          mapCapture = await captureLeafletMap(
            this.config.mapContainer,
            this.options.quality
          );
          
          // Valider que la capture n'est pas noire
          const validation = validateCapture(mapCapture.canvas);
          telemetry.log('CAPTURE', { 
            attempt: captureAttempt,
            validation,
            dimensions: { w: mapCapture.canvas.width, h: mapCapture.canvas.height }
          });
          
          if (validation.valid) {
            break; // Capture OK
          }
          
          if (captureAttempt < MAX_CAPTURE_ATTEMPTS) {
            console.warn(`[Export] Capture invalide (attempt ${captureAttempt}), retry après attente tuiles...`);
            telemetry.warn(`Capture invalide (blackRatio=${validation.blackRatio.toFixed(2)}), retry #${captureAttempt + 1}`);
            
            // Attendre avant retry (optimisé: 300ms au lieu de 500ms)
            await waitForTilesLoaded(this.config.mapContainer, 2000);
            await waitForFrames(3);
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            telemetry.warn(`Capture potentiellement invalide après ${MAX_CAPTURE_ATTEMPTS} tentatives`);
          }
        }
        
        if (!mapCapture) {
          throw new Error('Échec de la capture après plusieurs tentatives');
        }
        
        // Log dimensions de capture
        telemetry.setCaptureDimensions(mapCapture.canvas.width, mapCapture.canvas.height);
      } finally {
        // Restaurer TOUS les panes cachés
        if (map && Object.keys(hiddenPanes).length > 0) {
          const panes = map.getPanes();
          for (const [paneName, originalDisplay] of Object.entries(hiddenPanes)) {
            const pane = panes[paneName];
            if (pane && pane.style) {
              pane.style.display = originalDisplay;
            }
          }
          telemetry.log('CAPTURE', { restoredPanes: Object.keys(hiddenPanes) });
        }
        
        // Restaurer la grille de fond
        if (gridWasVisible && gridLayer && map) {
          gridLayer.addTo(map);
        }
        
        // Restaurer la taille originale du container si on l'avait changée
        if (originalContainerStyle && this.config.mapContainer && map) {
          this.config.mapContainer.style.width = originalContainerStyle.width;
          this.config.mapContainer.style.height = originalContainerStyle.height;
          map.invalidateSize({ animate: false });
          console.log('[Export] Container restauré à sa taille originale');
        }
        
        // Restaurer la vue originale si on l'avait changée
        if (originalBounds && map) {
          map.fitBounds(originalBounds, { animate: false });
        }
      }
      
      telemetry.endStage({ captureSuccess: true });
      telemetry.startStage('LAYOUT');
      
      updateProgress('Génération du canevas...');
      
      const bbox: BBox = {
        minX: bounds.west,
        minY: bounds.south,
        maxX: bounds.east,
        maxY: bounds.north
      };
      telemetry.setBbox(bbox);
      
      // Créer le frame d'export avec dimensions A4 FIXES
      // La carte sera redimensionnée pour s'adapter à la zone carte du layout A4
      const exportFrame = ExportFrame.createA4(this.options, 'portrait');
      const layout = exportFrame.getLayout();
      
      // Log dimensions canvas et zone carte
      telemetry.setCanvasDimensions(
        layout.totalWidth,
        layout.totalHeight,
        layout.mapArea.width,
        layout.mapArea.height
      );
      
      // Log drawImage params pour debug aspect ratio
      telemetry.logDrawImage(
        mapCapture.canvas.width,
        mapCapture.canvas.height,
        layout.mapArea.width,
        layout.mapArea.height,
        layout.mapArea.x,
        layout.mapArea.y
      );
      
      telemetry.endStage();
      telemetry.startStage('DRAW');
      
      console.log('[Export] Frame A4 créé, capture:', {
        captureWidth: mapCapture.width,
        captureHeight: mapCapture.height
      });
      
      // Dessiner les éléments
      exportFrame.drawTitle(thematic, admFilters);
      await exportFrame.drawMapImage(mapCapture.canvas);
      
      // Dessiner les mailles vides AVANT le masque (utiliser savedOptions)
      let emptyCellsDrawn = false;
      let cellsWithData = 0;
      let cellsWithoutData = 0;
      let admCells: Array<{ geometry: any; has_data: boolean; value?: number; n_sondages?: number }> = [];
      
      // Variable pour stocker le comptage des classes (pour filtrer la légende)
      let classUsageCount: Map<number, number> | undefined;
      
      // TOUJOURS charger les mailles ADM si zone filtrée (pour stats locales)
      if (this.options.zone === 'adm-filtered' && admFilters) {
        telemetry.startStage('FETCH');
        try {
          admCells = await this.fetchAdmCells(admFilters, thematic.parameter);
          cellsWithData = admCells.filter(c => c.has_data).length;
          cellsWithoutData = admCells.filter(c => !c.has_data).length;
          
          telemetry.setCellCounts(admCells.length, cellsWithData, cellsWithoutData);
          telemetry.endStage();
          
          console.log('[Export] Mailles ADM récupérées:', admCells.length, 'withData:', cellsWithData, 'withoutData:', cellsWithoutData);
          
          // Dessiner les mailles vides si option activée
          if (savedOptions.showEmptyCells && admCells.length > 0) {
            telemetry.startStage('GRID');
            exportFrame.drawEmptyCells(admCells, bbox);
            emptyCellsDrawn = cellsWithoutData > 0;
            telemetry.endStage({ emptyCellsDrawn, count: cellsWithoutData });
          }
          
          // NOUVEAU: Dessiner les mailles colorées côté export (source unique)
          // On ne capture plus les mailles depuis Leaflet, on les dessine nous-mêmes
          // IMPORTANT: Capturer le classUsageCount pour filtrer la légende
          const legendDataForCells = this.config.getThematicLegendData?.();
          if (legendDataForCells?.classes && admCells.length > 0 && cellsWithData > 0) {
            telemetry.startStage('DRAW_CELLS');
            classUsageCount = exportFrame.drawColoredCells(admCells, bbox, legendDataForCells.classes);
            telemetry.endStage({ 
              coloredCellsDrawn: cellsWithData,
              classUsage: classUsageCount ? Object.fromEntries(classUsageCount) : {}
            });
          }
        } catch (e: any) {
          telemetry.endStage();
          telemetry.error('Impossible de charger les mailles ADM', e as Error);
          console.warn('[Export] Impossible de charger les mailles ADM:', e);
        }
      }
      
      // Dessiner le masque hors ADM si demandé (utiliser savedOptions.maskMode)
      const admPolygon = this.config.getAdmPolygon?.();
      console.log('[Export] Masque ADM - mode:', savedOptions.maskMode, 'polygon:', admPolygon?.length || 0, 'points');
      
      if (this.options.zone === 'adm-filtered' && admPolygon && admPolygon.length >= 3) {
        telemetry.startStage('MASK');
        if (savedOptions.maskMode !== 'none') {
          // Dessiner le masque avec la bordure incluse
          console.log('[Export] Dessin masque ADM mode:', savedOptions.maskMode);
          exportFrame.drawAdmMask(admPolygon, bbox, savedOptions.maskMode);
          telemetry.endStage({ maskApplied: true, polygonPoints: admPolygon.length });
        } else {
          // Masque "aucun" mais on dessine quand même la bordure ADM
          console.log('[Export] Masque=none, dessin bordure ADM uniquement');
          exportFrame.drawAdmBoundary(admPolygon, bbox, '#3366cc', 2.5);
          telemetry.endStage({ maskApplied: false, boundaryDrawn: true, polygonPoints: admPolygon.length });
        }
      } else if (this.options.zone === 'adm-filtered') {
        telemetry.startStage('MASK');
        telemetry.warn('Pas de polygone ADM valide pour le masque/bordure');
        console.warn('[Export] Pas de polygone ADM valide pour le masque/bordure, zone:', this.options.zone, 'polygon:', admPolygon);
        telemetry.endStage({ maskApplied: false });
      }
      
      exportFrame.drawGridAndFrame(bbox);
      
      // Re-dessiner la bordure ADM après la grille si masque=none (pour qu'elle soit visible au-dessus)
      if (this.options.zone === 'adm-filtered' && admPolygon && admPolygon.length >= 3 && savedOptions.maskMode === 'none') {
        console.log('[Export] Re-dessin bordure ADM après grille (masque=none)');
        exportFrame.drawAdmBoundary(admPolygon, bbox, '#3366cc', 2.5);
      }
      
      // Dessiner les labels des ADM limitrophes si zone filtrée et option activée (utiliser savedOptions)
      if (savedOptions.showNeighbors && this.options.zone === 'adm-filtered' && admFilters) {
        telemetry.startStage('NEIGHBORS');
        try {
          const neighbors = await this.fetchAdmNeighbors(admFilters);
          const admPolygonForLabels = this.config.getAdmPolygon?.();
          telemetry.setNeighborCounts(neighbors.length, neighbors.length);
          if (neighbors && neighbors.length > 0) {
            exportFrame.drawNeighborLabels(neighbors, bbox, admPolygonForLabels);
          }
          telemetry.endStage();
        } catch (e) {
          telemetry.error('Impossible de charger les ADM limitrophes', e as Error);
          console.warn('[Export] Impossible de charger les ADM limitrophes:', e);
          telemetry.endStage({ error: true });
        }
      }
      
      // Récupérer les données de légende thématique
      telemetry.startStage('LEGEND');
      const legendData = this.config.getThematicLegendData?.() || undefined;
      const hasAdmBoundary = savedOptions.maskMode !== 'none' && !!admPolygon && admPolygon.length >= 3;
      
      if (legendData?.classes) {
        // Compter les classes visibles selon classUsageCount (si disponible) ou count
        const visibleClasses = classUsageCount 
          ? legendData.classes.filter((_, idx) => (classUsageCount?.get(idx) ?? 0) > 0)
          : legendData.classes.filter(c => c.count === undefined || c.count > 0);
        telemetry.setLegendClasses(legendData.classes.length, visibleClasses.length);
        console.log('[Export] Légende: classes totales:', legendData.classes.length, 'visibles:', visibleClasses.length);
      }
      // IMPORTANT: Passer classUsageCount pour filtrer la légende par classes réellement utilisées
      exportFrame.drawLegend(legendData, emptyCellsDrawn, hasAdmBoundary, classUsageCount);
      telemetry.endStage();
      
      // Calculer et dessiner les statistiques si demandé
      // IMPORTANT: Utiliser admCells (données locales ADM) pour les stats, pas legendData.features (global)
      if (this.options.includeStats && legendData) {
        telemetry.startStage('STATS');
        
        // Extraire les valeurs des mailles avec données pour calculs avancés (médiane, σ, Q1/Q3)
        // IMPORTANT: Utiliser c.value en priorité (valeur thématique), pas n_sondages
        const cellValues = admCells
          .filter(c => c.has_data && c.value != null)
          .map(c => c.value as number)
          .filter(v => typeof v === 'number' && Number.isFinite(v));
        
        console.log('[Export][STATS] Valeurs extraites pour stats:', {
          totalCells: admCells.length,
          withData: admCells.filter(c => c.has_data).length,
          withValue: cellValues.length,
          sampleValues: cellValues.slice(0, 10),
          min: cellValues.length > 0 ? Math.min(...cellValues) : null,
          max: cellValues.length > 0 ? Math.max(...cellValues) : null
        });
        
        // Calculer les stats depuis les mailles ADM locales (source de vérité)
        const localStats = admCells.length > 0 ? {
          count: cellsWithData,
          null_count: cellsWithoutData,
          count_total: admCells.length,
          sum: cellValues.reduce((acc, v) => acc + v, 0),
          mean: cellValues.length > 0 
            ? cellValues.reduce((acc, v) => acc + v, 0) / cellValues.length 
            : 0
        } : undefined;
        
        console.log('[Export] Stats locales calculées depuis admCells:', {
          ...localStats,
          valuesCount: cellValues.length,
          sampleValues: cellValues.slice(0, 10)
        });
        
        // Créer des features simulées pour les calculs avancés (médiane, σ, Q1/Q3)
        const featuresForStats = cellValues.map(v => ({ value: v }));
        
        const statsData = buildExportStats({
          parameterId: legendData.parameterId || thematic.parameter,
          parameterLabel: legendData.parameterLabel || thematic.name,
          unit: legendData.unit || '',
          features: featuresForStats, // Passer les valeurs pour calculs avancés
          totalCellCount: admCells.length || legendData.totalCellCount || 0,
          classes: legendData.classes || [],
          admFilters: admFilters || {},
          // Priorité aux stats locales ADM, sinon fallback sur apiStats
          apiStats: localStats || legendData.apiStats
        });
        
        // Log les stats calculées pour debug
        telemetry.setComputedStats({
          title: statsData.title,
          subtitle: statsData.subtitle,
          rowCount: statsData.rows.length,
          rows: statsData.rows.map(r => ({ label: r.label, value: r.value, unit: r.unit }))
        });
        
        // Log les strings finales pour debug "stats vides"
        telemetry.log('STATS', {
          drawStatsInputKeys: Object.keys(statsData),
          drawStatsStrings: statsData.rows.reduce((acc, r) => {
            acc[r.label] = r.unit ? `${r.value} ${r.unit}` : r.value;
            return acc;
          }, {} as Record<string, string>)
        });
        
        exportFrame.drawStats(statsData);
        telemetry.endStage();
      }
      
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
      
      // Utiliser l'option métadonnées sauvegardée AVANT modification du DOM
      const includeMetadata = savedOptions.includeMetadata;
      console.log('[Export] Option includeMetadata:', includeMetadata);
      
      telemetry.startStage('SAVE');
      
      // Préparer les métadonnées si demandé
      let metadata: ExportMetadata | undefined;
      if (includeMetadata) {
        metadata = {
          version: '3.0',
          exportDate: new Date().toISOString(),
          runId: telemetry.getRunId(),
          thematic: {
            parameter: thematic.parameter,
            name: thematic.name
          },
          zone: {
            type: this.options.zone,
            adm1: admFilters?.adm1?.name,
            adm2: admFilters?.adm2?.name,
            adm3: admFilters?.adm3?.name,
            bounds
          },
          output: {
            format: this.options.format,
            quality: this.options.quality,
            dpi,
            dimensions: { width: layout.totalWidth, height: layout.totalHeight }
          },
          cells: admCells.length > 0 ? {
            total: admCells.length,
            withData: cellsWithData,
            withoutData: cellsWithoutData
          } : undefined,
          legend: legendData?.classes ? {
            classes: legendData.classes.map((c, idx) => ({
              label: c.label,
              color: c.color,
              count: classUsageCount?.get(idx)
            }))
          } : undefined,
          telemetry: telemetry.getStages(),
          debugLogs: telemetry.getDebugLogs(),
          consoleLogs: telemetry.getConsoleLogs()
        };
      }
      
      if (this.options.format === 'png') {
        updateProgress('Génération du PNG...');
        
        if (includeMetadata && metadata) {
          // Export ZIP avec métadonnées
          updateProgress('Encodage PNG...');
          telemetry.startStage('ENCODE');
          const canvas = exportFrame.getCanvas();
          const imageBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Échec conversion canvas')), 'image/png');
          });
          telemetry.endStage(); // ENCODE
          telemetry.log('ENCODE', { sizeBytes: imageBlob.size, sizeKB: Math.round(imageBlob.size / 1024) });
          
          updateProgress('Création du ZIP...');
          telemetry.startStage('ZIP');
          const zipBlob = await generateZipWithMetadata(imageBlob, filename, metadata);
          telemetry.endStage(); // ZIP
          telemetry.log('ZIP', { sizeBytes: zipBlob.size, sizeKB: Math.round(zipBlob.size / 1024) });
          
          const zipFilename = filename.replace('.png', '.zip');
          
          telemetry.startStage('SAVE');
          telemetry.log('SAVE', {
            format: 'zip',
            filename: zipFilename,
            outputPx: { w: layout.totalWidth, h: layout.totalHeight },
            dpi,
            includesMetadata: true
          });
          
          downloadBlob(zipBlob, zipFilename);
          telemetry.endStage(); // SAVE
        } else {
          // Export PNG simple
          telemetry.startStage('ENCODE');
          const dataUrl = exportFrame.toDataURL('image/png');
          telemetry.endStage(); // ENCODE
          
          telemetry.startStage('SAVE');
          telemetry.log('SAVE', {
            format: 'png',
            filename,
            outputPx: { w: layout.totalWidth, h: layout.totalHeight },
            dpi
          });
          
          downloadDataURL(dataUrl, filename);
          telemetry.endStage(); // SAVE
        }
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
        
        if (includeMetadata && metadata) {
          // Export ZIP avec PDF + métadonnées
          updateProgress('Création du ZIP avec métadonnées...');
          const zipBlob = await generateZipWithMetadata(pdfBlob, filename, metadata);
          const zipFilename = filename.replace('.pdf', '.zip');
          downloadBlob(zipBlob, zipFilename);
        } else {
          downloadBlob(pdfBlob, filename);
        }
      }
      
      // Finaliser la télémétrie
      const exportMeta = telemetry.finalize();
      
      // Afficher le runId dans la console pour référence
      console.log(`[Export] ✅ Export terminé - RunId: ${telemetry.getRunId()}`);
      
      // Succès - fermer le dialogue
      this.close();
      
      // Toast de succès avec RunId
      this.showToast(`Export ${this.options.format.toUpperCase()} réussi ! (${telemetry.getRunId()})`, 'success');
      
    } catch (error) {
      telemetry.error('Export failed', error as Error);
      telemetry.finalize();
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
      telemetry.stopConsoleCapture(); // Arrêter la capture des console.log
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
  
  /**
   * Récupère les ADM limitrophes (solution statique + API fallback)
   * Ajoute automatiquement les pays voisins selon la position géographique
   */
  private async fetchAdmNeighbors(
    admFilters: ActiveAdmFilters
  ): Promise<Array<{ label: string; direction: string; lon: number; lat: number }>> {
    const neighbors: Array<{ label: string; direction: string; lon: number; lat: number }> = [];
    
    // Récupérer le bbox de l'ADM pour déterminer les voisins externes
    const admBounds = this.config.getAdmBounds?.();
    if (!admBounds) return neighbors;
    
    const { north, south, east, west } = admBounds;
    const centerLon = (east + west) / 2;
    const centerLat = (north + south) / 2;
    
    // Frontières du Togo (approximatives)
    const TOGO_BOUNDS = {
      north: 11.14,  // Frontière Burkina Faso
      south: 6.10,   // Golfe de Guinée
      east: 1.81,    // Frontière Bénin
      west: -0.15    // Frontière Ghana
    };
    
    // Ajouter les voisins externes selon la position de l'ADM
    // Golfe de Guinée (sud) - si l'ADM touche la côte
    if (south < 6.25) {
      neighbors.push({ label: 'Golfe de Guinée', direction: 'S', lon: centerLon, lat: south - 0.1 });
    }
    
    // Ghana (ouest) - si l'ADM est proche de la frontière ouest
    if (west < 0.5) {
      neighbors.push({ label: 'Ghana', direction: 'W', lon: west - 0.1, lat: centerLat });
    }
    
    // Bénin (est) - si l'ADM est proche de la frontière est
    if (east > 1.3) {
      neighbors.push({ label: 'Bénin', direction: 'E', lon: east + 0.1, lat: centerLat });
    }
    
    // Burkina Faso (nord) - si l'ADM est proche de la frontière nord
    if (north > 10.5) {
      neighbors.push({ label: 'Burkina Faso', direction: 'N', lon: centerLon, lat: north + 0.1 });
    }
    
    // Essayer de récupérer les voisins internes depuis l'API
    let level: string | null = null;
    let name: string | null = null;
    
    if (admFilters.adm3) {
      level = 'adm3';
      name = admFilters.adm3.name;
    } else if (admFilters.adm2) {
      level = 'adm2';
      name = admFilters.adm2.name;
    } else if (admFilters.adm1) {
      level = 'adm1';
      name = admFilters.adm1.name;
    }
    
    // ÉTAPE 2: Fix 401 /api/adm-neighbors avec fallback propre
    if (level && name) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/adm-neighbors?level=${level}&name=${encodeURIComponent(name)}`,
          withAuth()
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.neighbors && Array.isArray(data.neighbors)) {
            // Ajouter les voisins internes (autres ADM du Togo)
            for (const n of data.neighbors) {
              // Éviter les doublons avec les voisins externes
              if (!neighbors.some(existing => existing.label === n.label)) {
                neighbors.push(n);
              }
            }
          }
        } else if (response.status === 401) {
          // 401: Auth requise mais pas critique pour l'export
          // Log unique (pas de spam) et fallback sur voisins statiques
          if (!this.neighborsAuthWarningShown) {
            console.warn('[Export] ⚠️ /api/adm-neighbors nécessite authentification - utilisation voisins statiques uniquement');
            this.neighborsAuthWarningShown = true;
          }
        } else {
          console.warn(`[Export] API adm-neighbors erreur ${response.status} - utilisation voisins statiques`);
        }
      } catch (e) {
        console.warn('[Export] API adm-neighbors indisponible - utilisation voisins statiques');
      }
    }
    
    console.log('[Export] Voisins trouvés:', neighbors);
    return neighbors;
  }
  
  /**
   * Récupère toutes les mailles d'un ADM (avec et sans données)
   * STRATÉGIE HYBRIDE:
   * 1. Récupérer la grille (géométries) depuis /export/cells/adm ou /coverage/mailles
   * 2. Enrichir avec les VRAIES VALEURS thématiques depuis l'écran (getThematicFeatures)
   * 
   * Cela garantit que l'export utilise les MÊMES VALEURS que l'écran.
   */
  private async fetchAdmCells(
    admFilters: ActiveAdmFilters,
    parameterId?: string
  ): Promise<Array<{ geometry: any; has_data: boolean; n_sondages?: number; value?: number }>> {
    // 1. Récupérer les features thématiques de l'écran (SOURCE DE VÉRITÉ)
    const screenFeatures = this.config.getThematicFeatures?.() || [];
    const hasScreenData = screenFeatures.length > 0;
    
    console.log('[Export][DATA] thematicSource:', hasScreenData ? 'SCREEN' : 'API', 
      'featureCount:', screenFeatures.length);
    
    // Debug: afficher la structure d'une feature pour comprendre les propriétés
    if (screenFeatures.length > 0) {
      const sampleFeature = screenFeatures[0];
      console.log('[Export][DATA] Sample feature structure:', {
        hasProperties: !!sampleFeature.properties,
        propertyKeys: sampleFeature.properties ? Object.keys(sampleFeature.properties) : [],
        sampleProps: sampleFeature.properties,
        hasGeometry: !!sampleFeature.geometry
      });
    }
    
    // NOUVELLE APPROCHE: Utiliser directement les features thématiques de l'écran
    // car les codes de mailles peuvent être différents entre l'API thématique et la grille de couverture
    if (hasScreenData) {
      // Récupérer le polygone ADM pour filtrage géographique
      const admPolygon = this.config.getAdmPolygon?.();
      const hasAdmPolygon = admPolygon && admPolygon.length >= 3;
      
      console.log('[Export][DATA] Filtrage ADM:', {
        hasAdmPolygon,
        polygonPoints: admPolygon?.length || 0,
        admFilters: { adm1: admFilters.adm1?.name, adm2: admFilters.adm2?.name }
      });
      
      // Extraire les valeurs et géométries des features thématiques
      const allThematicCells: Array<{ geometry: any; has_data: boolean; n_sondages?: number; value?: number; code?: string; centroid?: {lat: number, lng: number} }> = [];
      
      for (const f of screenFeatures) {
        const props: any = f.properties || {};
        const geometry = f.geometry;
        
        if (!geometry) continue;
        
        // Extraire la valeur
        let value = props.value;
        if (value == null && parameterId) {
          value = props[parameterId];
        }
        if (value == null) {
          value = props.vbs_avg ?? props.n_sondages ?? props.passant_80um_avg ?? 
                  props.passant_2mm_avg ?? props.wl_avg ?? props.wp_avg ?? props.ip_avg ??
                  props.gamma_d_max_avg ?? props.w_opt_avg;
        }
        
        const code = props.code || props.grid_id || props.cell_id || props.id;
        
        // Calculer le centroïde de la maille pour le test d'inclusion
        const centroid = this.computeCentroid(geometry);
        
        allThematicCells.push({
          geometry,
          has_data: value != null && !isNaN(value),
          n_sondages: props.n_sondages || 0,
          value: value != null && !isNaN(value) ? value : undefined,
          code: code ? String(code) : undefined,
          centroid
        });
      }
      
      // FILTRAGE GÉOGRAPHIQUE: Ne garder que les mailles dont le centroïde est dans le polygone ADM
      let thematicCells = allThematicCells;
      if (hasAdmPolygon && this.options.onlyAdmCells) {
        // Convertir le polygone ADM en format {lat, lng}[] si nécessaire
        const polygonPoints = admPolygon.map((p: any) => {
          // Le polygone peut être [{lat, lng}] ou [[lng, lat]]
          if (typeof p.lat === 'number' && typeof p.lng === 'number') {
            return p;
          }
          // Format [lng, lat]
          if (Array.isArray(p) && p.length >= 2) {
            return { lng: p[0], lat: p[1] };
          }
          return p;
        });
        
        thematicCells = allThematicCells.filter(cell => {
          if (!cell.centroid) return false;
          return this.pointInPolygon(cell.centroid, polygonPoints);
        });
        
        console.log('[Export][DATA] Filtrage géographique ADM:', {
          avant: allThematicCells.length,
          après: thematicCells.length,
          filtrées: allThematicCells.length - thematicCells.length
        });
      }
      
      const withData = thematicCells.filter(c => c.has_data).length;
      const sampleValues = thematicCells.filter(c => c.value != null).slice(0, 5).map(c => ({ code: c.code, value: c.value }));
      
      console.log('[Export][DATA] Features thématiques après filtrage:', {
        total: thematicCells.length,
        withData,
        sampleValues,
        valueRange: withData > 0 ? {
          min: Math.min(...thematicCells.filter(c => c.value != null).map(c => c.value as number)),
          max: Math.max(...thematicCells.filter(c => c.value != null).map(c => c.value as number))
        } : null
      });
      
      // Récupérer aussi la grille vide pour les mailles sans données
      const emptyGrid = await this.fetchGridFromCoverage(admFilters);
      
      // Créer un Set des codes thématiques pour éviter les doublons
      const thematicCodes = new Set(thematicCells.map(c => c.code).filter(Boolean));
      
      // Filtrer les mailles vides: exclure celles déjà dans thematicCells
      let emptyCellsRaw = emptyGrid.filter(cell => !thematicCodes.has(cell.cell_id));
      
      // FILTRAGE GÉOGRAPHIQUE des mailles vides par polygone ADM (même logique que thematicCells)
      if (hasAdmPolygon && this.options.onlyAdmCells) {
        const polygonPoints = admPolygon.map((p: any) => {
          if (typeof p.lat === 'number' && typeof p.lng === 'number') return p;
          if (Array.isArray(p) && p.length >= 2) return { lng: p[0], lat: p[1] };
          return p;
        });
        
        const beforeCount = emptyCellsRaw.length;
        emptyCellsRaw = emptyCellsRaw.filter(cell => {
          const centroid = this.computeCentroid(cell.geometry);
          if (!centroid) return false;
          return this.pointInPolygon(centroid, polygonPoints);
        });
        
        console.log('[Export][DATA] Filtrage géographique mailles vides:', {
          avant: beforeCount,
          après: emptyCellsRaw.length,
          filtrées: beforeCount - emptyCellsRaw.length
        });
      }
      
      const emptyCells = emptyCellsRaw.map(cell => ({
        geometry: cell.geometry,
        has_data: false,
        n_sondages: 0,
        value: undefined
      }));
      
      console.log('[Export][DATA] Grille combinée:', {
        thematicCells: thematicCells.length,
        emptyCells: emptyCells.length,
        total: thematicCells.length + emptyCells.length
      });
      
      // Retourner les features thématiques + les mailles vides
      return [...thematicCells, ...emptyCells];
    }
    
    // FALLBACK: Si pas de features thématiques, utiliser l'ancienne méthode
    console.log('[Export] Pas de features thématiques, fallback sur grille de couverture');
    
    let gridCells: Array<{ cell_id?: string; geometry: any; has_data: boolean; n_sondages?: number }> = [];
    
    try {
      const params = new URLSearchParams();
      if (admFilters.adm1) params.append('adm1', admFilters.adm1.name);
      if (admFilters.adm2) params.append('adm2', admFilters.adm2.name);
      if (admFilters.adm3) params.append('adm3', admFilters.adm3.name);
      
      console.log('[Export] Chargement grille ADM depuis /export/cells/adm...');
      // Ajouter l'authentification pour éviter l'erreur 401
      const token = localStorage.getItem('atlas_token') || localStorage.getItem('atlas_access_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE_URL}/export/cells/adm?${params.toString()}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        gridCells = (data.cells || []).map((c: any) => ({
          cell_id: c.cell_id,
          geometry: c.geometry,
          has_data: c.has_data,
          n_sondages: c.n_sondages || 0
        }));
        console.log('[Export] Grille ADM chargée:', gridCells.length, 'mailles');
      } else {
        console.warn('[Export] Erreur API /export/cells/adm:', response.status, '- fallback coverage');
        gridCells = await this.fetchGridFromCoverage(admFilters);
      }
    } catch (e) {
      console.warn('[Export] Erreur fetchAdmCells:', e, '- fallback coverage');
      gridCells = await this.fetchGridFromCoverage(admFilters);
    }
    
    return gridCells.map(cell => ({
      geometry: cell.geometry,
      has_data: cell.has_data,
      n_sondages: cell.n_sondages || 0,
      value: cell.has_data ? (cell.n_sondages || 0) : undefined
    }));
  }
  
  /**
   * Récupère la grille depuis /coverage/mailles (fallback)
   */
  private async fetchGridFromCoverage(
    admFilters: ActiveAdmFilters
  ): Promise<Array<{ cell_id?: string; geometry: any; has_data: boolean; n_sondages?: number }>> {
    try {
      console.log('[Export] Fallback sur /coverage/mailles pour la grille');
      const response = await fetch(`${API_BASE_URL}/coverage/mailles`);
      
      if (!response.ok) {
        console.warn('[Export] Erreur API coverage/mailles:', response.status);
        return [];
      }
      
      const geojson = await response.json();
      const features = geojson.features || [];
      
      // Filtrer par ADM
      const filtered = features.filter((f: any) => {
        const props = f.properties || {};
        if (admFilters.adm1 && props.adm1_name !== admFilters.adm1.name) return false;
        if (admFilters.adm2 && props.adm2_name !== admFilters.adm2.name) return false;
        if (admFilters.adm3 && props.adm3_name !== admFilters.adm3.name) return false;
        return true;
      });
      
      return filtered.map((f: any) => ({
        cell_id: f.properties?.code || f.properties?.cell_id,
        geometry: f.geometry,
        has_data: f.properties?.has_data || f.properties?.n_sondages > 0,
        n_sondages: f.properties?.n_sondages || 0
      }));
    } catch (e) {
      console.warn('[Export] Erreur fetchGridFromCoverage:', e);
      return [];
    }
  }
  
  /**
   * Calcule l'emprise optimale pour l'export A4 (v3.5.1 - Algorithme avancé corrigé)
   * 
   * Basé sur ALGORITHME BOUNDS_EXPORT.md :
   * 1. Projection en coordonnées métriques (correction Mercator)
   * 2. Calcul slenderness (étirement)
   * 3. Marges anisotropes selon la forme - RÉDUITES pour maximiser l'occupation
   * 4. Ajustement au ratio de la zone carte A4
   * 5. Clamp anti-rognage
   * 
   * @param admBounds Bbox brut de l'ADM en  /**
   * v3.5.2: Calcule les bounds optimaux pour une orientation donnée
   * Retourne les bounds et le taux d'occupation
   */
  private computeBoundsForOrientation(
    admBounds: { north: number; south: number; east: number; west: number },
    quality: ExportQuality,
    orientation: 'portrait' | 'landscape'
  ): { bounds: { north: number; south: number; east: number; west: number }; occ_area: number; occ_x: number; occ_y: number } {
    const admWidthDeg = admBounds.east - admBounds.west;
    const admHeightDeg = admBounds.north - admBounds.south;
    const centerLat = (admBounds.north + admBounds.south) / 2;
    const centerLng = (admBounds.east + admBounds.west) / 2;
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const W0_km = admWidthDeg * 111 * cosLat;
    const H0_km = admHeightDeg * 111;
    
    // v3.5.3: Marges ultra-réduites pour maximiser l'occupation (basé sur golden sample Plateaux)
    // 1% de marge de sécurité = quasi bord-à-bord tout en évitant le rognage
    const µ = 0.01;
    const W1 = admWidthDeg * (1 + 2 * µ);
    const H1 = admHeightDeg * (1 + 2 * µ);
    
    // Layout A4 pour l'orientation choisie
    const dpi = QUALITY_SETTINGS[quality]?.dpi || 300;
    const layout = getA4Layout(dpi, orientation);
    const AR_frame = layout.targetAspectRatio;
    
    const W1_km = W1 * 111 * cosLat;
    const H1_km = H1 * 111;
    const AR_1 = W1_km / H1_km;
    
    let W2 = W1, H2 = H1;
    if (AR_1 > AR_frame) {
      H2 = (W1_km / AR_frame) / 111;
    } else if (AR_1 < AR_frame) {
      W2 = (H1_km * AR_frame) / (111 * cosLat);
    }
    
    const securityMargin = 0.005;
    const halfW2 = W2 / 2;
    const halfH2 = H2 / 2;
    const finalHalfW = Math.max(halfW2, Math.abs(admBounds.west - centerLng) * (1 + securityMargin), Math.abs(admBounds.east - centerLng) * (1 + securityMargin));
    const finalHalfH = Math.max(halfH2, Math.abs(admBounds.south - centerLat) * (1 + securityMargin), Math.abs(admBounds.north - centerLat) * (1 + securityMargin));
    
    const finalWidthKm = finalHalfW * 2 * 111 * cosLat;
    const finalHeightKm = finalHalfH * 2 * 111;
    
    return {
      bounds: {
        west: centerLng - finalHalfW,
        east: centerLng + finalHalfW,
        south: centerLat - finalHalfH,
        north: centerLat + finalHalfH
      },
      occ_x: W0_km / finalWidthKm,
      occ_y: H0_km / finalHeightKm,
      occ_area: (W0_km * H0_km) / (finalWidthKm * finalHeightKm)
    };
  }

  /**
   * CORRECTION: Utiliser BoundsOptimizer avec géométrie ADM pour calcul précis clearance
   * @param quality Qualité d'export pour déterminer le DPI
   * @param admName Nom de l'ADM pour le log (optionnel)
   * @param geometry Géométrie GeoJSON de l'ADM (optionnel mais recommandé)
   */
  private async computeOptimalBoundsForSheet(
    admBounds: { north: number; south: number; east: number; west: number },
    quality: ExportQuality = 'hd',
    admName?: string,
    geometry?: ADMGeometry
  ): Promise<{ north: number; south: number; east: number; west: number }> {
    
    // CORRECTION ÉTAPE 3: Récupérer géométrie ADM de manière robuste
    let admGeometry = geometry
    if (!admGeometry) {
      const admFilters = this.config.getActiveAdmFilters?.()
      if (admFilters) {
        const extracted = await this.extractAdmGeometryRobust(admFilters)
        admGeometry = extracted || undefined
      }
    }
    
    // CORRECTION: Utiliser BoundsOptimizer pour calcul itératif avec clearance réelle
    const optimizer = new BoundsOptimizer(quality, {
      safePx: 16,
      maxIterations: 15,
      muStart: 0.01,
      searchStrategy: 'binary',
      logPrefix: 'Export',
      admName
    })
    
    const boundsRect: BoundsRect = {
      north: admBounds.north,
      south: admBounds.south,
      east: admBounds.east,
      west: admBounds.west
    }
    
    const metrics = await optimizer.computeOptimalBounds(boundsRect, admGeometry)
    
    // Export JSON des métriques pour traçabilité
    const jsonMetrics = optimizer.toJSON()
    console.log(`[Export][BoundsJSON] ${admName || 'Zone'}:`, JSON.stringify(jsonMetrics, null, 2))
    
    // TODO: Sauvegarder jsonMetrics dans le log d'export ou fichier séparé
    
    return metrics.bounds
  }
  
  /**
   * ÉTAPE 3: Extrait la géométrie ADM depuis Leaflet de manière robuste
   * Gère Polygon ET MultiPolygon + structures nested
   * Fallback API si Leaflet échoue
   */
  private async extractAdmGeometryRobust(admFilters: ActiveAdmFilters): Promise<ADMGeometry | null> {
    console.log('[ExportBoundsGeometry] Extraction géométrie ADM...')
    
    // TENTATIVE 1: Extraction depuis Leaflet
    const leafletGeom = this.extractAdmGeometryFromLeaflet()
    if (leafletGeom) {
      const bbox = this.computeGeometryBbox(leafletGeom)
      const totalPoints = this.countGeometryPoints(leafletGeom)
      console.log(`[ExportBoundsGeometry] ✅ Source: leaflet | Type: ${leafletGeom.type} | Points: ${totalPoints} | BBox: [${bbox.west.toFixed(3)}, ${bbox.south.toFixed(3)}, ${bbox.east.toFixed(3)}, ${bbox.north.toFixed(3)}]`)
      return leafletGeom
    }
    
    // TENTATIVE 2: Fallback API
    console.warn('[ExportBoundsGeometry] ⚠️ Leaflet failed, trying API fallback...')
    const apiGeom = await this.fetchAdmGeometryFromAPI(admFilters)
    if (apiGeom) {
      const bbox = this.computeGeometryBbox(apiGeom)
      const totalPoints = this.countGeometryPoints(apiGeom)
      console.log(`[ExportBoundsGeometry] ✅ Source: api | Type: ${apiGeom.type} | Points: ${totalPoints} | BBox: [${bbox.west.toFixed(3)}, ${bbox.south.toFixed(3)}, ${bbox.east.toFixed(3)}, ${bbox.north.toFixed(3)}]`)
      return apiGeom
    }
    
    // ÉCHEC: Pas de géométrie disponible
    console.error('[ExportBoundsGeometry] ❌ Source: none | Clearance sera approximée à 50px')
    return null
  }
  
  /**
   * Extrait géométrie depuis polygon Leaflet (méthode originale améliorée)
   */
  private extractAdmGeometryFromLeaflet(): ADMGeometry | null {
    const polygon = this.config.getAdmPolygon?.()
    if (!polygon || polygon.length < 3) {
      return null
    }
    
    // getAdmPolygonCoords() retourne [[lng, lat], [lng, lat], ...]
    const coordinates: [number, number][] = polygon.map(p => {
      // Vérifier si c'est un objet {lat, lng}
      if (typeof p === 'object' && 'lat' in p && 'lng' in p) {
        return [(p as any).lng, (p as any).lat]
      }
      // Sinon c'est un tableau [lng, lat] (format GeoJSON standard)
      return [p[0], p[1]] as [number, number]
    })
    
    // Fermer le polygon si nécessaire
    const first = coordinates[0]
    const last = coordinates[coordinates.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]])
    }
    
    return {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  }
  
  /**
   * Fetch géométrie ADM depuis API (fallback)
   */
  private async fetchAdmGeometryFromAPI(admFilters: ActiveAdmFilters): Promise<ADMGeometry | null> {
    let level = ''
    let name = ''
    
    if (admFilters.adm3) {
      level = 'adm3'
      name = admFilters.adm3.name
    } else if (admFilters.adm2) {
      level = 'adm2'
      name = admFilters.adm2.name
    } else if (admFilters.adm1) {
      level = 'adm1'
      name = admFilters.adm1.name
    }
    
    if (!level || !name) return null
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/adm-geojson?level=${level}&name=${encodeURIComponent(name)}`
      )
      
      if (response.ok) {
        const geojson = await response.json()
        if (geojson.features && geojson.features[0]) {
          return geojson.features[0].geometry
        }
      }
    } catch (e) {
      console.warn('[ExportBoundsGeometry] API fetch failed:', e)
    }
    
    return null
  }
  
  /**
   * Calcule bbox d'une géométrie
   */
  private computeGeometryBbox(geometry: ADMGeometry): { north: number; south: number; east: number; west: number } {
    const coords = geometry.type === 'Polygon' 
      ? geometry.coordinates[0] 
      : geometry.coordinates[0][0]
    
    const lngs = coords.map((c: any) => c[0])
    const lats = coords.map((c: any) => c[1])
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    }
  }
  
  /**
   * Compte le nombre total de points d'une géométrie
   */
  private countGeometryPoints(geometry: ADMGeometry): number {
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0].length
    } else {
      return (geometry.coordinates as any).reduce((sum: number, poly: any) => sum + poly[0].length, 0)
    }
  }
  
  /**
   * PHASE 3: Applique un pan bias si pad_bottom >> pad_top (Maritime avec océan)
   */
  private async applyPanBiasIfNeeded(
    map: any,
    frameBounds: { north: number; south: number; east: number; west: number },
    admBounds: { north: number; south: number; east: number; west: number },
    admName: string
  ): Promise<void> {
    
    // Calculer padding en degrés
    const pad_top = frameBounds.north - admBounds.north
    const pad_bottom = admBounds.south - frameBounds.south
    const pad_left = admBounds.west - frameBounds.west
    const pad_right = frameBounds.east - admBounds.east
    
    const frameHeight = frameBounds.north - frameBounds.south
    const pad_top_pct = (pad_top / frameHeight) * 100
    const pad_bottom_pct = (pad_bottom / frameHeight) * 100
    
    console.log(`[PHASE3][${admName}] Padding: top=${pad_top_pct.toFixed(1)}% bottom=${pad_bottom_pct.toFixed(1)}%`)
    
    // Seuil: si pad_bottom > pad_top + 10%, appliquer pan bias
    const THRESHOLD = 10
    if (pad_bottom_pct > pad_top_pct + THRESHOLD) {
      const imbalance = pad_bottom_pct - pad_top_pct
      console.log(`[PHASE3][${admName}] ⚠️ Déséquilibre vertical: ${imbalance.toFixed(1)}% (bottom > top)`)
      
      // Calculer delta en pixels pour recentrer
      const mapSize = map.getSize()
      const deltaY = Math.round((imbalance / 100) * frameHeight * (mapSize.y / frameHeight) / 2)
      
      console.log(`[PHASE3][${admName}] Applying panBy: [0, ${-deltaY}]px`)
      map.panBy([0, -deltaY], { animate: false, duration: 0 })
      
      // Attendre moveend
      await new Promise<void>(resolve => {
        const handler = () => { map.off('moveend', handler); resolve(); }
        map.on('moveend', handler)
        setTimeout(() => { map.off('moveend', handler); resolve(); }, 1000)
      })
      
      // Log bounds après pan
      const newBounds = map.getBounds()
      console.log(`[PHASE3][${admName}] Bounds APRÈS pan: [${newBounds.getSouth().toFixed(4)}, ${newBounds.getWest().toFixed(4)}] → [${newBounds.getNorth().toFixed(4)}, ${newBounds.getEast().toFixed(4)}]`)
    } else {
      console.log(`[PHASE3][${admName}] ✅ Padding équilibré, pas de pan bias nécessaire`)
    }
  }

  private disableMapInteractionsForExport(map: any): () => void {
    const original = {
      dragging: !!map.dragging?.enabled?.(),
      touchZoom: !!map.touchZoom?.enabled?.(),
      doubleClickZoom: !!map.doubleClickZoom?.enabled?.(),
      scrollWheelZoom: !!map.scrollWheelZoom?.enabled?.(),
      boxZoom: !!map.boxZoom?.enabled?.(),
      keyboard: !!map.keyboard?.enabled?.(),
      tap: !!map.tap?.enabled?.(),
    };

    try {
      map.dragging?.disable?.();
      map.touchZoom?.disable?.();
      map.doubleClickZoom?.disable?.();
      map.scrollWheelZoom?.disable?.();
      map.boxZoom?.disable?.();
      map.keyboard?.disable?.();
      map.tap?.disable?.();
    } catch (e) {
      console.warn('[ExportSingle] disableMapInteractionsForExport failed:', e);
    }

    return () => {
      try {
        if (original.dragging) map.dragging?.enable?.();
        if (original.touchZoom) map.touchZoom?.enable?.();
        if (original.doubleClickZoom) map.doubleClickZoom?.enable?.();
        if (original.scrollWheelZoom) map.scrollWheelZoom?.enable?.();
        if (original.boxZoom) map.boxZoom?.enable?.();
        if (original.keyboard) map.keyboard?.enable?.();
        if (original.tap) map.tap?.enable?.();
      } catch (e) {
        console.warn('[ExportSingle] restoreMapInteractions failed:', e);
      }
    };
  }

  private enableFractionalZoomForExport(map: any): () => void {
    const original = {
      zoomSnap: map.options?.zoomSnap,
      zoomDelta: map.options?.zoomDelta,
      wheelPxPerZoomLevel: map.options?.wheelPxPerZoomLevel,
    };

    try {
      if (map.options) {
        map.options.zoomSnap = 0.1;
        map.options.zoomDelta = 0.1;
        if (typeof map.options.wheelPxPerZoomLevel === 'number') {
          map.options.wheelPxPerZoomLevel = 120;
        }
      }
    } catch (e) {
      console.warn('[ExportSingle] enableFractionalZoomForExport failed:', e);
    }

    return () => {
      try {
        if (map.options) {
          map.options.zoomSnap = original.zoomSnap;
          map.options.zoomDelta = original.zoomDelta;
          map.options.wheelPxPerZoomLevel = original.wheelPxPerZoomLevel;
        }
      } catch (e) {
        console.warn('[ExportSingle] restoreFractionalZoom failed:', e);
      }
    };
  }

  private async waitForStableBounds(
    map: any,
    options: {
      admName: string;
      timeoutMs: number;
      stableSamples: number;
      sampleIntervalMs: number;
    }
  ): Promise<{ north: number; south: number; east: number; west: number }> {
    const t0 = performance.now();

    const almostEqual = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;
    const eps = 1e-6;

    const getRect = () => {
      const b = map.getBounds();
      return {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      };
    };

    const eq = (
      a: { north: number; south: number; east: number; west: number },
      b: { north: number; south: number; east: number; west: number }
    ) => (
      almostEqual(a.north, b.north, eps) &&
      almostEqual(a.south, b.south, eps) &&
      almostEqual(a.east, b.east, eps) &&
      almostEqual(a.west, b.west, eps)
    );

    let last = getRect();
    let stableCount = 0;

    while (performance.now() - t0 < options.timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, options.sampleIntervalMs));
      await waitForFrames(1);

      const current = getRect();
      if (eq(current, last)) {
        stableCount++;
        if (stableCount >= options.stableSamples) {
          console.log(`[PHASE2][${options.admName}] stable bounds after ${(performance.now() - t0).toFixed(0)}ms (${stableCount} samples)`);
          console.log(`[PHASE2][${options.admName}] Map zoom: ${map.getZoom()}`);
          console.log(`[PHASE2][${options.admName}] Map bounds: [${current.south.toFixed(4)}, ${current.west.toFixed(4)}] → [${current.north.toFixed(4)}, ${current.east.toFixed(4)}]`);
          return current;
        }
      } else {
        stableCount = 0;
        last = current;
      }
    }

    const fallback = getRect();
    console.warn(`[PHASE2][${options.admName}] stable bounds TIMEOUT after ${(performance.now() - t0).toFixed(0)}ms`);
    console.warn(`[PHASE2][${options.admName}] Map zoom: ${map.getZoom()}`);
    console.warn(`[PHASE2][${options.admName}] Map bounds: [${fallback.south.toFixed(4)}, ${fallback.west.toFixed(4)}] → [${fallback.north.toFixed(4)}, ${fallback.east.toFixed(4)}]`);
    return fallback;
  }
  
  /**
   * CORRECTION: Fonction générique utilisant BoundsOptimizer pour tous les niveaux ADM
   * 
   * @param level Niveau ADM ('adm1', 'adm2', 'adm3')
   * @param admBounds Bbox de l'ADM
   * @param quality Qualité d'export
   * @param admName Nom de l'ADM pour les logs
   * @param geometry Géométrie GeoJSON de l'ADM (optionnel)
   */
  public async computeOptimalBoundsForAdm(
    level: 'adm1' | 'adm2' | 'adm3',
    admBounds: { north: number; south: number; east: number; west: number },
    quality: ExportQuality = 'hd',
    admName?: string,
    geometry?: ADMGeometry
  ): Promise<{ north: number; south: number; east: number; west: number }> {
    const levelLabel = level === 'adm1' ? 'Région' : level === 'adm2' ? 'Préfecture' : 'Commune'
    
    const optimizer = new BoundsOptimizer(quality, {
      safePx: 16,
      maxIterations: 15,
      muStart: 0.01,
      searchStrategy: 'binary',
      logPrefix: level.toUpperCase(),
      admName: `${levelLabel} ${admName || 'inconnu'}`
    })
    
    const boundsRect: BoundsRect = {
      north: admBounds.north,
      south: admBounds.south,
      east: admBounds.east,
      west: admBounds.west
    }
    
    const metrics = await optimizer.computeOptimalBounds(boundsRect, geometry)
    
    return metrics.bounds
  }
  
  // NOTE: computeTargetMapAreaAspectRatio supprimée - utiliser getA4Layout() à la place
  
  /**
   * Calcule le centroïde d'une géométrie GeoJSON
   */
  private computeCentroid(geometry: any): { lat: number; lng: number } | undefined {
    if (!geometry) return undefined;
    
    try {
      // Pour un Polygon, calculer le centroïde du premier anneau
      if (geometry.type === 'Polygon' && geometry.coordinates?.[0]) {
        const ring = geometry.coordinates[0];
        let sumLng = 0, sumLat = 0;
        for (const coord of ring) {
          sumLng += coord[0];
          sumLat += coord[1];
        }
        return {
          lng: sumLng / ring.length,
          lat: sumLat / ring.length
        };
      }
      
      // Pour un MultiPolygon, utiliser le premier polygone
      if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]) {
        const ring = geometry.coordinates[0][0];
        let sumLng = 0, sumLat = 0;
        for (const coord of ring) {
          sumLng += coord[0];
          sumLat += coord[1];
        }
        return {
          lng: sumLng / ring.length,
          lat: sumLat / ring.length
        };
      }
      
      // Pour un Point
      if (geometry.type === 'Point' && geometry.coordinates) {
        return {
          lng: geometry.coordinates[0],
          lat: geometry.coordinates[1]
        };
      }
    } catch (e) {
      console.warn('[Export] Erreur calcul centroïde:', e);
    }
    
    return undefined;
  }
  
  /**
   * Test si un point est à l'intérieur d'un polygone (algorithme ray casting)
   * @param point Point à tester {lat, lng}
   * @param polygon Tableau de points [{lat, lng}, ...]
   */
  private pointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
    if (!point || !polygon || polygon.length < 3) return false;
    
    const x = point.lng;
    const y = point.lat;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
}

// ============================================================================
// Export du module
// ============================================================================

export function createExportQuickDialog(config: ExportQuickDialogConfig): ExportQuickDialog {
  return new ExportQuickDialog(config);
}
