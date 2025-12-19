import { ThematicMapManager } from './thematic-maps'
import type { ThematicMapConfig, ObjectifMetier, MapType, ClassificationMethod } from './thematic-types'
import { createExportQuickDialog, type ExportQuickDialogConfig } from '../export'
import { createExportAtlasDialog } from '../export/export-atlas-dialog'
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
  private exportDialog: ReturnType<typeof createExportQuickDialog> | null = null
  
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
    excludeOutsideAdmCheckbox?: HTMLInputElement
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
    console.log('[ThematicPanel] Initialisation...')
    
    // Render the panel HTML
    this.renderPanel()
    console.log('[ThematicPanel] HTML rendu')
    
    // Cache DOM elements
    this.cacheElements()
    console.log('[ThematicPanel] Elements cachés:', {
      adm1: !!this.elements.adm1Select,
      adm2: !!this.elements.adm2Select,
      adm3: !!this.elements.adm3Select
    })
    
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
    
    console.log('[ThematicPanel] ✅ Initialisation terminée')
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
          <select id="thematicAdm1" class="thematic-select">
            <option value="">— toutes régions —</option>
          </select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Préfecture (ADM2)</div>
          <select id="thematicAdm2" class="thematic-select">
            <option value="">— toutes préfectures —</option>
          </select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Commune (ADM3)</div>
          <select id="thematicAdm3" class="thematic-select">
            <option value="">— toutes communes —</option>
          </select>
        </div>
        
        <div id="admFilterSummary" class="adm-filter-summary" style="display:none;"></div>
        
        <button id="clearAdmFilters" class="btn-small full-width" style="margin-bottom:12px;">
          🧹 Effacer filtres géographiques
        </button>
        
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
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label">
            <input type="checkbox" id="excludeOutsideAdm">
            <span>Exclure mailles hors sélection ADM</span>
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
          <button id="exportThematicPro" class="btn-primary full-width" title="Export cartographique professionnel avec grille, titre, légende">
            <span class="btn-icon">📤</span> Export Pro (PNG/PDF)
          </button>
        </div>
        
        <div class="thematic-actions">
          <button id="exportThematicAtlas" class="btn-secondary full-width" title="Exporter toutes les cartes thématiques pour tous les ADM">
            <span class="btn-icon">📚</span> Export Atlas complet
          </button>
        </div>
        
        <div class="thematic-actions export-grid">
          <button id="exportThematicPNG" class="btn-small" title="Capture rapide de la carte">
            <span class="btn-icon">🖼️</span> PNG rapide
          </button>
          <button id="exportThematicQGIS" class="btn-small" title="GeoJSON + style QML pour QGIS">
            <span class="btn-icon">🗺️</span> QGIS
          </button>
        </div>
        
        <div class="thematic-actions">
          <button id="exportThematicGeoJSON" class="btn-small">
            <span class="btn-icon">📥</span> GeoJSON brut
          </button>
          <button id="saveThematicConfig" class="btn-small">
            <span class="btn-icon">💾</span> Sauvegarder config
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
      adm1Select: document.getElementById('thematicAdm1') as HTMLSelectElement,
      adm2Select: document.getElementById('thematicAdm2') as HTMLSelectElement,
      adm3Select: document.getElementById('thematicAdm3') as HTMLSelectElement,
      minSondagesInput: document.getElementById('minSondages') as HTMLInputElement,
      excludeNoDataCheckbox: document.getElementById('excludeNoData') as HTMLInputElement,
      excludeOutsideAdmCheckbox: document.getElementById('excludeOutsideAdm') as HTMLInputElement,
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
   * Utilitaire pour remplir un select de manière fiable
   */
  private fillSelect(
    select: HTMLSelectElement, 
    options: { value: string; label: string }[], 
    defaultLabel: string = '— toutes —'
  ): void {
    // Vider complètement le select
    select.innerHTML = ''
    
    // Ajouter l'option par défaut
    const defaultOpt = document.createElement('option')
    defaultOpt.value = ''
    defaultOpt.textContent = defaultLabel
    select.appendChild(defaultOpt)
    
    // Ajouter les autres options
    for (const opt of options) {
      if (opt.value === '') continue // Skip si c'est l'option par défaut déjà ajoutée
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = opt.label
      select.appendChild(option)
    }
  }
  
  /**
   * Populate ADM selects
   */
  private populateAdmSelects(): void {
    const adm1Select = this.elements.adm1Select
    if (!adm1Select) {
      console.warn('[ThematicPanel] ADM1 select not found')
      return
    }
    
    // Utiliser fillSelect pour peupler ADM1
    const adm1Options = ADM1_OPTIONS.filter(o => o.value !== '')
    this.fillSelect(adm1Select, adm1Options, '— toutes régions —')
    
    console.log('[ThematicPanel] ADM1 options populated:', adm1Select.options.length, 'options')
  }
  
  /**
   * Cascade ADM1 → ADM2 : charger les préfectures de la région sélectionnée
   */
  private async loadAdm2ForAdm1(adm1Name: string | null): Promise<void> {
    const adm2Select = this.elements.adm2Select
    const adm3Select = this.elements.adm3Select
    if (!adm2Select) return
    
    // Reset ADM2 et ADM3
    this.fillSelect(adm2Select, [], '— toutes préfectures —')
    adm2Select.disabled = true
    if (adm3Select) {
      this.fillSelect(adm3Select, [], '— toutes communes —')
      adm3Select.disabled = true
    }
    
    if (!adm1Name) {
      adm2Select.disabled = false
      if (adm3Select) adm3Select.disabled = false
      return
    }
    
    try {
      // Appeler l'API pour récupérer les ADM2 de cette région
      const apiUrl = (window as any).__API_GEO__ || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/adm2?adm1=${encodeURIComponent(adm1Name)}`)
      if (!response.ok) throw new Error('Erreur chargement ADM2')
      
      const adm2List = await response.json()
      console.log('[ThematicPanel] ADM2 chargés:', adm2List.length)
      
      const options = adm2List.map((a: any) => ({ value: a.name, label: a.name }))
      this.fillSelect(adm2Select, options, '— toutes préfectures —')
      adm2Select.disabled = false
      
    } catch (error) {
      console.error('[ThematicPanel] Erreur chargement ADM2:', error)
      adm2Select.disabled = false
    }
  }
  
  /**
   * Cascade ADM2 → ADM3 : charger les communes de la préfecture sélectionnée
   */
  private async loadAdm3ForAdm2(adm2Name: string | null): Promise<void> {
    const adm3Select = this.elements.adm3Select
    if (!adm3Select) return
    
    // Reset ADM3
    this.fillSelect(adm3Select, [], '— toutes communes —')
    adm3Select.disabled = true
    
    if (!adm2Name) {
      adm3Select.disabled = false
      return
    }
    
    try {
      const apiUrl = (window as any).__API_GEO__ || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/adm3?adm2=${encodeURIComponent(adm2Name)}`)
      if (!response.ok) throw new Error('Erreur chargement ADM3')
      
      const adm3List = await response.json()
      console.log('[ThematicPanel] ADM3 chargés:', adm3List.length)
      
      const options = adm3List.map((a: any) => ({ value: a.name, label: a.name }))
      this.fillSelect(adm3Select, options, '— toutes communes —')
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
    
    // ADM1 change -> cascade to ADM2 + update overlay
    this.elements.adm1Select?.addEventListener('change', (e) => {
      const adm1Name = (e.target as HTMLSelectElement).value || null
      this.loadAdm2ForAdm1(adm1Name)
      this.updateAdmFilterSummary()
      // Mettre à jour le contour ADM immédiatement
      this.manager.updateAdmOverlay(adm1Name, null, null)
    })
    
    // ADM2 change -> cascade to ADM3 + update overlay
    this.elements.adm2Select?.addEventListener('change', (e) => {
      const adm1Name = this.elements.adm1Select?.value || null
      const adm2Name = (e.target as HTMLSelectElement).value || null
      this.loadAdm3ForAdm2(adm2Name)
      this.updateAdmFilterSummary()
      // Mettre à jour le contour ADM immédiatement
      this.manager.updateAdmOverlay(adm1Name, adm2Name, null)
    })
    
    // ADM3 change -> update summary + overlay
    this.elements.adm3Select?.addEventListener('change', (e) => {
      const adm1Name = this.elements.adm1Select?.value || null
      const adm2Name = this.elements.adm2Select?.value || null
      const adm3Name = (e.target as HTMLSelectElement).value || null
      this.updateAdmFilterSummary()
      // Mettre à jour le contour ADM immédiatement
      this.manager.updateAdmOverlay(adm1Name, adm2Name, adm3Name)
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
    document.getElementById('exportThematicQGIS')?.addEventListener('click', () => this.exportQGIS())
    document.getElementById('exportThematicPro')?.addEventListener('click', () => this.openExportProDialog())
    document.getElementById('exportThematicAtlas')?.addEventListener('click', () => this.openExportAtlasDialog())
    
    // Toggle grid layer
    this.elements.toggleGridCheckbox?.addEventListener('change', (e) => {
      this.toggleGridLayer((e.target as HTMLInputElement).checked)
    })
    
    // Clear ADM filters button
    document.getElementById('clearAdmFilters')?.addEventListener('click', () => {
      this.clearAdmFilters()
    })
  }
  
  /**
   * Effacer tous les filtres ADM
   */
  private clearAdmFilters(): void {
    if (this.elements.adm1Select) {
      this.elements.adm1Select.value = ''
    }
    if (this.elements.adm2Select) {
      this.fillSelect(this.elements.adm2Select, [], '— toutes préfectures —')
    }
    if (this.elements.adm3Select) {
      this.fillSelect(this.elements.adm3Select, [], '— toutes communes —')
    }
    this.updateAdmFilterSummary()
    // Effacer le contour ADM
    this.manager.updateAdmOverlay(null, null, null)
    this.toast('Filtres géographiques effacés', 'success')
  }
  
  /**
   * Mettre à jour le résumé des filtres ADM
   */
  private updateAdmFilterSummary(): void {
    const summary = document.getElementById('admFilterSummary')
    if (!summary) return
    
    const adm1 = this.elements.adm1Select?.value
    const adm2 = this.elements.adm2Select?.value
    const adm3 = this.elements.adm3Select?.value
    
    if (!adm1 && !adm2 && !adm3) {
      summary.style.display = 'none'
      return
    }
    
    const parts: string[] = []
    if (adm1) parts.push(`Région: <strong>${adm1}</strong>`)
    if (adm2) parts.push(`Préfecture: <strong>${adm2}</strong>`)
    if (adm3) parts.push(`Commune: <strong>${adm3}</strong>`)
    
    summary.innerHTML = `<div class="filter-badge">📍 ${parts.join(' → ')}</div>`
    summary.style.display = 'block'
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
    console.log('[ThematicPanel] ADM filters:', { adm1, adm2, adm3, adm1El: this.elements.adm1Select })
    const minSondages = parseInt(this.elements.minSondagesInput?.value || '1')
    const excludeNoData = this.elements.excludeNoDataCheckbox?.checked ?? true
    const excludeOutsideAdm = this.elements.excludeOutsideAdmCheckbox?.checked ?? false
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
        exclude_outside_adm: excludeOutsideAdm,
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
  private async resetThematic(): Promise<void> {
    await this.manager.clear()
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
   * Export as PNG (capture de la carte)
   */
  private async exportPNG(): Promise<void> {
    this.toast('Export PNG en cours...', 'info')
    await this.manager.exportCurrentMapAsPng()
  }
  
  /**
   * Export as PDF (A4 paysage avec légende)
   */
  private async exportPDF(): Promise<void> {
    this.toast('Export PDF en cours...', 'info')
    await this.manager.exportCurrentMapAsPdf()
  }
  
  /**
   * Export package QGIS (GeoJSON + style QML)
   */
  private async exportQGIS(): Promise<void> {
    this.toast('Export QGIS en cours...', 'info')
    await this.manager.exportQgisPackage()
  }
  
  /**
   * Ouvrir le dialogue d'export professionnel v3.0
   */
  private openExportProDialog(): void {
    // Créer le dialogue si pas encore fait
    if (!this.exportDialog) {
      const mapContainer = document.getElementById('map')
      if (!mapContainer) {
        this.toast('Conteneur carte introuvable', 'error')
        return
      }
      
      const map = this.manager['map']
      
      const config: ExportQuickDialogConfig = {
        mapContainer,
        
        getMapBounds: () => {
          const bounds = map.getBounds()
          return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          }
        },
        
        getActiveThematic: () => {
          const state = this.manager.getCurrentExportState?.()
          if (state) {
            return {
              name: state.parameterLabel || 'Carte géotechnique',
              parameter: state.parameterId || 'n_sondages',
              unit: state.unit
            }
          }
          return {
            name: 'Carte géotechnique',
            parameter: 'n_sondages'
          }
        },
        
        getActiveAdmFilters: () => {
          return {
            adm1: this.elements.adm1Select?.value ? { 
              code: this.elements.adm1Select.value, 
              name: this.elements.adm1Select.options[this.elements.adm1Select.selectedIndex]?.text || this.elements.adm1Select.value 
            } : undefined,
            adm2: this.elements.adm2Select?.value ? { 
              code: this.elements.adm2Select.value, 
              name: this.elements.adm2Select.options[this.elements.adm2Select.selectedIndex]?.text || this.elements.adm2Select.value 
            } : undefined,
            adm3: this.elements.adm3Select?.value ? { 
              code: this.elements.adm3Select.value, 
              name: this.elements.adm3Select.options[this.elements.adm3Select.selectedIndex]?.text || this.elements.adm3Select.value 
            } : undefined
          }
        },
        
        // Récupérer les données de légende thématique (classes, couleurs, labels, features, stats)
        getThematicLegendData: () => {
          const state = this.manager.getCurrentExportState?.()
          if (state && state.classes && state.classes.length > 0) {
            return {
              parameterId: state.parameterId,
              parameterLabel: state.parameterLabel,
              unit: state.unit,
              mapType: state.mapType,
              classes: state.classes.map(c => ({
                index: c.index,
                min: c.min,
                max: c.max,
                color: c.color,
                label: c.label
              })),
              features: state.features || [],
              totalCellCount: state.totalCellCount || 0,
              // Passer les stats enrichies de l'API pour l'export
              apiStats: state.apiStats
            }
          }
          return null
        },
        
        // Référence au gridLayer pour le masquer pendant l'export
        getGridLayer: () => (window as any).gridLayer,
        
        // Référence à la map Leaflet
        getMap: () => map,
        
        // Récupère le bbox du polygone ADM actif (pour centrer l'export sur l'ADM)
        getAdmBounds: () => this.manager.getAdmOverlayBounds?.() || null,
        
        // Récupère les coordonnées du polygone ADM pour le masque
        getAdmPolygon: () => this.manager.getAdmPolygonCoords?.() || null,
        
        // Récupère les features thématiques de l'écran (SOURCE DE VÉRITÉ pour l'export)
        getThematicFeatures: () => {
          const state = this.manager.getCurrentExportState?.()
          return state?.features || null
        }
      }
      
      this.exportDialog = createExportQuickDialog(config)
    }
    
    this.exportDialog.open()
  }
  
  /**
   * Ouvrir le dialogue d'export Atlas complet (batch)
   */
  private openExportAtlasDialog(): void {
    const map = this.manager['map']
    const mapContainer = document.getElementById('map')
    
    const callbacks = {
      // Changer la thématique et le filtre ADM
      setThematicAndAdm: async (thematicId: string, admLevel: string, admName: string): Promise<void> => {
        console.log(`[Atlas] Changement: ${thematicId} / ${admLevel} / ${admName}`)
        
        // Mettre à jour les sélecteurs ADM
        if (admLevel === 'adm1' && this.elements.adm1Select) {
          // Trouver l'option correspondante
          const options = Array.from(this.elements.adm1Select.options)
          const option = options.find(o => o.text === admName || o.value === admName)
          if (option) {
            this.elements.adm1Select.value = option.value
            this.elements.adm1Select.dispatchEvent(new Event('change'))
          }
        }
        
        // Mettre à jour le paramètre thématique
        if (this.elements.parameterSelect) {
          this.elements.parameterSelect.value = thematicId
          this.elements.parameterSelect.dispatchEvent(new Event('change'))
        }
        
        // Appliquer la carte thématique
        await this.applyThematic()
        
        // Attendre le rendu
        await new Promise(r => setTimeout(r, 1000))
      },
      
      // Capturer la carte actuelle avec ExportFrame (masque, stats, cadrage)
      captureCurrentMap: async (): Promise<Blob | null> => {
        if (!mapContainer || !map) return null
        
        try {
          // Utiliser le même mécanisme que ExportQuickDialog
          const { captureLeafletMap } = await import('../export/capture-utils')
          const { ExportFrame, computeScaleText } = await import('../export/export-frame')
          const { buildExportStats } = await import('../export/export-stats')
          
          // Récupérer les bounds de la carte
          const bounds = map.getBounds()
          const bbox = {
            minX: bounds.getWest(),
            minY: bounds.getSouth(),
            maxX: bounds.getEast(),
            maxY: bounds.getNorth()
          }
          
          // Capturer la carte
          const mapCapture = await captureLeafletMap(mapContainer, 'print')
          
          // Créer l'ExportFrame avec options
          const exportFrame = new ExportFrame(mapCapture.width, mapCapture.height, {
            format: 'png',
            quality: 'print',
            zone: 'adm-filtered',
            includeTitle: true,
            includeLegend: true,
            includeStats: true,
            includeScaleBar: true,
            includeNorthArrow: true,
            includeScrInfo: true,
            grid: { type: 'cross', scr: 'EPSG:4326', targetDivisions: 5, showLabels: true, labelSides: { top: true, bottom: true, left: true, right: true } },
            frameStyle: 'zebra'
          })
          
          // Récupérer les données thématiques
          const state = this.manager.getCurrentExportState?.()
          const thematic = { 
            name: state?.parameterLabel || 'Carte', 
            parameter: state?.parameterId || ''
          }
          // Récupérer les filtres ADM actifs
          const admFilters = {
            adm1: this.elements.adm1Select?.value ? { 
              code: this.elements.adm1Select.value, 
              name: this.elements.adm1Select.options[this.elements.adm1Select.selectedIndex]?.text || '' 
            } : undefined,
            adm2: this.elements.adm2Select?.value ? { 
              code: this.elements.adm2Select.value, 
              name: this.elements.adm2Select.options[this.elements.adm2Select.selectedIndex]?.text || '' 
            } : undefined,
            adm3: this.elements.adm3Select?.value ? { 
              code: this.elements.adm3Select.value, 
              name: this.elements.adm3Select.options[this.elements.adm3Select.selectedIndex]?.text || '' 
            } : undefined
          }
          
          // Dessiner les éléments
          exportFrame.drawTitle(thematic, admFilters)
          await exportFrame.drawMapImage(mapCapture.canvas)
          
          // Masque ADM
          const admPolygon = this.manager.getAdmPolygonCoords?.()
          if (admPolygon && admPolygon.length >= 3) {
            exportFrame.drawAdmMask(admPolygon, bbox, 'context')
          }
          
          exportFrame.drawGridAndFrame(bbox)
          
          // Légende et stats
          const legendData = state ? {
            parameterId: state.parameterId,
            parameterLabel: state.parameterLabel,
            unit: state.unit,
            mapType: state.mapType,
            classes: state.classes,
            features: state.features || [],
            totalCellCount: state.totalCellCount || 0,
            apiStats: state.apiStats
          } : undefined
          
          exportFrame.drawLegend(legendData)
          
          if (legendData) {
            const statsData = buildExportStats({
              parameterId: legendData.parameterId,
              parameterLabel: legendData.parameterLabel,
              unit: legendData.unit,
              features: legendData.features,
              totalCellCount: legendData.totalCellCount,
              classes: legendData.classes,
              admFilters,
              apiStats: legendData.apiStats
            })
            exportFrame.drawStats(statsData)
          }
          
          // Cartouche
          const centerLat = (bounds.getNorth() + bounds.getSouth()) / 2
          const scaleText = computeScaleText(mapCapture.width, bounds.getEast() - bounds.getWest(), centerLat)
          exportFrame.drawCartouche(scaleText)
          
          // Convertir en Blob
          return exportFrame.toBlob('image/png')
        } catch (e) {
          console.error('[Atlas] Erreur capture ExportFrame:', e)
          return null
        }
      },
      
      // Récupérer la liste des ADM (non utilisé, l'API est appelée directement)
      getAdmList: async (level: 'adm1' | 'adm2' | 'adm3') => {
        const response = await fetch(`http://localhost:8000/${level}`)
        if (response.ok) return response.json()
        return []
      },
      
      // Export single map (fallback)
      exportSingleMap: async () => null
    }
    
    const dialog = createExportAtlasDialog((config) => {
      console.log('[ThematicPanel] Export Atlas config:', config)
    }, callbacks)
    dialog.open()
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
