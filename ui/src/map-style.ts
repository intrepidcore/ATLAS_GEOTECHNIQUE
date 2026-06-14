/**
 * map-style.ts - Styles centralisés pour toutes les cartes Leaflet
 * 
 * Ce module centralise tous les styles de mailles, ADM3, et sélections
 * pour garantir la cohérence entre la carte Home et la page Sondages.
 * 
 * @version 3.4.0
 */

import L from 'leaflet';

type ZoneMailleMeta = {
  pct_intersection: number
  priorite_recherche: number
}

// ── Couleurs pastel par zone (from=clair, to=saturé) ──────────────────
export const ZONE_PASTEL_COLORS: Record<string, { from: string; to: string; hex: string }> = {
  DEPRESSION_LAMA_TG: { from: '#FDE68A', to: '#B45309', hex: '#F59E0B' },  // Ambre
  DEPRESSION_BADO_TG: { from: '#FCA5A5', to: '#B91C1C', hex: '#EF4444' },  // Rouge corail
  PLAINE_MONO_TG:     { from: '#6EE7B7', to: '#065F46', hex: '#10B981' },  // Vert émeraude
  PLAINE_OTI_TG:      { from: '#BAE6FD', to: '#0C4A6E', hex: '#0EA5E9' },  // Bleu ciel
  FOSSE_LIONS_TG:     { from: '#E9D5FF', to: '#5B21B6', hex: '#8B5CF6' },  // Violet lavande
}

// Zones par code → set de maille_code + meta
const zoneMailleCodes: Map<string, Set<string>> = new Map()
const zoneMailleMetaByCode: Map<string, Map<string, ZoneMailleMeta>> = new Map()
// Visibilité par zone (localStorage)
const zoneVisibility: Map<string, boolean> = new Map()

/** Priorité campagne reconnaissance (api-opti / AG) — rang 1 = plus prioritaire */
let campaignPriorityByCode: Map<string, number> = new Map();

/** Enregistre les mailles d'une zone (générique, toutes les 5 zones). */
export function setZoneMailleMetadata(
  zoneCode: string,
  mailles: Array<{ maille_code: string; pct_intersection?: number; priorite_recherche?: number }>
): void {
  const code = String(zoneCode || '').toUpperCase().trim()
  if (!code) return
  const metaMap = new Map<string, ZoneMailleMeta>()
  const codeSet = new Set<string>()
  for (const item of mailles || []) {
    const mc = String(item?.maille_code || '').trim()
    if (!mc) continue
    const pct = Number(item?.pct_intersection ?? 0)
    const pr = Number(item?.priorite_recherche ?? 4)
    metaMap.set(mc, {
      pct_intersection: Number.isFinite(pct) ? Math.max(pct, 0) : 0,
      priorite_recherche: Number.isFinite(pr) ? pr : 4,
    })
    codeSet.add(mc)
  }
  zoneMailleMetaByCode.set(code, metaMap)
  zoneMailleCodes.set(code, codeSet)
}

/** Contrôle la visibilité de la symbologie de bordure d'une zone. */
export function setZoneVisibility(zoneCode: string, visible: boolean): void {
  zoneVisibility.set(String(zoneCode || '').toUpperCase(), visible)
}

/** Rétrocompatibilité Lama (utilisé dans main.ts v1) */
export function setLamaMailleMetadata(
  mailles: Array<{ maille_code: string; pct_intersection?: number; priorite_recherche?: number }>
): void {
  setZoneMailleMetadata('DEPRESSION_LAMA_TG', mailles)
}

export function setLamaMailleCodes(codes: string[]): void {
  // rétrocompatiblité — délégué à setZoneMailleMetadata
}

export function setCampaignPriorities(
  entries: Array<{ maille_code: string; rank: number }> | null | undefined
): void {
  if (!entries?.length) {
    campaignPriorityByCode = new Map();
    return;
  }
  const m = new Map<string, number>();
  for (const e of entries) {
    const c = String(e?.maille_code || '').trim();
    if (!c) continue;
    const r = Number(e?.rank);
    m.set(c, Number.isFinite(r) && r > 0 ? Math.floor(r) : 1);
  }
  campaignPriorityByCode = m;
}

export function clearCampaignPriorities(): void {
  campaignPriorityByCode = new Map();
}


// =============================================================================
// COULEURS DE BASE
// =============================================================================

export const COLORS: Record<string, string> = {
  // Mailles selon type de localisation
  GRID_NO_DATA: '#cfd8e3',           // Gris - mailles sans données
  GRID_EXACT: '#51cf66',             // Vert - sondages GPS exact
  GRID_RANDOM: '#4c6ef5',            // Bleu - sondages position aléatoire
  GRID_NO_GEOM: '#e85d68',           // Rouge - données sans géométrie
  GRID_ASSIGNED: '#ff5fa2',          // Rose - maille attribuée à un étudiant (Colab)
  
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

// Petites helpers pour interpolations couleurs rapides (Leaflet styling)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

function interpolateZoneStroke(fromHex: string, toHex: string, pct: number): string {
  const t = clamp01((pct || 1) / 100)  // min pct=1 pour bordure visible même sur touch
  const f = hexToRgb(fromHex), to = hexToRgb(toHex)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  return rgbToHex(lerp(f.r, to.r), lerp(f.g, to.g), lerp(f.b, to.b))
}

/** Retourne {zoneCode, pct} de la zone la plus présente dans cette maille (pour la bordure). */
function getDominantZone(cellCode: string): { zoneCode: string; pct: number } | null {
  let best: { zoneCode: string; pct: number } | null = null
  for (const [zoneCode, codeSet] of zoneMailleCodes.entries()) {
    if (!codeSet.has(cellCode)) continue
    // Zone non visible → skip
    const vis = zoneVisibility.get(zoneCode)
    if (vis === false) continue
    const meta = zoneMailleMetaByCode.get(zoneCode)?.get(cellCode)
    const pct = meta?.pct_intersection ?? 1
    if (!best || pct > best.pct) best = { zoneCode, pct }
  }
  return best
}

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
  const cellCode =
    props.code ||
    props.maille_code ||
    props.code_m28 ||
    props.code_28km_lisible ||
    props.grid_code ||
    null;
  const dominantZone = cellCode ? getDominantZone(String(cellCode)) : null;
  
  // Calcul du poids dynamique selon le zoom
  const baseWeight = hasData ? WEIGHT.GRID_WITH_DATA : WEIGHT.GRID_NO_DATA;
  let weight = baseWeight;
  if (zoom !== undefined) {
    weight = zoom < 10 ? baseWeight : zoom < 12 ? baseWeight * 1.5 : baseWeight * 2;
  }
  
  // Règle métier/UX:
  // - Maille attribuée (isAssigned) visible en ROSE
  // - Opacité des mailles attribuées alignée avec les mailles avec données (bleu/vert)
  // - Mission active conserve une bordure plus marquée
  
  let fillColor = COLORS.GRID_NO_DATA;
  let fillOpacity = OPACITY.GRID_NO_DATA;
  let strokeColor = COLORS.GRID_BORDER_NO_DATA;
  let strokeWeight = weight;
  let strokeOpacity: number | undefined = undefined;
  
  // Priorité 1: Mission active → violet opaque
  if (hasActiveMission) {
    fillColor = COLORS.GRID_ASSIGNED;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_ASSIGNED;
    strokeWeight = Math.max(weight, 2);
  }
  // Priorité 2: Assignée sans mission active → rose (même opacité que bleu)
  else if (isAssigned) {
    fillColor = COLORS.GRID_ASSIGNED;
    fillOpacity = OPACITY.GRID_WITH_DATA;
    strokeColor = COLORS.GRID_ASSIGNED;
    strokeWeight = Math.max(weight, 1.5);
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

  // Les zones d'étude (Lama, Bado, …) sont rendues comme polygones sous la grille (main.ts) ;
  // ici on ne mélange plus la teinte « zone » au remplissage pour garder la légende statut données lisible.

  // Zone d'étude : bordure intensifiée + très légère tinte fill sur mailles sans données.
  // Le polygone zone est désactivé ; l'effet visuel est entièrement porté par les mailles.
  if (dominantZone) {
    const colors = ZONE_PASTEL_COLORS[dominantZone.zoneCode]
    if (colors) {
      strokeColor = interpolateZoneStroke(colors.from, colors.to, dominantZone.pct)
      strokeWeight = Math.max(weight + 0.4, 1.6)
      strokeOpacity = 1.0
      // Légère tinte zone sur fond transparent (mailles sans données uniquement)
      if (!hasData && !isColabHighlighted) {
        const hex = colors.hex
        fillColor = hex
        fillOpacity = 0.08
      }
    }
  }

  const campRank = cellCode ? campaignPriorityByCode.get(String(cellCode)) : undefined;
  if (campRank !== undefined && !hasActiveMission) {
    const intensity = 1 / (1 + (campRank - 1) * 0.28);
    fillColor = '#9333ea';
    fillOpacity = Math.max(fillOpacity, 0.22 + 0.42 * intensity);
    strokeColor = '#581c87';
    strokeWeight = Math.max(strokeWeight, 2.4);
  }
  
  return {
    color: strokeColor,
    weight: strokeWeight,
    ...(Number.isFinite(strokeOpacity as any) ? { opacity: strokeOpacity } : {}),
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

/** Retourne les zones qui contiennent cette maille avec % intersection. */
export function getZonesForMaille(mailleCode: string): Array<{ zoneCode: string; pct: number }> {
  const mc = String(mailleCode || '').trim()
  const result: Array<{ zoneCode: string; pct: number }> = []
  for (const [zoneCode, metaMap] of zoneMailleMetaByCode.entries()) {
    const meta = metaMap.get(mc)
    if (meta) result.push({ zoneCode, pct: meta.pct_intersection })
  }
  result.sort((a, b) => b.pct - a.pct)
  return result
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
