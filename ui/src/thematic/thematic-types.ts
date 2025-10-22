// Types et interfaces pour les cartes thématiques

export interface ThematicParameter {
  id: string
  label: string
  unit: string
  category: 'density' | 'granulo' | 'atterberg' | 'vbs' | 'proctor' | 'gonflement'
  description: string
  defaultBreaks?: number[]
  defaultPalette?: string
}

export const THEMATIC_PARAMETERS: ThematicParameter[] = [
  // Densité et couverture
  {
    id: 'n_sondages',
    label: 'Nombre de sondages',
    unit: '',
    category: 'density',
    description: 'Densité de sondages par maille',
    defaultPalette: 'Blues'
  },
  {
    id: 'n_essais_geo',
    label: "Nombre d'essais géotechniques",
    unit: '',
    category: 'density',
    description: 'Nombre total d\'essais géotechniques par maille',
    defaultPalette: 'Blues'
  },
  
  // Granulométrie
  {
    id: 'passant_80um_avg',
    label: '% Passant 80µm (moyen)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm)',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'Greens'
  },
  {
    id: 'passant_2mm_avg',
    label: '% Passant 2mm (moyen)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm)',
    defaultPalette: 'Greens'
  },
  
  // Atterberg
  {
    id: 'wl_avg',
    label: 'Limite de liquidité WL (moyenne)',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition plastique → liquide',
    defaultPalette: 'Blues'
  },
  {
    id: 'wp_avg',
    label: 'Limite de plasticité WP (moyenne)',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition solide → plastique',
    defaultPalette: 'Blues'
  },
  {
    id: 'ip_avg',
    label: 'Indice de plasticité IP (moyen)',
    unit: '%',
    category: 'atterberg',
    description: 'IP = WL - WP, caractérise la plasticité du sol',
    defaultBreaks: [12, 25, 40],
    defaultPalette: 'RdYlGn'
  },
  {
    id: 'ip_stddev',
    label: 'Écart-type IP',
    unit: '%',
    category: 'atterberg',
    description: 'Variabilité de l\'indice de plasticité',
    defaultPalette: 'Reds'
  },
  {
    id: 'ip_min',
    label: 'IP minimum',
    unit: '%',
    category: 'atterberg',
    description: 'Valeur minimale d\'IP observée',
    defaultPalette: 'Blues'
  },
  {
    id: 'ip_max',
    label: 'IP maximum',
    unit: '%',
    category: 'atterberg',
    description: 'Valeur maximale d\'IP observée',
    defaultPalette: 'Reds'
  },
  
  // VBS
  {
    id: 'vbs_avg',
    label: 'Valeur de Bleu VBS (moyenne)',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Mesure de l\'argilosité du sol',
    defaultBreaks: [0.1, 1.5, 2.5, 6, 8],
    defaultPalette: 'Blues'
  },
  {
    id: 'vbs_stddev',
    label: 'Écart-type VBS',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Variabilité de la valeur de bleu',
    defaultPalette: 'Reds'
  },
  {
    id: 'vbs_min',
    label: 'VBS minimum',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Valeur minimale de VBS observée',
    defaultPalette: 'Blues'
  },
  {
    id: 'vbs_max',
    label: 'VBS maximum',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Valeur maximale de VBS observée',
    defaultPalette: 'Reds'
  },
  
  // Proctor
  {
    id: 'gamma_d_max_avg',
    label: 'Densité sèche γd max (moyenne)',
    unit: 'kN/m³',
    category: 'proctor',
    description: 'Densité sèche maximale au Proctor',
    defaultBreaks: [16, 18, 20, 22],
    defaultPalette: 'RdYlGn'
  },
  {
    id: 'gamma_d_max_stddev',
    label: 'Écart-type γd max',
    unit: 'kN/m³',
    category: 'proctor',
    description: 'Variabilité de la densité sèche max',
    defaultPalette: 'Reds'
  },
  {
    id: 'w_opt_avg',
    label: 'Teneur en eau optimale wopt (moyenne)',
    unit: '%',
    category: 'proctor',
    description: 'Teneur en eau pour densité maximale',
    defaultBreaks: [8, 12, 18, 25],
    defaultPalette: 'Blues'
  },
  {
    id: 'w_opt_stddev',
    label: 'Écart-type wopt',
    unit: '%',
    category: 'proctor',
    description: 'Variabilité de la teneur en eau optimale',
    defaultPalette: 'Reds'
  },
  
  // Gonflement
  {
    id: 'eg_avg',
    label: 'Potentiel de gonflement eg (moyen)',
    unit: '%',
    category: 'gonflement',
    description: 'Risque de gonflement des argiles',
    defaultBreaks: [0.5, 2, 5, 10],
    defaultPalette: 'RdYlGn'
  },
  {
    id: 'eg_stddev',
    label: 'Écart-type eg',
    unit: '%',
    category: 'gonflement',
    description: 'Variabilité du potentiel de gonflement',
    defaultPalette: 'Reds'
  },
  {
    id: 'eg_min',
    label: 'eg minimum',
    unit: '%',
    category: 'gonflement',
    description: 'Valeur minimale de gonflement observée',
    defaultPalette: 'Greens'
  },
  {
    id: 'eg_max',
    label: 'eg maximum',
    unit: '%',
    category: 'gonflement',
    description: 'Valeur maximale de gonflement observée (risque)',
    defaultBreaks: [0.5, 2, 5, 10],
    defaultPalette: 'Reds'
  }
]

export type MapType = 'choropleth' | 'proportional' | 'comparative'
export type ClassificationMethod = 'quantiles' | 'equal_interval' | 'jenks' | 'custom'

export interface ThematicMapConfig {
  id?: string
  name: string
  type: MapType
  parameter: string
  classification?: {
    method: ClassificationMethod
    n_classes: number
    custom_breaks?: number[]
  }
  style: {
    palette: string
    opacity: number
    stroke_width?: number
    stroke_color?: string
  }
  filters: {
    adm1?: string
    adm2?: string
    adm3?: string
    min_sondages?: number
    bbox?: [number, number, number, number]
  }
}

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
}

export interface ResponseMetadata {
  parameter: string
  parameter_label: string
  unit: string
  category: string
  generated_at: string
  filters_applied: {
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

export interface SavedConfig {
  id: string
  name: string
  description?: string
  map_type: MapType
  parameter: string
  config: any
  is_public: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  density: 'Densité & Couverture',
  granulo: 'Granulométrie',
  atterberg: 'Limites d\'Atterberg',
  vbs: 'Bleu de Méthylène',
  proctor: 'Proctor',
  gonflement: 'Gonflement'
}

export const PALETTE_OPTIONS = [
  { value: 'Blues', label: 'Bleus', type: 'sequential' },
  { value: 'Greens', label: 'Verts', type: 'sequential' },
  { value: 'Reds', label: 'Rouges', type: 'sequential' },
  { value: 'RdYlGn', label: 'Rouge-Jaune-Vert', type: 'diverging' },
  { value: 'RdBu', label: 'Rouge-Bleu', type: 'diverging' },
  { value: 'Viridis', label: 'Viridis', type: 'sequential' }
]

export const ADM1_OPTIONS = [
  { value: '', label: 'Toutes les régions' },
  { value: 'Maritime', label: 'Maritime' },
  { value: 'Plateaux', label: 'Plateaux' },
  { value: 'Centrale', label: 'Centrale' },
  { value: 'Kara', label: 'Kara' },
  { value: 'Savanes', label: 'Savanes' }
]
