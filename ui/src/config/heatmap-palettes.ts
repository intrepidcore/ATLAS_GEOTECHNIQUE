/**
 * Configuration centralisée des palettes heatmap
 * Utilisé par leaflet.heat ET par les légendes
 */

export interface HeatmapGradient {
  [position: string]: string  // position: 0.0 à 1.0, color: hex
}

/**
 * Palette par défaut pour heatmap de paramètres géotechniques
 * Gradient plus saturé que leaflet.heat par défaut
 * 
 * Progression: Bleu (faible) → Cyan → Vert → Jaune → Orange → Rouge (fort)
 */
export const DEFAULT_HEATMAP_GRADIENT: HeatmapGradient = {
  '0.0': '#0000ff',   // Bleu pur
  '0.2': '#00ffff',   // Cyan
  '0.4': '#00ff00',   // Vert
  '0.6': '#ffff00',   // Jaune
  '0.8': '#ff8000',   // Orange
  '1.0': '#ff0000'    // Rouge pur
}

/**
 * Palette pour VBS (Valeur au Bleu de Méthylène)
 * Jaune (faible argilosité) → Orange → Rouge (forte argilosité)
 */
export const VBS_HEATMAP_GRADIENT: HeatmapGradient = {
  '0.0': '#ffffcc',   // Jaune très pâle
  '0.2': '#ffeda0',   // Jaune pâle
  '0.4': '#fed976',   // Jaune
  '0.5': '#feb24c',   // Orange clair
  '0.6': '#fd8d3c',   // Orange
  '0.7': '#fc4e2a',   // Orange-rouge
  '0.8': '#e31a1c',   // Rouge
  '0.9': '#bd0026',   // Rouge foncé
  '1.0': '#800026'    // Rouge très foncé
}

/**
 * Palette pour gonflement (EG)
 * Bleu clair → Bleu foncé
 */
export const EG_HEATMAP_GRADIENT: HeatmapGradient = {
  '0.0': '#f7fbff',   // Bleu très pâle
  '0.2': '#deebf7',   // Bleu pâle
  '0.4': '#c6dbef',   // Bleu clair
  '0.5': '#9ecae1',   // Bleu moyen
  '0.6': '#6baed6',   // Bleu
  '0.7': '#4292c6',   // Bleu foncé
  '0.8': '#2171b5',   // Bleu très foncé
  '0.9': '#08519c',   // Bleu profond
  '1.0': '#08306b'    // Bleu nuit
}

/**
 * Palette pour densité de sondages
 * Vert clair → Vert foncé
 */
export const DENSITY_HEATMAP_GRADIENT: HeatmapGradient = {
  '0.0': '#f7fcf5',   // Vert très pâle
  '0.2': '#e5f5e0',   // Vert pâle
  '0.4': '#c7e9c0',   // Vert clair
  '0.5': '#a1d99b',   // Vert moyen
  '0.6': '#74c476',   // Vert
  '0.7': '#41ab5d',   // Vert foncé
  '0.8': '#238b45',   // Vert très foncé
  '0.9': '#006d2c',   // Vert profond
  '1.0': '#00441b'    // Vert nuit
}

/**
 * Sélectionne la palette appropriée selon le paramètre
 */
export function getHeatmapGradient(parameterId: string): HeatmapGradient {
  if (parameterId.includes('vbs') || parameterId.includes('ip')) {
    return VBS_HEATMAP_GRADIENT
  }
  if (parameterId.includes('eg') || parameterId.includes('gonflement')) {
    return EG_HEATMAP_GRADIENT
  }
  if (parameterId.includes('sondage') || parameterId.includes('echantillon')) {
    return DENSITY_HEATMAP_GRADIENT
  }
  return DEFAULT_HEATMAP_GRADIENT
}

/**
 * Convertit un gradient en string CSS linear-gradient
 */
export function gradientToCSS(gradient: HeatmapGradient): string {
  const stops = Object.entries(gradient)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([position, color]) => {
      const pct = (parseFloat(position) * 100).toFixed(1)
      return `${color} ${pct}%`
    })
    .join(', ')
  
  return `linear-gradient(to right, ${stops})`
}

/**
 * Paramètres de rendu heatmap optimisés pour visibilité
 */
export interface HeatmapRenderOptions {
  radius: number
  blur: number
  maxZoom: number
  minOpacity: number
  gradient: HeatmapGradient
  /** Gamma pour courbe de normalisation (< 1 = plus saturé) */
  gamma?: number
  /** Utiliser percentile au lieu de max absolu */
  usePercentile?: boolean
  /** Percentile à utiliser (ex: 90 pour P90) */
  percentile?: number
}

/**
 * Options par défaut pour heatmap
 */
export const DEFAULT_HEATMAP_OPTIONS: HeatmapRenderOptions = {
  radius: 30,
  blur: 20,
  maxZoom: 12,
  minOpacity: 0.3,
  gradient: DEFAULT_HEATMAP_GRADIENT,
  gamma: 0.6,           // Courbe gamma pour booster contraste
  usePercentile: true,
  percentile: 90        // P90 pour éviter que les outliers écrasent tout
}

/**
 * Options spécifiques pour VBS (plus de contraste)
 */
export const VBS_HEATMAP_OPTIONS: HeatmapRenderOptions = {
  ...DEFAULT_HEATMAP_OPTIONS,
  gradient: VBS_HEATMAP_GRADIENT,
  gamma: 0.5,           // Encore plus de contraste
  radius: 35,
  blur: 25
}

/**
 * Options spécifiques pour densité (rayon plus large)
 */
export const DENSITY_HEATMAP_OPTIONS: HeatmapRenderOptions = {
  ...DEFAULT_HEATMAP_OPTIONS,
  gradient: DENSITY_HEATMAP_GRADIENT,
  gamma: 0.7,
  radius: 40,
  blur: 30
}

/**
 * Sélectionne les options appropriées selon le paramètre
 */
export function getHeatmapOptions(parameterId: string): HeatmapRenderOptions {
  if (parameterId.includes('vbs') || parameterId.includes('ip')) {
    return VBS_HEATMAP_OPTIONS
  }
  if (parameterId.includes('sondage') || parameterId.includes('echantillon')) {
    return DENSITY_HEATMAP_OPTIONS
  }
  return DEFAULT_HEATMAP_OPTIONS
}
