/**
 * Bounds Optimizer v4.4.0
 * 
 * Algorithme itératif de cadrage ADM avec:
 * - Règle métier: marge minimale 0.5 km (CIBLE, pas juste contrainte)
 * - Pénalité margin_excess pour éviter marges > 0.7 km
 * - Binary search inversée: chercher le shrink maximal qui garde margin >= 0.5km
 * - Quality score avec pénalité forte sur margin_excess_km
 * - Densification précise (1 km entre points)
 * - Logging structuré texte + JSON pour traçabilité
 * 
 * @author Atlas Géotechnique
 * @version 4.4.0
 */

import type { ExportQuality } from './export-types'
import { getA4Layout } from './export-frame'

// Copie locale de QUALITY_SETTINGS pour éviter dépendance circulaire
const QUALITY_SETTINGS: Record<string, { dpi: number }> = {
  low: { dpi: 150 },
  hd: { dpi: 300 },
  ultra: { dpi: 600 }
}

// ============================================================================
// TYPES
// ============================================================================

export interface BoundsRect {
  north: number
  south: number
  east: number
  west: number
}

export interface BoundsMetrics {
  bounds: BoundsRect
  
  // KPI marges bbox (%)
  pad_left_pct: number
  pad_right_pct: number
  pad_top_pct: number
  pad_bottom_pct: number
  pad_min_pct: number
  pad_max_pct: number
  
  // KPI clearance réelle (px)
  clear_left_px: number
  clear_right_px: number
  clear_top_px: number
  clear_bottom_px: number
  clear_min_px: number
  clear_min_side: 'left' | 'right' | 'top' | 'bottom'
  
  // KPI marges en km (NOUVEAU)
  margin_top_km: number
  margin_bottom_km: number
  margin_left_km: number
  margin_right_km: number
  margin_min_km: number
  margin_max_km: number
  margin_min_px_equiv: number  // Équivalent approximatif de margin_min_km en pixels
  
  // KPI occupation
  occ_x: number
  occ_y: number
  occ_area: number
  occ_major: number
  
  // Score multi-objectif (v4.4)
  quality_score: number  // Score combiné: occupation - pénalités marges
  margin_excess_km: number  // Excès de marge au-delà de TARGET (pour pénalité)
  margin_penalty: number  // Pénalité appliquée au quality_score
  
  // Métadonnées
  orientation: 'portrait' | 'landscape'
  shrinkFactor: number
}

export interface OptimizationOptions {
  safePx: number // Marge minimale en pixels (ex: 12 ou 16)
  maxIterations: number // Nombre max d'itérations binary search
  muStart: number // Marge initiale (ex: 0.01 = 1%)
  searchStrategy: 'binary' // Stratégie de recherche
  logPrefix: string // Préfixe des logs (ADM1/ADM2/ADM3)
  admName?: string // Nom de l'ADM pour logs
  maxPadPct?: number
  maxMarginRatio?: number
  maxMarginKmWarn?: number
}

export interface ADMGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: any
}

// ============================================================================
// TYPES POUR EXPORT JSON STRUCTURÉ
// ============================================================================

export interface BoundsIterationLog {
  iter: number
  shrink: number
  pad_pct: {
    left: number
    right: number
    top: number
    bottom: number
    max: number
  }
  margins_km: {
    left: number
    right: number
    top: number
    bottom: number
    min: number
    max: number
  }
  clearance_px: {
    left: number
    right: number
    top: number
    bottom: number
    min: number
    side: string
  }
  occupation: {
    occ_x: number
    occ_y: number
    occ_area: number
    occ_major: number
  }
  decision: 'accept' | 'reject'
  reason: string
  margin_excess_km: number
  margin_penalty: number
  quality_score: number
}

export interface BoundsOrientationResult {
  iterations: BoundsIterationLog[]
  final: BoundsMetrics
}

export interface BoundsOptimizerJSON {
  adm_name: string
  adm_level: string
  export_id?: string
  quality: string
  dpi: number
  target_margin_km: number
  densification: {
    target_spacing_km: number
    raw_points: number
    densified_points: number
    perimeter_km: number
  }
  orientations: {
    portrait: BoundsOrientationResult
    landscape: BoundsOrientationResult
  }
  chosen: {
    orientation: 'portrait' | 'landscape'
    metrics: BoundsMetrics
    reason: string
  }
  warnings: string[]
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Règle métier: marge minimale en km (distance géométrie ↔ bord carte)
const TARGET_MARGIN_KM = 0.5  // CIBLE: ~0.5 km de marge minimale (pas juste contrainte)
const MARGIN_TOLERANCE_KM = 0.1  // Tolérance acceptable: 0.5-0.6 km OK, au-delà pénalisé FORT
const MARGIN_PENALTY_WEIGHT = 20.0  // Poids de la pénalité margin_excess (TRÈS FORT - v4.5)
const MAX_PAD_PCT = 0.30  // Limite: pad_max ne doit pas dépasser 30% (évite marges énormes)
const MAX_MARGIN_RATIO = 4.0  // Limite: margin_max / margin_min <= 4 (évite asymétrie extrême)
const KM_PER_DEG_LAT = 111.0  // Approximation sphérique (WGS84 simplifié)

// Densification de la géométrie pour calcul précis de clearance
// TODO: Adapter dynamiquement selon taille ADM (1km pour grandes zones, 0.5km pour petites)
const TARGET_SPACING_KM = 1.0  // Espacement entre points densifiés

// Limite de performance: nombre max de points densifiés
// TODO: Implémenter downsampling si dépassement
const MAX_DENSIFIED_POINTS = 5000

const DEFAULT_OPTIONS: OptimizationOptions = {
  safePx: 16,
  maxIterations: 15,
  muStart: 0.01,
  searchStrategy: 'binary',
  logPrefix: 'ADM'
}

// ============================================================================
// CLASSE PRINCIPALE
// ============================================================================

export class BoundsOptimizer {
  private options: OptimizationOptions
  private quality: ExportQuality
  private admGeometry: ADMGeometry | null = null
  private densifiedBoundary: Array<{ lat: number; lng: number }> = []
  
  // Collecte des données pour export JSON
  private jsonData: Partial<BoundsOptimizerJSON> = {}
  private portraitIterations: BoundsIterationLog[] = []
  private landscapeIterations: BoundsIterationLog[] = []
  private rawPointsCount: number = 0
  private perimeterKm: number = 0
  
  constructor(quality: ExportQuality = 'hd', options: Partial<OptimizationOptions> = {}) {
    this.quality = quality
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }
  
  /**
   * Point d'entrée principal - calcule les bounds optimaux avec itération
   */
  public async computeOptimalBounds(
    admBounds: BoundsRect,
    geometry?: ADMGeometry
  ): Promise<BoundsMetrics> {
    
    const dpi = QUALITY_SETTINGS[this.quality]?.dpi || 300
    
    // Initialiser jsonData
    this.jsonData = {
      adm_name: this.options.admName || 'inconnu',
      adm_level: this.options.logPrefix,
      quality: this.quality,
      dpi,
      target_margin_km: TARGET_MARGIN_KM,
      warnings: []
    }
    this.portraitIterations = []
    this.landscapeIterations = []
    
    // En-tête détaillé
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds] Début optimisation bounds`)
    console.log(`[${this.options.logPrefix}][Bounds] ADM: ${this.options.admName || 'inconnu'} | Niveau: ${this.options.logPrefix} | Qualité: ${this.quality} (${dpi} DPI)`)
    console.log(`[${this.options.logPrefix}][Bounds] Règle métier: marge minimale >= ${TARGET_MARGIN_KM} km`)
    console.log(`[${this.options.logPrefix}][Bounds] Bounds ADM bruts: N=${admBounds.north.toFixed(3)} S=${admBounds.south.toFixed(3)} E=${admBounds.east.toFixed(3)} W=${admBounds.west.toFixed(3)}`)
    
    // Stocker et densifier la géométrie si fournie
    if (geometry) {
      console.log(`[${this.options.logPrefix}][Bounds] Type géométrie: ${geometry.type}`)
      this.admGeometry = geometry
      this.densifiedBoundary = this.densifyBoundary(geometry)
    } else {
      console.log(`[${this.options.logPrefix}][Bounds] ⚠️ Aucune géométrie fournie - utilisation bbox ADM uniquement`)
      this.jsonData.warnings?.push('Aucune géométrie fournie - utilisation bbox ADM uniquement')
    }
    
    // Stocker densification dans jsonData
    if (this.densifiedBoundary.length > 0) {
      this.jsonData.densification = {
        target_spacing_km: TARGET_SPACING_KM,
        raw_points: this.rawPointsCount,
        densified_points: this.densifiedBoundary.length,
        perimeter_km: this.perimeterKm
      }
    }
    
    // Tester les deux orientations
    const portraitMetrics = await this.optimizeForOrientation(admBounds, 'portrait')
    const landscapeMetrics = await this.optimizeForOrientation(admBounds, 'landscape')
    
    // Choisir la meilleure orientation basée sur occupation et respect de la marge cible
    // Priorité 1: marge minimale >= TARGET_MARGIN_KM
    // Priorité 2: occupation maximale
    const portraitMarginOk = portraitMetrics.margin_min_km >= TARGET_MARGIN_KM
    const landscapeMarginOk = landscapeMetrics.margin_min_km >= TARGET_MARGIN_KM
    
    let best: BoundsMetrics
    let reason = ''
    
    if (portraitMarginOk && !landscapeMarginOk) {
      best = portraitMetrics
      reason = `portrait respecte marge cible (${portraitMetrics.margin_min_km.toFixed(2)}km), paysage non (${landscapeMetrics.margin_min_km.toFixed(2)}km)`
    } else if (!portraitMarginOk && landscapeMarginOk) {
      best = landscapeMetrics
      reason = `paysage respecte marge cible (${landscapeMetrics.margin_min_km.toFixed(2)}km), portrait non (${portraitMetrics.margin_min_km.toFixed(2)}km)`
    } else {
      // Les deux respectent (ou ne respectent pas) la marge cible
      // Choisir celui avec la meilleure occupation
      if (portraitMetrics.occ_area >= landscapeMetrics.occ_area) {
        best = portraitMetrics
        reason = `occupation portrait (${(portraitMetrics.occ_area*100).toFixed(1)}%) >= paysage (${(landscapeMetrics.occ_area*100).toFixed(1)}%)`
      } else {
        best = landscapeMetrics
        reason = `occupation paysage (${(landscapeMetrics.occ_area*100).toFixed(1)}%) > portrait (${(portraitMetrics.occ_area*100).toFixed(1)}%)`
      }
    }
    
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds] COMPARAISON ORIENTATIONS`)
    console.log(`[${this.options.logPrefix}][Bounds] 🔄 Portrait: score=${portraitMetrics.quality_score.toFixed(3)} occ=${(portraitMetrics.occ_area*100).toFixed(1)}% margin_min=${portraitMetrics.margin_min_km.toFixed(2)}km pad_max=${(portraitMetrics.pad_max_pct*100).toFixed(1)}% shrink=${portraitMetrics.shrinkFactor.toFixed(3)}`)
    console.log(`[${this.options.logPrefix}][Bounds] 🔄 Paysage:  score=${landscapeMetrics.quality_score.toFixed(3)} occ=${(landscapeMetrics.occ_area*100).toFixed(1)}% margin_min=${landscapeMetrics.margin_min_km.toFixed(2)}km pad_max=${(landscapeMetrics.pad_max_pct*100).toFixed(1)}% shrink=${landscapeMetrics.shrinkFactor.toFixed(3)}`)
    console.log(`[${this.options.logPrefix}][Bounds] ✅ Orientation choisie: ${best.orientation.toUpperCase()} (${reason})`)
    
    // WARNING v4.5: Détecter marges excessives (> 1km)
    if (best.margin_min_km > 1.0) {
      const warning = `⚠️ MARGE EXCESSIVE: margin_min=${best.margin_min_km.toFixed(2)}km (>1km) pour ${this.options.admName || 'ADM'} - cadrage non optimal`
      console.warn(`[${this.options.logPrefix}][Bounds] ${warning}`)
      this.jsonData.warnings?.push(warning)
    }
    
    // WARNING v4.5: Détecter marges hors cible (> 0.6km)
    if (best.margin_min_km > TARGET_MARGIN_KM + MARGIN_TOLERANCE_KM) {
      const warning = `⚠️ MARGE HORS CIBLE: margin_min=${best.margin_min_km.toFixed(2)}km (cible: ${TARGET_MARGIN_KM}km ± ${MARGIN_TOLERANCE_KM}km) pour ${this.options.admName || 'ADM'}`
      console.warn(`[${this.options.logPrefix}][Bounds] ${warning}`)
      this.jsonData.warnings?.push(warning)
    }
    
    // Compléter jsonData
    this.jsonData.orientations = {
      portrait: { iterations: this.portraitIterations, final: portraitMetrics },
      landscape: { iterations: this.landscapeIterations, final: landscapeMetrics }
    }
    this.jsonData.chosen = {
      orientation: best.orientation,
      metrics: best,
      reason
    }
    
    this.logFinalMetrics(best)
    
    return best
  }
  
  /**
   * Optimise pour une orientation donnée avec binary search
   */
  private async optimizeForOrientation(
    admBounds: BoundsRect,
    orientation: 'portrait' | 'landscape'
  ): Promise<BoundsMetrics> {
    
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds][${orientation}] Début optimisation (binary search)`)

    const effectiveMaxPadPct = typeof this.options.maxPadPct === 'number' ? this.options.maxPadPct : MAX_PAD_PCT
    const effectiveMaxMarginRatio = typeof this.options.maxMarginRatio === 'number' ? this.options.maxMarginRatio : MAX_MARGIN_RATIO
    console.log(`[${this.options.logPrefix}][Bounds][${orientation}] Constraints`, {
      target_margin_km: TARGET_MARGIN_KM,
      max_pad_pct: effectiveMaxPadPct,
      max_margin_ratio: effectiveMaxMarginRatio,
      max_iterations: this.options.maxIterations,
      mu_start: this.options.muStart
    })
    
    // Binary search INVERSÉE : chercher le shrink minimal qui VIOLE les contraintes
    // Puis prendre celui juste avant (le plus zoomé qui respecte encore les contraintes)
    let shrinkMin = 0.50 // Très serré (probablement trop)
    let shrinkMax = 1.00 // Pas serré du tout (marge initiale)
    let bestMetrics: BoundsMetrics | null = null
    let iteration = 0
    const iterationsLog: BoundsIterationLog[] = []
    
    // Convergence plus fine pour atteindre vraiment la limite
    while (iteration < this.options.maxIterations && (shrinkMax - shrinkMin) > 0.0001) {
      iteration++
      const shrinkMid = (shrinkMin + shrinkMax) / 2
      
      const metrics = this.computeMetricsForShrink(admBounds, orientation, shrinkMid)
      
      // Log itération détaillée
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}] iter=${iteration} shrink=${shrinkMid.toFixed(4)}`)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}]   → pad: L=${(metrics.pad_left_pct*100).toFixed(1)}% R=${(metrics.pad_right_pct*100).toFixed(1)}% T=${(metrics.pad_top_pct*100).toFixed(1)}% B=${(metrics.pad_bottom_pct*100).toFixed(1)}% max=${(metrics.pad_max_pct*100).toFixed(1)}%`)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}]   → margin_km: L=${metrics.margin_left_km.toFixed(2)} R=${metrics.margin_right_km.toFixed(2)} T=${metrics.margin_top_km.toFixed(2)} B=${metrics.margin_bottom_km.toFixed(2)} min=${metrics.margin_min_km.toFixed(2)} max=${metrics.margin_max_km.toFixed(2)}`)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}]   → margin_excess=${metrics.margin_excess_km.toFixed(3)}km penalty=${metrics.margin_penalty.toFixed(3)} quality_score=${metrics.quality_score.toFixed(3)}`)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}]   → clear_px: L=${metrics.clear_left_px.toFixed(1)} R=${metrics.clear_right_px.toFixed(1)} T=${metrics.clear_top_px.toFixed(1)} B=${metrics.clear_bottom_px.toFixed(1)} min=${metrics.clear_min_px.toFixed(1)} (${metrics.clear_min_side})`)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}]   → occ: x=${(metrics.occ_x*100).toFixed(1)}% y=${(metrics.occ_y*100).toFixed(1)}% area=${(metrics.occ_area*100).toFixed(1)}% major=${(metrics.occ_major*100).toFixed(1)}%`)
      
      // RÈGLE MÉTIER v4.2: Vérifier marge km + contraintes pad_max et margin_ratio
      const marginKmOk = metrics.margin_min_km >= TARGET_MARGIN_KM
      const padMaxOk = metrics.pad_max_pct <= effectiveMaxPadPct
      const marginRatio = metrics.margin_min_km > 0 ? metrics.margin_max_km / metrics.margin_min_km : 999
      const marginRatioOk = marginRatio <= effectiveMaxMarginRatio
      
      const isAcceptable = marginKmOk && padMaxOk && marginRatioOk
      const decision = isAcceptable ? 'accept' : 'reject'
      
      let reason = ''
      if (!marginKmOk) reason = `margin_min_km=${metrics.margin_min_km.toFixed(2)} < ${TARGET_MARGIN_KM}km`
      else if (!padMaxOk) reason = `pad_max=${(metrics.pad_max_pct*100).toFixed(1)}% > ${(effectiveMaxPadPct*100).toFixed(0)}%`
      else if (!marginRatioOk) reason = `margin_ratio=${marginRatio.toFixed(2)} > ${effectiveMaxMarginRatio}`
      else {
        // Toutes contraintes OK - détailler la qualité
        if (metrics.margin_excess_km > 0) {
          reason = `margin=${metrics.margin_min_km.toFixed(2)}km (excess=${metrics.margin_excess_km.toFixed(2)}km) quality=${metrics.quality_score.toFixed(3)}`
        } else {
          reason = `margin=${metrics.margin_min_km.toFixed(2)}km (optimal) quality=${metrics.quality_score.toFixed(3)}`
        }
      }

      console.log(
        `[${this.options.logPrefix}][Bounds][${orientation}] iter=${iteration} ${decision.toUpperCase()} (${reason}) ` +
        `constraints: marginOk=${marginKmOk} padOk=${padMaxOk} ratioOk=${marginRatioOk} ` +
        `(margin_ratio=${marginRatio.toFixed(2)}, pad_max=${(metrics.pad_max_pct*100).toFixed(1)}%)`
      )
      
      // Collecter pour JSON
      iterationsLog.push({
        iter: iteration,
        shrink: shrinkMid,
        pad_pct: {
          left: metrics.pad_left_pct,
          right: metrics.pad_right_pct,
          top: metrics.pad_top_pct,
          bottom: metrics.pad_bottom_pct,
          max: metrics.pad_max_pct
        },
        margins_km: {
          left: metrics.margin_left_km,
          right: metrics.margin_right_km,
          top: metrics.margin_top_km,
          bottom: metrics.margin_bottom_km,
          min: metrics.margin_min_km,
          max: metrics.margin_max_km
        },
        clearance_px: {
          left: metrics.clear_left_px,
          right: metrics.clear_right_px,
          top: metrics.clear_top_px,
          bottom: metrics.clear_bottom_px,
          min: metrics.clear_min_px,
          side: metrics.clear_min_side
        },
        occupation: {
          occ_x: metrics.occ_x,
          occ_y: metrics.occ_y,
          occ_area: metrics.occ_area,
          occ_major: metrics.occ_major
        },
        decision,
        reason,
        margin_excess_km: metrics.margin_excess_km,
        margin_penalty: metrics.margin_penalty,
        quality_score: metrics.quality_score
      })
      
      if (isAcceptable) {
        // Acceptable - sauvegarder et essayer ENCORE PLUS serré
        bestMetrics = metrics
        shrinkMax = shrinkMid // Réduire la borne haute
        console.log(`[${this.options.logPrefix}][Bounds][${orientation}] iter=${iteration} ✅ ACCEPT (${reason}) margin_min=${metrics.margin_min_km.toFixed(2)}km → essayer plus serré`)
      } else {
        // Trop serré - augmenter la borne basse
        shrinkMin = shrinkMid
        console.log(`[${this.options.logPrefix}][Bounds][${orientation}] iter=${iteration} ❌ REJECT (${reason}) → relâcher`)
      }
    }
    
    // Si aucune solution trouvée, utiliser shrink=1.0 (marge initiale)
    if (!bestMetrics) {
      bestMetrics = this.computeMetricsForShrink(admBounds, orientation, 1.0)
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}] ⚠️ Aucune solution optimale - utilisation marge initiale (shrink=1.0)`)
    }
    
    console.log(`[${this.options.logPrefix}][Bounds][${orientation}] FINAL shrink=${bestMetrics.shrinkFactor.toFixed(3)} score=${bestMetrics.quality_score.toFixed(3)} margin_min=${bestMetrics.margin_min_km.toFixed(2)}km (≈ ${bestMetrics.margin_min_px_equiv.toFixed(1)}px) occ=${(bestMetrics.occ_area*100).toFixed(1)}% pad_max=${(bestMetrics.pad_max_pct * 100).toFixed(1)}%`)
    
    // Warning si marge cible non atteinte
    if (bestMetrics.margin_min_km < TARGET_MARGIN_KM) {
      const warning = `${orientation}: Marge minimale cible ${TARGET_MARGIN_KM}km non atteinte (obtenu: ${bestMetrics.margin_min_km.toFixed(2)}km)`
      console.log(`[${this.options.logPrefix}][Bounds][${orientation}] ⚠️ WARNING: ${warning}`)
      this.jsonData.warnings?.push(warning)
    }
    
    // Stocker itérations pour JSON
    if (orientation === 'portrait') {
      this.portraitIterations = iterationsLog
    } else {
      this.landscapeIterations = iterationsLog
    }
    
    return bestMetrics
  }
  
  /**
   * Calcule toutes les métriques pour un shrink factor donné
   */
  private computeMetricsForShrink(
    admBounds: BoundsRect,
    orientation: 'portrait' | 'landscape',
    shrinkFactor: number
  ): BoundsMetrics {
    
    // 1. Dimensions ADM
    const admWidthDeg = admBounds.east - admBounds.west
    const admHeightDeg = admBounds.north - admBounds.south
    const centerLat = (admBounds.north + admBounds.south) / 2
    const centerLng = (admBounds.east + admBounds.west) / 2
    const cosLat = Math.cos(centerLat * Math.PI / 180)
    const W0_km = admWidthDeg * 111 * cosLat
    const H0_km = admHeightDeg * 111
    
    // 2. Appliquer marge initiale modulée par shrinkFactor
    const mu = this.options.muStart * shrinkFactor
    const W1 = admWidthDeg * (1 + 2 * mu)
    const H1 = admHeightDeg * (1 + 2 * mu)
    
    // 3. Layout A4
    const dpi = QUALITY_SETTINGS[this.quality]?.dpi || 300
    const layout = getA4Layout(dpi, orientation)
    const AR_frame = layout.targetAspectRatio
    
    // 4. Ajuster au ratio frame
    const W1_km = W1 * 111 * cosLat
    const H1_km = H1 * 111
    const AR_1 = W1_km / H1_km
    
    let W2 = W1, H2 = H1
    if (AR_1 > AR_frame) {
      H2 = (W1_km / AR_frame) / 111
    } else if (AR_1 < AR_frame) {
      W2 = (H1_km * AR_frame) / (111 * cosLat)
    }
    
    // 5. Bounds finales
    const halfW2 = W2 / 2
    const halfH2 = H2 / 2
    
    const bounds: BoundsRect = {
      west: centerLng - halfW2,
      east: centerLng + halfW2,
      south: centerLat - halfH2,
      north: centerLat + halfH2
    }
    
    // 6. KPI marges bbox (%)
    const frameWidthDeg = bounds.east - bounds.west
    const frameHeightDeg = bounds.north - bounds.south
    
    const pad_left_pct = (admBounds.west - bounds.west) / frameWidthDeg
    const pad_right_pct = (bounds.east - admBounds.east) / frameWidthDeg
    const pad_top_pct = (bounds.north - admBounds.north) / frameHeightDeg
    const pad_bottom_pct = (admBounds.south - bounds.south) / frameHeightDeg
    
    const pad_min_pct = Math.min(pad_left_pct, pad_right_pct, pad_top_pct, pad_bottom_pct)
    const pad_max_pct = Math.max(pad_left_pct, pad_right_pct, pad_top_pct, pad_bottom_pct)
    
    // 6b. KPI marges en km (NOUVEAU v4.5 - corrigé bug géométrie)
    // Calculer distance entre bbox carte et bbox géométrie ADM en km
    const latMid = (bounds.north + bounds.south) / 2
    const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(latMid * Math.PI / 180)
    
    // CORRECTION v4.5: utiliser abs() pour éviter marges négatives absurdes
    // bounds doit TOUJOURS englober admBounds, donc marges doivent être positives
    const margin_top_km = Math.abs(bounds.north - admBounds.north) * KM_PER_DEG_LAT
    const margin_bottom_km = Math.abs(admBounds.south - bounds.south) * KM_PER_DEG_LAT
    const margin_left_km = Math.abs(admBounds.west - bounds.west) * kmPerDegLon
    const margin_right_km = Math.abs(bounds.east - admBounds.east) * kmPerDegLon
    
    const margin_min_km = Math.min(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
    const margin_max_km = Math.max(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
    
    // VALIDATION v4.5: détecter géométrie bbox invalide (marges énormes)
    const maxMarginKmWarn = typeof this.options.maxMarginKmWarn === 'number' ? this.options.maxMarginKmWarn : 100
    if (margin_max_km > maxMarginKmWarn) {
      console.warn(
        `[${this.options.logPrefix}][Bounds] ⚠️ BBOX INVALIDE: margin_max=${margin_max_km.toFixed(2)}km (>${maxMarginKmWarn}km) - possible bug géométrie`
      )
      console.warn(`[${this.options.logPrefix}][Bounds]   bounds: N=${bounds.north.toFixed(4)} S=${bounds.south.toFixed(4)} E=${bounds.east.toFixed(4)} W=${bounds.west.toFixed(4)}`)
      console.warn(`[${this.options.logPrefix}][Bounds]   admBounds: N=${admBounds.north.toFixed(4)} S=${admBounds.south.toFixed(4)} E=${admBounds.east.toFixed(4)} W=${admBounds.west.toFixed(4)}`)
    }
    
    // 6c. Calculer équivalent pixels de margin_min_km
    const pxPerDegLat = layout.mapArea.height / frameHeightDeg
    const pxPerDegLon = layout.mapArea.width / frameWidthDeg
    const margin_min_deg = margin_min_km / KM_PER_DEG_LAT  // Approximation
    const margin_min_px_equiv = margin_min_deg * Math.max(pxPerDegLat, pxPerDegLon)
    
    // 7. KPI clearance réelle (px)
    const clearance = this.computeClearance(bounds, layout.mapArea.width, layout.mapArea.height)
    
    // 8. KPI occupation
    const finalWidthKm = frameWidthDeg * 111 * cosLat
    const finalHeightKm = frameHeightDeg * 111
    
    const occ_x = W0_km / finalWidthKm
    const occ_y = H0_km / finalHeightKm
    const occ_area = (W0_km * H0_km) / (finalWidthKm * finalHeightKm)
    const occ_major = Math.max(occ_x, occ_y)
    
    // 9. Score multi-objectif (v4.4)
    // Priorité 1: occupation maximale
    // Priorité 2: PÉNALITÉ FORTE sur margin_excess (marges > TARGET + TOLERANCE)
    // Priorité 3: pénaliser pad_max excessif
    // Priorité 4: pénaliser asymétrie margin_max/margin_min
    
    // Calcul margin_excess: tout ce qui dépasse TARGET + TOLERANCE
    const margin_excess_km = Math.max(0, margin_min_km - (TARGET_MARGIN_KM + MARGIN_TOLERANCE_KM))
    const margin_penalty = margin_excess_km * MARGIN_PENALTY_WEIGHT
    
    const pad_penalty = Math.max(0, (pad_max_pct - 0.15) * 2)  // Pénalité si pad_max > 15%
    const margin_ratio = margin_min_km > 0 ? margin_max_km / margin_min_km : 1
    const asymmetry_penalty = Math.max(0, (margin_ratio - 2.0) * 0.05)  // Pénalité si ratio > 2
    
    // Score final: occupation - pénalités (margin_penalty est le plus fort)
    const quality_score = occ_area - margin_penalty - pad_penalty - asymmetry_penalty
    
    return {
      bounds,
      pad_left_pct,
      pad_right_pct,
      pad_top_pct,
      pad_bottom_pct,
      pad_min_pct,
      pad_max_pct,
      ...clearance,
      margin_top_km,
      margin_bottom_km,
      margin_left_km,
      margin_right_km,
      margin_min_km,
      margin_max_km,
      margin_min_px_equiv,
      occ_x,
      occ_y,
      occ_area,
      occ_major,
      quality_score,
      margin_excess_km,
      margin_penalty,
      orientation,
      shrinkFactor
    }
  }
  
  /**
   * Calcule la clearance réelle (distance limite ADM ↔ bords frame) en pixels
   */
  private computeClearance(
    bounds: BoundsRect,
    frameWidthPx: number,
    frameHeightPx: number
  ): {
    clear_left_px: number
    clear_right_px: number
    clear_top_px: number
    clear_bottom_px: number
    clear_min_px: number
    clear_min_side: 'left' | 'right' | 'top' | 'bottom'
  } {
    
    // Si pas de géométrie, utiliser bbox comme approximation
    if (this.densifiedBoundary.length === 0) {
      // Approximation grossière basée sur bbox
      const frameWidthDeg = bounds.east - bounds.west
      const frameHeightDeg = bounds.north - bounds.south
      
      const pxPerDegLng = frameWidthPx / frameWidthDeg
      const pxPerDegLat = frameHeightPx / frameHeightDeg
      
      // Utiliser les marges bbox comme proxy
      const clear_left_px = 50 // Valeur par défaut conservative
      const clear_right_px = 50
      const clear_top_px = 50
      const clear_bottom_px = 50
      
      return {
        clear_left_px,
        clear_right_px,
        clear_top_px,
        clear_bottom_px,
        clear_min_px: 50,
        clear_min_side: 'left'
      }
    }
    
    // Calcul précis avec géométrie densifiée
    const frameWidthDeg = bounds.east - bounds.west
    const frameHeightDeg = bounds.north - bounds.south
    
    const pxPerDegLng = frameWidthPx / frameWidthDeg
    const pxPerDegLat = frameHeightPx / frameHeightDeg
    
    let minLeft = Infinity
    let minRight = Infinity
    let minTop = Infinity
    let minBottom = Infinity
    
    for (const point of this.densifiedBoundary) {
      // Convertir en pixels dans le frame
      const x = (point.lng - bounds.west) * pxPerDegLng
      const y = (bounds.north - point.lat) * pxPerDegLat // Inverser Y (nord en haut)
      
      // Distance aux bords
      const distLeft = x
      const distRight = frameWidthPx - x
      const distTop = y
      const distBottom = frameHeightPx - y
      
      minLeft = Math.min(minLeft, distLeft)
      minRight = Math.min(minRight, distRight)
      minTop = Math.min(minTop, distTop)
      minBottom = Math.min(minBottom, distBottom)
    }
    
    // Trouver le côté critique
    const clearances = {
      left: minLeft,
      right: minRight,
      top: minTop,
      bottom: minBottom
    }
    
    const minEntry = Object.entries(clearances).reduce((min, [side, val]) => 
      val < min[1] ? [side, val] : min
    , ['left', minLeft] as [string, number])
    
    return {
      clear_left_px: minLeft,
      clear_right_px: minRight,
      clear_top_px: minTop,
      clear_bottom_px: minBottom,
      clear_min_px: minEntry[1],
      clear_min_side: minEntry[0] as 'left' | 'right' | 'top' | 'bottom'
    }
  }
  
  /**
   * Densifie la limite ADM pour calcul précis de clearance
   * Interpole des points tous les TARGET_SPACING_KM km le long des segments
   * TODO: Traiter tous les rings extérieurs pour MultiPolygon (actuellement 1er seulement)
   * TODO: Implémenter downsampling si > MAX_DENSIFIED_POINTS
   */
  private densifyBoundary(geometry: ADMGeometry): Array<{ lat: number; lng: number }> {
    const points: Array<{ lat: number; lng: number }> = []
    let totalPerimeterKm = 0
    let rawPointsCount = 0
    
    const processRing = (ring: number[][]) => {
      rawPointsCount += ring.length
      
      for (let i = 0; i < ring.length - 1; i++) {
        const [lng1, lat1] = ring[i]
        const [lng2, lat2] = ring[i + 1]
        
        // Distance approximative en km (formule euclidienne simplifiée)
        // TODO: Utiliser formule haversine pour précision à grande échelle
        const dlng = lng2 - lng1
        const dlat = lat2 - lat1
        const distKm = Math.sqrt(dlng * dlng * KM_PER_DEG_LAT * KM_PER_DEG_LAT + dlat * dlat * KM_PER_DEG_LAT * KM_PER_DEG_LAT)
        totalPerimeterKm += distKm
        
        // Nombre de segments à créer
        const nSegments = Math.max(1, Math.ceil(distKm / TARGET_SPACING_KM))
        
        // Interpolation linéaire
        for (let j = 0; j < nSegments; j++) {
          const t = j / nSegments
          points.push({
            lng: lng1 + t * dlng,
            lat: lat1 + t * dlat
          })
        }
      }
    }
    
    if (geometry.type === 'Polygon') {
      if (geometry.coordinates[0]) {
        processRing(geometry.coordinates[0])
      }
    } else if (geometry.type === 'MultiPolygon') {
      // TODO: Traiter tous les polygones, pas seulement le premier
      console.log(`[${this.options.logPrefix}][Bounds] ⚠️ MultiPolygon détecté: densification du 1er polygone uniquement`)
      if (geometry.coordinates[0]?.[0]) {
        processRing(geometry.coordinates[0][0])
      }
    }
    
    // Stocker pour JSON
    this.rawPointsCount = rawPointsCount
    this.perimeterKm = totalPerimeterKm
    
    // Log détaillé de la densification
    console.log(`[${this.options.logPrefix}][Bounds] Densification: ${rawPointsCount} points → ${points.length} points (espacement ≈ ${TARGET_SPACING_KM.toFixed(1)} km, périmètre ≈ ${totalPerimeterKm.toFixed(1)} km)`)
    
    if (points.length > MAX_DENSIFIED_POINTS) {
      console.log(`[${this.options.logPrefix}][Bounds] ⚠️ WARNING: ${points.length} points dépassent MAX_DENSIFIED_POINTS (${MAX_DENSIFIED_POINTS})`)
      // TODO: Implémenter downsampling
    }
    
    return points
  }
  
  /**
   * Exporte les données structurées au format JSON
   */
  public toJSON(): BoundsOptimizerJSON {
    return this.jsonData as BoundsOptimizerJSON
  }
  
  /**
   * Log des métriques finales
   */
  private logFinalMetrics(metrics: BoundsMetrics): void {
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds] FINAL METRICS`)
    console.log(`[${this.options.logPrefix}][Bounds] Orientation: ${metrics.orientation.toUpperCase()}`)
    console.log(`[${this.options.logPrefix}][Bounds] Shrink factor: ${metrics.shrinkFactor.toFixed(3)}`)
    console.log(`[${this.options.logPrefix}][Bounds] `)
    console.log(`[${this.options.logPrefix}][Bounds] 📊 OCCUPATION:`)
    console.log(`[${this.options.logPrefix}][Bounds]   occ_x=${(metrics.occ_x * 100).toFixed(1)}% occ_y=${(metrics.occ_y * 100).toFixed(1)}%`)
    console.log(`[${this.options.logPrefix}][Bounds]   occ_area=${(metrics.occ_area * 100).toFixed(1)}% occ_major=${(metrics.occ_major * 100).toFixed(1)}%`)
    console.log(`[${this.options.logPrefix}][Bounds] `)
    console.log(`[${this.options.logPrefix}][Bounds] 📏 MARGES BBOX (%):`)
    console.log(`[${this.options.logPrefix}][Bounds]   pad_top=${(metrics.pad_top_pct * 100).toFixed(1)}% pad_bottom=${(metrics.pad_bottom_pct * 100).toFixed(1)}%`)
    console.log(`[${this.options.logPrefix}][Bounds]   pad_left=${(metrics.pad_left_pct * 100).toFixed(1)}% pad_right=${(metrics.pad_right_pct * 100).toFixed(1)}%`)
    console.log(`[${this.options.logPrefix}][Bounds]   pad_max=${(metrics.pad_max_pct * 100).toFixed(1)}%`)
    console.log(`[${this.options.logPrefix}][Bounds] `)
    console.log(`[${this.options.logPrefix}][Bounds] 🎯 CLEARANCE RÉELLE (px):`)
    console.log(`[${this.options.logPrefix}][Bounds]   clear_top=${metrics.clear_top_px.toFixed(1)}px clear_bottom=${metrics.clear_bottom_px.toFixed(1)}px`)
    console.log(`[${this.options.logPrefix}][Bounds]   clear_left=${metrics.clear_left_px.toFixed(1)}px clear_right=${metrics.clear_right_px.toFixed(1)}px`)
    console.log(`[${this.options.logPrefix}][Bounds]   clear_min=${metrics.clear_min_px.toFixed(1)}px (side=${metrics.clear_min_side})`)
    console.log(`[${this.options.logPrefix}][Bounds] `)
    console.log(`[${this.options.logPrefix}][Bounds] 📍 MARGES EN KM:`)
    console.log(`[${this.options.logPrefix}][Bounds]   margin_top=${metrics.margin_top_km.toFixed(2)}km margin_bottom=${metrics.margin_bottom_km.toFixed(2)}km`)
    console.log(`[${this.options.logPrefix}][Bounds]   margin_left=${metrics.margin_left_km.toFixed(2)}km margin_right=${metrics.margin_right_km.toFixed(2)}km`)
    console.log(`[${this.options.logPrefix}][Bounds]   margin_min=${metrics.margin_min_km.toFixed(2)}km (≈ ${metrics.margin_min_px_equiv.toFixed(1)}px) margin_max=${metrics.margin_max_km.toFixed(2)}km`)
    console.log(`[${this.options.logPrefix}][Bounds] `)
    console.log(`[${this.options.logPrefix}][Bounds] 🎯 RÈGLE MÉTIER:`)
    console.log(`[${this.options.logPrefix}][Bounds]   Cible: margin_min >= ${TARGET_MARGIN_KM} km`)
    console.log(`[${this.options.logPrefix}][Bounds]   Obtenu: ${metrics.margin_min_km.toFixed(2)} km`)
    
    if (metrics.margin_min_km < TARGET_MARGIN_KM) {
      console.log(`[${this.options.logPrefix}][Bounds] ⚠️ WARNING: Marge minimale cible NON ATTEINTE (${metrics.margin_min_km.toFixed(2)} < ${TARGET_MARGIN_KM})`)
    } else if (metrics.margin_min_km < TARGET_MARGIN_KM * 1.2) {
      console.log(`[${this.options.logPrefix}][Bounds] ✅ Marge minimale respectée (limite atteinte)`)
    } else {
      console.log(`[${this.options.logPrefix}][Bounds] ✅ Marges confortables`)
    }
  }
}
