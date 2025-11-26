import L from 'leaflet'
import type {
  ThematicMapConfig,
  ThematicData,
  Classification,
  Statistics
} from './thematic-types'
import { getParameterById } from './thematic-types'

export class ThematicMapManager {
  private map: L.Map
  private apiUrl: string
  private polygonLayer: L.GeoJSON | null = null  // Couche des polygones (mailles)
  private circleLayer: L.LayerGroup | null = null // Couche des cercles proportionnels
  private admOverlayLayer: L.LayerGroup  // Couche des contours ADM
  private currentConfig: ThematicMapConfig | null = null
  private legendControl: L.Control | null = null
  private currentClassification: Classification | null = null
  private currentData: ThematicData | null = null
  
  constructor(map: L.Map, apiUrl: string) {
    this.map = map
    this.apiUrl = apiUrl
    this.admOverlayLayer = L.layerGroup().addTo(map)
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
      
      // 3. Afficher sur la carte selon le type
      this.clearLayers()
      
      if (config.type === 'choropleth') {
        this.renderChoropleth(data, classification, config)
      } else if (config.type === 'proportional') {
        this.renderProportionalCircles(data, classification, config)
      } else if (config.type === 'binary') {
        this.renderBinaryMap(data, config)
      }
      
      // 4. Afficher la légende
      this.showLegend(classification, data.statistics, config)
      
      // 5. Afficher le contour ADM sélectionné
      await this.showAdmOverlay(config)
      
      // 6. Sauvegarder la config et les données actuelles
      this.currentConfig = config
      this.currentClassification = classification
      this.currentData = data
      
      // 7. Émettre événement
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
    
    // Filtres ADM - envoyer seulement si exclude_outside_adm est activé ou si un ADM est sélectionné
    if (config.filters.exclude_outside_adm) {
      if (config.filters.adm1) params.append('adm1', config.filters.adm1)
      if (config.filters.adm2) params.append('adm2', config.filters.adm2)
      if (config.filters.adm3) params.append('adm3', config.filters.adm3)
    }
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
   * Afficher le contour de la zone ADM sélectionnée (depuis config)
   */
  private async showAdmOverlay(config: ThematicMapConfig): Promise<void> {
    await this.updateAdmOverlay(
      config.filters.adm1 || null,
      config.filters.adm2 || null,
      config.filters.adm3 || null
    )
  }
  
  /**
   * Mettre à jour le contour ADM (méthode publique)
   * Affiche le contour du niveau le plus précis sélectionné
   */
  async updateAdmOverlay(
    adm1: string | null,
    adm2: string | null,
    adm3: string | null
  ): Promise<void> {
    // Nettoyer les contours précédents
    this.admOverlayLayer.clearLayers()
    
    // Déterminer le niveau ADM le plus précis sélectionné
    let level: 'adm1' | 'adm2' | 'adm3' | null = null
    let name: string | null = null
    
    if (adm3) {
      level = 'adm3'
      name = adm3
    } else if (adm2) {
      level = 'adm2'
      name = adm2
    } else if (adm1) {
      level = 'adm1'
      name = adm1
    }
    
    if (!level || !name) {
      console.log('[ThematicMap] Pas de filtre ADM, pas de contour')
      return
    }
    
    try {
      const url = `${this.apiUrl}/adm-geojson?level=${level}&name=${encodeURIComponent(name)}`
      console.log('[ThematicMap] Chargement contour ADM:', url)
      
      const response = await fetch(url)
      if (!response.ok) {
        console.warn('[ThematicMap] Erreur chargement contour ADM:', response.status)
        return
      }
      
      const geojson = await response.json()
      
      if (!geojson.features || geojson.features.length === 0) {
        console.warn('[ThematicMap] Contour ADM vide pour:', level, name)
        return
      }
      
      // Style du contour selon le niveau
      const colors: Record<string, string> = {
        adm1: '#6366F1', // Indigo
        adm2: '#8B5CF6', // Violet
        adm3: '#EC4899'  // Rose
      }
      
      L.geoJSON(geojson, {
        style: {
          color: colors[level] || '#6366F1',
          weight: 3,
          fillOpacity: 0,
          dashArray: level === 'adm1' ? '10, 5' : level === 'adm2' ? '5, 5' : ''
        },
        interactive: false
      }).addTo(this.admOverlayLayer)
      
      console.log('[ThematicMap] ✅ Contour ADM affiché:', level, name)
      
    } catch (error) {
      console.error('[ThematicMap] Erreur contour ADM:', error)
    }
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
    
    // Carte binaire : classification spéciale à 2 classes
    if (config.type === 'binary') {
      const threshold = config.classification.binary_threshold ?? data.statistics.median
      return {
        breaks: [threshold],
        colors: ['#E5E7EB', '#15803d'],
        labels: [`< ${threshold.toFixed(1)}`, `≥ ${threshold.toFixed(1)}`],
        method: 'binary',
        n_classes: 2
      }
    }
    
    // Utiliser classification manuelle si fournie
    if (config.classification?.method === 'manual' && config.classification.manual_breaks) {
      const breaks = this.sanitizeBreaks(config.classification.manual_breaks)
      return {
        breaks,
        colors: await this.getColors(config.style.palette, breaks.length + 1),
        labels: this.generateLabels(breaks),
        method: 'manual',
        n_classes: breaks.length + 1
      }
    }
    
    // Pour les paramètres de densité (n_sondages, etc.), utiliser des breaks fixes
    const param = getParameterById(config.parameter)
    if (param?.defaultBreaks && config.classification?.method !== 'equal_interval') {
      const breaks = param.defaultBreaks
      return {
        breaks,
        colors: await this.getColors(config.style.palette, breaks.length + 1),
        labels: this.generateLabels(breaks),
        method: 'default_breaks',
        n_classes: breaks.length + 1
      }
    }
    
    // Calculer les breaks localement selon la méthode
    const nClasses = config.classification?.n_classes || 5
    let rawBreaks: number[]
    
    const sortedValues = [...values].sort((a, b) => a - b)
    const minVal = sortedValues[0]
    const maxVal = sortedValues[sortedValues.length - 1]
    
    switch (config.classification?.method) {
      case 'equal_interval':
        // Intervalles égaux
        const interval = (maxVal - minVal) / nClasses
        rawBreaks = Array.from({ length: nClasses - 1 }, (_, i) => minVal + (i + 1) * interval)
        break
      
      case 'quantiles':
      default:
        // Quantiles
        rawBreaks = []
        for (let i = 1; i < nClasses; i++) {
          const idx = Math.floor((i / nClasses) * sortedValues.length)
          rawBreaks.push(sortedValues[idx])
        }
        break
    }
    
    // Nettoyer les breaks (supprimer doublons, arrondir)
    const cleanedBreaks = this.sanitizeBreaks(rawBreaks)
    const effectiveClasses = cleanedBreaks.length + 1
    
    // Log si le nombre de classes a été réduit
    if (effectiveClasses < nClasses) {
      console.log(`[ThematicMap] Classes réduites: ${nClasses} demandées → ${effectiveClasses} effectives (données concentrées)`)
    }
    
    return {
      breaks: cleanedBreaks,
      colors: await this.getColors(config.style.palette, effectiveClasses),
      labels: this.generateLabels(cleanedBreaks),
      method: config.classification?.method || 'quantiles',
      n_classes: effectiveClasses
    }
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
   * Nettoyer les breaks pour éviter les doublons et classes dégénérées
   * Ex: [98.9, 99.6, 100, 100, 100] → [98.9, 99.6, 100]
   */
  private sanitizeBreaks(breaks: number[], decimals: number = 1): number[] {
    const eps = Math.pow(10, -decimals)
    const cleaned: number[] = []
    
    for (const b of breaks) {
      const rounded = this.roundTo(b, decimals)
      if (cleaned.length === 0 || Math.abs(rounded - cleaned[cleaned.length - 1]) > eps) {
        cleaned.push(rounded)
      }
    }
    
    // Si toutes les valeurs sont identiques → une seule classe
    if (cleaned.length === 1) {
      return [cleaned[0]]
    }
    
    return cleaned
  }
  
  /**
   * Arrondir à N décimales
   */
  private roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }
  
  /**
   * Générer les labels pour les classes (intervalles strictement croissants)
   */
  private generateLabels(breaks: number[]): string[] {
    if (breaks.length === 0) return ['Toutes valeurs']
    if (breaks.length === 1) return [`≤ ${breaks[0].toFixed(1)}`, `> ${breaks[0].toFixed(1)}`]
    
    const labels: string[] = []
    
    // Première classe : ≤ premier break
    labels.push(`≤ ${breaks[0].toFixed(1)}`)
    
    // Classes intermédiaires
    for (let i = 0; i < breaks.length - 1; i++) {
      labels.push(`${breaks[i].toFixed(1)} - ${breaks[i + 1].toFixed(1)}`)
    }
    
    // Dernière classe : > dernier break
    labels.push(`> ${breaks[breaks.length - 1].toFixed(1)}`)
    
    return labels
  }
  
  /**
   * Nettoyer les couches thématiques
   */
  private clearLayers(): void {
    if (this.polygonLayer) {
      this.map.removeLayer(this.polygonLayer)
      this.polygonLayer = null
    }
    if (this.circleLayer) {
      this.map.removeLayer(this.circleLayer)
      this.circleLayer = null
    }
    // Nettoyer aussi le contour ADM
    this.admOverlayLayer.clearLayers()
  }
  
  /**
   * Créer le pane thématique si nécessaire
   */
  private ensureThematicPane(): void {
    if (!this.map.getPane('thematicPane')) {
      this.map.createPane('thematicPane')
      const pane = this.map.getPane('thematicPane')
      if (pane) pane.style.zIndex = '650'
    }
    if (!this.map.getPane('thematicCirclesPane')) {
      this.map.createPane('thematicCirclesPane')
      const pane = this.map.getPane('thematicCirclesPane')
      if (pane) pane.style.zIndex = '660' // Au-dessus des polygones
    }
  }
  
  /**
   * Masquer la grille de couverture
   */
  private hideGridLayer(): void {
    const gridLayer = (window as any).gridLayer
    if (gridLayer && this.map.hasLayer(gridLayer)) {
      console.log('[ThematicMap] Masquage de la couche de couverture')
      this.map.removeLayer(gridLayer)
    }
  }
  
  /**
   * Calculer le centroïde d'un polygone GeoJSON
   */
  private getCentroid(feature: any): [number, number] {
    const coords = feature.geometry.coordinates
    if (feature.geometry.type === 'Polygon') {
      // Moyenne des coordonnées du premier anneau
      const ring = coords[0]
      let sumLat = 0, sumLng = 0
      for (const [lng, lat] of ring) {
        sumLat += lat
        sumLng += lng
      }
      return [sumLat / ring.length, sumLng / ring.length]
    } else if (feature.geometry.type === 'MultiPolygon') {
      // Prendre le premier polygone
      const ring = coords[0][0]
      let sumLat = 0, sumLng = 0
      for (const [lng, lat] of ring) {
        sumLat += lat
        sumLng += lng
      }
      return [sumLat / ring.length, sumLng / ring.length]
    }
    return [0, 0]
  }
  
  /**
   * Afficher carte choroplèthe (aplats de couleur sur les mailles)
   */
  private renderChoropleth(data: ThematicData, classification: Classification, config: ThematicMapConfig): void {
    this.ensureThematicPane()
    this.hideGridLayer()
    
    this.polygonLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',
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
        this.bindFeatureTooltip(feature, layer, data)
        this.bindFeatureHighlight(layer, config)
      }
    })
    
    this.polygonLayer.addTo(this.map)
    this.polygonLayer.bringToFront()
    
    if (data.features.length > 0) {
      this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] })
    }
  }
  
  /**
   * Afficher carte à cercles proportionnels
   * - Mailles en fond gris clair avec contour fin
   * - Cercles au centroïde avec rayon proportionnel à √valeur
   */
  private renderProportionalCircles(data: ThematicData, classification: Classification, config: ThematicMapConfig): void {
    this.ensureThematicPane()
    this.hideGridLayer()
    
    // 1. Couche de fond : mailles en gris clair
    this.polygonLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',
      style: () => ({
        fillColor: '#E5E7EB',
        fillOpacity: 0.3,
        color: '#9CA3AF',
        weight: 0.5
      }),
      onEachFeature: (feature, layer) => {
        this.bindFeatureTooltip(feature, layer, data)
      }
    })
    this.polygonLayer.addTo(this.map)
    
    // 2. Couche de cercles proportionnels
    this.circleLayer = L.layerGroup()
    
    // Calculer min/max pour le scaling
    const values = data.features
      .map(f => f.properties?.value)
      .filter(v => v != null && v > 0) as number[]
    
    if (values.length === 0) {
      console.warn('[ThematicMap] Aucune valeur positive pour les cercles')
      return
    }
    
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const minRadius = 4
    const maxRadius = 20
    
    // Créer les cercles
    for (const feature of data.features) {
      const value = feature.properties?.value
      if (value == null || value <= 0) continue
      
      // Rayon proportionnel à √valeur (perception visuelle correcte)
      const t = maxVal > minVal 
        ? (Math.sqrt(value) - Math.sqrt(minVal)) / (Math.sqrt(maxVal) - Math.sqrt(minVal))
        : 0.5
      const radius = minRadius + t * (maxRadius - minRadius)
      
      // Centroïde de la maille
      const [lat, lng] = this.getCentroid(feature)
      
      // Couleur selon la classification
      const color = this.getColorForValue(value, classification.breaks, classification.colors)
      
      const circle = L.circleMarker([lat, lng], {
        pane: 'thematicCirclesPane',
        radius,
        fillColor: color,
        fillOpacity: config.style.opacity,
        color: '#1f2937',
        weight: 1
      })
      
      // Tooltip
      const props = feature.properties
      circle.bindTooltip(`
        <div class="thematic-tooltip">
          <strong>${props?.code}</strong><br>
          <span class="tooltip-label">${data.metadata.parameter_label}:</span> 
          <strong>${props?.value?.toFixed(2) || 'N/A'} ${data.metadata.unit}</strong><br>
          <span class="tooltip-label">Sondages:</span> ${props?.n_sondages || 0}
        </div>
      `, { sticky: true })
      
      this.circleLayer.addLayer(circle)
    }
    
    this.circleLayer.addTo(this.map)
    
    if (data.features.length > 0) {
      this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] })
    }
  }
  
  /**
   * Afficher carte binaire (présence/absence)
   * - 2 classes uniquement : en dessous du seuil / au dessus du seuil
   */
  private renderBinaryMap(data: ThematicData, config: ThematicMapConfig): void {
    this.ensureThematicPane()
    this.hideGridLayer()
    
    // Seuil binaire : par défaut = 1 pour les comptages, médiane pour les valeurs continues
    const threshold = config.classification.binary_threshold ?? data.statistics.median
    
    // Couleurs binaires
    const presentColor = '#15803d'  // Vert
    const absentColor = '#E5E7EB'   // Gris clair
    
    this.polygonLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',
      style: (feature) => {
        const value = feature?.properties?.value
        const present = value != null && value >= threshold
        
        return present ? {
          fillColor: presentColor,
          fillOpacity: config.style.opacity,
          color: '#14532d',
          weight: 1
        } : {
          fillColor: absentColor,
          fillOpacity: 0.3,
          color: '#9CA3AF',
          weight: 0.5
        }
      },
      onEachFeature: (feature, layer) => {
        this.bindFeatureTooltip(feature, layer, data)
        this.bindFeatureHighlight(layer, config)
      }
    })
    
    this.polygonLayer.addTo(this.map)
    
    if (data.features.length > 0) {
      this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] })
    }
    
    // Mettre à jour la classification pour la légende binaire
    this.currentClassification = {
      breaks: [threshold],
      colors: [absentColor, presentColor],
      labels: [`< ${threshold.toFixed(1)}`, `≥ ${threshold.toFixed(1)}`],
      method: 'binary',
      n_classes: 2
    }
  }
  
  /**
   * Bind tooltip to a feature layer
   */
  private bindFeatureTooltip(feature: any, layer: L.Layer, data: ThematicData): void {
    const props = feature.properties
    const tooltipContent = `
      <div class="thematic-tooltip">
        <strong>${props?.code}</strong><br>
        <span class="tooltip-label">${data.metadata.parameter_label}:</span> 
        <strong>${props?.value?.toFixed(2) || 'N/A'} ${data.metadata.unit}</strong><br>
        <span class="tooltip-label">Sondages:</span> ${props?.n_sondages || 0}<br>
        <span class="tooltip-label">Essais:</span> ${props?.n_essais_geo || 0}
      </div>
    `
    ;(layer as any).bindTooltip(tooltipContent, { sticky: true })
  }
  
  /**
   * Bind highlight behavior on hover
   */
  private bindFeatureHighlight(layer: L.Layer, config: ThematicMapConfig): void {
    ;(layer as any).on({
      mouseover: (e: any) => {
        const target = e.target
        target.setStyle({
          weight: 3,
          color: '#000',
          fillOpacity: Math.min(config.style.opacity + 0.2, 1)
        })
        target.bringToFront()
      },
      mouseout: (e: any) => {
        this.polygonLayer?.resetStyle(e.target)
      }
    })
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
    const param = getParameterById(config.parameter)
    const paramLabel = param?.label || config.parameter
    const unit = param?.unit || ''
    
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'thematic-legend')
      
      // Déterminer si on a besoin de texte clair ou foncé selon la palette
      const isDarkPalette = ['Viridis', 'Blues', 'Greens'].includes(config.style.palette)
      
      div.innerHTML = `
        <div class="legend-header">
          <h4>${paramLabel}</h4>
          <button class="legend-close" title="Fermer">×</button>
        </div>
        <div class="legend-body">
          ${classification.labels.map((label, i) => {
            const bgColor = classification.colors[i] || '#cccccc'
            return `
              <div class="legend-item" data-class="${i}">
                <span class="legend-color" style="background:${bgColor}"></span>
                <span class="legend-label">${label}</span>
              </div>
            `
          }).join('')}
        </div>
        <div class="legend-stats">
          <div class="stat-row"><span>Min:</span><b>${stats.min.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
          <div class="stat-row"><span>Max:</span><b>${stats.max.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
          <div class="stat-row"><span>Moyenne:</span><b>${stats.mean.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
          <div class="stat-row"><span>Médiane:</span><b>${stats.median.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
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
   * Calculer la couleur de contraste (noir ou blanc) pour un fond donné
   */
  private getContrastColor(hexColor: string): string {
    // Convertir hex en RGB
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculer la luminosité relative (formule W3C)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Retourner noir pour fond clair, blanc pour fond sombre
    return luminance > 0.5 ? '#1a1a2e' : '#ffffff'
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
    if (!this.polygonLayer) {
      throw new Error('Aucune carte active')
    }
    
    const geojson = this.polygonLayer.toGeoJSON()
    
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
    this.clearLayers()
    
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
