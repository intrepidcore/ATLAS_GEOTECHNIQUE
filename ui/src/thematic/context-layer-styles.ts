/**
 * context-layer-styles.ts - Styles QGIS pour couches contextuelles
 * Couleurs identiques à la symbologie QGIS pour cohérence visuelle
 */

// =============================================================================
// RISQUE DE GONFLEMENT - 5 classes avec gradient jaune → orange → rouge
// =============================================================================

export const RISK_COLORS: Record<string, string> = {
  'Très faible': '#fff5cc',
  'Faible': '#ffe699',
  'Moyen': '#ffcc66',
  'Élevé': '#ff9933',
  'Très élevé': '#ff6600',
  // Variantes possibles
  'Risque Très Faible': '#fff5cc',
  'Risque Faible': '#ffe699',
  'Risque Moyen': '#ffcc66',
  'Risque Élevé': '#ff9933',
  'Risque Très Élevé': '#ff6600',
};

// =============================================================================
// UNITÉS GÉOLOGIQUES - 15+ unités avec couleurs distinctes
// =============================================================================

export const GEOLOGIE_COLORS: Record<string, string> = {
  // Chaîne Dahomeyides
  'Chaîne Dahomeyides Grès de Bassar': '#8B4513',
  'Chaîne Dahomeyides Schistes': '#A0522D',
  'Chaîne Dahomeyides Quartzites': '#D2691E',
  
  // Mésocénozoïque
  'Mésocénozoïque Alluvionnaires': '#F4A460',
  'Mésocénozoïque Sables': '#FFE4B5',
  'Mésocénozoïque Argiles': '#DEB887',
  
  // Socle Précambrien
  'Socle Précambrien Granites': '#9370DB',
  'Socle Précambrien Gneiss': '#8A2BE2',
  'Socle Précambrien Migmatites': '#9932CC',
  
  // Formations superficielles
  'Formations superficielles': '#90EE90',
  'Alluvions récentes': '#98FB98',
  'Colluvions': '#ADFF2F',
  
  // Autres
  'Formations volcano-sédimentaires': '#FF6347',
  'Formations détritiques': '#CD853F',
  'Non classé': '#CCCCCC',
};

// =============================================================================
// UNITÉS PÉDOLOGIQUES - Types de sols avec couleurs pastels
// =============================================================================

export const PEDOLOGIE_COLORS: Record<string, string> = {
  // Sols ferrallitiques
  'Sols ferrallitiques non indurés': '#FFB6C1',
  'Sols ferrallitiques indurés': '#FF69B4',
  'Sols ferrallitiques remaniés': '#FF1493',
  
  // Sols ferrugineux
  'Sols ferrugineux tropicaux': '#F0E68C',
  'Sols ferrugineux lessivés': '#EEE8AA',
  'Sols ferrugineux non lessivés': '#FAFAD2',
  
  // Sols hydromorphes
  'Sols hydromorphes': '#87CEEB',
  'Sols hydromorphes à gley': '#4682B4',
  'Sols hydromorphes à pseudogley': '#5F9EA0',
  
  // Sols peu évolués
  'Sols peu évolués': '#D3D3D3',
  'Sols d\'apport alluvial': '#B0C4DE',
  'Sols d\'érosion': '#A9A9A9',
  
  // Vertisols
  'Vertisols': '#8FBC8F',
  'Vertisols topomorphes': '#6B8E23',
  
  // Autres
  'Sols bruns': '#CD853F',
  'Non classé': '#CCCCCC',
};

// =============================================================================
// LÉGENDES POUR PANNEAUX UI
// =============================================================================

export interface LegendItem {
  label: string;
  color: string;
  description?: string;
}

export const RISK_LEGEND: LegendItem[] = [
  { label: 'Très faible', color: RISK_COLORS['Très faible'], description: 'Risque de gonflement très faible' },
  { label: 'Faible', color: RISK_COLORS['Faible'], description: 'Risque de gonflement faible' },
  { label: 'Moyen', color: RISK_COLORS['Moyen'], description: 'Risque de gonflement moyen' },
  { label: 'Élevé', color: RISK_COLORS['Élevé'], description: 'Risque de gonflement élevé' },
  { label: 'Très élevé', color: RISK_COLORS['Très élevé'], description: 'Risque de gonflement très élevé' },
];

export const GEOLOGIE_LEGEND: LegendItem[] = Object.entries(GEOLOGIE_COLORS)
  .filter(([key]) => key !== 'Non classé')
  .map(([label, color]) => ({ label, color }));

export const PEDOLOGIE_LEGEND: LegendItem[] = Object.entries(PEDOLOGIE_COLORS)
  .filter(([key]) => key !== 'Non classé')
  .map(([label, color]) => ({ label, color }));

// =============================================================================
// FONCTIONS HELPER
// =============================================================================

/**
 * Obtenir la couleur pour une unité géologique
 */
export function getGeologieColor(unite: string): string {
  return GEOLOGIE_COLORS[unite] || GEOLOGIE_COLORS['Non classé'];
}

/**
 * Obtenir la couleur pour une unité pédologique
 */
export function getPedologieColor(unite: string): string {
  return PEDOLOGIE_COLORS[unite] || PEDOLOGIE_COLORS['Non classé'];
}

/**
 * Obtenir la couleur pour une classe de risque
 */
export function getRiskColor(classe: string): string {
  return RISK_COLORS[classe] || RISK_COLORS['Moyen'];
}

export default {
  RISK_COLORS,
  GEOLOGIE_COLORS,
  PEDOLOGIE_COLORS,
  RISK_LEGEND,
  GEOLOGIE_LEGEND,
  PEDOLOGIE_LEGEND,
  getGeologieColor,
  getPedologieColor,
  getRiskColor,
};
