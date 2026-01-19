import L from 'leaflet'
import { apiUrl } from '../api'
import { getGeologieColor, getPedologieColor, getRiskColor } from './context-layer-styles'

// Type pour les styles chargés depuis l'API
export interface LayerStyleItem {
  unit_code: string
  unit_label: string
  color_hex: string
  sort_order: number
}

// Cache des styles chargés depuis l'API
const styleCache: Record<string, Map<string, LayerStyleItem>> = {}

/**
 * Charge les styles d'une couche depuis l'API (avec cache)
 */
export async function loadLayerStyles(layerId: 'geologie' | 'pedologie' | 'risque'): Promise<Map<string, LayerStyleItem>> {
  if (styleCache[layerId]) return styleCache[layerId]
  
  try {
    const res = await fetch(apiUrl(`/layers/${layerId}/styles`))
    if (!res.ok) {
      console.warn(`[ContextLayers] Failed to load styles for ${layerId}:`, res.status)
      return new Map()
    }
    
    const data: LayerStyleItem[] = await res.json()
    const map = new Map<string, LayerStyleItem>()
    
    for (const s of data) {
      // Mapper par label pour correspondre aux données GeoJSON
      map.set(s.unit_label, s)
      // Aussi mapper par code au cas où
      map.set(s.unit_code, s)
    }
    
    styleCache[layerId] = map
    console.log(`[ContextLayers] Loaded ${data.length} styles for ${layerId}`)
    return map
  } catch (e) {
    console.error(`[ContextLayers] Error loading styles for ${layerId}:`, e)
    return new Map()
  }
}

/**
 * Récupère les styles depuis le cache (sync, pour utilisation dans style function)
 */
export function getCachedStyles(layerId: string): Map<string, LayerStyleItem> | undefined {
  return styleCache[layerId]
}

/**
 * Gestionnaire des couches de contexte (géologie, pédologie, risque de gonflement)
 * Avec styles chargés depuis la BDD pour cohérence QGIS
 */
export class ContextLayersManager {
  private map: L.Map
  private geologieLayer: L.GeoJSON | null = null
  private pedologieLayer: L.GeoJSON | null = null
  private risqueGonflementLayer: L.GeoJSON | null = null
  private dsmLayer: L.TileLayer | null = null
  private dsmErrorCount: number = 0
  private readonly MAX_DSM_ERRORS = 10
  private dsmLoadedTilesCount: number = 0

  constructor(map: L.Map) {
    this.map = map
  }

  /**
   * Toggle context layer
   */
  async toggleLayer(layerType: 'geologie' | 'pedologie' | 'risque-gonflement' | 'dsm', show: boolean): Promise<void> {
    if (show) {
      await this.loadLayer(layerType)
    } else {
      this.removeLayer(layerType)
    }
  }

  /**
   * Load and display a context layer
   * Charge les styles depuis l'API avant d'afficher la couche
   */
  private async loadLayer(layerType: string): Promise<void> {
    // DSM est une couche raster (TileLayer), pas GeoJSON
    if (layerType === 'dsm') {
      this.loadDsmLayer()
      return
    }

    const bounds = this.map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

    try {
      // Charger les styles depuis l'API d'abord
      const styleLayerId = layerType === 'risque-gonflement' ? 'risque' : layerType
      await loadLayerStyles(styleLayerId as 'geologie' | 'pedologie' | 'risque')
      
      const url = apiUrl(`/layers/${layerType}`) + `?bbox=${bbox}`
      console.log(`[ContextLayers] Loading ${layerType} from ${url}`)
      
      const headers: HeadersInit = {}
      const token = localStorage.getItem('atlas_token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, { headers })
      if (!response.ok) throw new Error(`Failed to load ${layerType}: ${response.status} ${response.statusText}`)

      const geojson = await response.json()

      // Utiliser contextPane pour que les couches soient au-dessus des mailles
      const layer = L.geoJSON(geojson, {
        pane: 'contextPane', // Pane dédié au-dessus de gridPane
        style: (feature) => this.getLayerStyle(layerType, feature),
        interactive: false
      })

      layer.addTo(this.map)

      if (layerType === 'geologie') {
        this.geologieLayer = layer
      } else if (layerType === 'pedologie') {
        this.pedologieLayer = layer
      } else if (layerType === 'risque-gonflement') {
        this.risqueGonflementLayer = layer
      }

      console.log(`[ContextLayers] ${layerType} loaded with ${geojson.features?.length || 0} features (using contextPane)`)
    } catch (error) {
      console.error(`[ContextLayers] Error loading ${layerType}:`, error)
    }
  }

  /**
   * Load DSM/Relief raster layer from tileserver
   * Utilise togo_map comme fallback (dsm-cop30 non disponible)
   * Gère les erreurs de tuiles avec désactivation automatique si trop d'erreurs
   */
  private loadDsmLayer(): void {
    if (this.dsmLayer) {
      console.log('[ContextLayers] DSM/Relief already loaded, removing and reloading')
      this.map.removeLayer(this.dsmLayer)
      this.dsmLayer = null
    }
    
    // Reset error counter
    this.dsmErrorCount = 0
    this.dsmLoadedTilesCount = 0

    // URL du tileserver - tileset DSM dédié (dsm_cop30)
    const tileserverUrl = (import.meta as any).env?.VITE_TILES_URL || 'http://localhost:8081'
    const dsmUrl = `${tileserverUrl}/data/dsm_cop30/{z}/{x}/{y}.png`
    console.log('[ContextLayers] Loading relief (dsm_cop30) from:', dsmUrl)

    // Limiter les requêtes de tuiles à l'emprise du Togo pour réduire les 404
    // (à ajuster si besoin, mais suffisant pour éviter les demandes hors zone)
    const togoBounds = L.latLngBounds(
      L.latLng(6.0, -0.2),
      L.latLng(11.2, 1.9)
    )
    
    this.dsmLayer = L.tileLayer(dsmUrl, {
      attribution: 'Relief - DSM COP30',
      opacity: 0.6,
      maxZoom: 18,
      // Le tileset dsm_cop30 est actuellement généré à z=12 uniquement
      // Autoriser l'affichage à tous les zooms via overzoom (Leaflet scale les tuiles z=12)
      minZoom: 0,
      minNativeZoom: 12,
      maxNativeZoom: 12,
      pane: 'dsmPane',
      tileSize: 256,
      bounds: togoBounds,
      noWrap: true,
      errorTileUrl: '' // Pas de tuile d'erreur visible
    })

    // Ajouter la couche à la carte
    this.dsmLayer.addTo(this.map)
    
    // Mettre la couche au-dessus (pane dédié + bringToFront)
    this.dsmLayer.bringToFront()
    
    // Gestion des erreurs avec désactivation si trop d'erreurs
    this.dsmLayer.on('tileerror', (e: any) => {
      this.dsmErrorCount++
      if (this.dsmErrorCount <= 3) {
        console.warn(
          `[ContextLayers] Relief tile error (${this.dsmErrorCount}/${this.MAX_DSM_ERRORS}, loaded=${this.dsmLoadedTilesCount}):`,
          e.coords
        )
      }
      
      // Désactiver si trop d'erreurs
      if (this.dsmLoadedTilesCount === 0 && this.dsmErrorCount >= this.MAX_DSM_ERRORS && this.dsmLayer) {
        console.error('[ContextLayers] Too many tile errors with no loaded tiles, disabling relief layer')
        this.map.removeLayer(this.dsmLayer)
        this.dsmLayer = null
        
        // Décocher la checkbox dans l'UI
        const checkbox = document.getElementById('toggleDsm') as HTMLInputElement
        if (checkbox) checkbox.checked = false
        
        // Notifier l'utilisateur
        const maybeToast = (window as any).toast
        if (typeof maybeToast === 'function') {
          maybeToast('⚠️ Relief désactivé: tuiles non disponibles')
        }
      }
    })

    this.dsmLayer.on('tileload', () => {
      this.dsmLoadedTilesCount++
    })
    
    this.dsmLayer.on('load', () => {
      console.log('[ContextLayers] ✅ Relief tiles loaded successfully')
    })
    
    console.log('[ContextLayers] Relief layer added to map (dsm_cop30)')
  }

  /**
   * Remove a context layer
   */
  private removeLayer(layerType: string): void {
    if (layerType === 'dsm') {
      if (this.dsmLayer) {
        this.map.removeLayer(this.dsmLayer)
        this.dsmLayer = null
      }
      return
    }

    let layer: L.GeoJSON | null = null

    if (layerType === 'geologie') {
      layer = this.geologieLayer
      this.geologieLayer = null
    } else if (layerType === 'pedologie') {
      layer = this.pedologieLayer
      this.pedologieLayer = null
    } else if (layerType === 'risque-gonflement') {
      layer = this.risqueGonflementLayer
      this.risqueGonflementLayer = null
    }

    if (layer) {
      this.map.removeLayer(layer)
    }
  }

  /**
   * Get style for context layers
   * Utilise les styles chargés depuis l'API si disponibles, sinon fallback local
   */
  private getLayerStyle(layerType: string, feature?: any): L.PathOptions {
    const props = feature?.properties || {}
    
    switch (layerType) {
      case 'geologie': {
        const libelle = props.libelle || props.unite_geo || props.code
        // Chercher dans le cache des styles API
        const cachedStyles = getCachedStyles('geologie')
        const apiStyle = cachedStyles?.get(libelle)
        const fillColor = apiStyle?.color_hex || getGeologieColor(libelle)
        
        return {
          color: '#555555',
          weight: 0.8,
          fillOpacity: 0.45,
          fillColor
        }
      }
      case 'pedologie': {
        const libelle = props.libelle || props.unite_pedo || props.type_sol
        const cachedStyles = getCachedStyles('pedologie')
        const apiStyle = cachedStyles?.get(libelle)
        const fillColor = apiStyle?.color_hex || getPedologieColor(libelle)
        
        return {
          color: '#555555',
          weight: 0.8,
          fillOpacity: 0.45,
          fillColor
        }
      }
      case 'risque-gonflement': {
        const niveau = props.niveau_risque || props.risque_gonflement || props.classe
        const cachedStyles = getCachedStyles('risque')
        const apiStyle = cachedStyles?.get(niveau)
        const fillColor = apiStyle?.color_hex || getRiskColor(niveau)
        
        return {
          color: '#555555',
          weight: 0.8,
          fillOpacity: 0.5,
          fillColor
        }
      }
      default:
        return {
          color: '#666',
          weight: 1,
          fillOpacity: 0.1,
          fillColor: '#cccccc'
        }
    }
  }

  /**
   * Check if a context layer is currently active
   */
  isLayerActive(layerType: 'geologie' | 'pedologie' | 'risque-gonflement' | 'dsm'): boolean {
    switch (layerType) {
      case 'geologie':
        return this.geologieLayer !== null
      case 'pedologie':
        return this.pedologieLayer !== null
      case 'risque-gonflement':
        return this.risqueGonflementLayer !== null
      case 'dsm':
        return this.dsmLayer !== null
      default:
        return false
    }
  }
  
  /**
   * Set opacity for a context layer
   */
  setLayerOpacity(layerType: 'geologie' | 'pedologie' | 'risque-gonflement' | 'dsm', opacity: number): void {
    switch (layerType) {
      case 'geologie':
        if (this.geologieLayer) {
          this.geologieLayer.setStyle({ fillOpacity: opacity })
        }
        break
      case 'pedologie':
        if (this.pedologieLayer) {
          this.pedologieLayer.setStyle({ fillOpacity: opacity })
        }
        break
      case 'risque-gonflement':
        if (this.risqueGonflementLayer) {
          this.risqueGonflementLayer.setStyle({ fillOpacity: opacity })
        }
        break
      case 'dsm':
        if (this.dsmLayer) {
          this.dsmLayer.setOpacity(opacity)
        }
        break
    }
  }

  /**
   * Clear all context layers
   */
  clearAll(): void {
    this.removeLayer('geologie')
    this.removeLayer('pedologie')
    this.removeLayer('risque-gonflement')
    this.removeLayer('dsm')
  }
}
