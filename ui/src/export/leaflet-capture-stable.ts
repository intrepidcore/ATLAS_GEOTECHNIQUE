/**
 * ÉTAPE 5: Stabilisation capture Leaflet
 * Garantit séquence stable: fitBounds → moveend → tiles loaded → invalidateSize → screenshot
 */

export interface LeafletCaptureTimings {
  t0_fitBounds: number
  t1_moveend: number
  t2_tilesReady: number
  t3_invalidateSize: number
  t4_screenshot: number
  total_ms: number
}

/**
 * Attend que la carte Leaflet soit stable avant capture
 */
export async function waitForLeafletStable(
  map: any,
  timeoutMs: number = 5000
): Promise<LeafletCaptureTimings> {
  
  const timings: LeafletCaptureTimings = {
    t0_fitBounds: performance.now(),
    t1_moveend: 0,
    t2_tilesReady: 0,
    t3_invalidateSize: 0,
    t4_screenshot: 0,
    total_ms: 0
  }
  
  console.log('[LeafletCapture] Attente stabilisation carte...')
  
  // ÉTAPE 1: Attendre moveend
  await new Promise<void>((resolve) => {
    const onMoveEnd = () => {
      timings.t1_moveend = performance.now()
      console.log(`[LeafletCapture] ✅ moveend (${(timings.t1_moveend - timings.t0_fitBounds).toFixed(0)}ms)`)
      map.off('moveend', onMoveEnd)
      resolve()
    }
    map.once('moveend', onMoveEnd)
    
    // Timeout fallback
    setTimeout(() => {
      map.off('moveend', onMoveEnd)
      timings.t1_moveend = performance.now()
      console.warn(`[LeafletCapture] ⚠️ moveend timeout (${(timings.t1_moveend - timings.t0_fitBounds).toFixed(0)}ms)`)
      resolve()
    }, timeoutMs)
  })
  
  // ÉTAPE 2: Attendre tiles loaded
  const tilesReady = await waitForTilesLoaded(map, timeoutMs)
  timings.t2_tilesReady = performance.now()
  console.log(`[LeafletCapture] ${tilesReady ? '✅' : '⚠️'} tiles loaded (${(timings.t2_tilesReady - timings.t1_moveend).toFixed(0)}ms)`)
  
  // ÉTAPE 3: invalidateSize pour garantir dimensions correctes
  map.invalidateSize({ animate: false })
  timings.t3_invalidateSize = performance.now()
  console.log(`[LeafletCapture] ✅ invalidateSize (${(timings.t3_invalidateSize - timings.t2_tilesReady).toFixed(0)}ms)`)
  
  // ÉTAPE 4: Attendre 2 frames pour stabilisation DOM
  await waitFrames(2)
  timings.t4_screenshot = performance.now()
  console.log(`[LeafletCapture] ✅ ready for screenshot (${(timings.t4_screenshot - timings.t3_invalidateSize).toFixed(0)}ms)`)
  
  timings.total_ms = timings.t4_screenshot - timings.t0_fitBounds
  console.log(`[LeafletCapture] 🎯 Total stabilization: ${timings.total_ms.toFixed(0)}ms`)
  
  return timings
}

/**
 * Attend que toutes les tiles soient chargées
 */
async function waitForTilesLoaded(
  map: any,
  timeoutMs: number
): Promise<boolean> {
  
  return new Promise<boolean>((resolve) => {
    let resolved = false
    
    // Compter les tiles en cours de chargement
    const checkTiles = () => {
      if (resolved) return
      
      const tileLayers = []
      map.eachLayer((layer: any) => {
        if (layer._tiles || layer._loading) {
          tileLayers.push(layer)
        }
      })
      
      let loadingCount = 0
      for (const layer of tileLayers) {
        if (layer._loading) {
          loadingCount++
        }
        if (layer._tiles) {
          for (const key in layer._tiles) {
            const tile = layer._tiles[key]
            if (!tile.loaded && !tile.error) {
              loadingCount++
            }
          }
        }
      }
      
      if (loadingCount === 0) {
        resolved = true
        resolve(true)
      }
    }
    
    // Écouter événements tiles
    const onTileLoad = () => checkTiles()
    const onTileError = () => checkTiles()
    const onLoad = () => {
      if (!resolved) {
        resolved = true
        resolve(true)
      }
    }
    
    map.on('load', onLoad)
    map.on('tileload', onTileLoad)
    map.on('tileerror', onTileError)
    
    // Check initial
    checkTiles()
    
    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        map.off('load', onLoad)
        map.off('tileload', onTileLoad)
        map.off('tileerror', onTileError)
        console.warn('[LeafletCapture] Tiles timeout - continuing anyway')
        resolve(false)
      }
    }, timeoutMs)
  })
}

/**
 * Attend N frames d'animation
 */
function waitFrames(n: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let count = 0
    const tick = () => {
      count++
      if (count >= n) {
        resolve()
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Prépare la carte pour capture (dimensions entières, pas de transitions)
 */
export function prepareMapForCapture(
  container: HTMLElement,
  map: any
): { originalWidth: string; originalHeight: string } {
  
  const original = {
    originalWidth: container.style.width,
    originalHeight: container.style.height
  }
  
  // Forcer dimensions entières
  const rect = container.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  
  // Désactiver transitions
  container.style.transition = 'none'
  
  // Forcer recalcul
  map.invalidateSize({ animate: false })
  
  console.log(`[LeafletCapture] Container prepared: ${width}x${height}px`)
  
  return original
}

/**
 * Restaure la carte après capture
 */
export function restoreMapAfterCapture(
  container: HTMLElement,
  map: any,
  original: { originalWidth: string; originalHeight: string }
): void {
  
  container.style.width = original.originalWidth
  container.style.height = original.originalHeight
  container.style.transition = ''
  
  map.invalidateSize({ animate: false })
  
  console.log('[LeafletCapture] Container restored')
}
