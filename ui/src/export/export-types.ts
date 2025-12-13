/**
 * Types et interfaces pour le système d'export cartographique
 * Atlas Géotechnique v3.0
 */

// ============================================================================
// SCR (Système de Coordonnées de Référence)
// ============================================================================

export type ScrCode = 'EPSG:4326' | 'EPSG:25231';

export interface ScrDefinition {
  code: ScrCode;
  name: string;
  unit: 'degrees' | 'meters';
  /** Pas de grille "propres" pour ce SCR */
  niceSteps: number[];
  /** Format d'affichage des coordonnées */
  formatCoord: (value: number, axis: 'x' | 'y') => string;
}

export const SCR_DEFINITIONS: Record<ScrCode, ScrDefinition> = {
  'EPSG:4326': {
    code: 'EPSG:4326',
    name: 'WGS84 (Degrés)',
    unit: 'degrees',
    niceSteps: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
    formatCoord: (value: number, axis: 'x' | 'y') => {
      const suffix = axis === 'x' ? (value >= 0 ? '°E' : '°W') : (value >= 0 ? '°N' : '°S');
      return `${Math.abs(value).toFixed(3)}${suffix}`;
    }
  },
  'EPSG:25231': {
    code: 'EPSG:25231',
    name: 'UTM Zone 31N (Togo)',
    unit: 'meters',
    niceSteps: [100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000],
    formatCoord: (value: number, _axis: 'x' | 'y') => {
      // Arrondir à 10m et formater avec espace comme séparateur de milliers
      const rounded = Math.round(value / 10) * 10;
      return rounded.toLocaleString('fr-FR') + ' m';
    }
  }
};

// ============================================================================
// Options de grille
// ============================================================================

export type GridType = 'none' | 'cross' | 'continuous' | 'labels-only';

export type FrameStyle = 'none' | 'simple' | 'double' | 'zebra';

export interface GridOptions {
  type: GridType;
  scr: ScrCode;
  /** Nombre cible de divisions (défaut: 5) */
  targetDivisions: number;
  /** Pas personnalisé (override auto) */
  customStepX?: number;
  customStepY?: number;
  /** Afficher les labels de coordonnées */
  showLabels: boolean;
  /** Côtés où afficher les labels */
  labelSides: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

export const DEFAULT_GRID_OPTIONS: GridOptions = {
  type: 'cross',
  scr: 'EPSG:4326',
  targetDivisions: 5,
  showLabels: true,
  labelSides: {
    top: true,
    bottom: true,
    left: true,
    right: true
  }
};

// ============================================================================
// Options d'export
// ============================================================================

export type ExportFormat = 'png' | 'pdf';

export type ExportQuality = 'web' | 'print';

export type ExportZone = 'viewport' | 'adm-filtered';

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  zone: ExportZone;
  
  // Éléments à inclure
  includeTitle: boolean;
  includeLegend: boolean;
  includeStats: boolean;
  includeScaleBar: boolean;
  includeNorthArrow: boolean;
  includeScrInfo: boolean;
  
  // Grille et cadre
  grid: GridOptions;
  frameStyle: FrameStyle;
  
  // Métadonnées
  title?: string;
  subtitle?: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 'web',
  zone: 'viewport',
  
  includeTitle: true,
  includeLegend: true,
  includeStats: false,
  includeScaleBar: true,
  includeNorthArrow: true,
  includeScrInfo: true,
  
  grid: DEFAULT_GRID_OPTIONS,
  frameStyle: 'simple',
};

// ============================================================================
// Dimensions et résolutions
// ============================================================================

export interface ExportDimensions {
  /** Largeur en pixels */
  width: number;
  /** Hauteur en pixels */
  height: number;
  /** Facteur de scale pour haute résolution */
  scale: number;
}

export const QUALITY_SETTINGS: Record<ExportQuality, { scale: number; dpi: number }> = {
  web: { scale: 1, dpi: 72 },
  print: { scale: 3, dpi: 300 }
};

// ============================================================================
// Bounding Box
// ============================================================================

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GridLine {
  value: number;
  axis: 'x' | 'y';
  /** Position en pixels dans le canvas */
  pixelPos: number;
  /** Label formaté */
  label: string;
}

// ============================================================================
// Éléments du canevas d'export
// ============================================================================

export interface ExportFrameLayout {
  /** Dimensions totales du canevas */
  totalWidth: number;
  totalHeight: number;
  
  /** Zone du titre */
  titleArea: { x: number; y: number; width: number; height: number };
  
  /** Zone de la carte */
  mapArea: { x: number; y: number; width: number; height: number };
  
  /** Zone de la légende */
  legendArea: { x: number; y: number; width: number; height: number };
  
  /** Zone du cartouche */
  cartoucheArea: { x: number; y: number; width: number; height: number };
  
  /** Marges pour les labels de coordonnées */
  coordLabelMargin: number;
}

// ============================================================================
// État de l'export
// ============================================================================

export type ExportStatus = 'idle' | 'preparing' | 'capturing' | 'generating' | 'complete' | 'error';

export interface ExportState {
  status: ExportStatus;
  progress: number;
  message: string;
  error?: string;
}

// ============================================================================
// Thématique active (pour titre et légende)
// ============================================================================

export interface ActiveThematic {
  name: string;
  parameter: string;
  unit?: string;
  legendHtml?: string;
}

// ============================================================================
// Filtres ADM actifs
// ============================================================================

export interface ActiveAdmFilters {
  adm1?: { code: string; name: string };
  adm2?: { code: string; name: string };
  adm3?: { code: string; name: string };
}

export function formatAdmPath(filters: ActiveAdmFilters): string {
  const parts: string[] = [];
  if (filters.adm1) parts.push(filters.adm1.name);
  if (filters.adm2) parts.push(filters.adm2.name);
  if (filters.adm3) parts.push(filters.adm3.name);
  return parts.length > 0 ? parts.join(' / ') : 'Tout le Togo';
}
