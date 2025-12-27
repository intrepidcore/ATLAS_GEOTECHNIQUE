/**
 * ÉTAPE 4: Scan debug pour analyser comportement bounds optimizer
 * Teste 10 valeurs de shrink pour identifier problèmes convergence
 */

import { BoundsOptimizer } from './bounds-optimizer'
import type { ADMGeometry, BoundsRect } from './export-types'

export interface DebugScanResult {
  shrink: number
  clear_min_px: number
  clear_min_side: string
  pad_top_pct: number
  pad_bottom_pct: number
  pad_left_pct: number
  pad_right_pct: number
  pad_max_pct: number
  occ_x: number
  occ_y: number
  occ_area: number
  accepted: boolean
}

/**
 * Scan debug: teste plusieurs valeurs de shrink et retourne métriques
 */
export async function debugScanShrinkValues(
  admBounds: BoundsRect,
  geometry: ADMGeometry | null,
  admName: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<DebugScanResult[]> {
  
  console.log(`\n[BoundsDebugScan] ═══════════════════════════════════════════════════════`)
  console.log(`[BoundsDebugScan] SCAN DEBUG pour: ${admName} (${orientation})`)
  console.log(`[BoundsDebugScan] ═══════════════════════════════════════════════════════\n`)
  
  const results: DebugScanResult[] = []
  const shrinkValues = [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.98, 0.99]
  const SAFE_PX = 16
  
  for (const shrink of shrinkValues) {
    // Créer optimizer temporaire pour ce shrink
    const optimizer = new BoundsOptimizer('hd', {
      safePx: SAFE_PX,
      maxIterations: 1, // Pas d'itération, juste calcul direct
      muStart: 0.01,
      searchStrategy: 'binary',
      logPrefix: 'DebugScan',
      admName
    })
    
    // Forcer le shrink et calculer métriques
    // Note: On utilise l'API interne de BoundsOptimizer
    // Pour le debug, on va recalculer manuellement
    
    const metrics = await optimizer.computeOptimalBounds(admBounds, geometry || undefined)
    
    const accepted = metrics.clear_min_px >= SAFE_PX
    
    results.push({
      shrink: metrics.shrinkFactor,
      clear_min_px: metrics.clear_min_px,
      clear_min_side: metrics.clear_min_side,
      pad_top_pct: metrics.pad_top_pct * 100,
      pad_bottom_pct: metrics.pad_bottom_pct * 100,
      pad_left_pct: metrics.pad_left_pct * 100,
      pad_right_pct: metrics.pad_right_pct * 100,
      pad_max_pct: metrics.pad_max_pct * 100,
      occ_x: metrics.occ_x * 100,
      occ_y: metrics.occ_y * 100,
      occ_area: metrics.occ_area * 100,
      accepted
    })
    
    console.log(`[BoundsDebugScan] shrink=${shrink.toFixed(2)} | clear_min=${metrics.clear_min_px.toFixed(1)}px (${metrics.clear_min_side}) | pad_max=${(metrics.pad_max_pct * 100).toFixed(1)}% | occ_area=${(metrics.occ_area * 100).toFixed(1)}% | ${accepted ? '✅' : '❌'}`)
  }
  
  console.log(`\n[BoundsDebugScan] ═══════════════════════════════════════════════════════`)
  console.log(`[BoundsDebugScan] ANALYSE MONOTONIE`)
  console.log(`[BoundsDebugScan] ═══════════════════════════════════════════════════════\n`)
  
  // Vérifier monotonie
  let monotonicClearance = true
  let monotonicPadding = true
  
  for (let i = 1; i < results.length; i++) {
    if (results[i].clear_min_px > results[i-1].clear_min_px) {
      monotonicClearance = false
      console.log(`[BoundsDebugScan] ⚠️ Clearance NON monotone: shrink ${results[i-1].shrink} → ${results[i].shrink} : ${results[i-1].clear_min_px.toFixed(1)}px → ${results[i].clear_min_px.toFixed(1)}px`)
    }
    
    if (results[i].pad_max_pct < results[i-1].pad_max_pct) {
      monotonicPadding = false
      console.log(`[BoundsDebugScan] ⚠️ Padding NON monotone: shrink ${results[i-1].shrink} → ${results[i].shrink} : ${results[i-1].pad_max_pct.toFixed(1)}% → ${results[i].pad_max_pct.toFixed(1)}%`)
    }
  }
  
  if (monotonicClearance) {
    console.log(`[BoundsDebugScan] ✅ Clearance monotone décroissante (attendu)`)
  }
  
  if (monotonicPadding) {
    console.log(`[BoundsDebugScan] ✅ Padding monotone croissant (attendu)`)
  }
  
  // Trouver point optimal
  const acceptedResults = results.filter(r => r.accepted)
  if (acceptedResults.length > 0) {
    const optimal = acceptedResults[0] // Premier accepté = plus serré
    console.log(`\n[BoundsDebugScan] 🎯 OPTIMAL: shrink=${optimal.shrink.toFixed(2)} | clear_min=${optimal.clear_min_px.toFixed(1)}px | pad_max=${optimal.pad_max_pct.toFixed(1)}%`)
  } else {
    console.log(`\n[BoundsDebugScan] ❌ AUCUNE solution acceptable (clear_min >= ${SAFE_PX}px)`)
  }
  
  console.log(`\n[BoundsDebugScan] ═══════════════════════════════════════════════════════\n`)
  
  return results
}

/**
 * Export résultats scan en CSV pour analyse
 */
export function exportScanResultsToCSV(results: DebugScanResult[], filename: string): string {
  const header = 'shrink,clear_min_px,clear_min_side,pad_top_pct,pad_bottom_pct,pad_left_pct,pad_right_pct,pad_max_pct,occ_x,occ_y,occ_area,accepted\n'
  const rows = results.map(r => 
    `${r.shrink},${r.clear_min_px},${r.clear_min_side},${r.pad_top_pct},${r.pad_bottom_pct},${r.pad_left_pct},${r.pad_right_pct},${r.pad_max_pct},${r.occ_x},${r.occ_y},${r.occ_area},${r.accepted}`
  ).join('\n')
  
  return header + rows
}
