import { ThematicMapManager } from './thematic-maps'
import type { ThematicMapConfig, ObjectifMetier, MapType, ClassificationMethod } from './thematic-types'
import { 
  OBJECTIFS_METIER, 
  THEMATIC_PARAMETERS, 
  MAP_TYPES,
  CLASSIFICATION_METHODS,
  PALETTE_OPTIONS, 
  ADM1_OPTIONS,
  getParametersForObjectif,
  getParameterById,
  getObjectifById,
  getDefaultConfig
} from './thematic-types'

/**
 * Panneau de configuration des cartes thématiques v2.0
 * Organisation en 4 blocs métier pour ingénieurs géotechniciens
 */
export class ThematicPanel {
  private manager: ThematicMapManager
  private panelElement: HTMLElement
  private isOpen: boolean = false
  private currentConfig: ThematicMapConfig
  
  // Cache des éléments DOM
  private elements: {
    objectifSelect?: HTMLSelectElement
    parameterSelect?: HTMLSelectElement
    parameterDescription?: HTMLElement
    mapTypeSelect?: HTMLSelectElement
    methodSelect?: HTMLSelectElement
    nClassesInput?: HTMLInputElement
    manualBreaksContainer?: HTMLElement
    manualBreaksInput?: HTMLInputElement
    paletteSelect?: HTMLSelectElement
    opacityInput?: HTMLInputElement
    opacityValue?: HTMLElement
    adm1Select?: HTMLSelectElement
    adm2Select?: HTMLSelectElement
    adm3Select?: HTMLSelectElement
    minSondagesInput?: HTMLInputElement
    excludeNoDataCheckbox?: HTMLInputElement
    depthMinInput?: HTMLInputElement
    depthMaxInput?: HTMLInputElement
    summaryText?: HTMLElement
    toggleGridCheckbox?: HTMLInputElement
  } = {}
  
  constructor(manager: ThematicMapManager) {
    this.manager = manager
    this.panelElement = document.getElementById('thematicPanel') as HTMLElement
    this.currentConfig = getDefaultConfig()
    
    if (!this.panelElement) {
      throw new Error('Element #thematicPanel not found')
    }
    
    this.init()
  }
  
  private init(): void {
    // Render the panel HTML
    this.renderPanel()
    
    // Cache DOM elements
    this.cacheElements()
    
    // Populate selects
    this.populateObjectifSelect()
    this.populateMapTypeSelect()
    this.populateMethodSelect()
    this.populatePaletteSelect()
    this.populateAdmSelects()
    
    // Event listeners
    this.attachEventListeners()
    
    // Initialize with default values
    this.applyConfigToUI(this.currentConfig)
  }
  
  /**
   * Render the complete panel HTML
   */
  private renderPanel(): void {
    this.panelElement.innerHTML = `
      <div class="thematic-panel-header">
        <h3>🗺️ Cartes Thématiques</h3>
        <button id="closeThematicPanel" class="btn-close" title="Fermer">×</button>
      </div>
      
      <div class="thematic-panel-body">
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BLOC A : Objectif métier -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="thematic-section">
          <div class="section-label">Catégorie</div>
          <select id="thematicObjectif" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Paramètre</div>
          <select id="thematicParameter" class="thematic-select"></select>
          <div id="parameterDescription" class="param-description"></div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BLOC B : Style & Classification -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="thematic-section">
          <div class="section-label">Type de carte</div>
          <select id="mapType" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Méthode de classification</div>
          <select id="classificationMethod" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Nombre de classes</div>
          <input type="number" id="nClasses" class="thematic-input" value="5" min="3" max="9">
        </div>
        
        <div id="manualBreaksContainer" class="thematic-section" style="display:none;">
          <div class="section-label">Seuils manuels (séparés par virgule)</div>
          <input type="text" id="manualBreaks" class="thematic-input" placeholder="ex: 1, 2, 3, 4, 5">
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Palette de couleurs</div>
          <select id="colorPalette" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Opacité</div>
          <div class="opacity-control">
            <input type="range" id="opacity" min="0" max="1" step="0.05" value="0.7">
            <span id="opacityValue" class="opacity-value">70%</span>
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BLOC C : Filtres -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="thematic-divider">
          <span>Filtres géographiques</span>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Région (ADM1)</div>
          <select id="filterAdm1" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Préfecture (ADM2)</div>
          <select id="filterAdm2" class="thematic-select">
            <option value="">— toutes préfectures —</option>
          </select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Commune (ADM3)</div>
          <select id="filterAdm3" class="thematic-select">
            <option value="">— toutes communes —</option>
          </select>
        </div>
        
        <div class="thematic-divider">
          <span>Filtres données</span>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Sondages minimum</div>
          <input type="number" id="minSondages" class="thematic-input" value="1" min="0" max="10">
        </div>
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label">
            <input type="checkbox" id="excludeNoData" checked>
            <span>Exclure mailles sans données</span>
          </label>
        </div>
        
        <!-- Filtres avancés (repliables) -->
        <details class="advanced-filters">
          <summary>⚙️ Filtres avancés</summary>
          <div class="advanced-content">
            <div class="thematic-section">
              <div class="section-label">Profondeur (m)</div>
              <div class="range-inputs">
                <input type="number" id="depthMin" class="thematic-input small" placeholder="Min" min="0" step="0.5">
                <span class="range-separator">—</span>
                <input type="number" id="depthMax" class="thematic-input small" placeholder="Max" min="0" step="0.5">
              </div>
            </div>
          </div>
        </details>
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label">
            <input type="checkbox" id="toggleGridLayer" checked>
            <span>Afficher la grille de fond</span>
          </label>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BLOC D : Résumé & Actions -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div id="dataSummary" class="data-summary"></div>
        
        <div class="thematic-actions">
          <button id="applyThematic" class="btn-primary">
            <span class="btn-icon">📊</span> Appliquer
          </button>
          <button id="autoAOI" class="btn-secondary">
            <span class="btn-icon">🎯</span> Auto-Zoom
          </button>
        </div>
        
        <div class="thematic-actions">
          <button id="resetThematic" class="btn-outline">
            <span class="btn-icon">♻️</span> Réinitialiser
          </button>
        </div>
        
        <div class="thematic-divider">
          <span>Exports</span>
        </div>
        
        <div class="thematic-actions">
          <button id="saveThematicConfig" class="btn-small">
            <span class="btn-icon">💾</span> Sauvegarder
          </button>
          <button id="exportThematicGeoJSON" class="btn-small">
            <span class="btn-icon">📥</span> GeoJSON
          </button>
        </div>
        
        <div class="thematic-actions">
          <button id="exportThematicPNG" class="btn-small full-width">
            <span class="btn-icon">🖼️</span> Export PNG
          </button>
        </div>
      </div>
    `
  }
  
  /**
   * Cache DOM elements for performance
   */
  private cacheElements(): void {
    this.elements = {
      objectifSelect: document.getElementById('thematicObjectif') as HTMLSelectElement,
      parameterSelect: document.getElementById('thematicParameter') as HTMLSelectElement,
      parameterDescription: document.getElementById('parameterDescription') as HTMLElement,
      mapTypeSelect: document.getElementById('mapType') as HTMLSelectElement,
      methodSelect: document.getElementById('classificationMethod') as HTMLSelectElement,
      nClassesInput: document.getElementById('nClasses') as HTMLInputElement,
      manualBreaksContainer: document.getElementById('manualBreaksContainer') as HTMLElement,
      manualBreaksInput: document.getElementById('manualBreaks') as HTMLInputElement,
      paletteSelect: document.getElementById('colorPalette') as HTMLSelectElement,
      opacityInput: document.getElementById('opacity') as HTMLInputElement,
      opacityValue: document.getElementById('opacityValue') as HTMLElement,
      adm1Select: document.getElementById('filterAdm1') as HTMLSelectElement,
      adm2Select: document.getElementById('filterAdm2') as HTMLSelectElement,
      adm3Select: document.getElementById('filterAdm3') as HTMLSelectElement,
      minSondagesInput: document.getElementById('minSondages') as HTMLInputElement,
      excludeNoDataCheckbox: document.getElementById('excludeNoData') as HTMLInputElement,
      depthMinInput: document.getElementById('depthMin') as HTMLInputElement,
      depthMaxInput: document.getElementById('depthMax') as HTMLInputElement,
      summaryText: document.getElementById('dataSummary') as HTMLElement,
      toggleGridCheckbox: document.getElementById('toggleGridLayer') as HTMLInputElement
    }
  }
  
  /**
   * Populate objectif select with métier options
   */
  private populateObjectifSelect(): void {
    const select = this.elements.objectifSelect
    if (!select) return
    
    select.innerHTML = OBJECTIFS_METIER.map(obj => 
      `<option value="${obj.id}">${obj.icon} ${obj.label}</option>`
    ).join('')
  }
  
  /**
   * Update parameter list based on selected objectif
   */
  private updateParameterList(objectifId: ObjectifMetier): void {
    const select = this.elements.parameterSelect
    const descEl = this.elements.parameterDescription
    if (!select) return
    
    const params = getParametersForObjectif(objectifId)
    const objectif = getObjectifById(objectifId)
    
    select.innerHTML = params.map(p => {
      const unitSuffix = p.unit ? ` (${p.unit})` : ''
      return `<option value="${p.id}" 
        data-description="${p.description}"
        data-formula="${p.formula || ''}"
        data-palette="${p.defaultPalette || 'Blues'}"
        data-breaks="${p.defaultBreaks ? JSON.stringify(p.defaultBreaks) : ''}"
      >${p.label}${unitSuffix}</option>`
    }).join('')
    
    // Select default parameter for this objectif
    if (objectif?.defaultParameter) {
      select.value = objectif.defaultParameter
    }
    
    // Update description
    this.updateParameterDescription()
    
    // Update palette to objectif default
    if (objectif?.defaultPalette && this.elements.paletteSelect) {
      this.elements.paletteSelect.value = objectif.defaultPalette
    }
  }
  
  /**
   * Update parameter description display
   */
  private updateParameterDescription(): void {
    const select = this.elements.parameterSelect
    const descEl = this.elements.parameterDescription
    if (!select || !descEl) return
    
    const option = select.options[select.selectedIndex]
    if (option) {
      const desc = option.dataset.description || ''
      const formula = option.dataset.formula || ''
      descEl.innerHTML = formula 
        ? `${desc}<br><code class="formula">${formula}</code>`
        : desc
    }
  }
  
  /**
   * Populate map type select
   */
  private populateMapTypeSelect(): void {
    const select = this.elements.mapTypeSelect
    if (!select) return
    
    select.innerHTML = MAP_TYPES.map(t => 
      `<option value="${t.id}">${t.label}</option>`
    ).join('')
  }
  
  /**
   * Populate classification method select
   */
  private populateMethodSelect(): void {
    const select = this.elements.methodSelect
    if (!select) return
    
    select.innerHTML = CLASSIFICATION_METHODS.map(m => 
      `<option value="${m.id}" title="${m.description}">${m.label}</option>`
    ).join('')
  }
  
  /**
   * Populate palette select with color previews
   */
  private populatePaletteSelect(): void {
    const select = this.elements.paletteSelect
    if (!select) return
    
    select.innerHTML = PALETTE_OPTIONS.map(p => 
      `<option value="${p.value}">${p.label}</option>`
    ).join('')
  }
  
  /**
   * Populate ADM selects
   */
  private populateAdmSelects(): void {
    const adm1Select = this.elements.adm1Select
    if (!adm1Select) return
    
    adm1Select.innerHTML = ADM1_OPTIONS.map(o => 
      `<option value="${o.value}">${o.label}</option>`
    ).join('')
  }
  
  /**
   * Cascade ADM1 → ADM2 : charger les préfectures de la région sélectionnée
   */
  private async loadAdm2ForAdm1(adm1Code: string | null): Promise<void> {
    const adm2Select = this.elements.adm2Select
    const adm3Select = this.elements.adm3Select
    if (!adm2Select) return
    
    // Reset ADM2 et ADM3
    adm2Select.innerHTML = '<option value="">— toutes préfectures —</option>'
    adm2Select.disabled = true
    if (adm3Select) {
      adm3Select.innerHTML = '<option value="">— toutes communes —</option>'
      adm3Select.disabled = true
    }
    
    if (!adm1Code) return
    
    try {
      // Appeler l'API pour récupérer les ADM2 de cette région
      const apiUrl = (window as any).__API_GEO__ || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/adm/adm2?adm1_code=${adm1Code}`)
      if (!response.ok) throw new Error('Erreur chargement ADM2')
      
      const adm2List = await response.json()
      
      adm2Select.innerHTML = '<option value="">— toutes préfectures —</option>' +
        adm2List.map((a: any) => `<option value="${a.code}">${a.name}</option>`).join('')
      adm2Select.disabled = false
      
    } catch (error) {
      console.error('[ThematicPanel] Erreur chargement ADM2:', error)
      adm2Select.disabled = false
    }
  }
  
  /**
   * Cascade ADM2 → ADM3 : charger les communes de la préfecture sélectionnée
   */
  private async loadAdm3ForAdm2(adm2Code: string | null): Promise<void> {
    const adm3Select = this.elements.adm3Select
    if (!adm3Select) return
    
    // Reset ADM3
    adm3Select.innerHTML = '<option value="">— toutes communes —</option>'
    adm3Select.disabled = true
    
    if (!adm2Code) return
    
    try {
      const apiUrl = (window as any).__API_GEO__ || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/adm/adm3?adm2_code=${adm2Code}`)
      if (!response.ok) throw new Error('Erreur chargement ADM3')
      
      const adm3List = await response.json()
      
      adm3Select.innerHTML = '<option value="">— toutes communes —</option>' +
        adm3List.map((a: any) => `<option value="${a.code}">${a.name}</option>`).join('')
      adm3Select.disabled = false
      
    } catch (error) {
      console.error('[ThematicPanel] Erreur chargement ADM3:', error)
      adm3Select.disabled = false
    }
  }
  
  /**
   * Mettre à jour les contrôles de classification selon le type de carte
   */
  private updateClassificationControls(mapType: string): void {
    const methodSelect = this.elements.methodSelect
    const nClassesInput = this.elements.nClassesInput
    const manualBreaksContainer = this.elements.manualBreaksContainer
    
    if (mapType === 'binary') {
      // Carte binaire : griser méthode et nombre de classes
      if (methodSelect) {
        methodSelect.disabled = true
        methodSelect.style.opacity = '0.5'
      }
      if (nClassesInput) {
        nClassesInput.disabled = true
        nClassesInput.style.opacity = '0.5'
      }
      if (manualBreaksContainer) {
        manualBreaksContainer.style.display = 'none'
      }
      // TODO: Afficher un champ pour le seuil binaire
    } else {
      // Autres types : réactiver les contrôles
      if (methodSelect) {
        methodSelect.disabled = false
        methodSelect.style.opacity = '1'
      }
      if (nClassesInput) {
        nClassesInput.disabled = false
        nClassesInput.style.opacity = '1'
      }
    }
  }
  
  /**
   * Attach all event listeners
   */
  private attachEventListeners(): void {
    // Close button
    const closeBtn = document.getElementById('closeThematicPanel')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }
    
    // Open button
    const openBtn = document.getElementById('openThematicPanel')
    if (openBtn) {
      openBtn.addEventListener('click', () => this.open())
    }
    
    // Objectif change -> update parameters
    this.elements.objectifSelect?.addEventListener('change', (e) => {
      const objectifId = (e.target as HTMLSelectElement).value as ObjectifMetier
      this.updateParameterList(objectifId)
      this.currentConfig.objectif = objectifId
    })
    
    // Parameter change -> update description & palette
    this.elements.parameterSelect?.addEventListener('change', () => {
      this.updateParameterDescription()
      this.updatePaletteFromParameter()
    })
    
    // Map type change -> update classification controls
    this.elements.mapTypeSelect?.addEventListener('change', (e) => {
      const mapType = (e.target as HTMLSelectElement).value
      this.updateClassificationControls(mapType)
    })
    
    // Classification method change -> show/hide manual breaks
    this.elements.methodSelect?.addEventListener('change', (e) => {
      const method = (e.target as HTMLSelectElement).value
      if (this.elements.manualBreaksContainer) {
        this.elements.manualBreaksContainer.style.display = method === 'manual' ? 'block' : 'none'
      }
    })
    
    // Opacity slider
    this.elements.opacityInput?.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value)
      if (this.elements.opacityValue) {
        this.elements.opacityValue.textContent = `${Math.round(value * 100)}%`
      }
    })
    
    // ADM1 change -> cascade to ADM2
    this.elements.adm1Select?.addEventListener('change', (e) => {
      const adm1Code = (e.target as HTMLSelectElement).value || null
      this.loadAdm2ForAdm1(adm1Code)
    })
    
    // ADM2 change -> cascade to ADM3
    this.elements.adm2Select?.addEventListener('change', (e) => {
      const adm2Code = (e.target as HTMLSelectElement).value || null
      this.loadAdm3ForAdm2(adm2Code)
    })
    
    // Apply button
    document.getElementById('applyThematic')?.addEventListener('click', () => this.applyThematic())
    
    // Reset button
    document.getElementById('resetThematic')?.addEventListener('click', () => this.resetThematic())
    
    // Auto-zoom button
    document.getElementById('autoAOI')?.addEventListener('click', () => this.autoZoomToData())
    
    // Save button
    document.getElementById('saveThematicConfig')?.addEventListener('click', () => this.saveConfig())
    
    // Export buttons
    document.getElementById('exportThematicGeoJSON')?.addEventListener('click', () => this.exportGeoJSON())
    document.getElementById('exportThematicPNG')?.addEventListener('click', () => this.exportPNG())
    
    // Toggle grid layer
    this.elements.toggleGridCheckbox?.addEventListener('change', (e) => {
      this.toggleGridLayer((e.target as HTMLInputElement).checked)
    })
  }
  
  /**
   * Update palette based on selected parameter
   */
  private updatePaletteFromParameter(): void {
    const select = this.elements.parameterSelect
    const paletteSelect = this.elements.paletteSelect
    if (!select || !paletteSelect) return
    
    const option = select.options[select.selectedIndex]
    if (option?.dataset.palette) {
      paletteSelect.value = option.dataset.palette
    }
  }
  
  /**
   * Apply config values to UI elements
   */
  private applyConfigToUI(config: ThematicMapConfig): void {
    // Objectif
    if (this.elements.objectifSelect) {
      this.elements.objectifSelect.value = config.objectif
      this.updateParameterList(config.objectif)
    }
    
    // Parameter
    if (this.elements.parameterSelect) {
      this.elements.parameterSelect.value = config.parameter
      this.updateParameterDescription()
    }
    
    // Map type
    if (this.elements.mapTypeSelect) {
      this.elements.mapTypeSelect.value = config.type
    }
    
    // Classification
    if (this.elements.methodSelect) {
      this.elements.methodSelect.value = config.classification.method
    }
    if (this.elements.nClassesInput) {
      this.elements.nClassesInput.value = config.classification.n_classes.toString()
    }
    
    // Style
    if (this.elements.paletteSelect) {
      this.elements.paletteSelect.value = config.style.palette
    }
    if (this.elements.opacityInput) {
      this.elements.opacityInput.value = config.style.opacity.toString()
    }
    if (this.elements.opacityValue) {
      this.elements.opacityValue.textContent = `${Math.round(config.style.opacity * 100)}%`
    }
    
    // Filters
    if (this.elements.minSondagesInput) {
      this.elements.minSondagesInput.value = config.filters.min_sondages.toString()
    }
    if (this.elements.excludeNoDataCheckbox) {
      this.elements.excludeNoDataCheckbox.checked = config.filters.exclude_no_data
    }
  }
  
  /**
   * Build config from UI values
   */
  private buildConfigFromUI(): ThematicMapConfig {
    const objectif = (this.elements.objectifSelect?.value || 'couverture') as ObjectifMetier
    const parameter = this.elements.parameterSelect?.value || 'n_sondages'
    const type = (this.elements.mapTypeSelect?.value || 'choropleth') as MapType
    const method = (this.elements.methodSelect?.value || 'quantiles') as ClassificationMethod
    const nClasses = parseInt(this.elements.nClassesInput?.value || '5')
    const palette = this.elements.paletteSelect?.value || 'Blues'
    const opacity = parseFloat(this.elements.opacityInput?.value || '0.7')
    
    // Parse manual breaks if method is manual
    let manualBreaks: number[] | undefined
    if (method === 'manual' && this.elements.manualBreaksInput?.value) {
      manualBreaks = this.elements.manualBreaksInput.value
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n))
    }
    
    // Filters
    const adm1 = this.elements.adm1Select?.value || undefined
    const adm2 = this.elements.adm2Select?.value || undefined
    const adm3 = this.elements.adm3Select?.value || undefined
    const minSondages = parseInt(this.elements.minSondagesInput?.value || '1')
    const excludeNoData = this.elements.excludeNoDataCheckbox?.checked ?? true
    const depthMin = this.elements.depthMinInput?.value ? parseFloat(this.elements.depthMinInput.value) : undefined
    const depthMax = this.elements.depthMaxInput?.value ? parseFloat(this.elements.depthMaxInput.value) : undefined
    
    return {
      name: 'Carte temporaire',
      objectif,
      parameter,
      type,
      classification: {
        method,
        n_classes: nClasses,
        manual_breaks: manualBreaks
      },
      style: {
        palette,
        opacity,
        stroke_width: 1,
        stroke_color: '#333333'
      },
      filters: {
        adm1,
        adm2,
        adm3,
        min_sondages: minSondages,
        exclude_no_data: excludeNoData,
        depth_min: depthMin,
        depth_max: depthMax
      }
    }
  }
  
  /**
   * Apply thematic map
   */
  private async applyThematic(): Promise<void> {
    try {
      const config = this.buildConfigFromUI()
      this.currentConfig = config
      
      console.log('[ThematicPanel] Applying config:', config)
      
      // Show loading
      this.setLoading(true)
      
      await this.manager.loadThematicMap(config)
      
      // Update summary
      this.updateSummary()
      
      this.toast('Carte thématique chargée', 'success')
      
    } catch (error) {
      console.error('[ThematicPanel] Error:', error)
      this.toast(`Erreur: ${error}`, 'error')
    } finally {
      this.setLoading(false)
    }
  }
  
  /**
   * Update data summary display
   */
  private updateSummary(): void {
    const summaryEl = this.elements.summaryText
    if (!summaryEl) return
    
    const classification = this.manager.getCurrentClassification()
    const config = this.currentConfig
    const param = getParameterById(config.parameter)
    
    if (classification) {
      summaryEl.innerHTML = `
        <div class="summary-row">
          <span class="summary-label">Paramètre:</span>
          <span class="summary-value">${param?.label || config.parameter}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Classes:</span>
          <span class="summary-value">${classification.n_classes}</span>
        </div>
      `
      summaryEl.style.display = 'block'
    }
  }
  
  /**
   * Reset thematic map
   */
  private resetThematic(): void {
    this.manager.clear()
    this.currentConfig = getDefaultConfig()
    this.applyConfigToUI(this.currentConfig)
    
    if (this.elements.summaryText) {
      this.elements.summaryText.style.display = 'none'
    }
    
    this.toast('Carte réinitialisée', 'info')
  }
  
  /**
   * Auto-zoom to data extent
   */
  private autoZoomToData(): void {
    const polygonLayer = this.manager['polygonLayer']
    const map = this.manager['map']
    
    if (!polygonLayer || !map) {
      this.toast('Aucune carte thématique active', 'error')
      return
    }
    
    try {
      const bounds = polygonLayer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.1))
        this.toast('Zoom ajusté aux données', 'success')
      }
    } catch (error) {
      console.error('[ThematicPanel] Auto-zoom error:', error)
      this.toast('Erreur lors du zoom automatique', 'error')
    }
  }
  
  /**
   * Save current configuration
   */
  private async saveConfig(): Promise<void> {
    const name = prompt('Nom de la configuration:')
    if (!name) return
    
    const description = prompt('Description (optionnel):')
    
    try {
      const id = await this.manager.saveConfig(name, description || undefined)
      this.toast(`Configuration sauvegardée (ID: ${id})`, 'success')
    } catch (error) {
      console.error('[ThematicPanel] Save error:', error)
      this.toast(`Erreur: ${error}`, 'error')
    }
  }
  
  /**
   * Export as GeoJSON
   */
  private exportGeoJSON(): void {
    try {
      this.manager.exportAsGeoJSON()
      this.toast('Export GeoJSON réussi', 'success')
    } catch (error) {
      console.error('[ThematicPanel] Export error:', error)
      this.toast(`Erreur: ${error}`, 'error')
    }
  }
  
  /**
   * Export as PNG
   */
  private async exportPNG(): Promise<void> {
    this.toast('Export PNG non implémenté (Phase 3)', 'info')
  }
  
  /**
   * Toggle grid layer visibility
   */
  private toggleGridLayer(show: boolean): void {
    const gridLayer = (window as any).gridLayer
    const map = this.manager['map']
    
    if (!gridLayer || !map) return
    
    if (show) {
      if (!map.hasLayer(gridLayer)) {
        gridLayer.addTo(map)
      }
    } else {
      if (map.hasLayer(gridLayer)) {
        map.removeLayer(gridLayer)
      }
    }
  }
  
  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    const applyBtn = document.getElementById('applyThematic') as HTMLButtonElement
    if (applyBtn) {
      applyBtn.disabled = loading
      applyBtn.innerHTML = loading 
        ? '<span class="btn-icon">⏳</span> Chargement...'
        : '<span class="btn-icon">📊</span> Appliquer'
    }
  }
  
  /**
   * Show toast notification
   */
  private toast(message: string, type: 'success' | 'error' | 'info'): void {
    const toast = document.createElement('div')
    toast.className = `thematic-toast thematic-toast-${type}`
    toast.textContent = message
    document.body.appendChild(toast)
    
    setTimeout(() => toast.classList.add('show'), 10)
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }
  
  // Public methods
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
