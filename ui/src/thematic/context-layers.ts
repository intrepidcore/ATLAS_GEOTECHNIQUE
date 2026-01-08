import L from 'leaflet'
import { apiUrl } from '../api'
import { getGeologieColor, getPedologieColor, getRiskColor } from './context-layer-styles'

/**
 * Gestionnaire des couches de contexte (géologie, pédologie, risque de gonflement)
 * Avec styles QGIS identiques pour cohérence visuelle
 */
export class ContextLayersManager {
  private map: L.Map
  private geologieLayer: L.GeoJSON | null = null
  private pedologieLayer: L.GeoJSON | null = null
  private risqueGonflementLayer: L.GeoJSON | null = null
  private dsmLayer: L.TileLayer | null = null

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

      const layer = L.geoJSON(geojson, {
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

      console.log(`[ContextLayers] ${layerType} loaded with ${geojson.features?.length || 0} features`)
    } catch (error) {
      console.error(`[ContextLayers] Error loading ${layerType}:`, error)
    }
  }

  /**
   * Load DSM raster layer from tileserver
   */
  private loadDsmLayer(): void {
    if (this.dsmLayer) {
      console.log('[ContextLayers] DSM already loaded')
      return
    }

    // URL du tileserver pour DSM COP30
    const dsmUrl = 'http://localhost:8081/styles/dsm-cop30/{z}/{x}/{y}.png'
    
    this.dsmLayer = L.tileLayer(dsmUrl, {
      attribution: 'DSM Copernicus DEM GLO-30',
      opacity: 0.5,
      maxZoom: 18,
      tileSize: 256
    })

    this.dsmLayer.addTo(this.map)
    console.log('[ContextLayers] DSM layer loaded from tileserver')
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
   * Get style for context layers with QGIS colors
   */
  private getLayerStyle(layerType: string, feature?: any): L.PathOptions {
    const props = feature?.properties || {};
    
    switch (layerType) {
      case 'geologie': {
        const unite = props.libelle || props.unite_geo || props.code;
        const fillColor = getGeologieColor(unite);
        return {
          color: '#555555',
          weight: 1,
          fillOpacity: 0.35,
          fillColor
        };
      }
      case 'pedologie': {
        const unite = props.libelle || props.unite_pedo || props.type_sol;
        const fillColor = getPedologieColor(unite);
        return {
          color: '#555555',
          weight: 1,
          fillOpacity: 0.35,
          fillColor
        };
      }
      case 'risque-gonflement': {
        const classe = props.niveau_risque || props.risque_gonflement || props.classe;
        const fillColor = getRiskColor(classe);
        return {
          color: '#555555',
          weight: 1,
          fillOpacity: 0.4,
          fillColor
        };
      }
      default:
        return {
          color: '#666',
          weight: 1,
          fillOpacity: 0.1,
          fillColor: '#cccccc'
        };
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
   * Clear all context layers
   */
  clearAll(): void {
    this.removeLayer('geologie')
    this.removeLayer('pedologie')
    this.removeLayer('risque-gonflement')
    this.removeLayer('dsm')
  }
}
