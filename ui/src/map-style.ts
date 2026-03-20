/**
 * map-style.ts - Styles centralisés pour toutes les cartes Leaflet
 * 
 * Ce module centralise tous les styles de mailles, ADM3, et sélections
 * pour garantir la cohérence entre la carte Home et la page Sondages.
 * 
 * @version 3.4.0
 */

import L from 'leaflet';

// =============================================================================
// COULEURS DE BASE
// =============================================================================

export const COLORS: Record<string, string> = {
  // Mailles selon type de localisation
  GRID_NO_DATA: '#cfd8e3',           // Gris - mailles sans données
  GRID_EXACT: '#51cf66',             // Vert - sondages GPS exact
  GRID_RANDOM: '#4c6ef5',            // Bleu - sondages position aléatoire
  GRID_NO_GEOM: '#e85d68',           // Rouge - données sans géométrie
  GRID_ASSIGNED: '#a855f7',          // Violet - maille attribuée à un étudiant (Colab)
  
  // Contours
  GRID_BORDER_NO_DATA: '#6b778c55',  // Gris transparent pour sans données
  
  // Sélection et survol
  HOVER: '#e85d68',                  // Rouge pour survol
  SELECTED_ADM3: '#00ff66',          // Vert vif pour ADM3 sélectionné
  SELECTED_CELL: '#ffd600',          // Jaune pour maille sélectionnée
  
  // ADM3
  ADM3_BORDER: '#4c6ef5',            // Bleu pour contours ADM3
};

// =============================================================================
// OPACITÉS
// =============================================================================

export const OPACITY: Record<string, number> = {
  // Remplissage mailles (augmenté pour meilleure lisibilité)
  GRID_WITH_DATA: 0.60,              // Augmenté pour aligner la lisibilité (bleu/violet/vert)
  GRID_NO_DATA: 0.0,                 // Transparent (au lieu de 0.08)
  
  // Sélection
  SELECTED_ADM3: 0.15,
  SELECTED_CELL: 0.3,
  
  // Survol
  HOVER: 0.5,
};

// =============================================================================
// POIDS DES CONTOURS
// =============================================================================

export const WEIGHT: Record<string, number> = {
  // Contours mailles (augmenté pour meilleure visibilité)
  GRID_WITH_DATA: 1.5,               // Augmenté de 1 à 1.5
  GRID_NO_DATA: 1.2,                 // Augmenté de 0.8 à 1.2 (contour visible sur transparent)
  
  // Sélection
  SELECTED_ADM3: 2,
  SELECTED_CELL: 3,
  
  // Survol
  HOVER: 2,
  
  // ADM3
  ADM3_DEFAULT: 1.5,
};

// =============================================================================
// STYLES PRÉDÉFINIS
// =============================================================================

/**
 * Style par défaut pour mailles sans données
 */
export const GRID_NO_DATA_STYLE: L.PathOptions = {
  color: COLORS.GRID_BORDER_NO_DATA,
  weight: WEIGHT.GRID_NO_DATA,
  fillColor: COLORS.GRID_NO_DATA,
  fillOpacity: OPACITY.GRID_NO_DATA,
};

/**
 * Style pour mailles avec sondages GPS exact (vert)
 */
export const GRID_EXACT_STYLE: L.PathOptions = {
  color: COLORS.GRID_EXACT,
  weight: WEIGHT.GRID_WITH_DATA,
  fillColor: COLORS.GRID_EXACT,
  fillOpacity: OPACITY.GRID_WITH_DATA,
};

/**
 * Style pour mailles avec sondages position aléatoire (bleu)
 */
export const GRID_RANDOM_STYLE: L.PathOptions = {
  color: COLORS.GRID_RANDOM,
  weight: WEIGHT.GRID_WITH_DATA,
  fillColor: COLORS.GRID_RANDOM,
  fillOpacity: OPACITY.GRID_WITH_DATA,
};

/**
 * Style pour mailles avec données mais sans géométrie (rouge)
 */
export const GRID_NO_GEOM_STYLE: L.PathOptions = {
  color: COLORS.GRID_NO_GEOM,
  weight: WEIGHT.GRID_WITH_DATA,
  fillColor: COLORS.GRID_NO_GEOM,
  fillOpacity: OPACITY.GRID_WITH_DATA,
};

/**
 * Style de survol (hover)
 */
export const GRID_HOVER_STYLE: L.PathOptions = {
  color: COLORS.HOVER,
  weight: WEIGHT.HOVER,
  fillOpacity: OPACITY.HOVER,
};

/**
 * Style pour ADM3 sélectionné
 */
export const ADM3_SELECTED_STYLE: L.PathOptions = {
  color: COLORS.SELECTED_ADM3,
  weight: WEIGHT.SELECTED,
  fillColor: COLORS.SELECTED_ADM3,
  fillOpacity: OPACITY.SELECTED_ADM3,
};

/**
 * Style pour maille sélectionnée
 */
export const CELL_SELECTED_STYLE: L.PathOptions = {
  color: COLORS.SELECTED_CELL,
  weight: WEIGHT.SELECTED,
  fillColor: COLORS.SELECTED_CELL,
  fillOpacity: OPACITY.SELECTED_CELL,
};

/**
 * Style par défaut pour ADM3 (transparent)
 */
export const ADM3_DEFAULT_STYLE: L.PathOptions = {
  color: COLORS.ADM3_BORDER,
  weight: WEIGHT.ADM3,
  fillColor: 'transparent',
  fillOpacity: 0,
};

// =============================================================================
// FONCTIONS DE STYLE DYNAMIQUE
// =============================================================================

/**
 * Calcule le style d'une maille en fonction de ses propriétés
 * COULEURS UNIFIÉES pour grilles 2km ET 28km:
 * - Gris: n_sondages = 0 (sans données)
 * - Vert: n_sondages_exact > n_sondages_random (exact dominant)
 * - Bleu: n_sondages_random > n_sondages_exact (random dominant)
 * 
 * @param feature - Feature GeoJSON de la maille
 * @param zoom - Niveau de zoom actuel (optionnel, pour poids dynamique)
 */
export function getGridFeatureStyle(feature: any, zoom?: number): L.PathOptions {
  const props = feature?.properties || {};
  
  // Propriétés disponibles dans l'API
  const nSondages = props.n_sondages || 0;
  const hasData = nSondages > 0 || !!props.has_data;
  const hasExact = !!props.has_exact_location;
  const hasRandom = !!props.has_random_location;
  const hasActiveMission = !!props.has_active_mission;
  const isAssigned = !!props.is_assigned;
  const isColabHighlighted = hasActiveMission || isAssigned;
  const isVisibleAsData = hasData || isColabHighlighted;
  
  // Calcul du poids dynamique selon le zoom
  const baseWeight = hasData ? WEIGHT.GRID_WITH_DATA : WEIGHT.GRID_NO_DATA;
  let weight = baseWeight;
  if (zoom !== undefined) {
    weight = zoom < 10 ? baseWeight : zoom < 12 ? baseWeight * 1.5 : baseWeight * 2;
  }
  
  // LOGIQUE COULEURS CORRIGÉE - Séparation claire hasActiveMission vs isAssigned
  // Règle: 
  // - Violet opaque SEULEMENT si hasActiveMission (mission active en cours)
  // - Gris clair avec bordure violet si isAssigned sans mission active
  // - Vert/Bleu/Gris selon données sinon
  
  let fillColor = COLORS.GRID_NO_DATA;
  let fillOpacity = OPACITY.GRID_NO_DATA;
  let strokeColor = COLORS.GRID_BORDER_NO_DATA;
  let strokeWeight = weight;
  
  // Priorité 1: Mission active → violet opaque
  if (hasActiveMission) {
    fillColor = COLORS.GRID_ASSIGNED;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_ASSIGNED;
    strokeWeight = Math.max(weight, 2);
  }
  // Priorité 2: Assignée sans mission active → gris clair, bordure violet
  else if (isAssigned) {
    fillColor = '#888888';  // Gris clair (PAS violet)
    fillOpacity = 0.15;      // Très léger fill
    strokeColor = COLORS.GRID_ASSIGNED;  // Bordure violet seulement
    strokeWeight = 2.5;
  }
  // Priorité 3: Données existantes
  else if (!hasData) {
    fillColor = COLORS.GRID_NO_DATA;
    fillOpacity = OPACITY.GRID_NO_DATA;
    strokeColor = COLORS.GRID_BORDER_NO_DATA;
  }
  else if (hasExact && !hasRandom) {
    fillColor = COLORS.GRID_EXACT;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_EXACT;
  }
  else if (hasRandom && !hasExact) {
    fillColor = COLORS.GRID_RANDOM;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_RANDOM;
  }
  else if (hasExact && hasRandom) {
    // Mix: priorité au vert (exact dominant)
    fillColor = COLORS.GRID_EXACT;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_EXACT;
  }
  
  return {
    color: strokeColor,
    weight: strokeWeight,
    fillColor,
    fillOpacity,
  };
}

/**
 * Retourne le style de survol pour une maille
 * @param feature - Feature GeoJSON de la maille
 */
export function getGridHoverStyle(feature: any): L.PathOptions {
  return {
    ...GRID_HOVER_STYLE,
    // Conserver la couleur de remplissage originale mais augmenter l'opacité
    fillOpacity: OPACITY.HOVER,
  };
}

// =============================================================================
// LÉGENDE
// =============================================================================

export interface LegendItem {
  label: string;
  color: string;
  description?: string;
}

export const GRID_LEGEND: LegendItem[] = [
  { label: 'Attribuée (Colab)', color: COLORS.GRID_ASSIGNED, description: 'Maille attribuée à un étudiant/opérateur' },
  { label: 'GPS exact', color: COLORS.GRID_EXACT, description: 'Sondages avec coordonnées GPS précises' },
  { label: 'Position aléatoire', color: COLORS.GRID_RANDOM, description: 'Sondages positionnés aléatoirement dans ADM3' },
  { label: 'Sans géométrie', color: COLORS.GRID_NO_GEOM, description: 'Données sans position géographique' },
  { label: 'Sans données', color: COLORS.GRID_NO_DATA, description: 'Mailles sans sondages' },
];

// =============================================================================
// EXPORT PAR DÉFAUT
// =============================================================================

export default {
  COLORS,
  OPACITY,
  WEIGHT,
  GRID_NO_DATA_STYLE,
  GRID_EXACT_STYLE,
  GRID_RANDOM_STYLE,
  GRID_NO_GEOM_STYLE,
  GRID_HOVER_STYLE,
  ADM3_SELECTED_STYLE,
  CELL_SELECTED_STYLE,
  ADM3_DEFAULT_STYLE,
  getGridFeatureStyle,
  getGridHoverStyle,
  GRID_LEGEND,
};
