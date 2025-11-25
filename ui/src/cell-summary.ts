/**
 * Module pour la synthèse automatique géotechnique par maille
 * Phase 3 - Génération de texte descriptif basé sur les règles géotech
 */

import type { CellCompleteOut } from './cell-complete-types'

// Types pour les données de synthèse
interface CellSummaryData {
  kpi: {
    n_sondages: number
    n_echantillons: number
    n_essais: number
    pct_spread: number
    depth_max_m?: number | null
  }
  overview?: {
    atterberg?: Array<{ depth_m: number; wl?: number; wp?: number }>
    vbs?: Array<{ depth_m: number; vbs?: number }>
    depth_hist?: Array<{ bin: number; n: number }>
  }
  classif_overview?: {
    gtr_dominant?: string
    uscs_dominant?: string
  }
}

/**
 * Construit une synthèse textuelle géotechnique pour une maille
 */
export function buildCellSummary(data: CellSummaryData): string {
  const parts: string[] = []
  
  // Cas 1: On a des données détaillées (overview non vide)
  const hasOverviewData = (data.overview?.atterberg?.length ?? 0) > 0 || (data.overview?.vbs?.length ?? 0) > 0
  
  if (hasOverviewData) {
    // 1) Profondeur d'investigation
    const depthPart = buildDepthPart(data)
    if (depthPart) parts.push(depthPart)
    
    // 2) Argilosité (VBS)
    const vbsPart = buildVbsPart(data)
    if (vbsPart) parts.push(vbsPart)
    
    // 3) Plasticité (IP)
    const ipPart = buildIpPart(data)
    if (ipPart) parts.push(ipPart)
    
    // 4) Classification dominante
    const classPart = buildClassPart(data)
    if (classPart) parts.push(classPart)
    
    // 5) Source des données (spread ou réel)
    const sourcePart = buildSourcePart(data)
    if (sourcePart) parts.push(sourcePart)
    
    // Assembler avec une majuscule au début
    const summary = parts.join(' ; ')
    return summary.charAt(0).toUpperCase() + summary.slice(1) + '.'
  }
  
  // Cas 2: On n'a que les KPI (pas de données détaillées)
  if (data.kpi.n_essais > 0 || data.kpi.n_echantillons > 0) {
    let summary = `Maille instrumentée : ${data.kpi.n_sondages} sondage(s), ${data.kpi.n_echantillons} échantillon(s), ${data.kpi.n_essais} essai(s).`
    
    if (data.kpi.depth_max_m != null) {
      summary += ` Profondeur max. ${data.kpi.depth_max_m.toFixed(1)} m.`
    }
    
    if (data.kpi.pct_spread > 99) {
      summary += ` Données issues de diffusion ADM3.`
    }
    
    return summary
  }
  
  // Cas 3: Aucune donnée
  return "Aucun essai géotechnique enregistré pour cette maille."
}

/**
 * Partie profondeur d'investigation
 */
function buildDepthPart(data: CellSummaryData): string | null {
  // Essayer d'abord depth_max_m du KPI
  let maxDepth = data.kpi.depth_max_m
  
  // Sinon, calculer depuis l'histogramme ou les échantillons
  if (maxDepth == null && data.overview?.atterberg?.length) {
    maxDepth = Math.max(...data.overview.atterberg.map(a => a.depth_m))
  }
  if (maxDepth == null && data.overview?.vbs?.length) {
    maxDepth = Math.max(...data.overview.vbs.map(v => v.depth_m))
  }
  
  if (maxDepth == null) return null
  
  if (maxDepth < 3) {
    return `investigation superficielle (≤ ${maxDepth.toFixed(1)} m)`
  } else if (maxDepth <= 10) {
    return `profondeur d'investigation moyenne (≈ ${maxDepth.toFixed(1)} m)`
  } else {
    return `investigation profonde (jusqu'à ${maxDepth.toFixed(1)} m)`
  }
}

/**
 * Partie argilosité (VBS)
 */
function buildVbsPart(data: CellSummaryData): string | null {
  const vbsValues = data.overview?.vbs?.map(v => v.vbs).filter((v): v is number => v != null) ?? []
  if (vbsValues.length === 0) return null
  
  const vbsMean = vbsValues.reduce((a, b) => a + b, 0) / vbsValues.length
  
  if (vbsMean < 1) {
    return "sols globalement peu argileux / sableux"
  } else if (vbsMean < 2.5) {
    return "sols limono-argileux"
  } else if (vbsMean < 6) {
    return `sols argileux (VBS moy. ${vbsMean.toFixed(1)})`
  } else {
    return `sols très argileux à argilosité marquée (VBS moy. ${vbsMean.toFixed(1)})`
  }
}

/**
 * Partie plasticité (IP = WL - WP)
 */
function buildIpPart(data: CellSummaryData): string | null {
  const atterberg = data.overview?.atterberg ?? []
  const ipValues = atterberg
    .filter(a => a.wl != null && a.wp != null)
    .map(a => (a.wl! - a.wp!))
  
  if (ipValues.length === 0) return null
  
  const ipMean = ipValues.reduce((a, b) => a + b, 0) / ipValues.length
  const ipMin = Math.min(...ipValues)
  const ipMax = Math.max(...ipValues)
  
  let plasticity: string
  if (ipMean < 7) {
    plasticity = "plasticité faible"
  } else if (ipMean <= 17) {
    plasticity = "plasticité moyenne"
  } else if (ipMean <= 35) {
    plasticity = "plasticité élevée"
  } else {
    plasticity = "plasticité très élevée"
  }
  
  // Ajouter la plage si on a plusieurs valeurs
  if (ipValues.length > 1 && ipMax - ipMin > 5) {
    return `${plasticity} (IP ${ipMin.toFixed(0)}-${ipMax.toFixed(0)}%)`
  }
  return `${plasticity} (IP ≈ ${ipMean.toFixed(0)}%)`
}

/**
 * Partie classification dominante
 */
function buildClassPart(data: CellSummaryData): string | null {
  const gtr = data.classif_overview?.gtr_dominant
  const uscs = data.classif_overview?.uscs_dominant
  
  if (gtr && uscs) {
    return `classe GTR ${gtr} / USCS ${uscs}`
  } else if (gtr) {
    return `classe GTR dominante ${gtr}`
  } else if (uscs) {
    return `classe USCS dominante ${uscs}`
  }
  return null
}

/**
 * Partie source des données (spread ou réel)
 */
function buildSourcePart(data: CellSummaryData): string | null {
  if (data.kpi.pct_spread > 99) {
    return "valeurs issues de diffusion ADM3"
  } else if (data.kpi.pct_spread > 50) {
    return "valeurs partiellement issues de diffusion"
  }
  return null
}

/**
 * Génère une synthèse courte pour l'affichage dans la fiche maille
 */
export function buildShortSummary(data: CellSummaryData): string {
  const parts: string[] = []
  
  // VBS
  const vbsValues = data.overview?.vbs?.map(v => v.vbs).filter((v): v is number => v != null) ?? []
  if (vbsValues.length > 0) {
    const vbsMean = vbsValues.reduce((a, b) => a + b, 0) / vbsValues.length
    if (vbsMean < 1) parts.push("sableux")
    else if (vbsMean < 2.5) parts.push("limono-argileux")
    else if (vbsMean < 6) parts.push("argileux")
    else parts.push("très argileux")
  }
  
  // IP
  const atterberg = data.overview?.atterberg ?? []
  const ipValues = atterberg
    .filter(a => a.wl != null && a.wp != null)
    .map(a => (a.wl! - a.wp!))
  if (ipValues.length > 0) {
    const ipMean = ipValues.reduce((a, b) => a + b, 0) / ipValues.length
    if (ipMean < 7) parts.push("peu plastique")
    else if (ipMean <= 17) parts.push("moyennement plastique")
    else parts.push("très plastique")
  }
  
  if (parts.length === 0) return "—"
  return parts.join(", ")
}

/**
 * Génère une couleur indicative basée sur l'argilosité
 */
export function getArgilosityColor(data: CellSummaryData): string {
  const vbsValues = data.overview?.vbs?.map(v => v.vbs).filter((v): v is number => v != null) ?? []
  if (vbsValues.length === 0) return '#6b7280' // gris
  
  const vbsMean = vbsValues.reduce((a, b) => a + b, 0) / vbsValues.length
  
  if (vbsMean < 1) return '#22c55e'      // vert - peu argileux
  else if (vbsMean < 2.5) return '#f59e0b' // orange - limono-argileux
  else if (vbsMean < 6) return '#ef4444'   // rouge - argileux
  else return '#7c3aed'                    // violet - très argileux
}
