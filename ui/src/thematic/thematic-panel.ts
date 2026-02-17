import { ThematicMapManager } from './thematic-maps'
import { createExportQuickDialog, type ExportQuickDialogConfig } from '../export'
import { createExportAtlasDialog } from '../export/export-atlas-dialog'
import { apiUrl } from '../api'
import { 
  OBJECTIFS_METIER, 
  type ThematicMapConfig,
  type ObjectifMetier,
  type ThematicParameter,
  type MapType,
  type ClassificationMethod,
  type PaletteOption,
  getRecommendedPalette,
  PALETTE_OPTIONS, 
  THEMATIC_PARAMETERS, 
  MAP_TYPES,
  CLASSIFICATION_METHODS,
  ADM1_OPTIONS,
  getParametersForObjectif,
  getParameterById,
  getObjectifById,
  getDefaultConfig
} from './thematic-types'
import {
  type ThematicState,
  detectObjectif,
  computeTightBoundsForAdm,
  getExportFitOptions,
  fitMapForExport
} from './thematic-state'

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
    toggleGeologieCheckbox?: HTMLInputElement
    togglePedologieCheckbox?: HTMLInputElement
    toggleRisqueGonflementCheckbox?: HTMLInputElement
    toggleDsmCheckbox?: HTMLInputElement
  } = {}

  private setSelectValueByOptionText(select: HTMLSelectElement | undefined, optionText: string | undefined): void {
    if (!select || !optionText) return
    const match = Array.from(select.options).find(o => (o.text || '').trim() === optionText)
    if (match) {
      select.value = match.value
    } else {
      select.value = ''
    }
  }
  
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

    // Synchroniser visuellement le niveau de grille avec le panneau droit (source de vérité: main.ts)
    const getLevel = (window as any).getCurrentGridLevel
    const currentLevel = typeof getLevel === 'function' ? getLevel() : '2km'
    if ((window as any).syncGridLevelUI) {
      ;(window as any).syncGridLevelUI(currentLevel)
    }
    
    console.log('[ThematicPanel] ✅ Initialisation terminée')
  }

  public async reloadFromUI(): Promise<void> {
    await this.applyThematic()
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
        
        <div class="thematic-divider">
          <span>Niveau de grille</span>
        </div>
        
        <div class="thematic-section">
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="gridLevel" value="2km" checked>
              <span>Grille 2 km</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="gridLevel" value="combined">
              <span>Grille combinée (2 km + 28 km)</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="gridLevel" value="28km">
              <span>Grille 28 km (Profils)</span>
            </label>
          </div>
        </div>
        
        <div class="thematic-divider">
          <span>🗺️ Couches de contexte (QGIS)</span>
        </div>
        
        <!-- Panneau QGIS-like pour couches contextuelles avec légendes dépliables -->
        <div class="context-layers-panel" style="background:#0a1018;border-radius:8px;padding:10px;margin-bottom:10px">
          
          <!-- Géologie - Accordéon -->
          <details class="context-layer-accordion" style="margin-bottom:8px;background:#0f172a;border-radius:6px;border-left:3px solid #8B4513">
            <summary style="padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">
              <label class="checkbox-label" style="margin:0;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                <input type="checkbox" id="toggleGeologie">
                <span style="font-weight:600">🪨 Géologie</span>
              </label>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="layer-badge" style="font-size:10px;background:#8B451333;color:#D2691E;padding:2px 6px;border-radius:4px">vecteur</span>
                <span style="font-size:12px;color:#64748b">▼</span>
              </div>
            </summary>
            <div class="layer-content" style="padding:8px;border-top:1px solid #1c2843">
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:8px">
                <span>Opacité:</span>
                <input type="range" id="geologieOpacity" min="10" max="80" value="45" style="flex:1;height:4px">
                <span id="geologieOpacityValue">45%</span>
              </div>
              <div id="geologieLegend" class="layer-legend" style="max-height:150px;overflow-y:auto;font-size:10px">
                <div style="color:#64748b;font-style:italic">Cochez pour charger la légende...</div>
              </div>
            </div>
          </details>
          
          <!-- Pédologie - Accordéon -->
          <details class="context-layer-accordion" style="margin-bottom:8px;background:#0f172a;border-radius:6px;border-left:3px solid #FFB6C1">
            <summary style="padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">
              <label class="checkbox-label" style="margin:0;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                <input type="checkbox" id="togglePedologie">
                <span style="font-weight:600">🌱 Pédologie</span>
              </label>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="layer-badge" style="font-size:10px;background:#FFB6C133;color:#FF69B4;padding:2px 6px;border-radius:4px">vecteur</span>
                <span style="font-size:12px;color:#64748b">▼</span>
              </div>
            </summary>
            <div class="layer-content" style="padding:8px;border-top:1px solid #1c2843">
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:8px">
                <span>Opacité:</span>
                <input type="range" id="pedologieOpacity" min="10" max="80" value="45" style="flex:1;height:4px">
                <span id="pedologieOpacityValue">45%</span>
              </div>
              <div id="pedologieLegend" class="layer-legend" style="max-height:150px;overflow-y:auto;font-size:10px">
                <div style="color:#64748b;font-style:italic">Cochez pour charger la légende...</div>
              </div>
            </div>
          </details>
          
          <!-- Risque de gonflement - Accordéon -->
          <details class="context-layer-accordion" style="margin-bottom:8px;background:#0f172a;border-radius:6px;border-left:3px solid #ff9933">
            <summary style="padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">
              <label class="checkbox-label" style="margin:0;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                <input type="checkbox" id="toggleRisqueGonflement">
                <span style="font-weight:600">⚠️ Risque gonflement</span>
              </label>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="layer-badge" style="font-size:10px;background:#ff993333;color:#ff9933;padding:2px 6px;border-radius:4px">vecteur</span>
                <span style="font-size:12px;color:#64748b">▼</span>
              </div>
            </summary>
            <div class="layer-content" style="padding:8px;border-top:1px solid #1c2843">
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:8px">
                <span>Opacité:</span>
                <input type="range" id="risqueOpacity" min="10" max="80" value="50" style="flex:1;height:4px">
                <span id="risqueOpacityValue">50%</span>
              </div>
              <div id="risqueLegend" class="layer-legend" style="max-height:120px;overflow-y:auto;font-size:10px">
                <div style="color:#64748b;font-style:italic">Cochez pour charger la légende...</div>
              </div>
            </div>
          </details>
          
          <!-- DSM/Relief - Accordéon -->
          <details class="context-layer-accordion" style="background:#0f172a;border-radius:6px;border-left:3px solid #4682B4">
            <summary style="padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">
              <label class="checkbox-label" style="margin:0;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                <input type="checkbox" id="toggleDsm">
                <span style="font-weight:600">🏔️ Relief (Altitude)</span>
              </label>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="layer-badge" style="font-size:10px;background:#4682B433;color:#87CEEB;padding:2px 6px;border-radius:4px">raster</span>
                <span style="font-size:12px;color:#64748b">▼</span>
              </div>
            </summary>
            <div class="layer-content" style="padding:8px;border-top:1px solid #1c2843">
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:8px">
                <span>Opacité:</span>
                <input type="range" id="dsmOpacity" min="20" max="90" value="60" style="flex:1;height:4px">
                <span id="dsmOpacityValue">60%</span>
              </div>
              <div style="font-size:10px;color:#64748b;padding:4px;background:#1e293b;border-radius:4px">
                ⓘ Utilise <strong>togo_map</strong> comme fond relief (dsm-cop30 non configuré sur tileserver)
              </div>
            </div>
          </details>
          
          <div style="font-size:10px;color:#64748b;margin-top:8px;text-align:center">
            ℹ️ Cliquez sur ▼ pour voir la légende • Les données apparaissent dans les tooltips
          </div>
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
      toggleGridCheckbox: document.getElementById('toggleGridLayer') as HTMLInputElement,
      toggleGeologieCheckbox: document.getElementById('toggleGeologie') as HTMLInputElement,
      togglePedologieCheckbox: document.getElementById('togglePedologie') as HTMLInputElement,
      toggleRisqueGonflementCheckbox: document.getElementById('toggleRisqueGonflement') as HTMLInputElement,
      toggleDsmCheckbox: document.getElementById('toggleDsm') as HTMLInputElement
    }
  }

  private applyThematicOverrides(palette?: string, mapType?: 'choropleth' | 'bubble' | 'heatmap'): void {
    if (palette && this.elements.paletteSelect) {
      console.log(`[ThematicPanel][Override] palette requested="${palette}" before apply (current select="${this.elements.paletteSelect.value}")`)
      this.elements.paletteSelect.value = palette
      try {
        const custom = this.elements.paletteSelect.parentElement?.querySelector('.palette-custom-select') as HTMLElement | null
        const selectedEl = custom?.querySelector('.palette-selected') as HTMLElement | null
        const gradientEl = selectedEl?.querySelector('.palette-gradient') as HTMLElement | null
        const nameEl = selectedEl?.querySelector('.palette-name') as HTMLElement | null
        const p = PALETTE_OPTIONS.find(x => x.value === palette)
        if (p && gradientEl) gradientEl.style.background = this.createGradientStyle(p.colors)
        if (p && nameEl) nameEl.textContent = p.label
        if (custom) {
          custom.querySelectorAll('.palette-option').forEach(o => o.classList.remove('selected'))
          const active = custom.querySelector(`.palette-option[data-value="${palette}"]`)
          active?.classList.add('selected')
        }
      } catch {
        // best-effort only
      }
    }

    if (mapType && this.elements.mapTypeSelect) {
      console.log(`[ThematicPanel][Override] mapType requested="${mapType}" before apply (current select="${this.elements.mapTypeSelect.value}")`)
      this.elements.mapTypeSelect.value = mapType
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
   * Populate palette select with color previews (v3.5.0)
   * Crée un sélecteur personnalisé avec aperçu gradient
   */
  private populatePaletteSelect(): void {
    const select = this.elements.paletteSelect
    if (!select) return
    
    // IMPORTANT: D'abord peupler le select natif avec toutes les options
    // Cela garantit que select.value peut être défini correctement
    select.innerHTML = ''
    PALETTE_OPTIONS.forEach(palette => {
      const option = document.createElement('option')
      option.value = palette.value
      option.textContent = palette.label
      select.appendChild(option)
    })
    
    // Définir la valeur par défaut (Blues)
    select.value = 'Blues'
    
    // Créer le conteneur pour le sélecteur personnalisé avec gradient
    const parent = select.parentElement
    if (!parent) return
    
    // Vérifier si le sélecteur personnalisé existe déjà
    let customContainer = parent.querySelector('.palette-custom-select') as HTMLElement
    if (!customContainer) {
      customContainer = document.createElement('div')
      customContainer.className = 'palette-custom-select'
      parent.insertBefore(customContainer, select)
    }
    
    // Masquer le select natif mais le garder pour la valeur
    select.style.display = 'none'
    
    // Créer le bouton de sélection avec aperçu
    const currentPalette = PALETTE_OPTIONS.find(p => p.value === select.value) || PALETTE_OPTIONS[0]
    const gradient = this.createGradientStyle(currentPalette.colors)
    
    customContainer.innerHTML = `
      <div class="palette-selected" tabindex="0">
        <span class="palette-gradient" style="background: ${gradient}"></span>
        <span class="palette-name">${currentPalette.label}</span>
        <span class="palette-chevron">▼</span>
      </div>
      <div class="palette-dropdown">
        ${PALETTE_OPTIONS.map(p => `
          <div class="palette-option ${p.value === currentPalette.value ? 'selected' : ''}" data-value="${p.value}">
            <span class="palette-gradient" style="background: ${this.createGradientStyle(p.colors)}"></span>
            <span class="palette-name">${p.label}</span>
            ${p.colorblindSafe ? '<span class="palette-badge">♿</span>' : ''}
          </div>
        `).join('')}
      </div>
    `
    
    // Event listeners
    const selectedEl = customContainer.querySelector('.palette-selected') as HTMLElement
    const dropdownEl = customContainer.querySelector('.palette-dropdown') as HTMLElement
    
    selectedEl?.addEventListener('click', () => {
      customContainer.classList.toggle('open')
    })
    
    selectedEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        customContainer.classList.toggle('open')
      }
    })
    
    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', (e) => {
      if (!customContainer.contains(e.target as Node)) {
        customContainer.classList.remove('open')
      }
    })
    
    // Sélection d'une option
    dropdownEl?.querySelectorAll('.palette-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const value = (opt as HTMLElement).dataset.value || ''
        
        // IMPORTANT: Mettre à jour le select natif AVANT de déclencher l'événement
        select.value = value
        console.log(`[ThematicPanel][Palette] Option clicked: value="${value}", select.value="${select.value}"`)
        
        // Déclencher l'événement change pour que les listeners soient notifiés
        const changeEvent = new Event('change', { bubbles: true })
        select.dispatchEvent(changeEvent)
        
        // Mettre à jour l'affichage visuel
        const palette = PALETTE_OPTIONS.find(p => p.value === value)
        if (palette) {
          const gradientEl = selectedEl.querySelector('.palette-gradient') as HTMLElement
          const nameEl = selectedEl.querySelector('.palette-name') as HTMLElement
          if (gradientEl) gradientEl.style.background = this.createGradientStyle(palette.colors)
          if (nameEl) nameEl.textContent = palette.label
        }
        
        // Mettre à jour la sélection visuelle dans le dropdown
        dropdownEl.querySelectorAll('.palette-option').forEach(o => o.classList.remove('selected'))
        opt.classList.add('selected')
        
        // Fermer le dropdown
        customContainer.classList.remove('open')
      })
    })
    
    // Injecter les styles CSS si pas déjà fait
    this.injectPaletteStyles()
  }
  
  /**
   * Crée un style de gradient CSS à partir d'un tableau de couleurs
   */
  private createGradientStyle(colors: string[]): string {
    return `linear-gradient(to right, ${colors.join(', ')})`
  }
  
  /**
   * Injecte les styles CSS pour le sélecteur de palette personnalisé
   */
  private injectPaletteStyles(): void {
    if (document.getElementById('palette-select-styles')) return
    
    const style = document.createElement('style')
    style.id = 'palette-select-styles'
    style.textContent = `
      /* Sélecteur de palette - DARK MODE (v3.5.1) */
      .palette-custom-select {
        position: relative;
        width: 100%;
      }
      
      .palette-selected {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
      }
      
      .palette-selected:hover {
        border-color: #3b82f6;
        background: #1e3a5f;
      }
      
      .palette-selected:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }
      
      .palette-gradient {
        width: 60px;
        height: 16px;
        border-radius: 3px;
        flex-shrink: 0;
        border: 1px solid rgba(255,255,255,0.15);
      }
      
      .palette-name {
        flex: 1;
        font-size: 13px;
        font-family: 'Consolas', 'Monaco', monospace;
        color: #e2e8f0;
      }
      
      .palette-chevron {
        font-size: 10px;
        color: #94a3b8;
        transition: transform 0.2s;
      }
      
      .palette-custom-select.open .palette-chevron {
        transform: rotate(180deg);
      }
      
      .palette-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 250px;
        overflow-y: auto;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 1000;
        display: none;
        margin-top: 4px;
      }
      
      .palette-custom-select.open .palette-dropdown {
        display: block;
      }
      
      .palette-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.15s;
        color: #e2e8f0;
      }
      
      .palette-option:hover {
        background: #334155;
      }
      
      .palette-option.selected {
        background: #1e3a5f;
      }
      
      .palette-option .palette-gradient {
        width: 50px;
        height: 14px;
      }
      
      .palette-badge {
        font-size: 11px;
        padding: 2px 4px;
        background: #dbeafe;
        color: #1d4ed8;
        border-radius: 3px;
      }
      
      /* Scrollbar styling */
      .palette-dropdown::-webkit-scrollbar {
        width: 6px;
      }
      .palette-dropdown::-webkit-scrollbar-track {
        background: #f1f1f1;
      }
      .palette-dropdown::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
      }
    `
    document.head.appendChild(style)
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
    
    // Palette change -> STOCKER ET LOGGER
    this.elements.paletteSelect?.addEventListener('change', (e) => {
      const selectEl = e.target as HTMLSelectElement
      const palette = selectEl.value || 'Blues'
      
      console.log(`[ThematicUI][Palette] Change event: DOM value="${palette}"`)
      
      // Stocker la palette dans la config sans recharger
      if (this.currentConfig) {
        this.currentConfig.style.palette = palette
        console.log(`[ThematicUI][Palette] Config updated: palette="${palette}"`)
      }
      
      // NE PAS recharger la carte ici - attendre le clic sur "Appliquer"
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
    
    // Grid level radio buttons
    document.querySelectorAll('input[name="gridLevel"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const level = (e.target as HTMLInputElement).value as '2km' | '28km' | 'combined'
        console.log('[ThematicPanel] Grid level changed to:', level)
        if ((window as any).setGridLevel) {
          (window as any).setGridLevel(level)
        }
        if ((window as any).syncGridLevelUI) {
          ;(window as any).syncGridLevelUI(level)
        }

        void this.applyThematic()
      })
    })
    
    // Toggle context layers - met à jour l'état global pour les tooltips enrichis
    // + charge la légende dynamiquement depuis l'API
    this.elements.toggleGeologieCheckbox?.addEventListener('change', async (e) => {
      const checked = (e.target as HTMLInputElement).checked
      this.manager.toggleContextLayer('geologie', checked)
      if ((window as any).setActiveContextLayer) {
        (window as any).setActiveContextLayer('geologie', checked)
      }
      // Charger la légende si activée
      if (checked) {
        await this.loadLegend('geologie', 'geologieLegend')
      }
    })
    
    this.elements.togglePedologieCheckbox?.addEventListener('change', async (e) => {
      const checked = (e.target as HTMLInputElement).checked
      this.manager.toggleContextLayer('pedologie', checked)
      if ((window as any).setActiveContextLayer) {
        (window as any).setActiveContextLayer('pedologie', checked)
      }
      if (checked) {
        await this.loadLegend('pedologie', 'pedologieLegend')
      }
    })
    
    this.elements.toggleRisqueGonflementCheckbox?.addEventListener('change', async (e) => {
      const checked = (e.target as HTMLInputElement).checked
      this.manager.toggleContextLayer('risque-gonflement', checked)
      if ((window as any).setActiveContextLayer) {
        (window as any).setActiveContextLayer('risque-gonflement', checked)
      }
      if (checked) {
        await this.loadLegend('risque', 'risqueLegend')
      }
    })
    
    this.elements.toggleDsmCheckbox?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked
      this.manager.toggleContextLayer('dsm', checked)
      if ((window as any).setActiveContextLayer) {
        (window as any).setActiveContextLayer('dsm', checked)
      }
    })
    
    // Sliders d'opacité pour les couches contextuelles
    document.getElementById('geologieOpacity')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      document.getElementById('geologieOpacityValue')!.textContent = `${val}%`
      this.manager.setContextLayerOpacity('geologie', parseInt(val) / 100)
    })
    document.getElementById('pedologieOpacity')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      document.getElementById('pedologieOpacityValue')!.textContent = `${val}%`
      this.manager.setContextLayerOpacity('pedologie', parseInt(val) / 100)
    })
    document.getElementById('risqueOpacity')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      document.getElementById('risqueOpacityValue')!.textContent = `${val}%`
      this.manager.setContextLayerOpacity('risque-gonflement', parseInt(val) / 100)
    })
    document.getElementById('dsmOpacity')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      document.getElementById('dsmOpacityValue')!.textContent = `${val}%`
      this.manager.setContextLayerOpacity('dsm', parseInt(val) / 100)
    })
    
    // Clear ADM filters button
    document.getElementById('clearAdmFilters')?.addEventListener('click', () => {
      this.clearAdmFilters()
    })
  }
  
  /**
   * Charge et affiche la légende d'une couche contextuelle depuis l'API
   */
  private async loadLegend(layerId: 'geologie' | 'pedologie' | 'risque', containerId: string): Promise<void> {
    const container = document.getElementById(containerId)
    if (!container) return
    
    container.innerHTML = '<div style="color:#64748b;font-style:italic;font-size:0.8rem">Chargement...</div>'
    
    try {
      const res = await fetch(apiUrl(`/layers/${layerId}/styles`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const styles: Array<{ unit_code: string; unit_label: string; color_hex: string; sort_order: number }> = await res.json()
      
      if (styles.length === 0) {
        container.innerHTML = '<div style="color:#64748b;font-style:italic;font-size:0.8rem">Aucun style disponible</div>'
        return
      }
      
      // Trier par sort_order
      styles.sort((a, b) => a.sort_order - b.sort_order)
      
      // Construire la légende HTML avec checkboxes
      container.innerHTML = ''
      container.className = 'legend-list'
      
      for (const s of styles) {
        const label = document.createElement('label')
        label.className = 'legend-item'
        
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = true
        checkbox.className = 'legend-item__checkbox'
        checkbox.dataset.layerId = layerId
        checkbox.dataset.unitCode = s.unit_code
        
        const swatch = document.createElement('span')
        swatch.className = 'legend-item__swatch'
        swatch.style.backgroundColor = s.color_hex
        
        const text = document.createElement('span')
        text.className = 'legend-item__label'
        text.textContent = s.unit_label
        text.title = s.unit_label
        
        // Event listener pour filtrer les unités
        checkbox.addEventListener('change', () => {
          this.toggleLegendUnit(layerId, s.unit_code, checkbox.checked)
        })
        
        label.appendChild(checkbox)
        label.appendChild(swatch)
        label.appendChild(text)
        container.appendChild(label)
      }
      
      console.log(`[ThematicPanel] Loaded ${styles.length} legend items for ${layerId}`)
    } catch (e) {
      console.error(`[ThematicPanel] Failed to load legend for ${layerId}:`, e)
      container.innerHTML = '<div style="color:#f87171;font-size:0.8rem">Erreur de chargement</div>'
    }
  }
  
  /**
   * Active/désactive l'affichage d'une unité dans une couche contextuelle
   */
  private toggleLegendUnit(layerId: string, unitCode: string, visible: boolean): void {
    console.log(`[ThematicPanel] Toggle unit ${unitCode} for ${layerId}: ${visible}`)
    // TODO: Implémenter le filtrage des features dans la couche GeoJSON
    // Pour l'instant, juste logger l'action
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
   * CORRECTION: Ne suggère la palette que si aucune n'est déjà sélectionnée
   */
  private updatePaletteFromParameter(): void {
    const select = this.elements.parameterSelect
    const paletteSelect = this.elements.paletteSelect
    if (!select || !paletteSelect) return
    
    const option = select.options[select.selectedIndex]
    // CORRECTION: Ne changer la palette que si elle est encore à la valeur par défaut
    // Cela évite d'écraser une sélection explicite de l'utilisateur
    if (option?.dataset.palette && paletteSelect.value === 'Blues') {
      console.log(`[ThematicUI][Palette] Suggestion auto: ${option.dataset.palette} (paramètre: ${option.value})`)
      paletteSelect.value = option.dataset.palette
      // Mettre à jour l'affichage custom select
      this.updateCustomPaletteDisplay(option.dataset.palette)
    } else {
      console.log(`[ThematicUI][Palette] Palette utilisateur conservée: ${paletteSelect.value}`)
    }
  }
  
  /**
   * Met à jour l'affichage du custom select palette
   */
  private updateCustomPaletteDisplay(paletteValue: string): void {
    const customContainer = document.querySelector('.palette-custom-select') as HTMLElement
    if (!customContainer) return
    
    const palette = PALETTE_OPTIONS.find(p => p.value === paletteValue)
    if (!palette) return
    
    const selectedEl = customContainer.querySelector('.palette-selected') as HTMLElement
    if (!selectedEl) return
    
    const gradientEl = selectedEl.querySelector('.palette-gradient') as HTMLElement
    const nameEl = selectedEl.querySelector('.palette-name') as HTMLElement
    
    if (gradientEl) {
      const gradient = this.createGradientStyle(palette.colors)
      gradientEl.style.background = gradient
    }
    if (nameEl) {
      nameEl.textContent = palette.label
    }
    
    // Mettre à jour la sélection visuelle dans le dropdown
    const dropdownEl = customContainer.querySelector('.palette-dropdown') as HTMLElement
    if (dropdownEl) {
      dropdownEl.querySelectorAll('.palette-option').forEach(opt => {
        const optValue = (opt as HTMLElement).dataset.value
        if (optValue === paletteValue) {
          opt.classList.add('selected')
        } else {
          opt.classList.remove('selected')
        }
      })
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
    
    console.log(`[ThematicUI][buildConfig] palette from DOM="${palette}"`)
    
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
    
    // Source de vérité: main.ts (panneau droit). Fallback sur radio si non disponible.
    const getLevel = (window as any).getCurrentGridLevel
    const levelFromGlobal = typeof getLevel === 'function' ? getLevel() : undefined
    const gridLevelRadio = document.querySelector('input[name="gridLevel"]:checked') as HTMLInputElement
    const levelFromRadio = (gridLevelRadio?.value || '2km') as '2km' | '28km' | 'combined'
    const gridLevel = (levelFromGlobal || levelFromRadio) as '2km' | '28km' | 'combined'
    console.log('[ThematicPanel] Grid level (global):', levelFromGlobal, 'radio:', levelFromRadio, '=>', gridLevel)
    
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
        grid: gridLevel,
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
      
      console.log(`[ThematicUI][Apply] ✅ Palette finale="${config.style.palette}"`)
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
          if (state) {
            return {
              parameterId: state.parameterId,
              parameterLabel: state.parameterLabel,
              unit: state.unit,
              mapType: state.mapType,
              gridLevel: state.gridLevel,
              classes: (state.classes || []).map(c => ({
                index: c.index,
                min: c.min,
                max: c.max,
                color: c.color,
                label: c.label
              })),
              features: state.features || [],
              totalCellCount: state.totalCellCount || 0,
              // Passer les stats enrichies de l'API pour l'export
              apiStats: state.apiStats,
              secondary: state.secondary
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
      // Changer la thématique et le filtre ADM - VERSION ROBUSTE (v3.5.2: palette optionnelle)
      setThematicAndAdm: async (
        thematicId: string,
        admLevel: string,
        admName: string,
        palette?: string,
        mapType?: 'choropleth' | 'bubble' | 'heatmap'
      ): Promise<void> => {
        console.log(`[Atlas] setThematicAndAdm: ${thematicId} / ${admLevel} / ${admName} / palette=${palette || 'default'} / mapType=${mapType || 'default'}`)
        
        // 1. Construire l'état thématique (source unique de vérité)
        const admFilters: ThematicState['admFilters'] = {}
        if (admLevel === 'adm1') {
          admFilters.adm1 = admName
        } else if (admLevel === 'adm2') {
          admFilters.adm1 = this.elements.adm1Select?.value || undefined
          admFilters.adm2 = admName
        } else if (admLevel === 'adm3') {
          admFilters.adm1 = this.elements.adm1Select?.value || undefined
          admFilters.adm2 = this.elements.adm2Select?.value || undefined
          admFilters.adm3 = admName
        }
        
        // 2. Synchroniser les sélecteurs UI SANS dispatchEvent (évite les effets de bord)
        // IMPORTANT: les <select> ADM stockent souvent un "code" en value, alors que admName est un "label".
        // On matche donc sur option.text pour retrouver le code.
        console.log('[Atlas][Batch] ADM selection before', {
          admLevel,
          admName,
          target: admFilters,
          dom: {
            adm1: this.elements.adm1Select?.value,
            adm2: this.elements.adm2Select?.value,
            adm3: this.elements.adm3Select?.value
          }
        })

        this.setSelectValueByOptionText(this.elements.adm1Select, admFilters.adm1)
        this.setSelectValueByOptionText(this.elements.adm2Select, admFilters.adm2)
        this.setSelectValueByOptionText(this.elements.adm3Select, admFilters.adm3)

        console.log('[Atlas][Batch] ADM selection applied to DOM', {
          dom: {
            adm1: this.elements.adm1Select?.value,
            adm2: this.elements.adm2Select?.value,
            adm3: this.elements.adm3Select?.value
          },
          domText: {
            adm1: this.elements.adm1Select?.options[this.elements.adm1Select.selectedIndex]?.text,
            adm2: this.elements.adm2Select?.options[this.elements.adm2Select.selectedIndex]?.text,
            adm3: this.elements.adm3Select?.options[this.elements.adm3Select.selectedIndex]?.text
          }
        })

        const objectifForThematic = detectObjectif(thematicId)
        console.log('[Atlas][Batch] thematic selection', {
          thematicId,
          objectifForThematic,
          before: {
            objectifSelect: this.elements.objectifSelect?.value,
            parameterSelect: this.elements.parameterSelect?.value
          }
        })

        if (this.elements.objectifSelect) {
          this.elements.objectifSelect.value = objectifForThematic
          this.updateParameterList(objectifForThematic)
        }

        if (this.elements.parameterSelect) {
          const options = Array.from(this.elements.parameterSelect.options).map(o => o.value)
          const hasOption = options.includes(thematicId)
          console.log('[Atlas][Batch] parameterSelect options', {
            thematicId,
            optionCount: options.length,
            hasOption
          })

          if (hasOption) {
            this.elements.parameterSelect.value = thematicId
          } else {
            console.warn('[Atlas][Batch] thematicId not present in parameterSelect options; keeping current value', {
              thematicId,
              current: this.elements.parameterSelect.value
            })
          }
          this.updateParameterDescription()
        }

        console.log('[Atlas][Batch] thematic selection applied to DOM', {
          after: {
            objectifSelect: this.elements.objectifSelect?.value,
            parameterSelect: this.elements.parameterSelect?.value
          }
        })

        // Appliquer overrides export AVANT de reconstruire la config depuis le DOM
        this.applyThematicOverrides(palette, mapType)

        // Recharger la thématique avec le niveau de grille courant (2km/28km/combined)
        // afin que l'export capture le bon rendu.
        await this.applyThematic()
        
        // 5. Attendre que le manager soit prêt
        await this.manager.waitUntilReady(5000)
        
        // 6. Mettre à jour l'overlay ADM
        await this.manager.updateAdmOverlay(
          admFilters.adm1 || null,
          admFilters.adm2 || null,
          admFilters.adm3 || null
        )
        
        // 7. Attendre le rendu de l'overlay
        await new Promise(r => setTimeout(r, 300))
        
        // 8. Cadrer la carte avec marges serrées
        const L = (window as any).L
        const admBounds = this.manager.getAdmOverlayBounds?.()
        if (map && admBounds) {
          // Calculer bounds serrés
          const tightBounds = computeTightBoundsForAdm(admBounds)
          const fitOptions = getExportFitOptions()
          
          console.log(`[Atlas] Cadrage serré:`, {
            original: admBounds,
            tight: tightBounds,
            paddingPx: fitOptions.paddingPx
          })
          
          // Invalider la taille (comme export Pro)
          map.invalidateSize(false)
          
          // Créer bounds Leaflet
          const leafletBounds = L.latLngBounds(
            [tightBounds.south, tightBounds.west],
            [tightBounds.north, tightBounds.east]
          )
          
          // Appliquer le zoom
          map.fitBounds(leafletBounds, {
            animate: false,
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
            }, 1500)
          })
        }
        
        // 9. Attendre le rendu final des tuiles
        await new Promise(r => setTimeout(r, 400))
        
        console.log(`[Atlas] Carte prête: ${thematicId} / ${admLevel} / ${admName}`)
      },
      
      // Fournir la configuration pour ExportQuickDialog (moteur Export Pro)
      getExportProConfig: () => {
        // mapContainer ne peut pas être null ici car on est dans openExportAtlasDialog
        // qui vérifie déjà que mapContainer existe
        return {
          mapContainer: mapContainer as HTMLElement,
          getMapBounds: () => {
            const b = map.getBounds()
            return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
          },
          getActiveThematic: () => {
            const state = this.manager.getCurrentExportState?.()
            return {
              name: state?.parameterLabel || 'Carte',
              parameter: state?.parameterId || 'n_sondages',
              unit: state?.unit
            }
          },
          getActiveAdmFilters: () => ({
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
          }),
          getThematicLegendData: () => this.manager.getCurrentExportState?.() || null,
          getGridLayer: () => (window as any).gridLayer,
          getMap: () => map,
          getAdmBounds: () => {
            const polygon = this.manager.getAdmPolygonCoords?.()
            if (!polygon || polygon.length < 3) return null
            const lats = polygon.map((p: number[]) => p[1])
            const lngs = polygon.map((p: number[]) => p[0])
            return {
              north: Math.max(...lats),
              south: Math.min(...lats),
              east: Math.max(...lngs),
              west: Math.min(...lngs)
            }
          },
          getAdmPolygon: () => {
            return this.manager.getAdmPolygonCoords?.() || null
          },
          getThematicFeatures: () => {
            const state = this.manager.getCurrentExportState?.()
            return state?.features || null
          }
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
