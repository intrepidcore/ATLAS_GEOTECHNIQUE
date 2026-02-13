// Types et interfaces pour les cartes thématiques v2.0
// Organisation métier pour ingénieurs géotechniciens

// ============================================================================
// OBJECTIFS MÉTIER - Bloc A
// ============================================================================

export type ObjectifMetier = 
  | 'couverture'      // Couverture & instrumentation
  | 'argilosite'      // Argilosité / plasticité
  | 'gonflement'      // Potentiel de gonflement
  | 'compacite'       // Compacité / portance (Proctor)
  | 'granulometrie'   // Granulométrie
  | 'contexte'        // Contexte géographique
  | 'personnalise'    // Power user - tous les paramètres

export interface ObjectifConfig {
  id: ObjectifMetier
  label: string
  description: string
  icon: string
  parameters: string[]  // IDs des paramètres associés
  defaultParameter: string
  defaultPalette: string
}

export const OBJECTIFS_METIER: ObjectifConfig[] = [
  {
    id: 'couverture',
    label: 'Couverture & instrumentation',
    description: 'Densité de sondages et essais par maille',
    icon: '📍',
    parameters: ['n_sondages', 'n_echantillons', 'n_essais_total'],
    defaultParameter: 'n_sondages',
    defaultPalette: 'Greens'
  },
  {
    id: 'argilosite',
    label: 'Argilosité / plasticité',
    description: 'Caractérisation de la fraction argileuse',
    icon: '🧱',
    parameters: ['vbs_avg', 'ip_avg', 'wl_avg', 'wp_avg'],
    defaultParameter: 'vbs_avg',
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'gonflement',
    label: 'Potentiel de gonflement',
    description: 'Risque de gonflement des argiles',
    icon: '⚠️',
    parameters: ['eg_avg', 'eg_max', 'eg_min'],
    defaultParameter: 'eg_avg',
    defaultPalette: 'Blues'
  },
  {
    id: 'compacite',
    label: 'Compacité / portance (Proctor)',
    description: 'Caractéristiques de compactage',
    icon: '🔨',
    parameters: ['gamma_d_max_avg', 'w_opt_avg'],
    defaultParameter: 'gamma_d_max_avg',
    defaultPalette: 'Oranges'
  },
  {
    id: 'granulometrie',
    label: 'Granulométrie',
    description: 'Distribution granulométrique',
    icon: '📊',
    parameters: ['passant_80um_avg', 'passant_2mm_avg', 'passant_20mm_avg'],
    defaultParameter: 'passant_80um_avg',
    defaultPalette: 'BrBG'
  },
  {
    id: 'contexte',
    label: 'Contexte géographique',
    description: 'Paramètres géographiques et topographiques',
    icon: '🗺️',
    parameters: ['altitude_mean'],
    defaultParameter: 'altitude_mean',
    defaultPalette: 'Terrain'
  },
  {
    id: 'personnalise',
    label: 'Personnalisé',
    description: 'Accès à tous les paramètres disponibles',
    icon: '⚙️',
    parameters: [], // Tous les paramètres
    defaultParameter: 'n_sondages',
    defaultPalette: 'Greens'
  }
]

// ============================================================================
// PARAMÈTRES THÉMATIQUES
// ============================================================================

export type ParameterCategory = 'density' | 'granulo' | 'atterberg' | 'vbs' | 'proctor' | 'gonflement' | 'contexte'

export interface ThematicParameter {
  id: string
  label: string
  unit: string
  category: ParameterCategory
  description: string
  formula?: string           // Formule pour tooltip
  defaultBreaks?: number[]
  defaultPalette?: string
  minEssaisField?: string    // Champ pour filtre "essais minimum"
}

export const THEMATIC_PARAMETERS: ThematicParameter[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // COUVERTURE & INSTRUMENTATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'n_sondages',
    label: 'Nombre de sondages',
    unit: '',
    category: 'density',
    description: 'Densité de sondages par maille (UTM 2 km × 2 km)',
    defaultBreaks: [1, 2, 3, 4, 5],
    defaultPalette: 'Greens'
  },
  {
    id: 'n_echantillons',
    label: 'Nombre d\'échantillons',
    unit: '',
    category: 'density',
    description: 'Nombre total d\'échantillons prélevés par maille',
    defaultPalette: 'Greens'
  },
  {
    id: 'n_essais_total',
    label: 'Nombre d\'essais',
    unit: '',
    category: 'density',
    description: 'Nombre total d\'essais géotechniques par maille',
    defaultPalette: 'Greens'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ARGILOSITÉ / PLASTICITÉ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'vbs_avg',
    label: 'VBS moyen',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Valeur de Bleu de Méthylène moyenne - mesure de l\'argilosité',
    formula: 'VBS = masse de bleu absorbé / masse de sol sec × 100',
    defaultBreaks: [0.2, 1.5, 2.5, 6, 8],
    defaultPalette: 'YlOrRd',
    minEssaisField: 'n_essais_vbs'
  },
  {
    id: 'ip_avg',
    label: 'IP moyen',
    unit: '%',
    category: 'atterberg',
    description: 'Indice de plasticité moyen - caractérise la plasticité du sol',
    formula: 'IP = WL - WP',
    defaultBreaks: [7, 12, 25, 40],
    defaultPalette: 'PuRd',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'wl_avg',
    label: 'Limite de liquidité WL',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition plastique → liquide',
    defaultPalette: 'PuBu',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'wp_avg',
    label: 'Limite de plasticité WP',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition solide → plastique',
    defaultPalette: 'BuPu',
    minEssaisField: 'n_essais_atterberg'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // POTENTIEL DE GONFLEMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'eg_avg',
    label: 'Eg moyen',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement moyen - risque de gonflement des argiles',
    formula: 'Eg = (h_final - h_initial) / h_initial × 100',
    defaultBreaks: [0.5, 2, 5, 10],
    defaultPalette: 'Reds',
    minEssaisField: 'n_essais_gonflement'
  },
  {
    id: 'eg_max',
    label: 'Eg maximum',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement maximal observé (pire cas)',
    defaultBreaks: [1, 3, 7, 12],
    defaultPalette: 'Reds',
    minEssaisField: 'n_essais_gonflement'
  },
  {
    id: 'eg_min',
    label: 'Eg minimum',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement minimal observé',
    defaultPalette: 'Greens',
    minEssaisField: 'n_essais_gonflement'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACITÉ / PORTANCE (PROCTOR)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gamma_d_max_avg',
    label: 'γd,max moyen',
    unit: 't/m³',
    category: 'proctor',
    description: 'Densité sèche maximale moyenne au Proctor',
    formula: 'γd,max = masse sèche / volume à compactage optimal',
    defaultBreaks: [1.6, 1.8, 2.0, 2.2],
    defaultPalette: 'Oranges',
    minEssaisField: 'n_essais_proctor'
  },
  {
    id: 'w_opt_avg',
    label: 'wopt moyenne',
    unit: '%',
    category: 'proctor',
    description: 'Teneur en eau optimale moyenne pour compactage',
    formula: 'wopt = teneur en eau à γd,max',
    defaultBreaks: [8, 12, 18, 25],
    defaultPalette: 'Blues',
    minEssaisField: 'n_essais_proctor'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GRANULOMÉTRIE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'passant_80um_avg',
    label: '% Passant 80µm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm)',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'BrBG',
    minEssaisField: 'n_essais_granulo'
  },
  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXTE GÉOGRAPHIQUE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'altitude_mean',
    label: 'Altitude moyenne (DSM COP30)',
    unit: 'm',
    category: 'contexte',
    description: 'Altitude moyenne par maille issue du Modèle Numérique de Surface Copernicus DEM GLO-30',
    defaultBreaks: [100, 200, 300, 400, 500],
    defaultPalette: 'Terrain'
  },

  {
    id: 'passant_2mm_avg',
    label: '% Passant 2mm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm)',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_20mm_avg',
    label: '% Passant 20mm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction graviers + fines (< 20mm)',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  }
]

// ============================================================================
// TYPES DE CARTE - Bloc B
// ============================================================================

export type MapType = 'choropleth' | 'bubble' | 'binary' | 'heatmap'

export interface MapTypeConfig {
  id: MapType
  label: string
  description: string
  icon: string
}

export const MAP_TYPES: MapTypeConfig[] = [
  {
    id: 'choropleth',
    label: 'Choroplèthe (aplats)',
    description: 'Coloration des mailles selon la valeur',
    icon: '🗺️'
  },
  {
    id: 'bubble',
    label: 'Cercles proportionnels',
    description: 'Taille des cercles proportionnelle à la valeur',
    icon: '⭕'
  },
  {
    id: 'binary',
    label: 'Binaire (présence/absence)',
    description: 'Zones couvertes vs non couvertes',
    icon: '✓✗'
  },
  {
    id: 'heatmap',
    label: 'Carte de chaleur (heatmap)',
    description: 'Densité de chaleur continue',
    icon: '🔥'
  }
]

// ============================================================================
// MÉTHODES DE CLASSIFICATION
// ============================================================================

export type ClassificationMethod = 'quantiles' | 'equal_interval' | 'jenks' | 'manual'

export interface ClassificationConfig {
  id: ClassificationMethod
  label: string
  description: string
}

export const CLASSIFICATION_METHODS: ClassificationConfig[] = [
  {
    id: 'quantiles',
    label: 'Quantiles',
    description: 'Même nombre de mailles par classe (défaut, lisible)'
  },
  {
    id: 'equal_interval',
    label: 'Intervalles égaux',
    description: 'Même amplitude pour chaque classe'
  },
  {
    id: 'jenks',
    label: 'Seuils naturels (Jenks)',
    description: 'Minimise la variance intra-classe'
  },
  {
    id: 'manual',
    label: 'Seuils manuels',
    description: 'Définir ses propres seuils'
  }
]

// ============================================================================
// CONFIGURATION COMPLÈTE
// ============================================================================

export interface ThematicMapConfig {
  id?: string
  name: string
  
  // Bloc A - Objectif
  objectif: ObjectifMetier
  parameter: string
  
  // Bloc B - Style
  type: MapType
  classification: {
    method: ClassificationMethod
    n_classes: number
    manual_breaks?: number[]
    binary_threshold?: number  // Seuil pour carte binaire
  }
  style: {
    palette: string
    opacity: number
    stroke_width: number
    stroke_color: string
  }
  
  // Bloc C - Filtres
  filters: {
    // Spatial
    adm1?: string
    adm2?: string
    adm3?: string
    bbox?: [number, number, number, number]
    grid?: '2km' | '28km' | 'combined'  // Niveau de grille (ajouté pour support 28km + mode combiné UI)
    
    // Instrumentation
    min_sondages: number
    min_essais_param?: number
    exclude_no_data: boolean
    exclude_outside_adm?: boolean  // Exclure mailles hors sélection ADM
    
    // Géotechnique (avancé)
    depth_min?: number
    depth_max?: number
    year_min?: number
    year_max?: number
  }
  
  // Couches de contexte
  contextLayers?: {
    showGeologie: boolean
    showPedologie: boolean
    showRisqueGonflement: boolean
  }
}

// ============================================================================
// RÉPONSES API
// ============================================================================

export interface ThematicData {
  type: string
  features: GeoJSON.Feature[]
  statistics: Statistics
  metadata: ResponseMetadata
}

export interface Statistics {
  min: number
  max: number
  mean: number
  median: number
  stddev: number
  variance: number
  quantiles: {
    q25: number
    q50: number
    q75: number
    q90: number
    q95: number
  }
  count: number
  null_count: number
  // Champs enrichis (optionnels, depuis API v3.1)
  count_total?: number
  sum?: number
  parent_context?: {
    level: string
    parent_name: string
    parent_sum: number
    parent_cells: number
  }
}

export interface ResponseMetadata {
  parameter: string
  parameter_label: string
  unit: string
  category: string
  generated_at: string
  filters_applied: {
    grid?: '2km' | '28km'
    bbox?: [number, number, number, number]
    adm1?: string
    adm2?: string
    adm3?: string
    min_sondages?: number
  }
}

export interface Classification {
  breaks: number[]
  colors: string[]
  labels: string[]
  method: string
  n_classes: number
}

// ============================================================================
// TYPES EXPORT
// ============================================================================

export interface ThematicClassBreak {
  index: number        // 0,1,2,...
  min: number | null   // borne inf (null => "-∞")
  max: number | null   // borne sup (null => "+∞")
  color: string        // "#RRGGBB"
  label: string        // "2.5 - 6.0"
}

export interface ThematicExportFilters {
  adm1?: string | null
  adm2?: string | null
  adm3?: string | null
  minSondages?: number | null
}

export interface ThematicExportState {
  parameterId: string       // "vbs_avg"
  parameterLabel: string    // "VBS moyen"
  unit: string              // "g/100g"
  mapType: 'choropleth' | 'proportional' | 'binary'
  classes: ThematicClassBreak[]
  filters: ThematicExportFilters
  stats: {
    min: number
    max: number
    mean: number
    median: number
  } | null
  features?: any[]          // Features GeoJSON pour les statistiques d'export
  totalCellCount?: number   // Nombre total de mailles dans la zone (pour calcul couverture)
  /** Statistiques enrichies depuis l'API (pour export) */
  apiStats?: {
    count: number
    count_total?: number
    null_count?: number
    sum?: number
    min?: number
    max?: number
    mean?: number
    median?: number
    stddev?: number
    parent_context?: {
      level: string
      parent_name: string
      parent_sum: number
      parent_cells: number
    }
  }
}

export interface SavedConfig {
  id: string
  name: string
  description?: string
  objectif: ObjectifMetier
  parameter: string
  config: ThematicMapConfig
  is_public: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================================
// PALETTES DE COULEURS
// ============================================================================

/**
 * Mapping centralisé thématique → palette recommandée
 * Source de vérité unique pour cartes ET graphes
 * 
 * Critères de sélection:
 * - Compatibilité impression (éviter palettes trop saturées)
 * - Accessibilité daltonisme (Viridis, Cividis préférés)
 * - Cohérence sémantique (rouge=risque, bleu=eau, vert=densité)
 */
export interface ThematicPaletteConfig {
  palette: string
  reversed?: boolean
  diverging?: boolean
  midpoint?: number
  /** Description pour l'UI */
  rationale?: string
}

export const THEMATIC_PALETTE_MAP: Record<string, ThematicPaletteConfig> = {
  // Couverture & instrumentation
  'n_sondages': { palette: 'Greens', rationale: 'Densité de données (vert=bien couvert)' },
  'n_echantillons': { palette: 'Greens', rationale: 'Densité de données' },
  'n_essais_total': { palette: 'Greens', rationale: 'Densité de données' },
  
  // Argilosité / plasticité - palettes chaudes (risque argileux)
  'vbs_avg': { palette: 'YlOrRd', rationale: 'Risque argileux croissant (jaune→rouge)' },
  'ip_avg': { palette: 'PuRd', rationale: 'Plasticité (mauve/rose)' },
  'wl_avg': { palette: 'PuBu', rationale: 'Limite de liquidité (bleu)' },
  'wp_avg': { palette: 'BuPu', rationale: 'Limite de plasticité (violet)' },
  
  // Gonflement - palette bleue (eau/gonflement)
  'eg_avg': { palette: 'Blues', rationale: 'Gonflement (bleu=eau)' },
  'eg_max': { palette: 'Blues', rationale: 'Gonflement maximal' },
  'eg_min': { palette: 'Greens', reversed: true, rationale: 'Gonflement minimal (vert=faible risque)' },
  
  // Compacité / Proctor
  'gamma_d_max_avg': { palette: 'Oranges', rationale: 'Compacité (orange)' },
  'w_opt_avg': { palette: 'Blues', rationale: 'Teneur en eau optimale' },
  
  // Granulométrie - palette divergente (fines vs grossiers)
  'passant_80um_avg': { palette: 'BrBG', diverging: true, midpoint: 50, rationale: 'Fines vs sables (divergent)' },
  'passant_2mm_avg': { palette: 'YlGnBu', rationale: 'Granulométrie' },
  'passant_20mm_avg': { palette: 'YlGnBu', rationale: 'Granulométrie' }
}

/**
 * Récupère la palette recommandée pour un paramètre
 * Fallback sur 'Blues' si non défini
 */
export function getRecommendedPalette(parameterId: string): ThematicPaletteConfig {
  return THEMATIC_PALETTE_MAP[parameterId] || { palette: 'Blues' }
}

export interface PaletteOption {
  value: string
  label: string
  type: 'sequential' | 'diverging'
  colors: string[]  // Preview colors
  /** Accessible aux daltoniens */
  colorblindSafe?: boolean
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  // Séquentielles - Monochrome
  { 
    value: 'Blues', 
    label: 'Blues', 
    type: 'sequential',
    colors: ['#f7fbff', '#6baed6', '#08306b']
  },
  { 
    value: 'Greens', 
    label: 'Greens', 
    type: 'sequential',
    colors: ['#f7fcf5', '#74c476', '#00441b']
  },
  { 
    value: 'Reds', 
    label: 'Reds', 
    type: 'sequential',
    colors: ['#fff5f0', '#fb6a4a', '#67000d']
  },
  { 
    value: 'Oranges', 
    label: 'Oranges', 
    type: 'sequential',
    colors: ['#fff5eb', '#fd8d3c', '#7f2704']
  },
  { 
    value: 'Purples', 
    label: 'Purples', 
    type: 'sequential',
    colors: ['#fcfbfd', '#9e9ac8', '#3f007d']
  },
  
  // Séquentielles - Multi-teintes
  { 
    value: 'YlOrRd', 
    label: 'YlOrRd', 
    type: 'sequential',
    colors: ['#ffffcc', '#fd8d3c', '#800026']
  },
  { 
    value: 'YlGnBu', 
    label: 'YlGnBu', 
    type: 'sequential',
    colors: ['#ffffd9', '#41b6c4', '#081d58']
  },
  { 
    value: 'PuBu', 
    label: 'PuBu', 
    type: 'sequential',
    colors: ['#fff7fb', '#67a9cf', '#023858']
  },
  { 
    value: 'BuPu', 
    label: 'BuPu', 
    type: 'sequential',
    colors: ['#f7fcfd', '#8c96c6', '#4d004b']
  },
  { 
    value: 'PuRd', 
    label: 'PuRd', 
    type: 'sequential',
    colors: ['#f7f4f9', '#df65b0', '#67001f']
  },
  
  // Séquentielles - Accessibles daltonisme
  { 
    value: 'Viridis', 
    label: 'Viridis ♿', 
    type: 'sequential',
    colors: ['#440154', '#21918c', '#fde725'],
    colorblindSafe: true
  },
  { 
    value: 'Cividis', 
    label: 'Cividis ♿', 
    type: 'sequential',
    colors: ['#00204d', '#7c7b78', '#ffea46'],
    colorblindSafe: true
  },
  
  // Divergentes
  { 
    value: 'RdYlGn', 
    label: 'RdYlGn', 
    type: 'diverging',
    colors: ['#d73027', '#ffffbf', '#1a9850']
  },
  { 
    value: 'RdBu', 
    label: 'RdBu', 
    type: 'diverging',
    colors: ['#b2182b', '#f7f7f7', '#2166ac']
  },
  { 
    value: 'BrBG', 
    label: 'BrBG', 
    type: 'diverging',
    colors: ['#8c510a', '#f5f5f5', '#01665e']
  },
  { 
    value: 'PuOr', 
    label: 'PuOr', 
    type: 'diverging',
    colors: ['#7f3b08', '#f7f7f7', '#2d004b']
  }
]

// ============================================================================
// RÉGIONS ADM
// ============================================================================

export const ADM1_OPTIONS = [
  { value: '', label: '— toutes régions —' },
  { value: 'Maritime', label: 'Maritime' },
  { value: 'Plateaux', label: 'Plateaux' },
  { value: 'Centrale', label: 'Centrale' },
  { value: 'Kara', label: 'Kara' },
  { value: 'Savanes', label: 'Savanes' }
]

// ============================================================================
// HELPERS
// ============================================================================

export function getParameterById(id: string): ThematicParameter | undefined {
  return THEMATIC_PARAMETERS.find(p => p.id === id)
}

export function getObjectifById(id: ObjectifMetier): ObjectifConfig | undefined {
  return OBJECTIFS_METIER.find(o => o.id === id)
}

export function getParametersForObjectif(objectifId: ObjectifMetier): ThematicParameter[] {
  const objectif = getObjectifById(objectifId)
  if (!objectif) return THEMATIC_PARAMETERS
  
  if (objectifId === 'personnalise') {
    return THEMATIC_PARAMETERS
  }
  
  return THEMATIC_PARAMETERS.filter(p => objectif.parameters.includes(p.id))
}

export function getDefaultConfig(): ThematicMapConfig {
  return {
    name: 'Nouvelle carte',
    objectif: 'couverture',
    parameter: 'n_sondages',
    type: 'choropleth',
    classification: {
      method: 'quantiles',
      n_classes: 5
    },
    style: {
      palette: 'Blues',
      opacity: 0.7,
      stroke_width: 1,
      stroke_color: '#333333'
    },
    filters: {
      min_sondages: 1,
      exclude_no_data: true
    },
    contextLayers: {
      showGeologie: false,
      showPedologie: false,
      showRisqueGonflement: false
    }
  }
}
