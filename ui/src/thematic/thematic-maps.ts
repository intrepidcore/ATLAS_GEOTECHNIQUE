import L from 'leaflet'
import 'leaflet.heat'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type {
  ThematicMapConfig,
  ThematicData,
  Classification,
  Statistics,
  ThematicExportState,
  ThematicClassBreak
} from './thematic-types'
import { getParameterById, getRecommendedPalette, PALETTE_OPTIONS } from './thematic-types'
import { ContextLayersManager } from './context-layers'

export class ThematicMapManager {
  private map: L.Map
  private apiUrl: string
  private polygonLayer: L.GeoJSON | null = null  // Couche des polygones (mailles)
  private circleLayer: L.LayerGroup | null = null // Couche des cercles proportionnels
  private heatLayer: any = null // Couche heatmap (leaflet.heat)
  public admOverlayLayer: L.LayerGroup  // Couche des contours ADM (public pour accès externe)
  private currentConfig: ThematicMapConfig | null = null
  private legendControl: L.Control | null = null
  private currentClassification: Classification | null = null
  private currentData: ThematicData | null = null
  private currentExportState: ThematicExportState | null = null
  
  // Gestionnaire des couches de contexte
  private contextLayers: ContextLayersManager
  
  // État de chargement pour waitUntilReady
  private _isReady: boolean = true
  private _readyCallbacks: Array<() => void> = []
  
  constructor(map: L.Map, apiUrl: string) {
    this.map = map
    this.apiUrl = apiUrl
    this.admOverlayLayer = L.layerGroup().addTo(map)
    this.contextLayers = new ContextLayersManager(map)
  }
  
  /**
   * Toggle context layer (proxy to ContextLayersManager)
   */
  async toggleContextLayer(layerType: 'geologie' | 'pedologie' | 'risque-gonflement', show: boolean): Promise<void> {
    await this.contextLayers.toggleLayer(layerType, show)
  }
  
  /**
   * Indique si le manager est prêt (carte chargée)
   */
  get isReady(): boolean {
    return this._isReady
  }
  
  /**
   * Attend que le manager soit prêt
   */
  async waitUntilReady(timeoutMs: number = 5000): Promise<void> {
    if (this._isReady) return
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this._readyCallbacks.indexOf(resolve)
        if (idx >= 0) this._readyCallbacks.splice(idx, 1)
        console.warn('[ThematicMap] waitUntilReady timeout')
        resolve() // Résoudre quand même pour éviter les blocages
      }, timeoutMs)
      
      this._readyCallbacks.push(() => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }
  
  /**
   * Marque le manager comme prêt et notifie les callbacks
   */
  private setReady(ready: boolean): void {
    this._isReady = ready
    if (ready) {
      const callbacks = [...this._readyCallbacks]
      this._readyCallbacks = []
      callbacks.forEach(cb => cb())
    }
  }
  
  /**
   * Charger et afficher une carte thématique
   */
  async loadThematicMap(config: ThematicMapConfig): Promise<void> {
    // Marquer comme non prêt au début du chargement
    this.setReady(false)
    
    try {
      // Audit v3.5.4 - palette reçue
      console.log(`[ThematicMap][Interactive] palette received="${config.style.palette}"`)
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
      } else if (config.type === 'bubble') {
        this.renderProportionalCircles(data, classification, config)
      } else if (config.type === 'binary') {
        this.renderBinaryMap(data, config)
      } else if (config.type === 'heatmap') {
        this.renderHeatmap(data, classification, config)
      }
      
      // 4. Afficher la légende
      this.showLegend(classification, data.statistics, config)
      
      // 5. Afficher le contour ADM sélectionné
      await this.showAdmOverlay(config)
      
      // 6. Sauvegarder la config et les données actuelles
      this.currentConfig = config
      this.currentClassification = classification
      this.currentData = data
      
      // 7. Mettre à jour l'état d'export
      this.updateExportState()
      
      // 8. Émettre événement
      this.map.fire('thematicmap:loaded', { config, data, classification })
      
      // 9. Marquer comme prêt
      this.setReady(true)
      
    } catch (error) {
      console.error('[ThematicMap] Erreur:', error)
      this.setReady(true) // Marquer comme prêt même en cas d'erreur pour éviter les blocages
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
    
    // CORRECTION ÉTAPE 5: Gérer NO DATA proprement (pas une erreur)
    if (values.length === 0) {
      console.warn(`[ThematicMap] ⚠️ NO DATA pour ${config.parameter} - aucune valeur à classifier`)
      // Retourner une classification NO DATA au lieu de throw
      return {
        breaks: [],
        colors: ['#9CA3AF'], // Gris neutre pour NO DATA
        labels: ['NO DATA'],
        method: 'no_data',
        n_classes: 1
      }
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
    
    // Détecter si le paramètre est un comptage (valeurs entières)
    const param = getParameterById(config.parameter)
    const isCountParameter = param?.id.includes('n_') || param?.id.includes('count') || param?.unit === 'count'
    
    // Pour les paramètres de densité (n_sondages, etc.), utiliser des breaks fixes
    if (param?.defaultBreaks && config.classification?.method !== 'equal_interval') {
      const breaks = param.defaultBreaks
      return {
        breaks,
        colors: await this.getColors(config.style.palette, breaks.length + 1),
        labels: this.generateLabels(breaks, isCountParameter),
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
        // Pour les comptages, arrondir aux entiers
        if (isCountParameter) {
          rawBreaks = rawBreaks.map(b => Math.round(b))
        }
        break
      
      case 'quantiles':
      default:
        // Quantiles
        rawBreaks = []
        for (let i = 1; i < nClasses; i++) {
          const idx = Math.floor((i / nClasses) * sortedValues.length)
          rawBreaks.push(sortedValues[idx])
        }
        // Pour les comptages, arrondir aux entiers
        if (isCountParameter) {
          rawBreaks = rawBreaks.map(b => Math.round(b))
        }
        break
    }
    
    // Nettoyer les breaks (supprimer doublons, arrondir)
    const decimals = isCountParameter ? 0 : 1
    const cleanedBreaks = this.sanitizeBreaks(rawBreaks, decimals)
    const effectiveClasses = cleanedBreaks.length + 1
    
    // Log si le nombre de classes a été réduit
    if (effectiveClasses < nClasses) {
      console.log(`[ThematicMap] Classes réduites: ${nClasses} demandées → ${effectiveClasses} effectives (données concentrées)`)
    }
    
    return {
      breaks: cleanedBreaks,
      colors: await this.getColors(config.style.palette, effectiveClasses),
      labels: this.generateLabels(cleanedBreaks, isCountParameter),
      method: config.classification?.method || 'quantiles',
      n_classes: effectiveClasses
    }
  }
  
  /**
   * Récupérer les couleurs d'une palette (v3.5.0 - corrigé)
   * @param palette Nom de la palette (ex: 'YlOrRd', 'Blues', 'Viridis')
   * @param n Nombre de couleurs à retourner
   */
  private async getColors(palette: string, n: number): Promise<string[]> {
    // Audit v3.5.4 - tracer appel getColors
    console.log(`[ThematicMap][Interactive] getColors(palette="${palette}", n=${n})`)
    
    // Palettes complètes pour interpolation (v3.5.0 enrichi)
    const palettes: Record<string, string[]> = {
      // Séquentielles monochrome
      'Blues': ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      'Greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      'Reds': ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
      'Oranges': ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
      'Purples': ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
      // Séquentielles multi-teintes
      'YlOrRd': ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
      'YlGnBu': ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
      'PuBu': ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'],
      'BuPu': ['#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#810f7c', '#4d004b'],
      'PuRd': ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256', '#980043', '#67001f'],
      // Accessibles daltonisme
      'Viridis': ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde724'],
      'Cividis': ['#00204d', '#00306f', '#2b4a74', '#4d637b', '#6d7c82', '#8d9589', '#acae91', '#cbc89d', '#e8e2ab', '#ffea46'],
      // Divergentes
      'RdYlGn': ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'],
      'RdBu': ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac'],
      'BrBG': ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'],
      'PuOr': ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b']
    }
    
    const colors = palettes[palette] || palettes['Blues']
    
    // Échantillonner uniformément
    if (n >= colors.length) return colors
    if (n <= 1) return [colors[Math.floor(colors.length / 2)]]
    
    const step = (colors.length - 1) / (n - 1)
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round(i * step)
      return colors[Math.min(idx, colors.length - 1)]
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
   * Gère les valeurs entières pour les paramètres de comptage
   */
  private generateLabels(breaks: number[], isInteger: boolean = false): string[] {
    if (breaks.length === 0) return ['Toutes valeurs']
    
    const format = (val: number) => isInteger ? Math.round(val).toString() : val.toFixed(1)
    
    if (breaks.length === 1) {
      return isInteger 
        ? [`${format(breaks[0])}`, `> ${format(breaks[0])}`]
        : [`≤ ${format(breaks[0])}`, `> ${format(breaks[0])}`]
    }
    
    const labels: string[] = []
    
    if (isInteger) {
      // Pour les entiers: "1", "2-3", "4-5", "> 5"
      labels.push(format(breaks[0]))
      for (let i = 0; i < breaks.length - 1; i++) {
        const start = Math.round(breaks[i]) + 1
        const end = Math.round(breaks[i + 1])
        if (start === end) {
          labels.push(format(end))
        } else {
          labels.push(`${start}-${end}`)
        }
      }
      labels.push(`> ${format(breaks[breaks.length - 1])}`)
    } else {
      // Pour les décimales: format classique
      labels.push(`≤ ${format(breaks[0])}`)
      for (let i = 0; i < breaks.length - 1; i++) {
        labels.push(`${format(breaks[i])} - ${format(breaks[i + 1])}`)
      }
      labels.push(`> ${format(breaks[breaks.length - 1])}`)
    }
    
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
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer)
      this.heatLayer = null
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
    
    // v3.5.3: Log explicite des couleurs utilisées pour debug
    console.log(`[ThematicMap][Choropleth] Palette: ${config.style.palette}`)
    console.log(`[ThematicMap][Choropleth] Colors: ${JSON.stringify(classification.colors)}`)
    
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
    
    // 1. Couche de fond : mailles en gris très clair (discret)
    this.polygonLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',
      style: () => ({
        fillColor: '#F9FAFB',  // Gris quasi-blanc
        fillOpacity: 0.2,      // Très transparent
        color: '#E5E7EB',      // Gris très clair pour les contours
        weight: 0.3            // Traits très fins
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
          fillColor: '#F9FAFB',  // Gris quasi-blanc pour mailles vides
          fillOpacity: 0.2,      // Très transparent
          color: '#E5E7EB',      // Gris très clair pour contours
          weight: 0.3            // Traits très fins
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
   * Afficher carte de chaleur (heatmap)
   */
  private renderHeatmap(data: ThematicData, classification: Classification, config: ThematicMapConfig): void {
    this.ensureThematicPane()
    this.hideGridLayer()
    
    // 1. Couche de fond: mailles en gris très clair (discret)
    this.polygonLayer = L.geoJSON(data.features as any, {
      pane: 'thematicPane',
      style: () => ({
        fillColor: '#F9FAFB',
        fillOpacity: 0.2,
        color: '#E5E7EB',
        weight: 0.3
      }),
      interactive: false
    })
    this.polygonLayer.addTo(this.map)
    
    // 2. Préparer les données pour heatmap: [lat, lng, intensity]
    const heatData: [number, number, number][] = []
    const values = data.features
      .map(f => f.properties?.value)
      .filter(v => v != null && !isNaN(v)) as number[]
    
    if (values.length === 0) {
      console.warn('[ThematicMap][Heatmap] Aucune donnée pour heatmap')
      return
    }
    
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range = maxVal - minVal || 1
    
    // Construire points avec intensité normalisée
    for (const feature of data.features) {
      const value = feature.properties?.value
      if (value == null || isNaN(value)) continue
      
      // Centroïde de la maille
      const geom = feature.geometry
      let lat = 0, lng = 0
      
      if (geom.type === 'Polygon' && geom.coordinates[0]) {
        const coords = geom.coordinates[0]
        lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length
        lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length
      } else if (geom.type === 'MultiPolygon' && geom.coordinates[0]?.[0]) {
        const coords = geom.coordinates[0][0]
        lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length
        lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length
      }
      
      // Normaliser intensité entre 0 et 1
      const intensity = (value - minVal) / range
      heatData.push([lat, lng, intensity])
    }
    
    console.log(`[ThematicMap][Heatmap] ${heatData.length} points, range: ${minVal.toFixed(2)} - ${maxVal.toFixed(2)}`)
    
    // 3. Créer la couche heatmap
    this.heatLayer = (L as any).heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: '#0000ff',
        0.2: '#00ffff',
        0.4: '#00ff00',
        0.6: '#ffff00',
        0.8: '#ff8000',
        1.0: '#ff0000'
      }
    })
    
    this.heatLayer.addTo(this.map)
    
    if (data.features.length > 0) {
      this.map.fitBounds(this.polygonLayer.getBounds(), { padding: [50, 50] })
    }
    
    console.log('[ThematicMap][Heatmap] Heatmap affichée')
  }
  
  /**
   * Bind tooltip to a feature layer with dynamic context enrichment
   */
  private bindFeatureTooltip(feature: any, layer: L.Layer, data: ThematicData): void {
    const props = feature.properties
    
    // Build tooltip content dynamically
    const lines: string[] = []
    
    // Always show: code, region, surveys
    lines.push(`<strong>${props?.code}</strong>`)
    if (props?.adm1_name) {
      lines.push(`<span class="tooltip-label">Région:</span> ${props.adm1_name}`)
    }
    
    // Parameter value if available
    if (data.metadata.parameter_label && props?.value != null) {
      lines.push(`<span class="tooltip-label">${data.metadata.parameter_label}:</span> <strong>${props.value.toFixed(2)} ${data.metadata.unit}</strong>`)
    }
    
    // Surveys count
    lines.push(`<span class="tooltip-label">Sondages:</span> ${props?.n_sondages || 0}`)
    if (props?.n_sondages_exact || props?.n_sondages_random) {
      lines.push(`<span class="tooltip-label-sm">(${props.n_sondages_exact || 0} exact, ${props.n_sondages_random || 0} random)</span>`)
    }
    
    // Context enrichment: geology
    if (this.contextLayers.isLayerActive('geologie') && props?.geol_unit) {
      lines.push(`<hr style="margin: 4px 0; border-color: #e5e7eb;">`)
      lines.push(`<span class="tooltip-label">Géologie:</span> <strong>${props.geol_unit}</strong>`)
    }
    
    // Context enrichment: pedology
    if (this.contextLayers.isLayerActive('pedologie') && props?.pedo_unit) {
      if (!props?.geol_unit) lines.push(`<hr style="margin: 4px 0; border-color: #e5e7eb;">`)
      lines.push(`<span class="tooltip-label">Pédologie:</span> <strong>${props.pedo_unit}</strong>`)
    }
    
    // Context enrichment: swelling risk
    if (this.contextLayers.isLayerActive('risque-gonflement') && props?.swelling_class) {
      if (!props?.geol_unit && !props?.pedo_unit) lines.push(`<hr style="margin: 4px 0; border-color: #e5e7eb;">`)
      lines.push(`<span class="tooltip-label">Risque gonflement:</span> <strong>${props.swelling_class}</strong>`)
      // Bonus: show Eg average if available
      if (props?.eg_avg != null) {
        lines.push(`<span class="tooltip-label-sm">(Eg moy. = ${props.eg_avg.toFixed(1)} %)</span>`)
      }
    }
    
    const tooltipContent = `<div class="thematic-tooltip">${lines.join('<br>')}</div>`
    ;(layer as any).bindTooltip(tooltipContent, { sticky: true })
  }
  
  /**
   * Bind highlight behavior on hover and click
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
      },
      click: (e: any) => {
        // Propager le clic vers la maille correspondante dans la grille originale
        const feature = e.target.feature
        const code = feature?.properties?.code
        if (code) {
          console.log('[ThematicMap] Clic sur maille thématique:', code)
          // Émettre un événement personnalisé pour que main.ts puisse le gérer
          this.map.fire('thematicmap:cellclick', { 
            code, 
            properties: feature.properties,
            latlng: e.latlng,
            layer: e.target
          })
        }
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
      
      // Légende spécifique pour Heatmap: barre gradient
      if (config.type === 'heatmap') {
        div.innerHTML = `
          <div class="legend-header">
            <h4>${paramLabel}</h4>
            <button class="legend-close" title="Fermer">×</button>
          </div>
          <div class="legend-body legend-heatmap">
            <div class="heatmap-gradient" style="
              background: linear-gradient(to right, 
                #0000ff 0%, 
                #00ffff 20%, 
                #00ff00 40%, 
                #ffff00 60%, 
                #ff8000 80%, 
                #ff0000 100%);
              height: 20px;
              width: 100%;
              border-radius: 3px;
            "></div>
            <div class="heatmap-labels" style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px;">
              <span>Faible</span>
              <span>Forte</span>
            </div>
          </div>
          <div class="legend-stats">
            <div class="stat-row"><span>Min:</span><b>${stats.min.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
            <div class="stat-row"><span>Max:</span><b>${stats.max.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
            <div class="stat-row"><span>Moyenne:</span><b>${stats.mean.toFixed(2)}${unit ? ' ' + unit : ''}</b></div>
            <div class="stat-row"><span>Mailles:</span><b>${stats.count}</b></div>
            <div class="stat-row" style="font-size: 10px; color: #666; margin-top: 5px;">Zones transparentes: absence de données</div>
          </div>
        `
      } else {
        // Légende classique pour choropleth/bubble/binary
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
      }
      
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
  async clear(): Promise<void> {
    this.clearLayers()
    
    if (this.legendControl) {
      this.map.removeControl(this.legendControl)
      this.legendControl = null
    }
    
    // Restaurer la couche de couverture (grille) en la rechargeant complètement
    // pour que les événements de clic soient ré-attachés
    const loadGrid = (window as any).loadGrid
    if (loadGrid) {
      console.log('[ThematicMap] Rechargement complet de la grille de couverture')
      try {
        await loadGrid(false)
        console.log('[ThematicMap] Grille rechargée avec succès')
      } catch (err) {
        console.error('[ThematicMap] Erreur rechargement grille:', err)
      }
    } else {
      // Fallback: juste ajouter la couche existante (sans événements)
      const gridLayer = (window as any).gridLayer
      if (gridLayer && !this.map.hasLayer(gridLayer)) {
        console.log('[ThematicMap] Restauration de la couche de couverture (fallback)')
        gridLayer.addTo(this.map)
      }
    }
    
    this.currentConfig = null
    this.currentClassification = null
    this.currentData = null
    
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
  
  // ============================================================================
  // EXPORT STATE
  // ============================================================================
  
  /**
   * Obtenir l'état d'export actuel
   */
  getCurrentExportState(): ThematicExportState | null {
    return this.currentExportState
  }
  
  /**
   * Mettre à jour l'état d'export (appelé après chaque apply)
   */
  updateExportState(): void {
    if (!this.currentConfig || !this.currentClassification || !this.currentData) {
      this.currentExportState = null
      return
    }
    
    const param = getParameterById(this.currentConfig.parameter)
    const classification = this.currentClassification
    const stats = this.currentData.statistics
    
    // Construire les classes avec bornes
    // breaks = [b0, b1, b2, ...] définit les seuils entre classes
    // Classe 0: min=null, max=breaks[0]
    // Classe 1: min=breaks[0], max=breaks[1]
    // Classe N-1: min=breaks[N-2], max=null
    const classes: ThematicClassBreak[] = []
    const breaks = classification.breaks || []
    
    console.log('[ThematicMap] Building classes from breaks:', breaks, 'labels:', classification.labels)
    
    for (let i = 0; i < classification.n_classes; i++) {
      classes.push({
        index: i,
        min: i === 0 ? null : breaks[i - 1],
        max: i === classification.n_classes - 1 ? null : breaks[i],
        color: classification.colors[i],
        label: classification.labels[i]
      })
    }
    
    console.log('[ThematicMap] Classes built:', classes.map(c => ({ label: c.label, min: c.min, max: c.max })))
    
    this.currentExportState = {
      parameterId: this.currentConfig.parameter,
      parameterLabel: param?.label || this.currentConfig.parameter,
      unit: param?.unit || '',
      mapType: this.currentConfig.type as 'choropleth' | 'proportional' | 'binary',
      classes,
      filters: {
        adm1: this.currentConfig.filters.adm1 || null,
        adm2: this.currentConfig.filters.adm2 || null,
        adm3: this.currentConfig.filters.adm3 || null,
        minSondages: this.currentConfig.filters.min_sondages || null
      },
      stats: {
        min: stats.min,
        max: stats.max,
        mean: stats.mean,
        median: stats.median
      },
      features: this.currentData.features || [],
      totalCellCount: stats.count_total || stats.count || this.currentData.features?.length || 0,
      // Statistiques enrichies de l'API pour l'export
      apiStats: {
        count: stats.count,
        count_total: stats.count_total,
        null_count: stats.null_count,
        sum: stats.sum,
        min: stats.min,
        max: stats.max,
        mean: stats.mean,
        median: stats.median,
        stddev: stats.stddev,
        parent_context: stats.parent_context
      }
    }
    
    console.log('[ThematicMap] Export state updated:', this.currentExportState)
  }
  
  // ============================================================================
  // EXPORT PNG
  // ============================================================================
  
  /**
   * Exporter la carte actuelle en PNG
   */
  async exportCurrentMapAsPng(): Promise<void> {
    const mapContainer = document.getElementById('map')
    if (!mapContainer) {
      alert('Impossible de trouver le conteneur de carte.')
      return
    }
    
    try {
      console.log('[ThematicMap] Export PNG en cours...')
      
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#1a1a2e'
      })
      
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Erreur lors de la génération du PNG.')
          return
        }
        
        const state = this.currentExportState
        const param = state?.parameterId ?? 'carte'
        const ts = new Date().toISOString().slice(0, 10)
        
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `atlas_${param}_${ts}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(a.href)
        
        console.log('[ThematicMap] ✅ Export PNG terminé')
      }, 'image/png')
      
    } catch (error) {
      console.error('[ThematicMap] Erreur export PNG:', error)
      alert('Erreur lors de l\'export PNG. Voir la console pour les détails.')
    }
  }
  
  // ============================================================================
  // EXPORT PDF
  // ============================================================================
  
  /**
   * Exporter la carte actuelle en PDF (A4 paysage)
   */
  async exportCurrentMapAsPdf(): Promise<void> {
    const mapContainer = document.getElementById('map')
    if (!mapContainer) {
      alert('Impossible de trouver le conteneur de carte.')
      return
    }
    
    try {
      console.log('[ThematicMap] Export PDF en cours...')
      
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#1a1a2e'
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      // A4 paysage
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      // Calculer les dimensions de l'image
      const imgWidth = pageWidth - 20  // marges 10 mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      const x = 10
      const y = Math.max(15, (pageHeight - imgHeight) / 2)
      
      // Titre en haut
      const state = this.currentExportState
      const title = state
        ? `${state.parameterLabel} – ${state.filters.adm1 ?? 'Togo'}`
        : 'Carte Atlas Géotechnique'
      
      pdf.setFontSize(12)
      pdf.setTextColor(51, 51, 51)
      pdf.text(title, 10, 10)
      
      // Date en haut à droite
      const dateStr = new Date().toLocaleDateString('fr-FR')
      pdf.setFontSize(8)
      pdf.text(dateStr, pageWidth - 30, 10)
      
      // Image de la carte
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, Math.min(imgHeight, pageHeight - 25))
      
      // Légende en bas si on a les classes
      if (state && state.classes.length > 0) {
        const legendY = pageHeight - 8
        pdf.setFontSize(7)
        pdf.text('Légende:', 10, legendY)
        
        let legendX = 25
        for (const cls of state.classes) {
          // Rectangle de couleur
          pdf.setFillColor(cls.color)
          pdf.rect(legendX, legendY - 3, 4, 3, 'F')
          // Label
          pdf.setTextColor(51, 51, 51)
          pdf.text(cls.label, legendX + 5, legendY)
          legendX += 30
          if (legendX > pageWidth - 40) break
        }
      }
      
      // Sauvegarder
      const ts = new Date().toISOString().slice(0, 10)
      const param = state?.parameterId ?? 'carte'
      pdf.save(`atlas_${param}_${ts}.pdf`)
      
      console.log('[ThematicMap] ✅ Export PDF terminé')
      
    } catch (error) {
      console.error('[ThematicMap] Erreur export PDF:', error)
      alert('Erreur lors de l\'export PDF. Voir la console pour les détails.')
    }
  }
  
  // ============================================================================
  // EXPORT QGIS (GeoJSON + QML)
  // ============================================================================
  
  /**
   * Exporter le package QGIS (GeoJSON + style QML dans un ZIP)
   */
  async exportQgisPackage(): Promise<void> {
    const state = this.currentExportState
    if (!state) {
      alert('Appliquez d\'abord une carte thématique.')
      return
    }
    
    try {
      console.log('[ThematicMap] Export QGIS en cours...')
      
      const payload = {
        parameter_id: state.parameterId,
        parameter_label: state.parameterLabel,
        unit: state.unit,
        map_type: state.mapType,
        classes: state.classes,
        filters: {
          adm1: state.filters.adm1,
          adm2: state.filters.adm2,
          adm3: state.filters.adm3,
          min_sondages: state.filters.minSondages
        }
      }
      
      const response = await fetch(`${this.apiUrl}/thematic/export/qgis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur serveur ${response.status}: ${errorText}`)
      }
      
      const blob = await response.blob()
      const ts = new Date().toISOString().slice(0, 10)
      const fileName = `atlas_${state.parameterId}_${ts}_qgis.zip`
      
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      
      console.log('[ThematicMap] ✅ Export QGIS terminé')
      
    } catch (error) {
      console.error('[ThematicMap] Erreur export QGIS:', error)
      alert('Échec de l\'export QGIS. Voir la console pour les détails.')
    }
  }
  
  /**
   * Récupère le bbox du contour ADM actuellement affiché
   * Retourne null si aucun contour ADM n'est affiché
   */
  getAdmOverlayBounds(): { north: number; south: number; east: number; west: number } | null {
    if (!this.admOverlayLayer || this.admOverlayLayer.getLayers().length === 0) {
      return null
    }
    
    try {
      // Calculer les bounds en itérant sur les layers
      let minLat = Infinity, maxLat = -Infinity
      let minLng = Infinity, maxLng = -Infinity
      
      this.admOverlayLayer.eachLayer((layer: any) => {
        if (layer.getBounds) {
          const layerBounds = layer.getBounds()
          if (layerBounds.isValid()) {
            minLat = Math.min(minLat, layerBounds.getSouth())
            maxLat = Math.max(maxLat, layerBounds.getNorth())
            minLng = Math.min(minLng, layerBounds.getWest())
            maxLng = Math.max(maxLng, layerBounds.getEast())
          }
        }
      })
      
      if (minLat === Infinity || maxLat === -Infinity) {
        return null
      }
      
      return {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
      }
    } catch (e) {
      console.warn('[ThematicMap] Impossible de récupérer les bounds ADM:', e)
      return null
    }
  }
  
  /**
   * Récupère les coordonnées du polygone ADM pour le masque d'export
   * Retourne un tableau de [lng, lat] représentant le contour externe
   */
  getAdmPolygonCoords(): number[][] | null {
    console.log('[ThematicMap] getAdmPolygonCoords called:', {
      hasAdmOverlayLayer: !!this.admOverlayLayer,
      layerCount: this.admOverlayLayer?.getLayers?.()?.length || 0
    })
    
    if (!this.admOverlayLayer || this.admOverlayLayer.getLayers().length === 0) {
      console.warn('[ThematicMap] admOverlayLayer est vide ou inexistant')
      return null
    }
    
    try {
      let coords: number[][] | null = null
      
      // Fonction récursive pour trouver le premier polygone dans les layers imbriqués
      const findPolygonCoords = (layer: any, depth: number = 0): void => {
        if (coords) return // Déjà trouvé
        
        console.log(`[ThematicMap] Exploring layer depth=${depth}:`, {
          type: layer.constructor?.name,
          hasGetLatLngs: !!layer.getLatLngs,
          hasGetLayers: !!layer.getLayers,
          hasFeature: !!layer.feature
        })
        
        // Si c'est un groupe de layers (L.GeoJSON, L.FeatureGroup), explorer les sous-layers
        if (layer.getLayers && typeof layer.getLayers === 'function') {
          const subLayers = layer.getLayers()
          console.log(`[ThematicMap] Layer has ${subLayers.length} sub-layers`)
          for (const subLayer of subLayers) {
            findPolygonCoords(subLayer, depth + 1)
            if (coords) return
          }
        }
        
        // Si c'est un polygone avec getLatLngs
        if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
          const latLngs = layer.getLatLngs()
          console.log('[ThematicMap] Layer latLngs:', {
            isArray: Array.isArray(latLngs),
            length: latLngs?.length,
            firstIsArray: Array.isArray(latLngs?.[0]),
            sample: latLngs?.[0]?.[0] || latLngs?.[0]
          })
          
          // GeoJSON peut avoir plusieurs niveaux d'imbrication
          // Polygon: [[LatLng, LatLng, ...]]
          // MultiPolygon: [[[LatLng, ...]]]
          let ring: any = latLngs
          while (Array.isArray(ring) && Array.isArray(ring[0]) && !(ring[0] as any).lat) {
            ring = ring[0]
          }
          
          if (ring && ring.length > 0 && (ring[0] as any).lat !== undefined) {
            coords = ring.map((ll: any) => [ll.lng, ll.lat])
            console.log('[ThematicMap] Coords extraites:', coords?.length, 'points')
          }
        }
      }
      
      this.admOverlayLayer.eachLayer((layer: any) => {
        findPolygonCoords(layer, 0)
      })
      
      if (!coords) {
        console.warn('[ThematicMap] Aucune coordonnée trouvée dans admOverlayLayer')
      }
      
      return coords
    } catch (e) {
      console.warn('[ThematicMap] Impossible de récupérer les coords ADM:', e)
      return null
    }
  }
}
