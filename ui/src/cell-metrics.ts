/**
 * Chantier B & C - Types et calculs unifiés pour les métriques de maille
 * Source unique de vérité pour tous les compteurs et statistiques
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Compteurs d'essais par type - 6 familles
 * Un essai = un type × un échantillon
 */
export interface EssaisTypeCounts {
  atterberg: number
  vbs: number
  classif: number
  proctor: number
  granulo: number
  gonflement: number
}

/**
 * Métriques complètes d'une maille
 * Calculées une seule fois, utilisées partout
 */
export interface CellMetrics {
  // Identité
  code: string
  region: string | null
  prefecture: string | null
  commune: string | null

  // Compteurs principaux
  nSondages: number
  nEchantillons: number
  essaisParType: EssaisTypeCounts
  nEssais: number  // = somme des 6 types

  // Profondeur d'investigation
  depthMin: number | null
  depthMax: number | null
  depthMean: number | null
  depthBins: [number, number, number, number]  // 0-1, 1-1.5, 1.5-2, >2

  // Argilosité
  vbsMean: number | null
  pctArgileux: number | null
  ipMean: number | null
}

// ============================================================================
// HELPERS DE FORMATAGE
// ============================================================================

/**
 * Formate un nombre avec unité, ou retourne '—' si null/NaN
 */
export function fmtNumber(x: number | null | undefined, unit?: string, digits = 1): string {
  if (x == null || Number.isNaN(x)) return '—'
  const v = x.toFixed(digits).replace('.', ',')
  return unit ? `${v} ${unit}` : v
}

/**
 * Formate un entier, ou retourne '0' si null
 */
export function fmtInt(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return '0'
  return x.toString()
}

/**
 * Met à jour le texte d'un élément DOM de manière sûre
 */
export function setCount(id: string, value: number): void {
  const el = document.getElementById(id)
  if (el) el.textContent = value.toString()
}

/**
 * Met à jour le texte d'un élément DOM avec formatage
 */
export function setText(id: string, value: string): void {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

// ============================================================================
// NORMALISATION DES DONNÉES API
// ============================================================================

/**
 * Normalise les compteurs d'essais depuis une réponse API
 * Garantit qu'on n'a jamais undefined
 */
export function normalizeEssaisTypes(raw: any): EssaisTypeCounts {
  return {
    atterberg: raw?.atterberg ?? 0,
    vbs: raw?.vbs ?? 0,
    classif: raw?.classif ?? 0,
    proctor: raw?.proctor ?? 0,
    granulo: raw?.granulo ?? 0,
    gonflement: raw?.gonflement ?? 0,
  }
}

/**
 * Calcule le total des essais depuis les compteurs par type
 */
export function sumEssais(types: EssaisTypeCounts): number {
  return types.atterberg + types.vbs + types.classif + 
         types.proctor + types.granulo + types.gonflement
}

// ============================================================================
// CALCUL DES MÉTRIQUES DEPUIS LES DONNÉES BRUTES
// ============================================================================

/**
 * Calcule toutes les métriques d'une maille depuis les données de l'API /cells/{code}/complete
 * C'est LA source unique de vérité pour le panneau maille
 */
export function computeCellMetrics(data: any): CellMetrics {
  const samples = data.samples || []
  const kpi = data.kpi || {}
  
  // Identité (depuis les propriétés de la maille ou les données API)
  const code = data.code || kpi.code || '—'
  const region = data.adm1_name || null
  const prefecture = data.adm2_name || null
  const commune = data.adm3_name || null

  // Compteurs de base
  const nSondages = kpi.n_sondages ?? 0
  const nEchantillons = kpi.n_echantillons ?? samples.length

  // Compteurs d'essais par type - calculés depuis les samples
  const essaisParType: EssaisTypeCounts = {
    atterberg: samples.filter((s: any) => s.atterberg != null).length,
    vbs: samples.filter((s: any) => s.vbs != null).length,
    classif: samples.filter((s: any) => s.classif != null).length,
    proctor: samples.filter((s: any) => s.proctor != null).length,
    granulo: samples.filter((s: any) => s.granulo != null).length,
    gonflement: samples.filter((s: any) => s.swelling != null).length,
  }
  
  // Total essais = somme des 6 types (cohérent partout)
  const nEssais = sumEssais(essaisParType)

  // Profondeurs
  const depths = samples
    .map((s: any) => s.depth_m)
    .filter((d: any): d is number => d != null && !Number.isNaN(d))
  
  const depthMin = depths.length > 0 ? Math.min(...depths) : null
  const depthMax = depths.length > 0 ? Math.max(...depths) : null
  const depthMean = depths.length > 0 
    ? depths.reduce((a: number, b: number) => a + b, 0) / depths.length 
    : null

  // Bins de profondeur (0-1, 1-1.5, 1.5-2, >2)
  const depthBins: [number, number, number, number] = [
    depths.filter((d: number) => d >= 0 && d < 1).length,
    depths.filter((d: number) => d >= 1 && d < 1.5).length,
    depths.filter((d: number) => d >= 1.5 && d < 2).length,
    depths.filter((d: number) => d >= 2).length,
  ]

  // Argilosité - VBS
  const vbsValues = samples
    .map((s: any) => s.vbs?.vbs)
    .filter((v: any): v is number => v != null && !Number.isNaN(v))
  
  const vbsMean = vbsValues.length > 0
    ? vbsValues.reduce((a: number, b: number) => a + b, 0) / vbsValues.length
    : null

  const pctArgileux = vbsValues.length > 0
    ? (vbsValues.filter((v: number) => v > 2.5).length / vbsValues.length) * 100
    : null

  // IP moyen depuis Atterberg
  const ipValues = samples
    .map((s: any) => s.atterberg?.ip)
    .filter((v: any): v is number => v != null && !Number.isNaN(v))
  
  const ipMean = ipValues.length > 0
    ? ipValues.reduce((a: number, b: number) => a + b, 0) / ipValues.length
    : null

  return {
    code,
    region,
    prefecture,
    commune,
    nSondages,
    nEchantillons,
    essaisParType,
    nEssais,
    depthMin,
    depthMax,
    depthMean,
    depthBins,
    vbsMean,
    pctArgileux,
    ipMean,
  }
}

// ============================================================================
// GÉNÉRATION DE LA SYNTHÈSE TEXTUELLE
// ============================================================================

/**
 * Génère la synthèse textuelle pour une maille
 * Toujours présente dès qu'il y a au moins 1 sondage
 */
export function buildSynthese(metrics: CellMetrics): string {
  if (!metrics.nSondages) {
    return "Aucune donnée géotechnique disponible pour cette maille."
  }

  const parts: string[] = []

  // 1. Instrumentation
  parts.push(
    `Maille instrumentée : ${metrics.nSondages} sondage(s), ` +
    `${metrics.nEchantillons} échantillon(s), ` +
    `${metrics.nEssais} essai(s).`
  )

  // 2. Profondeur
  if (metrics.depthMin != null && metrics.depthMax != null && metrics.depthMean != null) {
    parts.push(
      `Investigations entre ${metrics.depthMin.toFixed(1)} et ` +
      `${metrics.depthMax.toFixed(1)} m (moy. ${metrics.depthMean.toFixed(1)} m).`
    )
  }

  // 3. Argilosité
  if (metrics.vbsMean != null) {
    const niveau =
      metrics.vbsMean < 2.5 ? "sols plutôt sableux/limoneux" :
      metrics.vbsMean < 5   ? "sols limono-argileux" :
                              "sols argileux à forte teneur en fines"
    
    let argiloText = `${niveau} (VBS moy. ${metrics.vbsMean.toFixed(1)} g/100g`
    
    if (metrics.pctArgileux != null) {
      argiloText += `; ${metrics.pctArgileux.toFixed(0)}% d'échantillons argileux`
    }
    
    argiloText += ")."
    parts.push(argiloText)
  }

  // 4. Plasticité
  if (metrics.ipMean != null) {
    const plasticite =
      metrics.ipMean < 12 ? "plasticité faible" :
      metrics.ipMean < 25 ? "plasticité moyenne" :
      metrics.ipMean < 40 ? "plasticité élevée" :
                           "plasticité très élevée"
    parts.push(`IP moyen ${metrics.ipMean.toFixed(0)}%, ${plasticite}.`)
  }

  return parts.join(" ")
}
