import L from 'leaflet'
import type {
  ThematicMapConfig,
  ThematicData,
  Classification,
  Statistics,
  ThematicParameter,
  THEMATIC_PARAMETERS
} from './thematic-types'

export class ThematicMapManager {
  private map: L.Map
  private apiUrl: string
  private currentLayer: L.GeoJSON | null = null
  private currentConfig: ThematicMapConfig | null = null
  private legendControl: L.Control | null = null
  private currentClassification: Classification | null = null
  
  constructor(map: L.Map, apiUrl: string) {
    this.map = map
    this.apiUrl = apiUrl
  }
  
  /**
   * Charger et afficher une carte thématique
   */
  async loadThematicMap(config: ThematicMapConfig): Promise<void> {
    try {
      console.log('[ThematicMap] Chargement config:', config)
      
      // 1. Récupérer les données
      const data = await this.fetchThematicData(config)
      console.log('[ThematicMap] Données récupérées:', data.features.length, 'features')
      
      // 2. Classifier les données
      const classification = await this.classifyData(config, data)
      console.log('[ThematicMap] Classification:', classification)
      
      // 3. Afficher sur la carte
      if (config.type === 'choropleth') {
        this.renderChoropleth(data, classification, config)
      } else if (config.type === 'proportional') {
        this.renderProportional(data, classification, config)
      }
      
      // 4. Afficher la légende
      this.showLegend(classification, data.statistics, config)
      
      // 5. Sauvegarder la config actuelle
      this.currentConfig = config
      this.currentClassification = classification
      
      // 6. Émettre événement
      this.map.fire('thematicmap:loaded', { config, data, classification })
      
    } catch (error) {
      console.error('[ThematicMap] Erreur:', error)
      throw error
    }
  }
  
  /**
   * Récupérer les données depuis l'API
   */
  private async fetchThematicData(config: ThematicMapConfig): Promise<ThematicData> {
    const params = new URLSearchParams({
      parameter: config.parameter,
      include_geometry: 'true',
      zoom: this.map.getZoom().toString()
    })
    
    if (config.filters.adm1) params.append('adm1', config.filters.adm1)
    if (config.filters.adm2) params.append('adm2', config.filters.adm2)
    if (config.filters.adm3) params.append('adm3', config.filters.adm3)
    if (config.filters.min_sondages) params.append('min_sondages', config.filters.min_sondages.toString())
    
    if (config.filters.bbox) {
      params.append('bbox', config.filters.bbox.join(','))
    }
    
    const url = `${this.apiUrl}/thematic/data?${params}`
    console.log('[ThematicMap] Fetching:', url)
    
    const response = await fetch(url)
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erreur API: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
  
  /**
   * Classifier les données
   */
  private async classifyData(config: ThematicMapConfig, data: ThematicData): Promise<Classification> {
    // Extraire les valeurs
    const values = data.features
      .map(f => f.properties?.value)
      .filter(v => v != null && !isNaN(v)) as number[]
    
    if (values.length === 0) {
      throw new Error('Aucune valeur à classifier')
    }
    
    // Utiliser classification personnalisée si fournie
    if (config.classification?.method === 'custom' && config.classification.custom_breaks) {
      return {
        breaks: config.classification.custom_breaks,
        colors: await this.getColors(config.style.palette, config.classification.custom_breaks.length + 1),
        labels: this.generateLabels(config.classification.custom_breaks),
        method: 'custom',
        n_classes: config.classification.custom_breaks.length + 1
      }
    }
    
    // Sinon, appeler l'API pour classifier
    const classifyRequest = {
      values,
      method: config.classification?.method || 'quantiles',
      n_classes: config.classification?.n_classes || 5,
      palette: config.style.palette
    }
    
    const response = await fetch(`${this.apiUrl}/thematic/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classifyRequest)
    })
    
    if (!response.ok) {
      throw new Error(`Erreur classification: ${response.status}`)
    }
    
    return response.json()
  }
  
  /**
   * Récupérer les couleurs d'une palette
   */
  private async getColors(palette: string, n: number): Promise<string[]> {
    // Palettes hardcodées pour fallback
    const palettes: Record<string, string[]> = {
      'Blues': ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      'Greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      'Reds': ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
      'RdYlGn': ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'],
      'RdBu': ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac'],
      'Viridis': ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde724']
    }
    
    const colors = palettes[palette] || palettes['Blues']
    
    // Échantillonner uniformément
    if (n >= colors.length) return colors
    
    const step = (colors.length - 1) / (n - 1)
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round(i * step)
      return colors[idx]
    })
  }
  
  /**
   * Générer les labels pour les classes
   */
  private generateLabels(breaks: number[]): string[] {
    const labels: string[] = []
    labels.push(`< ${breaks[0].toFixed(1)}`)
    for (let i = 0; i < breaks.length - 1; i++) {
      labels.push(`${breaks[i].toFixed(1)} - ${breaks[i + 1].toFixed(1)}`)
    }
    labels.push(`≥ ${breaks[breaks.length - 1].toFixed(1)}`)
    return labels
  }
  
  /**
   * Afficher carte choroplèthe
   */
  private renderChoropleth(data: ThematicData, classification: Classification, config: ThematicMapConfig): void {
    // Supprimer la couche précédente
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer)
    }
    
    // Créer un pane dédié pour la couche thématique (au-dessus des autres)
    if (!this.map.getPane('thematicPane')) {
      this.map.createPane('thematicPane')
      const pane = this.map.getPane('thematicPane')
      if (pane) pane.style.zIndex = '650' // Au-dessus des overlays (600)
    }
    
    // Masquer la couche de couverture (grille rouge) si elle existe
    const gridLayer = (window as any).gridLayer
    if (gridLayer && this.map.hasLayer(gridLayer)) {
      console.log('[ThematicMap] Masquage de la couche de couverture')
      this.map.removeLayer(gridLayer)
    }
    
    // Créer la nouvelle couche
    this.currentLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',  // Utiliser le pane dédié
      style: (feature) => {
        const value = feature?.properties?.value
        const color = this.getColorForValue(value, classification.breaks, classification.colors)
        
        return {
          fillColor: color,
          fillOpacity: config.style.opacity,
          color: config.style.stroke_color || '#333',
          weight: config.style.stroke_width || 1
        }
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        const tooltipContent = `
          <div class="thematic-tooltip">
            <strong>${props.code}</strong><br>
            <span class="tooltip-label">${data.metadata.parameter_label}:</span> 
            <strong>${props.value?.toFixed(2) || 'N/A'} ${data.metadata.unit}</strong><br>
            <span class="tooltip-label">Sondages:</span> ${props.n_sondages}<br>
            <span class="tooltip-label">Essais:</span> ${props.n_essais_geo}
          </div>
        `
        layer.bindTooltip(tooltipContent, { sticky: true })
        
        // Highlight au survol
        layer.on({
          mouseover: (e) => {
            const target = e.target
            target.setStyle({
              weight: 3,
              color: '#000',
              fillOpacity: Math.min(config.style.opacity + 0.2, 1)
            })
            target.bringToFront()
          },
          mouseout: (e) => {
            this.currentLayer?.resetStyle(e.target)
          }
        })
      }
    })
    
    this.currentLayer.addTo(this.map)
    
    // Forcer la couche au premier plan
    this.currentLayer.bringToFront()
    
    // Zoomer sur les données
    if (data.features.length > 0) {
      this.map.fitBounds(this.currentLayer.getBounds(), { padding: [50, 50] })
    }
  }
  
  /**
   * Afficher carte à symboles proportionnels
   */
  private renderProportional(data: ThematicData, classification: Classification, config: ThematicMapConfig): void {
    // Supprimer la couche précédente
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer)
    }
    
    // Trouver min/max pour la taille
    const values = data.features.map(f => f.properties?.value).filter(v => v != null) as number[]
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    
    // Créer la couche avec cercles proportionnels
    this.currentLayer = L.geoJSON(data.features as any, {
      pointToLayer: (feature, latlng) => {
        const value = feature.properties?.value
        const nSondages = feature.properties?.n_sondages || 1
        
        // Taille basée sur n_sondages (5-30 pixels)
        const radius = 5 + (nSondages / 20) * 25
        
        // Couleur basée sur la valeur du paramètre
        const color = this.getColorForValue(value, classification.breaks, classification.colors)
        
        return L.circleMarker(latlng, {
          radius,
          fillColor: color,
          fillOpacity: config.style.opacity,
          color: '#fff',
          weight: 2
        })
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties
        const tooltipContent = `
          <div class="thematic-tooltip">
            <strong>${props.code}</strong><br>
            <span class="tooltip-label">${data.metadata.parameter_label}:</span> 
            <strong>${props.value?.toFixed(2) || 'N/A'} ${data.metadata.unit}</strong><br>
            <span class="tooltip-label">Sondages:</span> ${props.n_sondages}<br>
            <span class="tooltip-label">Essais:</span> ${props.n_essais_geo}
          </div>
        `
        layer.bindTooltip(tooltipContent, { sticky: true })
      }
    })
    
    this.currentLayer.addTo(this.map)
    
    // Zoomer sur les données
    if (data.features.length > 0) {
      this.map.fitBounds(this.currentLayer.getBounds(), { padding: [50, 50] })
    }
  }
  
  /**
   * Obtenir la couleur pour une valeur
   */
  private getColorForValue(value: number | undefined | null, breaks: number[], colors: string[]): string {
    if (value == null || isNaN(value)) return '#cccccc'
    
    for (let i = 0; i < breaks.length; i++) {
      if (value < breaks[i]) return colors[i]
    }
    
    return colors[colors.length - 1]
  }
  
  /**
   * Afficher la légende
   */
  private showLegend(classification: Classification, stats: Statistics, config: ThematicMapConfig): void {
    if (this.legendControl) {
      this.map.removeControl(this.legendControl)
    }
    
    const legend = new L.Control({ position: 'bottomright' })
    
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'thematic-legend')
      
      div.innerHTML = `
        <div class="legend-header">
          <h4>${config.parameter}</h4>
          <button class="legend-close" title="Fermer">×</button>
        </div>
        <div class="legend-body">
          ${classification.labels.map((label, i) => `
            <div class="legend-item" data-class="${i}">
              <span class="legend-color" style="background:${classification.colors[i]}"></span>
              <span class="legend-label">${label}</span>
            </div>
          `).join('')}
        </div>
        <div class="legend-stats">
          <div class="stat-row"><span>Min:</span><b>${stats.min.toFixed(2)}</b></div>
          <div class="stat-row"><span>Max:</span><b>${stats.max.toFixed(2)}</b></div>
          <div class="stat-row"><span>Moyenne:</span><b>${stats.mean.toFixed(2)}</b></div>
          <div class="stat-row"><span>Médiane:</span><b>${stats.median.toFixed(2)}</b></div>
          <div class="stat-row"><span>Mailles:</span><b>${stats.count}</b></div>
        </div>
      `
      
      // Event listeners
      const closeBtn = div.querySelector('.legend-close') as HTMLElement
      if (closeBtn) {
        L.DomEvent.on(closeBtn, 'click', () => {
          this.clear()
        })
      }
      
      // Toggle classes
      const items = div.querySelectorAll('.legend-item')
      items.forEach(item => {
        L.DomEvent.on(item as HTMLElement, 'click', (e) => {
          item.classList.toggle('disabled')
          // TODO: Filtrer les features de cette classe
        })
      })
      
      // Empêcher propagation des événements de la carte
      L.DomEvent.disableClickPropagation(div)
      L.DomEvent.disableScrollPropagation(div)
      
      return div
    }
    
    legend.addTo(this.map)
    this.legendControl = legend
  }
  
  /**
   * Sauvegarder la configuration actuelle
   */
  async saveConfig(configName: string, description?: string): Promise<string> {
    if (!this.currentConfig) {
      throw new Error('Aucune configuration active')
    }
    
    const payload = {
      config_name: configName,
      description,
      ...this.currentConfig,
      is_public: false
    }
    
    const response = await fetch(`${this.apiUrl}/thematic/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Erreur sauvegarde: ${response.status}`)
    }
    
    const result = await response.json()
    return result.id
  }
  
  /**
   * Charger une configuration sauvegardée
   */
  async loadConfig(configId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/thematic/configs/${configId}`)
    if (!response.ok) {
      throw new Error(`Erreur chargement: ${response.status}`)
    }
    
    const config = await response.json()
    await this.loadThematicMap(config)
  }
  
  /**
   * Exporter en GeoJSON
   */
  exportAsGeoJSON(): void {
    if (!this.currentLayer) {
      throw new Error('Aucune carte active')
    }
    
    const geojson = this.currentLayer.toGeoJSON()
    
    // Ajouter métadonnées
    const exportData = {
      ...geojson,
      metadata: {
        config: this.currentConfig,
        classification: this.currentClassification,
        exported_at: new Date().toISOString()
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thematic_map_${this.currentConfig?.parameter}_${Date.now()}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  /**
   * Nettoyer la carte
   */
  clear(): void {
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer)
      this.currentLayer = null
    }
    
    if (this.legendControl) {
      this.map.removeControl(this.legendControl)
      this.legendControl = null
    }
    
    // Restaurer la couche de couverture (grille rouge) si elle existe
    const gridLayer = (window as any).gridLayer
    if (gridLayer && !this.map.hasLayer(gridLayer)) {
      console.log('[ThematicMap] Restauration de la couche de couverture')
      gridLayer.addTo(this.map)
    }
    
    this.currentConfig = null
    this.currentClassification = null
    
    this.map.fire('thematicmap:cleared')
  }
  
  /**
   * Obtenir la configuration actuelle
   */
  getCurrentConfig(): ThematicMapConfig | null {
    return this.currentConfig
  }
  
  /**
   * Obtenir la classification actuelle
   */
  getCurrentClassification(): Classification | null {
    return this.currentClassification
  }
}
