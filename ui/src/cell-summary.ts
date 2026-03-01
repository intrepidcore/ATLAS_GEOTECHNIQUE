/**
 * Module pour la synthèse automatique géotechnique par maille
 * Phase 3 - Génération de texte descriptif basé sur les règles géotech
 */

import type { CellCompleteOut } from './cell-complete-types'

// Types pour les données de synthèse
export interface CellSummaryData {
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
  // Stats calculées côté frontend (v3.6)
  depth_stats?: {
    min_m: number | null
    max_m: number | null
    moy_m: number | null
  }
  argilosite?: {
    vbs_moyen: number | null
    pct_argileux: number | null
    ip_moyen: number | null
  }
  samples?: any[]  // Échantillons bruts
}

/**
 * Construit une synthèse textuelle géotechnique pour une maille
 * Logique 3 niveaux (v3.6) - Ne retourne JAMAIS null
 */
export function buildCellSummary(data: CellSummaryData): string {
  const { kpi, depth_stats, argilosite, overview } = data
  
  // Déterminer le niveau de synthèse disponible
  const hasDepth = depth_stats?.min_m != null && depth_stats?.max_m != null
  const hasVbs = argilosite?.vbs_moyen != null
  const hasIp = argilosite?.ip_moyen != null
  const hasOverviewData = (overview?.atterberg?.length ?? 0) > 0 || (overview?.vbs?.length ?? 0) > 0
  
  // NIVEAU 3 - Complet (profondeur + VBS ou IP)
  if (hasDepth && (hasVbs || hasIp)) {
    const parts: string[] = []
    
    // Instrumentation
    parts.push(`Maille instrumentée : ${kpi.n_sondages} sondage(s), ${kpi.n_echantillons} échantillon(s), ${kpi.n_essais} essai(s)`)
    
    // Profondeur
    if (depth_stats) {
      const depthRange = depth_stats.min_m === depth_stats.max_m
        ? `${depth_stats.min_m?.toFixed(1)} m`
        : `${depth_stats.min_m?.toFixed(1)} à ${depth_stats.max_m?.toFixed(1)} m`
      const moyStr = depth_stats.moy_m != null ? ` (moy. ${depth_stats.moy_m.toFixed(1)} m)` : ''
      parts.push(`Investigations entre ${depthRange}${moyStr}`)
    }
    
    // Argilosité
    const argiloParts: string[] = []
    if (hasVbs) {
      const vbs = argilosite!.vbs_moyen!
      let soilType = 'sols peu argileux'
      if (vbs >= 6) soilType = 'sols très argileux'
      else if (vbs >= 2.5) soilType = 'sols argileux'
      else if (vbs >= 1) soilType = 'sols limono-argileux'
      argiloParts.push(`${soilType} (VBS moy. ${vbs.toFixed(1)} g/100g)`)
    }
    if (hasIp) {
      const ip = argilosite!.ip_moyen!
      let plasticity = 'plasticité faible'
      if (ip > 35) plasticity = 'plasticité très élevée'
      else if (ip > 17) plasticity = 'plasticité élevée'
      else if (ip >= 7) plasticity = 'plasticité moyenne'
      argiloParts.push(plasticity)
    }
    if (argiloParts.length > 0) {
      parts.push(argiloParts.join(', '))
    }
    
    return parts.join('. ') + '.'
  }
  
  // NIVEAU 2 - Intermédiaire (profondeur OU argilosité)
  if (hasDepth || hasVbs || hasIp || hasOverviewData) {
    const parts: string[] = []
    
    // Instrumentation
    parts.push(`Maille instrumentée : ${kpi.n_sondages} sondage(s), ${kpi.n_echantillons} échantillon(s), ${kpi.n_essais} essai(s)`)
    
    // Profondeur si disponible
    if (hasDepth && depth_stats) {
      const depthRange = depth_stats.min_m === depth_stats.max_m
        ? `${depth_stats.min_m?.toFixed(1)} m`
        : `${depth_stats.min_m?.toFixed(1)}–${depth_stats.max_m?.toFixed(1)} m`
      
      const depthQualif = (depth_stats.max_m ?? 0) < 3 ? 'peu explorée en profondeur' : 'exploration moyenne'
      parts.push(`Profondeurs d'investigation : ${depthRange}, maille ${depthQualif}`)
    } else if (hasVbs && argilosite) {
      // Argilosité seule
      const vbs = argilosite.vbs_moyen!
      let soilType = 'sols peu argileux'
      if (vbs >= 6) soilType = 'sols très argileux'
      else if (vbs >= 2.5) soilType = 'sols argileux'
      else if (vbs >= 1) soilType = 'sols limono-argileux'
      parts.push(`Indicateur VBS : ${soilType} (moy. ${vbs.toFixed(1)} g/100g)`)
    }
    
    return parts.join('. ') + '.'
  }
  
  // NIVEAU 1 - Minimal (seulement KPI)
  if (kpi.n_sondages > 0 || kpi.n_echantillons > 0 || kpi.n_essais > 0) {
    let summary = `Maille instrumentée : ${kpi.n_sondages} sondage(s), ${kpi.n_echantillons} échantillon(s), ${kpi.n_essais} essai(s).`
    summary += ` Pas encore d'indicateurs synthétiques (VBS, limites d'Atterberg, etc.).`
    return summary
  }
  
  // Cas sans données
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
