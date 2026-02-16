/**
 * Télémétrie d'export - Logging structuré pour debug
 * Atlas Géotechnique v3.1
 * 
 * Fournit un système de logging uniforme pour tracer chaque étape de l'export
 * et identifier rapidement les problèmes (double limite, étirement, stats vides, etc.)
 */

// ============================================================================
// Types
// ============================================================================

export type ExportStage = 
  | 'UI'         // Interaction utilisateur (options sélectionnées)
  | 'FETCH'      // Récupération des données (mailles, ADM, voisins)
  | 'FILTER'     // Filtrage des données par ADM
  | 'FIT'        // Resize + fitBounds + waitForFrames
  | 'TILES_WAIT' // Attente stabilité des tuiles
  | 'CAPTURE'    // Capture html2canvas de la carte Leaflet
  | 'LAYOUT'     // Calcul du layout A4 et zones
  | 'DRAW'       // Dessin sur le canvas (carte, masque, mailles)
  | 'DRAW_CELLS' // Dessin des mailles colorées côté export
  | 'MASK'       // Application du masque ADM
  | 'GRID'       // Grille de coordonnées
  | 'STATS'      // Calcul et rendu des statistiques
  | 'LEGEND'     // Génération de la légende
  | 'NEIGHBORS'  // Labels des ADM voisins
  | 'ENCODE'     // Canvas → PNG blob
  | 'ZIP'        // Compression ZIP + création blob
  | 'SAVE';      // Sauvegarde finale (téléchargement)

export interface ExportTiming {
  stage: ExportStage;
  startMs: number;
  endMs?: number;
  durationMs?: number;
}

export interface ExportLogEntry {
  runId: string;
  timestamp: string;
  stage: ExportStage;
  data: Record<string, any>;
}

export interface ExportMeta {
  runId: string;
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  
  // Options utilisateur
  options: {
    format: string;
    quality: string;
    zone: string;
    dpi: number;
    maskMode: string;
    showEmptyCells: boolean;
    onlyAdmCells: boolean;
    showNeighbors: boolean;
    includeStats: boolean;
    includeLegend: boolean;
  };
  
  // Thématique
  thematic: {
    id: string;
    name: string;
    unit?: string;
  };
  
  // Filtres ADM
  admFilters: {
    adm1?: string;
    adm2?: string;
    adm3?: string;
  };
  
  // Dimensions
  dimensions: {
    captureWidth?: number;
    captureHeight?: number;
    canvasWidth?: number;
    canvasHeight?: number;
    mapAreaWidth?: number;
    mapAreaHeight?: number;
  };
  
  // BBox
  bbox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  
  // Compteurs
  counts: {
    totalCells?: number;
    cellsWithData?: number;
    cellsWithoutData?: number;
    neighborsFound?: number;
    neighborsDrawn?: number;
    legendClasses?: number;
  };
  
  // Stats calculées
  computedStats?: Record<string, any>;
  
  // Timings par étape
  timings: ExportTiming[];
  
  // Erreurs
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Classe ExportTelemetry
// ============================================================================

export class ExportTelemetry {
  private runId: string;
  private meta: ExportMeta;
  private currentStage: ExportStage | null = null;
  private stageStartTime: number = 0;
  private debugLogs: Array<{ timestamp: string; stage: ExportStage; data: Record<string, any> }> = [];
  
  constructor() {
    this.runId = this.generateRunId();
    this.meta = this.initMeta();
  }
  
  /**
   * Génère un ID unique pour cette exécution d'export
   * Format: YYYYMMDD_HHMMSS_XXXX
   */
  private generateRunId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${date}_${time}_${rand}`;
  }
  
  /**
   * Initialise les métadonnées
   */
  private initMeta(): ExportMeta {
    return {
      runId: this.runId,
      startedAt: new Date().toISOString(),
      options: {
        format: '',
        quality: '',
        zone: '',
        dpi: 0,
        maskMode: '',
        showEmptyCells: false,
        onlyAdmCells: false,
        showNeighbors: false,
        includeStats: false,
        includeLegend: false
      },
      thematic: {
        id: '',
        name: ''
      },
      admFilters: {},
      dimensions: {},
      counts: {},
      timings: [],
      errors: [],
      warnings: []
    };
  }
  
  /**
   * Retourne l'ID de cette exécution
   */
  getRunId(): string {
    return this.runId;
  }
  
  /**
   * Log structuré avec préfixe [Export][STAGE]
   * Stocke aussi dans debugLogs pour export ZIP
   */
  log(stage: ExportStage, data: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    
    // Stocker dans le buffer pour export ZIP
    this.debugLogs.push({ timestamp, stage, data });
    
    // Format console lisible
    const prefix = `[Export][${stage}]`;
    console.log(prefix, `runId=${this.runId}`, data);
  }
  
  /**
   * Retourne les logs de debug pour inclusion dans metadata.json
   */
  getDebugLogs(): Array<{ timestamp: string; stage: ExportStage; data: Record<string, any> }> {
    return this.debugLogs;
  }
  
  /**
   * Buffer pour les logs console capturés
   */
  private consoleLogs: Array<{ timestamp: string; level: string; tag: string; message: string }> = [];
  private originalConsoleLog: typeof console.log | null = null;
  private originalConsoleWarn: typeof console.warn | null = null;
  private originalConsoleError: typeof console.error | null = null;
  
  /**
   * Démarre la capture des console.log/warn/error avec tags [Export], [ExportFrame], [ExportStats]
   */
  startConsoleCapture(): void {
    if (this.originalConsoleLog) return; // Déjà en capture
    
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    
    const captureLog = (level: string, ...args: any[]) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      
      // Capturer uniquement les logs avec tags export
      const exportTags = ['[Export]', '[ExportFrame]', '[ExportStats]', '[ThematicMap]'];
      const matchedTag = exportTags.find(tag => message.includes(tag));
      
      if (matchedTag) {
        this.consoleLogs.push({
          timestamp: new Date().toISOString(),
          level,
          tag: matchedTag,
          message: message.substring(0, 500) // Limiter la taille
        });
      }
    };
    
    console.log = (...args: any[]) => {
      captureLog('log', ...args);
      this.originalConsoleLog!.apply(console, args);
    };
    
    console.warn = (...args: any[]) => {
      captureLog('warn', ...args);
      this.originalConsoleWarn!.apply(console, args);
    };
    
    console.error = (...args: any[]) => {
      captureLog('error', ...args);
      this.originalConsoleError!.apply(console, args);
    };
  }
  
  /**
   * Arrête la capture et restaure les fonctions console originales
   */
  stopConsoleCapture(): void {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
      this.originalConsoleLog = null;
    }
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
      this.originalConsoleWarn = null;
    }
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
  }
  
  /**
   * Retourne les logs console capturés
   */
  getConsoleLogs(): Array<{ timestamp: string; level: string; tag: string; message: string }> {
    return this.consoleLogs;
  }
  
  /**
   * Démarre le chronométrage d'une étape
   */
  startStage(stage: ExportStage): void {
    // Terminer l'étape précédente si elle existe
    if (this.currentStage) {
      this.endStage();
    }
    
    this.currentStage = stage;
    this.stageStartTime = performance.now();
    
    this.log(stage, { event: 'start' });
  }
  
  /**
   * Termine le chronométrage de l'étape courante
   */
  endStage(additionalData?: Record<string, any>): void {
    if (!this.currentStage) return;
    
    const endTime = performance.now();
    const duration = Math.round(endTime - this.stageStartTime);
    
    const timing: ExportTiming = {
      stage: this.currentStage,
      startMs: this.stageStartTime,
      endMs: endTime,
      durationMs: duration
    };
    
    this.meta.timings.push(timing);
    
    this.log(this.currentStage, { 
      event: 'end', 
      durationMs: duration,
      ...additionalData 
    });
    
    this.currentStage = null;
  }
  
  /**
   * Enregistre les options utilisateur
   */
  setOptions(options: Partial<ExportMeta['options']>): void {
    Object.assign(this.meta.options, options);
    this.log('UI', { options: this.meta.options });
  }
  
  /**
   * Enregistre la thématique
   */
  setThematic(thematic: ExportMeta['thematic']): void {
    this.meta.thematic = thematic;
    this.log('UI', { thematic });
  }
  
  /**
   * Enregistre les filtres ADM
   */
  setAdmFilters(filters: ExportMeta['admFilters']): void {
    this.meta.admFilters = filters;
    this.log('UI', { admFilters: filters });
  }
  
  /**
   * Enregistre les dimensions de capture
   */
  setCaptureDimensions(width: number, height: number): void {
    this.meta.dimensions.captureWidth = width;
    this.meta.dimensions.captureHeight = height;
    this.log('CAPTURE', { 
      captureWidth: width, 
      captureHeight: height,
      captureAspectRatio: (width / height).toFixed(3)
    });
  }
  
  /**
   * Enregistre les dimensions du canvas final
   */
  setCanvasDimensions(width: number, height: number, mapAreaWidth: number, mapAreaHeight: number): void {
    this.meta.dimensions.canvasWidth = width;
    this.meta.dimensions.canvasHeight = height;
    this.meta.dimensions.mapAreaWidth = mapAreaWidth;
    this.meta.dimensions.mapAreaHeight = mapAreaHeight;
    
    this.log('LAYOUT', { 
      canvasWidth: width, 
      canvasHeight: height,
      mapAreaWidth,
      mapAreaHeight,
      mapAreaAspectRatio: (mapAreaWidth / mapAreaHeight).toFixed(3)
    });
  }
  
  /**
   * Enregistre le bbox
   */
  setBbox(bbox: ExportMeta['bbox']): void {
    this.meta.bbox = bbox;
    if (bbox) {
      const width = bbox.maxX - bbox.minX;
      const height = bbox.maxY - bbox.minY;
      this.log('LAYOUT', { 
        bbox,
        bboxWidth: width.toFixed(4),
        bboxHeight: height.toFixed(4),
        bboxAspectRatio: (width / height).toFixed(3)
      });
    }
  }
  
  /**
   * Enregistre les compteurs de mailles
   */
  setCellCounts(total: number, withData: number, withoutData: number): void {
    this.meta.counts.totalCells = total;
    this.meta.counts.cellsWithData = withData;
    this.meta.counts.cellsWithoutData = withoutData;
    
    this.log('FILTER', { 
      totalCells: total, 
      cellsWithData: withData, 
      cellsWithoutData: withoutData,
      coveragePct: total > 0 ? ((withData / total) * 100).toFixed(1) + '%' : '0%'
    });
  }
  
  /**
   * Enregistre les voisins
   */
  setNeighborCounts(found: number, drawn: number): void {
    this.meta.counts.neighborsFound = found;
    this.meta.counts.neighborsDrawn = drawn;
    this.log('NEIGHBORS', { neighborsFound: found, neighborsDrawn: drawn });
  }
  
  /**
   * Enregistre les stats calculées
   */
  setComputedStats(stats: Record<string, any>): void {
    this.meta.computedStats = stats;
    this.log('STATS', { computedStats: stats });
  }
  
  /**
   * Enregistre les classes de légende
   */
  setLegendClasses(count: number, visibleCount: number): void {
    this.meta.counts.legendClasses = count;
    this.log('LEGEND', { 
      totalClasses: count, 
      visibleClasses: visibleCount 
    });
  }
  
  /**
   * Log les paramètres de drawImage pour debug aspect ratio
   */
  logDrawImage(srcW: number, srcH: number, dstW: number, dstH: number, dstX: number, dstY: number): void {
    const arSrc = srcW / srcH;
    const arDst = dstW / dstH;
    const scaleX = dstW / srcW;
    const scaleY = dstH / srcH;
    
    this.log('DRAW', {
      drawImage: {
        srcW, srcH, arSrc: arSrc.toFixed(3),
        dstW, dstH, arDst: arDst.toFixed(3),
        dstX, dstY,
        scaleX: scaleX.toFixed(3),
        scaleY: scaleY.toFixed(3),
        aspectRatioMismatch: Math.abs(arSrc - arDst) > 0.01
      }
    });
    
    // NOTE: L'export ne doit JAMAIS étirer l'image. Le rendu utilise un recadrage (cover)
    // pour remplir la zone carte A4. On logue donc l'écart d'AR sans warning bloquant.
    if (Math.abs(arSrc - arDst) > 0.01) {
      this.log('DRAW', {
        aspectRatio: {
          mismatch: true,
          message: `Aspect ratio mismatch: src=${arSrc.toFixed(3)} dst=${arDst.toFixed(3)} -> crop (cover), no-stretch`
        }
      });
    }
  }
  
  /**
   * Log l'état de l'overlay ADM avant capture
   */
  logAdmOverlayState(visible: boolean, hidden: boolean): void {
    this.log('CAPTURE', {
      admOverlay: {
        visibleBeforeCapture: visible,
        hiddenForCapture: hidden
      }
    });
    
    if (visible && !hidden) {
      this.warn('ADM overlay visible during capture - may cause double boundary!');
    }
  }
  
  /**
   * Ajoute un warning
   */
  warn(message: string): void {
    this.meta.warnings.push(message);
    console.warn(`[Export][WARN] runId=${this.runId}`, message);
  }
  
  /**
   * Ajoute une erreur
   */
  error(message: string, error?: Error): void {
    this.meta.errors.push(message);
    console.error(`[Export][ERROR] runId=${this.runId}`, message, error);
  }
  
  /**
   * Finalise et retourne les métadonnées complètes
   */
  finalize(): ExportMeta {
    this.meta.completedAt = new Date().toISOString();
    
    // Calculer la durée totale
    const start = new Date(this.meta.startedAt).getTime();
    const end = new Date(this.meta.completedAt).getTime();
    this.meta.totalDurationMs = end - start;
    
    this.log('SAVE', {
      event: 'complete',
      totalDurationMs: this.meta.totalDurationMs,
      errors: this.meta.errors.length,
      warnings: this.meta.warnings.length
    });
    
    // Log résumé final
    console.log(`[Export][SUMMARY] runId=${this.runId}`, {
      duration: `${this.meta.totalDurationMs}ms`,
      dimensions: this.meta.dimensions,
      counts: this.meta.counts,
      errors: this.meta.errors,
      warnings: this.meta.warnings
    });
    
    return this.meta;
  }
  
  /**
   * Génère un JSON des métadonnées (pour export_meta.json)
   */
  toJSON(): string {
    return JSON.stringify(this.meta, null, 2);
  }
  
  /**
   * Retourne les timings par étape (pour les métadonnées d'export)
   */
  getStages(): Record<string, any> {
    const stages: Record<string, any> = {};
    
    for (const timing of this.meta.timings) {
      stages[timing.stage] = {
        durationMs: timing.durationMs,
        startMs: timing.startMs,
        endMs: timing.endMs
      };
    }
    
    return {
      stages,
      totalDurationMs: this.meta.totalDurationMs,
      errors: this.meta.errors,
      warnings: this.meta.warnings
    };
  }
}

// ============================================================================
// Factory et singleton pour l'export courant
// ============================================================================

let currentTelemetry: ExportTelemetry | null = null;

/**
 * Crée une nouvelle instance de télémétrie pour un export
 */
export function createExportTelemetry(): ExportTelemetry {
  currentTelemetry = new ExportTelemetry();
  return currentTelemetry;
}

/**
 * Récupère la télémétrie courante (ou en crée une nouvelle)
 */
export function getExportTelemetry(): ExportTelemetry {
  if (!currentTelemetry) {
    currentTelemetry = new ExportTelemetry();
  }
  return currentTelemetry;
}

/**
 * Helper rapide pour logger sans gérer l'instance
 */
export function exportLog(stage: ExportStage, data: Record<string, any>): void {
  getExportTelemetry().log(stage, data);
}
