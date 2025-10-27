import { ThematicMapManager } from './thematic-maps'
import type { ThematicMapConfig, ThematicParameter } from './thematic-types'
import { THEMATIC_PARAMETERS, CATEGORY_LABELS, PALETTE_OPTIONS, ADM1_OPTIONS } from './thematic-types'

export class ThematicPanel {
  private manager: ThematicMapManager
  private panelElement: HTMLElement
  private isOpen: boolean = false
  
  constructor(manager: ThematicMapManager) {
    this.manager = manager
    this.panelElement = document.getElementById('thematicPanel') as HTMLElement
    
    if (!this.panelElement) {
      throw new Error('Element #thematicPanel not found')
    }
    
    this.init()
  }
  
  private init(): void {
    // Populate parameter select
    this.populateParameterSelect()
    
    // Event listeners
    this.attachEventListeners()
    
    // Initialize with default values
    this.setDefaults()
  }
  
  private populateParameterSelect(): void {
    const categorySelect = document.getElementById('thematicCategory') as HTMLSelectElement
    const parameterSelect = document.getElementById('thematicParameter') as HTMLSelectElement
    
    if (!categorySelect || !parameterSelect) return
    
    // Category change handler
    categorySelect.addEventListener('change', () => {
      const category = categorySelect.value
      this.updateParameterList(category)
    })
    
    // Initial population
    this.updateParameterList('all')
  }
  
  private updateParameterList(category: string): void {
    const parameterSelect = document.getElementById('thematicParameter') as HTMLSelectElement
    const descriptionEl = document.getElementById('parameterDescription') as HTMLElement
    
    if (!parameterSelect) return
    
    // Clear existing options
    parameterSelect.innerHTML = ''
    
    // Filter parameters by category
    const filteredParams = category === 'all' 
      ? THEMATIC_PARAMETERS 
      : THEMATIC_PARAMETERS.filter(p => p.category === category)
    
    // Add options
    filteredParams.forEach(param => {
      const option = document.createElement('option')
      option.value = param.id
      option.textContent = param.label
      option.dataset.description = param.description
      option.dataset.defaultPalette = param.defaultPalette || 'Blues'
      option.dataset.defaultBreaks = param.defaultBreaks ? JSON.stringify(param.defaultBreaks) : ''
      parameterSelect.appendChild(option)
    })
    
    // Update description
    if (parameterSelect.selectedIndex >= 0) {
      const selected = parameterSelect.options[parameterSelect.selectedIndex]
      if (descriptionEl) {
        descriptionEl.textContent = selected.dataset.description || ''
      }
      
      // Update palette to default
      const paletteSelect = document.getElementById('colorPalette') as HTMLSelectElement
      if (paletteSelect && selected.dataset.defaultPalette) {
        paletteSelect.value = selected.dataset.defaultPalette
      }
    }
    
    // Parameter change handler
    parameterSelect.addEventListener('change', () => {
      const selected = parameterSelect.options[parameterSelect.selectedIndex]
      if (descriptionEl) {
        descriptionEl.textContent = selected.dataset.description || ''
      }
      
      // Update palette
      const paletteSelect = document.getElementById('colorPalette') as HTMLSelectElement
      if (paletteSelect && selected.dataset.defaultPalette) {
        paletteSelect.value = selected.dataset.defaultPalette
      }
      
      // Update breaks if custom
      const methodSelect = document.getElementById('classificationMethod') as HTMLSelectElement
      if (methodSelect && selected.dataset.defaultBreaks && methodSelect.value === 'custom') {
        // TODO: Populate custom breaks
      }
    })
  }
  
  private attachEventListeners(): void {
    // Open/Close panel
    const openBtn = document.getElementById('openThematicPanel')
    const closeBtn = document.getElementById('closeThematicPanel')
    
    if (openBtn) {
      openBtn.addEventListener('click', () => this.open())
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }
    
    // Apply button
    const applyBtn = document.getElementById('applyThematic')
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyThematic())
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetThematic')
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetThematic())
    }
    
    // Save button
    const saveBtn = document.getElementById('saveThematicConfig')
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveConfig())
    }
    
    // Export buttons
    const exportGeoJSONBtn = document.getElementById('exportThematicGeoJSON')
    if (exportGeoJSONBtn) {
      exportGeoJSONBtn.addEventListener('click', () => this.exportGeoJSON())
    }
    
    const exportPNGBtn = document.getElementById('exportThematicPNG')
    if (exportPNGBtn) {
      exportPNGBtn.addEventListener('click', () => this.exportPNG())
    }
    
    // Toggle grid layer
    const toggleGridBtn = document.getElementById('toggleGridLayer') as HTMLInputElement
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('change', () => this.toggleGridLayer(toggleGridBtn.checked))
    }
    
    // Auto-AOI button
    const autoAOIBtn = document.getElementById('autoAOI')
    if (autoAOIBtn) {
      autoAOIBtn.addEventListener('click', () => this.autoZoomToData())
    }
  }
  
  private setDefaults(): void {
    // Set default values
    const nClassesInput = document.getElementById('nClasses') as HTMLInputElement
    if (nClassesInput) nClassesInput.value = '5'
    
    const minSondagesInput = document.getElementById('minSondages') as HTMLInputElement
    if (minSondagesInput) minSondagesInput.value = '3'
  }
  
  private async applyThematic(): Promise<void> {
    try {
      const config = this.buildConfig()
      
      // Show loading
      this.setLoading(true)
      
      await this.manager.loadThematicMap(config)
      
      // Show stats
      const stats = this.manager.getCurrentClassification()
      if (stats) {
        this.showStats()
      }
      
      this.toast('Carte thématique chargée', 'success')
      
    } catch (error) {
      console.error('Erreur application thématique:', error)
      this.toast(`Erreur: ${error}`, 'error')
    } finally {
      this.setLoading(false)
    }
  }
  
  private buildConfig(): ThematicMapConfig {
    const parameterSelect = document.getElementById('thematicParameter') as HTMLSelectElement
    const methodSelect = document.getElementById('classificationMethod') as HTMLSelectElement
    const nClassesInput = document.getElementById('nClasses') as HTMLInputElement
    const paletteSelect = document.getElementById('colorPalette') as HTMLSelectElement
    const typeSelect = document.getElementById('mapType') as HTMLSelectElement
    const adm1Select = document.getElementById('filterAdm1') as HTMLSelectElement
    const adm2Select = document.getElementById('filterAdm2') as HTMLSelectElement
    const adm3Select = document.getElementById('filterAdm3') as HTMLSelectElement
    const minSondagesInput = document.getElementById('minSondages') as HTMLInputElement
    const opacityInput = document.getElementById('opacity') as HTMLInputElement
    
    const parameter = parameterSelect?.value || 'n_sondages'
    const method = methodSelect?.value as any || 'quantiles'
    const nClasses = parseInt(nClassesInput?.value || '5')
    const palette = paletteSelect?.value || 'Blues'
    const type = (typeSelect?.value as any) || 'choropleth'
    const adm1 = adm1Select?.value || undefined
    const adm2 = adm2Select?.value || undefined
    const adm3 = adm3Select?.value || undefined
    const minSondages = parseInt(minSondagesInput?.value || '3')
    const opacity = parseFloat(opacityInput?.value || '0.7')
    
    // Get custom breaks if method is custom
    let customBreaks: number[] | undefined
    if (method === 'custom') {
      const selected = parameterSelect.options[parameterSelect.selectedIndex]
      if (selected.dataset.defaultBreaks) {
        customBreaks = JSON.parse(selected.dataset.defaultBreaks)
      }
    }
    
    const config: ThematicMapConfig = {
      name: 'Carte temporaire',
      type,
      parameter,
      classification: {
        method,
        n_classes: nClasses,
        custom_breaks: customBreaks
      },
      style: {
        palette,
        opacity,
        stroke_width: 1,
        stroke_color: '#333'
      },
      filters: {
        adm1,
        adm2,
        adm3,
        min_sondages: minSondages
      }
    }
    
    return config
  }
  
  private resetThematic(): void {
    this.manager.clear()
    this.hideStats()
    this.toast('Carte réinitialisée', 'info')
  }
  
  private async saveConfig(): Promise<void> {
    const name = prompt('Nom de la configuration:')
    if (!name) return
    
    const description = prompt('Description (optionnel):')
    
    try {
      const id = await this.manager.saveConfig(name, description || undefined)
      this.toast(`Configuration sauvegardée (ID: ${id})`, 'success')
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      this.toast(`Erreur: ${error}`, 'error')
    }
  }
  
  private exportGeoJSON(): void {
    try {
      this.manager.exportAsGeoJSON()
      this.toast('Export GeoJSON réussi', 'success')
    } catch (error) {
      console.error('Erreur export:', error)
      this.toast(`Erreur: ${error}`, 'error')
    }
  }
  
  private async exportPNG(): Promise<void> {
    try {
      // Use html2canvas or similar
      this.toast('Export PNG non implémenté (Phase 2)', 'info')
    } catch (error) {
      console.error('Erreur export PNG:', error)
      this.toast(`Erreur: ${error}`, 'error')
    }
  }
  
  private showStats(): void {
    const statsEl = document.getElementById('thematicStats')
    if (!statsEl) return
    
    statsEl.style.display = 'block'
    
    // Stats are shown in the legend
  }
  
  private hideStats(): void {
    const statsEl = document.getElementById('thematicStats')
    if (statsEl) {
      statsEl.style.display = 'none'
    }
  }
  
  private setLoading(loading: boolean): void {
    const applyBtn = document.getElementById('applyThematic') as HTMLButtonElement
    if (applyBtn) {
      applyBtn.disabled = loading
      applyBtn.textContent = loading ? '⏳ Chargement...' : '📊 Appliquer'
    }
  }
  
  private toast(message: string, type: 'success' | 'error' | 'info'): void {
    // Simple toast notification
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.remove()
    }, 3000)
  }
  
  private toggleGridLayer(show: boolean): void {
    const gridLayer = (window as any).gridLayer
    const map = this.manager['map'] // Access private map
    
    if (!gridLayer || !map) return
    
    if (show) {
      if (!map.hasLayer(gridLayer)) {
        gridLayer.addTo(map)
        console.log('[ThematicPanel] Grille de fond affichée')
      }
    } else {
      if (map.hasLayer(gridLayer)) {
        map.removeLayer(gridLayer)
        console.log('[ThematicPanel] Grille de fond masquée')
      }
    }
  }
  
  private autoZoomToData(): void {
    const currentLayer = this.manager['currentLayer'] // Access private layer
    const map = this.manager['map']
    
    if (!currentLayer || !map) {
      this.toast('Aucune carte thématique active', 'error')
      return
    }
    
    try {
      const bounds = currentLayer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.1)) // 10% padding
        this.toast('Zoom ajusté aux données', 'success')
      }
    } catch (error) {
      console.error('Erreur auto-zoom:', error)
      this.toast('Erreur lors du zoom automatique', 'error')
    }
  }
  
  public open(): void {
    this.panelElement.style.display = 'block'
    this.isOpen = true
  }
  
  public close(): void {
    this.panelElement.style.display = 'none'
    this.isOpen = false
  }
  
  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }
}
