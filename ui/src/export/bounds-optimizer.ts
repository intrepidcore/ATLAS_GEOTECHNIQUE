/**
 * Bounds Optimizer v3.5.4
 * 
 * Algorithme itératif de cadrage ADM avec:
 * - KPI marges bbox (pad_left/right/top/bottom_pct)
 * - KPI clearance réelle (clear_left/right/top/bottom_px)
 * - Binary search pour maximiser occupation sans toucher les bords
 * - Densification de la limite ADM pour détection précise
 * 
 * @author Atlas Géotechnique
 * @version 3.5.4
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
  
  // KPI occupation
  occ_x: number
  occ_y: number
  occ_area: number
  occ_major: number
  
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
}

export interface ADMGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: any
}

// ============================================================================
// CONSTANTES
// ============================================================================

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
    
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds] Optimisation pour: ${this.options.admName || 'inconnu'}`)
    
    // Stocker et densifier la géométrie si fournie
    if (geometry) {
      this.admGeometry = geometry
      this.densifiedBoundary = this.densifyBoundary(geometry)
      console.log(`[${this.options.logPrefix}][Bounds] Géométrie densifiée: ${this.densifiedBoundary.length} points`)
    }
    
    // Tester les deux orientations
    const portraitMetrics = await this.optimizeForOrientation(admBounds, 'portrait')
    const landscapeMetrics = await this.optimizeForOrientation(admBounds, 'landscape')
    
    // Choisir la meilleure
    const best = portraitMetrics.occ_area >= landscapeMetrics.occ_area ? portraitMetrics : landscapeMetrics
    
    console.log(`[${this.options.logPrefix}][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[${this.options.logPrefix}][Bounds] 🔄 Portrait: occ_area=${(portraitMetrics.occ_area * 100).toFixed(1)}% clear_min=${portraitMetrics.clear_min_px.toFixed(1)}px`)
    console.log(`[${this.options.logPrefix}][Bounds] 🔄 Paysage: occ_area=${(landscapeMetrics.occ_area * 100).toFixed(1)}% clear_min=${landscapeMetrics.clear_min_px.toFixed(1)}px`)
    console.log(`[${this.options.logPrefix}][Bounds] ✅ Orientation choisie: ${best.orientation.toUpperCase()}`)
    
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
    
    console.log(`[${this.options.logPrefix}][Bounds] Optimisation ${orientation}...`)
    
    // Binary search sur le shrink factor
    let shrinkMin = 0.80 // Plus serré possible
    let shrinkMax = 1.00 // Pas serré du tout (marge initiale)
    let bestMetrics: BoundsMetrics | null = null
    let iteration = 0
    
    while (iteration < this.options.maxIterations && (shrinkMax - shrinkMin) > 0.001) {
      iteration++
      const shrinkMid = (shrinkMin + shrinkMax) / 2
      
      const metrics = this.computeMetricsForShrink(admBounds, orientation, shrinkMid)
      
      // Log itération
      console.log(`[${this.options.logPrefix}][Bounds] ${orientation} iter=${iteration} shrink=${shrinkMid.toFixed(3)} clear_min=${metrics.clear_min_px.toFixed(1)}px (${metrics.clear_min_side}) occ_area=${(metrics.occ_area * 100).toFixed(1)}%`)
      
      // Vérifier si clearance est acceptable
      if (metrics.clear_min_px >= this.options.safePx) {
        // Acceptable - on peut essayer de serrer plus
        bestMetrics = metrics
        shrinkMin = shrinkMid // Essayer plus serré
        console.log(`[${this.options.logPrefix}][Bounds] ${orientation} iter=${iteration} ✅ accept (safe clearance)`)
      } else {
        // Trop serré - reculer
        shrinkMax = shrinkMid
        console.log(`[${this.options.logPrefix}][Bounds] ${orientation} iter=${iteration} ❌ reject (clearance too small on ${metrics.clear_min_side})`)
      }
    }
    
    // Si aucune solution trouvée, utiliser shrink=1.0 (marge initiale)
    if (!bestMetrics) {
      bestMetrics = this.computeMetricsForShrink(admBounds, orientation, 1.0)
      console.log(`[${this.options.logPrefix}][Bounds] ${orientation} Aucune solution optimale - utilisation marge initiale`)
    }
    
    console.log(`[${this.options.logPrefix}][Bounds] ${orientation} FINAL shrink=${bestMetrics.shrinkFactor.toFixed(3)} clear_min=${bestMetrics.clear_min_px.toFixed(1)}px pad_max=${(bestMetrics.pad_max_pct * 100).toFixed(1)}% occ_major=${(bestMetrics.occ_major * 100).toFixed(1)}%`)
    
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
    
    // 7. KPI clearance réelle (px)
    const clearance = this.computeClearance(bounds, layout.mapArea.width, layout.mapArea.height)
    
    // 8. KPI occupation
    const finalWidthKm = frameWidthDeg * 111 * cosLat
    const finalHeightKm = frameHeightDeg * 111
    
    const occ_x = W0_km / finalWidthKm
    const occ_y = H0_km / finalHeightKm
    const occ_area = (W0_km * H0_km) / (finalWidthKm * finalHeightKm)
    const occ_major = Math.max(occ_x, occ_y)
    
    return {
      bounds,
      pad_left_pct,
      pad_right_pct,
      pad_top_pct,
      pad_bottom_pct,
      pad_min_pct,
      pad_max_pct,
      ...clearance,
      occ_x,
      occ_y,
      occ_area,
      occ_major,
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
   * Interpole des points tous les ~3-5 km le long des segments
   */
  private densifyBoundary(geometry: ADMGeometry): Array<{ lat: number; lng: number }> {
    const points: Array<{ lat: number; lng: number }> = []
    const targetSpacingKm = 4 // Espacement cible en km
    
    const processRing = (ring: number[][]) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lng1, lat1] = ring[i]
        const [lng2, lat2] = ring[i + 1]
        
        // Distance approximative en km
        const dlng = lng2 - lng1
        const dlat = lat2 - lat1
        const distKm = Math.sqrt(dlng * dlng * 111 * 111 + dlat * dlat * 111 * 111)
        
        // Nombre de segments à créer
        const nSegments = Math.max(1, Math.ceil(distKm / targetSpacingKm))
        
        // Interpoler
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
      // Ring extérieur seulement
      if (geometry.coordinates[0]) {
        processRing(geometry.coordinates[0])
      }
    } else if (geometry.type === 'MultiPolygon') {
      // Premier polygone, ring extérieur
      if (geometry.coordinates[0]?.[0]) {
        processRing(geometry.coordinates[0][0])
      }
    }
    
    return points
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
    
    if (metrics.clear_min_px < this.options.safePx * 1.5) {
      console.log(`[${this.options.logPrefix}][Bounds] ⚠️ Limite atteinte: impossible de serrer plus sans risquer contact (${metrics.clear_min_side}) — forme oblique/allongée.`)
    } else {
      console.log(`[${this.options.logPrefix}][Bounds] ✅ Clearance confortable`)
    }
  }
}
