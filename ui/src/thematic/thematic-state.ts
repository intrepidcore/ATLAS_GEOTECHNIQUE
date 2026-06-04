/**
 * Système d'état centralisé pour les cartes thématiques
 * Source unique de vérité pour la thématique affichée
 */

import type { ThematicMapConfig, MapType } from './thematic-types'

// ============================================================================
// Types
// ============================================================================

export interface ThematicState {
  parameterId: string
  objectif: 'argilosite' | 'couverture' | 'compacite' | 'granulometrie' | 'gonflement'
  mapType: MapType | 'proportional'
  admFilters: {
    adm1?: string
    adm2?: string
    adm3?: string
  }
  classification?: {
    method: 'quantiles' | 'equal_interval' | 'jenks' | 'manual'
    numClasses: number
    palette: string
  }
}

export interface SetThematicStateOptions {
  source: 'ui' | 'export'
  skipZoom?: boolean
}

export interface ExportFitOptions {
  paddingPx: number
  maxZoom: number
  animate: boolean
}

// ============================================================================
// État global
// ============================================================================

let currentThematicState: ThematicState | null = null
let isReady = false
let readyCallbacks: Array<() => void> = []

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Détecte l'objectif à partir du parameterId
 */
export function detectObjectif(parameterId: string): ThematicState['objectif'] {
  if (['vbs_avg', 'ip_avg', 'wl_avg', 'wp_avg'].includes(parameterId)) {
    return 'argilosite'
  }
  if (['n_sondages', 'n_echantillons', 'n_essais'].includes(parameterId)) {
    return 'couverture'
  }
  if (['gamma_d_max_avg', 'wopt_avg'].includes(parameterId)) {
    return 'compacite'
  }
  if (['passant_80um_avg', 'passant_2mm_avg', 'passant_20mm_avg'].includes(parameterId)) {
    return 'granulometrie'
  }
  if (['eg_avg', 'eg_max'].includes(parameterId)) {
    return 'gonflement'
  }
  return 'couverture' // default
}

/**
 * Calcule les bounds serrés pour un polygone ADM
 */
export function computeTightBoundsForAdm(
  admBounds: { north: number; south: number; east: number; west: number }
): { north: number; south: number; east: number; west: number } {
  // Dimensions du bbox ADM en degrés
  const admWidth = admBounds.east - admBounds.west
  const admHeight = admBounds.north - admBounds.south
  
  // Centre de l'ADM
  const centerLat = (admBounds.north + admBounds.south) / 2
  const centerLng = (admBounds.east + admBounds.west) / 2
  
  // Correction latitude (1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat))
  const latCorrection = Math.cos(centerLat * Math.PI / 180)
  
  // Calculer la compacité de l'ADM (ratio largeur/hauteur en km)
  const admWidthKm = admWidth * 111 * latCorrection
  const admHeightKm = admHeight * 111
  const compactness = admWidthKm / admHeightKm // >1 = horizontal, <1 = vertical
  
  // Marges TRÈS SERRÉES (3-5% max)
  let marginH: number
  let marginV: number
  
  if (compactness > 1.5) {
    marginH = 0.04
    marginV = 0.02
  } else if (compactness < 0.67) {
    marginH = 0.02
    marginV = 0.04
  } else {
    marginH = 0.03
    marginV = 0.03
  }
  
  // Appliquer les marges
  const W1 = admWidth * (1 + 2 * marginH)
  const H1 = admHeight * (1 + 2 * marginV)
  
  // Ratio de la zone carte sur A4 portrait (environ 1.1 à 1.2)
  const sheetRatio = 1.15
  
  // Ratio actuel de l'emprise avec marges
  const currentRatio = H1 / (W1 * latCorrection)
  
  let W2 = W1
  let H2 = H1
  
  if (currentRatio > sheetRatio) {
    W2 = (H1 / sheetRatio) / latCorrection
  } else if (currentRatio < sheetRatio) {
    const idealH2 = W1 * latCorrection * sheetRatio
    const maxExtraHeight = admHeight * 0.15
    H2 = Math.min(idealH2, H1 + maxExtraHeight)
    if (H2 < idealH2) {
      W2 = (H2 / sheetRatio) / latCorrection
    }
  }
  
  return {
    west: centerLng - W2 / 2,
    east: centerLng + W2 / 2,
    south: centerLat - H2 / 2,
    north: centerLat + H2 / 2
  }
}

/**
 * Options de fitBounds pour l'export
 */
export function getExportFitOptions(): ExportFitOptions {
  return {
    paddingPx: 10, // Marge minimale en pixels
    maxZoom: 18,
    animate: false
  }
}

// ============================================================================
// Gestionnaire d'état
// ============================================================================

export function getCurrentState(): ThematicState | null {
  return currentThematicState
}

export function setReady(ready: boolean): void {
  isReady = ready
  if (ready) {
    // Notifier tous les callbacks en attente
    const callbacks = [...readyCallbacks]
    readyCallbacks = []
    callbacks.forEach(cb => cb())
  }
}

export function getIsReady(): boolean {
  return isReady
}

export async function waitUntilReady(timeoutMs: number = 5000): Promise<void> {
  if (isReady) return
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = readyCallbacks.indexOf(resolve)
      if (idx >= 0) readyCallbacks.splice(idx, 1)
      reject(new Error('waitUntilReady timeout'))
    }, timeoutMs)
    
    readyCallbacks.push(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

/**
 * Convertit un ThematicState en ThematicMapConfig
 */
export function stateToConfig(state: ThematicState): ThematicMapConfig {
  return {
    name: state.parameterId,
    objectif: state.objectif,
    parameter: state.parameterId,
    type: (state.mapType === 'proportional' ? 'bubble' : state.mapType) as MapType,
    classification: {
      method: state.classification?.method || 'quantiles',
      n_classes: state.classification?.numClasses || 6
    },
    style: {
      palette: state.classification?.palette || 'Blues',
      opacity: 0.8,
      stroke_width: 0.1, // v4.5.1: Réduit pour export discret
      stroke_color: '#F0F0F0' // v4.5.1: Gris clair
    },
    filters: {
      adm1: state.admFilters.adm1,
      adm2: state.admFilters.adm2,
      adm3: state.admFilters.adm3,
      min_sondages: 1,
      exclude_no_data: true
    }
  }
}

/**
 * Met à jour l'état thématique central
 * C'est LA fonction unique pour changer la thématique
 */
export async function setThematicState(
  next: ThematicState,
  manager: any, // ThematicMapManager
  elements: {
    adm1Select?: HTMLSelectElement
    adm2Select?: HTMLSelectElement
    adm3Select?: HTMLSelectElement
    parameterSelect?: HTMLSelectElement
    mapTypeSelect?: HTMLSelectElement
  },
  opts?: SetThematicStateOptions
): Promise<void> {
  console.log('[ThematicState] setThematicState:', next, opts)
  
  // Marquer comme non prêt
  setReady(false)
  
  // Mettre à jour l'état global
  currentThematicState = next
  
  // Synchroniser l'UI si demandé (pour l'export, on met à jour les selects sans events)
  if (opts?.source === 'export') {
    if (elements.adm1Select) {
      elements.adm1Select.value = next.admFilters.adm1 || ''
    }
    if (elements.adm2Select) {
      elements.adm2Select.value = next.admFilters.adm2 || ''
    }
    if (elements.adm3Select) {
      elements.adm3Select.value = next.admFilters.adm3 || ''
    }
    if (elements.parameterSelect) {
      elements.parameterSelect.value = next.parameterId
    }
    if (elements.mapTypeSelect) {
      elements.mapTypeSelect.value = next.mapType
    }
  }
  
  // Convertir en config et appeler le manager
  const config = stateToConfig(next)
  
  try {
    // Charger la carte thématique
    await manager.loadThematicMap(config)
    
    // Mettre à jour l'overlay ADM
    await manager.updateAdmOverlay(
      next.admFilters.adm1 || null,
      next.admFilters.adm2 || null,
      next.admFilters.adm3 || null
    )
    
    // Marquer comme prêt
    setReady(true)
    console.log('[ThematicState] Carte thématique prête')
  } catch (e) {
    console.error('[ThematicState] Erreur:', e)
    setReady(true) // Marquer comme prêt même en cas d'erreur pour éviter les blocages
    throw e
  }
}

// ============================================================================
// Orchestrateur d'export
// ============================================================================

export interface ExportThematicMapOptions {
  parameterId: string
  admLevel: 'adm1' | 'adm2' | 'adm3'
  admName: string
  adm1?: string // Pour ADM2/ADM3, le parent ADM1
  adm2?: string // Pour ADM3, le parent ADM2
  boundaryLevel?: 'none' | 'adm1' | 'adm2'
}

/**
 * Fonction principale d'export d'une carte thématique pour un ADM
 * Encapsule toute la séquence : changement thématique → attente → cadrage → capture
 */
export async function exportThematicMapForADM(
  opts: ExportThematicMapOptions,
  manager: any,
  map: any,
  elements: any,
  captureFunction: () => Promise<Blob | null>
): Promise<Blob | null> {
  console.log('[ThematicState] exportThematicMapForADM:', opts)
  
  // 1. Construire l'état thématique
  const admFilters: ThematicState['admFilters'] = {}
  
  if (opts.admLevel === 'adm1') {
    admFilters.adm1 = opts.admName
  } else if (opts.admLevel === 'adm2') {
    admFilters.adm1 = opts.adm1
    admFilters.adm2 = opts.admName
  } else if (opts.admLevel === 'adm3') {
    admFilters.adm1 = opts.adm1
    admFilters.adm2 = opts.adm2
    admFilters.adm3 = opts.admName
  }
  
  const state: ThematicState = {
    parameterId: opts.parameterId,
    objectif: detectObjectif(opts.parameterId),
    mapType: 'choropleth',
    admFilters
  }
  
  // 2. Mettre à jour l'état thématique
  await setThematicState(state, manager, elements, { source: 'export' })
  
  // 3. Attendre que la carte soit prête
  await waitUntilReady(8000)
  
  // 4. Attendre un peu plus pour le rendu complet
  await new Promise(r => setTimeout(r, 300))
  
  // 5. Cadrer la carte sur l'ADM
  await fitMapForExport(manager, map)
  
  // 6. Attendre la fin du zoom
  await new Promise(r => setTimeout(r, 500))
  
  // 7. Capturer la carte
  const blob = await captureFunction()
  
  return blob
}

/**
 * Cadre la carte sur l'ADM actuel avec des marges serrées
 */
export async function fitMapForExport(manager: any, map: any): Promise<void> {
  const admBounds = manager.getAdmOverlayBounds?.()
  if (!admBounds) {
    console.warn('[ThematicState] Pas de bounds ADM disponibles')
    return
  }
  
  // Calculer les bounds serrés
  const tightBounds = computeTightBoundsForAdm(admBounds)
  const fitOptions = getExportFitOptions()
  
  console.log('[ThematicState] fitMapForExport:', {
    original: admBounds,
    tight: tightBounds,
    options: fitOptions
  })
  
  // Invalider la taille de la carte (comme l'export Pro)
  map.invalidateSize(false)
  
  // Créer les bounds Leaflet
  const L = (window as any).L
  const leafletBounds = L.latLngBounds(
    [tightBounds.south, tightBounds.west],
    [tightBounds.north, tightBounds.east]
  )
  
  // Appliquer le zoom
  map.fitBounds(leafletBounds, {
    animate: fitOptions.animate,
    padding: [fitOptions.paddingPx, fitOptions.paddingPx],
    maxZoom: fitOptions.maxZoom
  })
  
  // Attendre la fin du zoom
  await new Promise<void>(resolve => {
    const handler = () => {
      map.off('moveend', handler)
      resolve()
    }
    map.on('moveend', handler)
    setTimeout(() => {
      map.off('moveend', handler)
      resolve()
    }, 2000)
  })
}
