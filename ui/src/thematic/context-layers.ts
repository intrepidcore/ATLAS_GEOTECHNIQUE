import L from 'leaflet'
import { apiUrl } from '../api'

/**
 * Gestionnaire des couches de contexte (géologie, pédologie, risque de gonflement)
 */
export class ContextLayersManager {
  private map: L.Map
  private geologieLayer: L.GeoJSON | null = null
  private pedologieLayer: L.GeoJSON | null = null
  private risqueGonflementLayer: L.GeoJSON | null = null

  constructor(map: L.Map) {
    this.map = map
  }

  /**
   * Toggle context layer
   */
  async toggleLayer(layerType: 'geologie' | 'pedologie' | 'risque-gonflement', show: boolean): Promise<void> {
    if (show) {
      await this.loadLayer(layerType)
    } else {
      this.removeLayer(layerType)
    }
  }

  /**
   * Load and display a context layer
   */
  private async loadLayer(layerType: string): Promise<void> {
    const bounds = this.map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

    try {
      const url = apiUrl(`/layers/${layerType}`) + `?bbox=${bbox}`
      console.log(`[ContextLayers] Loading ${layerType} from ${url}`)
      
      // Utiliser fetch avec les headers d'auth si disponibles
      const headers: HeadersInit = {}
      const token = localStorage.getItem('atlas_token')
      console.log(`[ContextLayers] Token found:`, token ? `${token.substring(0, 20)}...` : 'NO TOKEN')
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      console.log(`[ContextLayers] Request headers:`, headers)
      const response = await fetch(url, { headers })
      console.log(`[ContextLayers] Response status: ${response.status}`)
      
      if (!response.ok) throw new Error(`Failed to load ${layerType}: ${response.status} ${response.statusText}`)

      const geojson = await response.json()

      const style = this.getLayerStyle(layerType)

      const layer = L.geoJSON(geojson, {
        style: () => style,
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

      console.log(`[ContextLayers] ${layerType} loaded with ${geojson.features?.length || 0} features`)
    } catch (error) {
      console.error(`[ContextLayers] Error loading ${layerType}:`, error)
    }
  }

  /**
   * Remove a context layer
   */
  private removeLayer(layerType: string): void {
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
   */
  private getLayerStyle(layerType: string): L.PathOptions {
    switch (layerType) {
      case 'geologie':
        return {
          color: '#8B4513',
          weight: 1,
          fillOpacity: 0.15,
          fillColor: '#D2691E'
        }
      case 'pedologie':
        return {
          color: '#228B22',
          weight: 1,
          fillOpacity: 0.15,
          fillColor: '#90EE90'
        }
      case 'risque-gonflement':
        return {
          color: '#DC143C',
          weight: 1,
          fillOpacity: 0.2,
          fillColor: '#FFB6C1'
        }
      default:
        return {
          color: '#666',
          weight: 1,
          fillOpacity: 0.1
        }
    }
  }

  /**
   * Check if a context layer is currently active
   */
  isLayerActive(layerType: 'geologie' | 'pedologie' | 'risque-gonflement'): boolean {
    switch (layerType) {
      case 'geologie':
        return this.geologieLayer !== null
      case 'pedologie':
        return this.pedologieLayer !== null
      case 'risque-gonflement':
        return this.risqueGonflementLayer !== null
      default:
        return false
    }
  }

  /**
   * Clear all context layers
   */
  clearAll(): void {
    this.removeLayer('geologie')
    this.removeLayer('pedologie')
    this.removeLayer('risque-gonflement')
  }
}
