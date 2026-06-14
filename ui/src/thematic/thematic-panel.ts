import { ThematicMapManager } from './thematic-maps'
import { createExportQuickDialog, type ExportQuickDialogConfig } from '../export'
import { createExportAtlasDialog } from '../export/export-atlas-dialog'
import { apiUrl } from '../api'
import { 
  OBJECTIFS_METIER, 
  type ThematicMapConfig,
  type ObjectifMetier,
  type ThematicSource,
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
  getParametersForObjectifAndSource,
  getParameterById,
  getObjectifById,
  getDefaultConfig,
  buildKedApiParameterId,
  parseKedApiParameterId,
  KED_SELECT_PREFIX,
  type KedHorizon,
} from './thematic-types'
import { setActiveThematicParameterId } from './thematic-parameter-context'
import { tokenStorage } from '../services/auth-api'
import { icons } from '../icons/lucide-inline'
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
interface ModelStatus {
  id: string
  status: string
  n_mailles: number
  n_params: number
  metrics: Record<string, any>
  warnings: string[]
}

export class ThematicPanel {
  private manager: ThematicMapManager
  private panelElement: HTMLElement
  private isOpen: boolean = false
  private currentConfig: ThematicMapConfig
  private exportDialog: ReturnType<typeof createExportQuickDialog> | null = null
  private modelStatusCache: ModelStatus[] = []

  private async waitForNextPaint(): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
  
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

    // Mode expert (roadmap)
    toggleExpertModeCheckbox?: HTMLInputElement
    expertContextLayersContainer?: HTMLElement
    expertHorizonFilterContainer?: HTMLElement
    thematicHorizonSelect?: HTMLSelectElement
    toggleReliabilityOverlayCheckbox?: HTMLInputElement
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

    // Mode expert (hide/show overlays + horizon selection)
    void this.applyExpertMode(false)

    // ARCH-01: charge les statuts des modèles ML depuis l'API (aucune valeur hardcodée)
    void this.syncSourceAvailability()

    // Synchroniser visuellement le niveau de grille avec le panneau droit (source de vérité: main.ts)
    const getLevel = (window as any).getCurrentGridLevel
    const currentLevel = typeof getLevel === 'function' ? getLevel() : '2km'
    if ((window as any).syncGridLevelUI) {
      ;(window as any).syncGridLevelUI(currentLevel)
    }
    
    console.log('[ThematicPanel] ✅ Initialisation terminée')
  }

  /**
   * Mode expert (roadmap)
   * - Standard: aucune UI/couche visuelle liée aux domaines géologiques
   * - Expert: affiche sélection domaine (layers) + filtre horizon (profondeur)
   */
  private async applyExpertMode(enabled: boolean): Promise<void> {
    if (this.elements.expertContextLayersContainer) {
      this.elements.expertContextLayersContainer.style.display = enabled ? '' : 'none'
    }
    if (this.elements.expertHorizonFilterContainer) {
      this.elements.expertHorizonFilterContainer.style.display = enabled ? '' : 'none'
    }

    if (!enabled) {
      // Garantir "zéro élément visuel lié aux domaines" en standard mode
      if (this.elements.toggleGeologieCheckbox) this.elements.toggleGeologieCheckbox.checked = false
      if (this.elements.togglePedologieCheckbox) this.elements.togglePedologieCheckbox.checked = false
      if (this.elements.toggleRisqueGonflementCheckbox) this.elements.toggleRisqueGonflementCheckbox.checked = false
      if (this.elements.toggleDsmCheckbox) this.elements.toggleDsmCheckbox.checked = false

      // Couper les overlays côté Leaflet (idempotent)
      await this.manager.toggleContextLayer('geologie', false)
      await this.manager.toggleContextLayer('pedologie', false)
      await this.manager.toggleContextLayer('risque-gonflement', false)
      await this.manager.toggleContextLayer('dsm', false)
    } else {
      // Mode expert activé:
      // - afficher par défaut la couche géologie (contours domaines) pour satisfaire la spec roadmap
      // - laisser les autres couches contextuelles désactivées par défaut
      if (this.elements.toggleGeologieCheckbox) this.elements.toggleGeologieCheckbox.checked = true
      if (this.elements.togglePedologieCheckbox) this.elements.togglePedologieCheckbox.checked = false
      if (this.elements.toggleRisqueGonflementCheckbox) this.elements.toggleRisqueGonflementCheckbox.checked = false
      if (this.elements.toggleDsmCheckbox) this.elements.toggleDsmCheckbox.checked = false

      if (this.elements.toggleGeologieCheckbox) {
        await this.manager.toggleContextLayer('geologie', true)
        if ((window as any).setActiveContextLayer) (window as any).setActiveContextLayer('geologie', true)
        await this.loadLegend('geologie', 'geologieLegend')
      }

      await this.manager.toggleContextLayer('pedologie', false)
      await this.manager.toggleContextLayer('risque-gonflement', false)
      await this.manager.toggleContextLayer('dsm', false)
    }
  }

  public async reloadFromUI(): Promise<void> {
    await this.applyThematic()
  }

  /**
   * ARCH-01 : Charge les statuts des modèles ML depuis l'API.
   * Active/désactive les options du dropdown selon model.status.
   * Met à jour le badge live avec données API (aucune valeur hardcodée).
   */
  private async syncSourceAvailability(): Promise<void> {
    try {
      const base = (window as any).__API_GEO__ || 'http://localhost:8000'
      const resp = await fetch(`${base}/ai/models/status`)
      if (!resp.ok) return

      const data = (await resp.json()) as { models: ModelStatus[] }
      this.modelStatusCache = data.models

      for (const model of data.models) {
        const opt = this.panelElement.querySelector<HTMLOptionElement>(
          `option[data-model-id="${model.id}"]`
        )
        if (!opt) continue
        // Désactiver uniquement si erreur hard — pas_calculé = accessible mais sans données
        const isError = model.status === 'error' || model.status === 'disabled'
        opt.disabled = isError
        if (model.status === 'not_computed' || model.status === 'not_started') {
          opt.title = `Modèle non encore calculé — données non disponibles`
          // Indicateur visuel léger (pas désactivé)
          if (!opt.text.includes('⚠')) opt.text = opt.text + ' ⚠'
        } else if (isError) {
          opt.title = `Erreur modèle (${model.status}) — sélection désactivée`
        } else if (model.status === 'ready') {
          opt.title = `${model.n_mailles.toLocaleString('fr-FR')} mailles`
        }
      }

      // Initialise le badge avec la source courante
      const currentSource = (document.getElementById('thematicAiSource') as HTMLSelectElement | null)?.value as ThematicSource | undefined
      if (currentSource) this.updateModelBadge(currentSource)
    } catch {
      // Silencieux — l'UI reste fonctionnelle sans les badges
    }
  }

  /**
   * ARCH-01 : Met à jour le badge sous le dropdown source.
   * Toutes les valeurs viennent du cache API (modelStatusCache), aucune valeur hardcodée.
   */
  private updateModelBadge(source: ThematicSource): void {
    const badge = document.getElementById('sourceModelBadge')
    const label = document.getElementById('sourceRmseLabel')
    if (!badge || !label) return

    if (source === 'base') {
      badge.style.display = 'none'
      return
    }

    badge.style.display = 'block'

    const modelIdMap: Partial<Record<ThematicSource, string>> = {
      l1_ked: 'L1_KED_H', l2a_rk: 'L2a_RK', l2b_blup: 'L2b_BLUP',
      l3_vfs: 'L3_VFS', l4_mtgp: 'L4_MTGP',
      interpolation: 'L1_KED_H', ia: 'L4_MTGP',
    }

    const modelId = modelIdMap[source]
    if (!modelId) { label.textContent = '—'; return }

    const model = this.modelStatusCache.find((m) => m.id === modelId)
    if (!model) { label.textContent = 'Statut inconnu'; return }

    const coverage = model.n_mailles.toLocaleString('fr-FR')
    const rmseVbs = (model.metrics?.['vbs_ked_h1'] as any)?.loo_rmse
      ?? (model.metrics?.['vbs_h1'] as any)?.loo_rmse
    label.textContent = rmseVbs != null
      ? `${coverage} mailles · LOO-RMSE VBS·H1: ${Number(rmseVbs).toFixed(2)}`
      : `${coverage} mailles · métriques non disponibles`
  }
  
  /**
   * Avertissements contextuels (badge sous la source).
   * Actuellement : RK-SCORPAN H2 métriques dégradées sur VBS et EG.
   */
  private showSourceWarning(source: ThematicSource): void {
    const warningEl = document.getElementById('sourceWarningBanner')
    if (!warningEl) return
    const DEGRADED_RK_H2 = ['vbs', 'eg']
    const param = this.elements.parameterSelect?.value ?? ''
    const horizon = this.elements.thematicHorizonSelect?.value ?? 'H2'
    if (
      source === 'l2a_rk' &&
      horizon === 'H2' &&
      DEGRADED_RK_H2.some(b => param.startsWith(`${b}_rk`))
    ) {
      warningEl.textContent = '⚠ RK-SCORPAN H2 : métriques dégradées pour VBS et EG sur cet horizon.'
      warningEl.style.display = 'block'
    } else {
      warningEl.style.display = 'none'
    }
  }

  /**
   * Render the complete panel HTML
   */
  private renderPanel(): void {
    this.panelElement.innerHTML = `
      <div class="thematic-panel-header">
        <h3 class="thematic-panel-title">${icons.layers()} Cartes thématiques</h3>
        <button id="closeThematicPanel" class="btn-close" title="Fermer" aria-label="Fermer">×</button>
      </div>
      
      <div class="thematic-panel-body">
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label thematic-toggle-label">
            <input type="checkbox" class="atlas-switch" id="toggleExpertMode">
            <span>Mode expert</span>
          </label>
        </div>

        <details class="atlas-accordion" id="accordionCarte" open>
          <summary class="accordion-header">Carte thématique</summary>
          <div class="accordion-body">

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- BLOC A : Source de données -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div class="thematic-section" id="thematicSourceSection">
          <div class="section-label">Source de données</div>
          <select id="thematicAiSource" class="thematic-select">
            <optgroup label="Données terrain">
              <option value="base">Base — Données terrain (sondages)</option>
            </optgroup>
            <optgroup label="Machine Learning géostatistique">
              <option value="l1_ked" data-model-id="L1_KED_H">ML L1 — KED Hiérarchique (5 niveaux)</option>
              <option value="l2a_rk" data-model-id="L2a_RK">ML L2a — RK-SCORPAN (Regression Kriging)</option>
              <option value="l2b_blup" data-model-id="L2b_BLUP">ML L2b — Fusion Bayésienne BLUP</option>
              <option value="l3_vfs" data-model-id="L3_VFS">ML L3 — VfS-PLS (Sentinel-2, VBS uniquement)</option>
              <option value="l4_mtgp" data-model-id="L4_MTGP">ML L4 — MTGP/ICM (Multi-Tâches, exp.)</option>
            </optgroup>
          </select>
          <div id="sourceModelBadge" class="source-badge" style="display:none;font-size:11px;color:#94a3b8;padding:4px 0;min-height:18px" aria-live="polite">
            <i data-lucide="activity" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>
            <span id="sourceRmseLabel">—</span>
          </div>
          <div id="sourceWarningBanner" style="display:none;margin-top:4px;padding:5px 8px;background:#422006;border:1px solid #92400e;border-radius:4px;font-size:11px;color:#fbbf24;" role="alert" aria-live="polite"></div>
        </div>

        <div class="thematic-section">
          <div class="section-label">Catégorie</div>
          <select id="thematicObjectif" class="thematic-select"></select>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Paramètre</div>
          <select id="thematicParameter" class="thematic-select"></select>
          <div id="parameterDescription" class="param-description"></div>
        </div>

        <div class="thematic-section" id="thematicHorizonRow" style="display:none;">
          <div class="section-label">Horizon</div>
          <select id="thematicHorizon" class="thematic-select" aria-label="Horizon ML">
            <option value="H1">H1 (0,5 m)</option>
            <option value="H2" selected>H2 (1,5 m)</option>
            <option value="H3">H3 (2,0 m)</option>
          </select>
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
        
          </div><!-- /accordion-body Carte -->
        </details><!-- /accordionCarte -->

        <details class="atlas-accordion" id="accordionFiltres" open>
          <summary class="accordion-header">
            Filtres
            <span id="filtersActiveBadge" class="badge-filters" style="display:none">0</span>
          </summary>
          <div class="accordion-body">

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
        
        <button id="clearAdmFilters" class="btn-small full-width btn-clear-adm" style="margin-bottom:12px;">
          ${icons.rotateCcw()}<span>Effacer filtres géographiques</span>
        </button>
        
        <div class="thematic-divider">
          <span>Filtres données</span>
        </div>
        
        <div class="thematic-section">
          <div class="section-label">Sondages minimum</div>
          <input type="number" id="minSondages" class="thematic-input" value="0" min="0" max="10">
        </div>
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label thematic-toggle-label">
            <input type="checkbox" class="atlas-switch" id="excludeNoData" checked>
            <span>Exclure mailles sans données</span>
          </label>
        </div>
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label thematic-toggle-label">
            <input type="checkbox" class="atlas-switch" id="excludeOutsideAdm">
            <span>Exclure mailles hors sélection ADM</span>
          </label>
        </div>
        
        <!-- Filtres horizon (expert-only) -->
        <div id="expertHorizonFilter" style="display:none;">
          <!-- Filtres avancés (repliables) -->
          <details class="advanced-filters">
            <summary>Filtres avancés</summary>
            <div class="advanced-content">
              <div class="thematic-section">
                <div class="section-label">Profondeur (m)</div>
                <div class="range-inputs">
                  <input type="number" id="depthMin" class="thematic-input small" placeholder="Min" min="0" step="0.5">
                  <span class="range-separator" aria-hidden="true">→</span>
                  <input type="number" id="depthMax" class="thematic-input small" placeholder="Max" min="0" step="0.5">
                </div>
              </div>
            </div>
          </details>
        </div>
        
        <div class="thematic-section checkbox-section">
          <label class="checkbox-label thematic-toggle-label">
            <input type="checkbox" class="atlas-switch" id="toggleGridLayer" checked>
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
        
        <div id="expertContextLayers" style="display:none;">
          <div class="thematic-section checkbox-section">
            <label class="checkbox-label thematic-toggle-label">
              <input type="checkbox" class="atlas-switch" id="toggleReliabilityOverlay">
              <span>Overlay fiabilité (hachure si &lt; 3 sondages / 20 km)</span>
            </label>
          </div>
        </div>

          </div><!-- /accordion-body Filtres -->
        </details><!-- /accordionFiltres -->

        <details class="atlas-accordion" id="accordionContexte">
          <summary class="accordion-header">Couches contexte (QGIS)</summary>
          <div class="accordion-body">

          <!-- Panneau QGIS-like pour couches contextuelles avec légendes dépliables -->
          <div class="context-layers-panel" style="background:#0a1018;border-radius:8px;padding:10px;margin-bottom:10px">
          
          <!-- Géologie - Accordéon -->
          <details class="context-layer-accordion" style="margin-bottom:8px;background:#0f172a;border-radius:6px;border-left:3px solid #8B4513">
            <summary style="padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">
              <label class="checkbox-label" style="margin:0;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                <input type="checkbox" id="toggleGeologie">
                <span style="font-weight:600">Géologie</span>
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
                <span style="font-weight:600">Pédologie</span>
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
                <span style="font-weight:600">Risque gonflement</span>
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
                <span style="font-weight:600">Relief (Altitude)</span>
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
                Info : utilise <strong>togo_map</strong> comme fond relief (dsm-cop30 non configuré sur tileserver)
              </div>
            </div>
          </details>
          
          <div style="font-size:10px;color:#64748b;margin-top:8px;text-align:center">
            Cliquez sur ▼ pour la légende — données dans les infobulles.
          </div>
          </div>

          </div><!-- /accordion-body Contexte -->
        </details><!-- /accordionContexte -->

        <details class="atlas-accordion" id="accordionZones" open>
          <summary class="accordion-header">Zones d'étude</summary>
          <div class="accordion-body">
        <p class="thematic-zone-hint">
          Ouvrir le panneau d'analyse par zone. Les mailles concernées sont colorées sur la grille (légende ci‑dessous).
        </p>
        <div class="zone-etude-btn-grid">
          <button type="button" id="openZoneEtudeLamaBtn" class="btn-secondary zone-etude-btn" title="Dépression de la Lama — data gap RGA">
            <span class="zone-dot zone-dot--lama" aria-hidden="true"></span>
            <span class="zone-name">Lama</span>
            <span class="zone-km2-badge">547 km²</span>
            <input type="checkbox" id="zoneVisLama" data-zone="DEPRESSION_LAMA_TG" class="zone-vis-chk" aria-label="Afficher Lama sur la carte" title="Afficher/masquer sur la carte">
          </button>
          <button type="button" id="openZoneEtudeBadoBtn" class="btn-secondary zone-etude-btn" title="Dépression du Bado — data gap">
            <span class="zone-dot zone-dot--bado" aria-hidden="true"></span>
            <span class="zone-name">Bado</span>
            <span class="zone-km2-badge">312 km²</span>
            <input type="checkbox" id="zoneVisBado" data-zone="DEPRESSION_BADO_TG" class="zone-vis-chk" aria-label="Afficher Bado sur la carte" title="Afficher/masquer sur la carte">
          </button>
          <button type="button" id="openZoneEtudeMonoBtn" class="btn-secondary zone-etude-btn" title="Plaine du Mono — data gap">
            <span class="zone-dot zone-dot--mono" aria-hidden="true"></span>
            <span class="zone-name">Mono</span>
            <span class="zone-km2-badge">1 296 km²</span>
            <input type="checkbox" id="zoneVisMono" data-zone="PLAINE_MONO_TG" class="zone-vis-chk" aria-label="Afficher Mono sur la carte" title="Afficher/masquer sur la carte">
          </button>
          <button type="button" id="openZoneEtudeOtiBtn" class="btn-secondary zone-etude-btn" title="Plaine de l'Oti — data gap">
            <span class="zone-dot zone-dot--oti" aria-hidden="true"></span>
            <span class="zone-name">Oti</span>
            <span class="zone-km2-badge">464 km²</span>
            <input type="checkbox" id="zoneVisOti" data-zone="PLAINE_OTI_TG" class="zone-vis-chk" aria-label="Afficher Oti sur la carte" title="Afficher/masquer sur la carte">
          </button>
          <button type="button" id="openZoneEtudeFosseBtn" class="btn-secondary zone-etude-btn zone-etude-btn--full" title="Fosse aux Lions — data gap">
            <span class="zone-dot zone-dot--fosse" aria-hidden="true"></span>
            <span class="zone-name">Fosse aux Lions</span>
            <span class="zone-km2-badge">7 km²</span>
            <input type="checkbox" id="zoneVisFosse" data-zone="FOSSE_LIONS_TG" class="zone-vis-chk" aria-label="Afficher Fosse aux Lions sur la carte" title="Afficher/masquer sur la carte">
          </button>
        </div>
        <div class="thematic-actions">
          <button id="refreshAiSourcesBtn" class="btn-secondary full-width" title="Recalcule infer / interpolation / fondation">
            ${icons.refreshCw()}<span>Recalculer sources IA/AG</span>
          </button>
        </div>
        <div class="thematic-actions export-grid-2">
          <button id="runTrainInferThematicBtn" class="btn-small" title="Lancer entraînement + inférence supervisée">
            ${icons.brain()}<span>Train IA</span>
          </button>
          <button id="runKrigingThematicBtn" class="btn-small" title="Lancer interpolation kriging globale">
            ${icons.flaskConical()}<span>Kriging</span>
          </button>
        </div>
          </div><!-- /accordion-body Zones -->
        </details><!-- /accordionZones -->

        <!-- ═══ BLOC D : Résumé & Actions ═══ -->
        <div id="dataSummary" class="data-summary"></div>

        <div class="thematic-actions">
          <button id="applyThematic" class="btn-primary">
            ${icons.check()}<span>Appliquer</span>
          </button>
          <button id="autoAOI" class="btn-secondary">
            ${icons.crosshair()}<span>Auto-Zoom</span>
          </button>
        </div>

        <div class="thematic-actions">
          <button id="resetThematic" class="btn-reset-subtle" type="button">
            ${icons.rotateCcw()}<span>Réinitialiser</span>
          </button>
        </div>

        <details class="atlas-accordion" id="accordionExports">
          <summary class="accordion-header">Exports</summary>
          <div class="accordion-body">
        
        <div class="thematic-actions">
          <button id="exportThematicPro" class="btn-primary full-width" title="Export cartographique professionnel avec grille, titre, légende">
            ${icons.upload()}<span>Export Pro (PNG/PDF)</span>
          </button>
        </div>
        
        <div class="thematic-actions">
          <button id="exportThematicAtlas" class="btn-secondary full-width" title="Exporter toutes les cartes thématiques pour tous les ADM">
            ${icons.bookOpen()}<span>Export Atlas complet</span>
          </button>
        </div>
        
        <div class="thematic-actions export-grid-2">
          <button id="exportThematicPNG" class="btn-small" title="Capture rapide de la carte">
            ${icons.image()}<span>PNG rapide</span>
          </button>
          <button id="exportThematicQGIS" class="btn-small" title="GeoJSON + style QML pour QGIS">
            ${icons.layers()}<span>QGIS</span>
          </button>
        </div>

        <div class="thematic-actions export-grid-2">
          <button id="exportThematicGeoJSON" class="btn-small">
            ${icons.fileJson()}<span>GeoJSON brut</span>
          </button>
          <button id="saveThematicConfig" class="btn-small">
            ${icons.save()}<span>Sauvegarder config</span>
          </button>
        </div>
          </div><!-- /accordion-body Exports -->
        </details><!-- /accordionExports -->
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
      toggleDsmCheckbox: document.getElementById('toggleDsm') as HTMLInputElement,

      toggleExpertModeCheckbox: document.getElementById('toggleExpertMode') as HTMLInputElement,
      expertContextLayersContainer: document.getElementById('expertContextLayers') as HTMLElement,
      expertHorizonFilterContainer: document.getElementById('expertHorizonFilter') as HTMLElement,
      thematicHorizonSelect: document.getElementById('thematicHorizon') as HTMLSelectElement,
      toggleReliabilityOverlayCheckbox: document.getElementById('toggleReliabilityOverlay') as HTMLInputElement,
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
    // Uniquement les 4 familles scientifiques (roadmap Phase 3)
    // IA/Interpolation et Personnalisé sont retirés : les modèles ML sont
    // accessibles via le sélecteur "Source de données" (L1-L4).
    const VISIBLE_IDS: ObjectifMetier[] = ['couverture', 'argilosite', 'portance', 'insitu']
    select.innerHTML = OBJECTIFS_METIER
      .filter(obj => VISIBLE_IDS.includes(obj.id))
      .map(obj => `<option value="${obj.id}">${obj.label}</option>`)
      .join('')
  }
  
  /**
   * Update parameter list based on selected objectif
   */
  private updateParameterList(objectifId: ObjectifMetier): void {
    const select = this.elements.parameterSelect
    const descEl = this.elements.parameterDescription
    if (!select) return
    
    const sourceSelect = document.getElementById('thematicAiSource') as HTMLSelectElement | null
    const source = (sourceSelect?.value || 'base') as ThematicSource
    const params = getParametersForObjectifAndSource(objectifId, source)
    const objectif = getObjectifById(objectifId)
    
    if (params.length === 0) {
      const isMLSource = source !== 'base' && source !== 'interpolation' && source !== 'ia'
      const hint = isMLSource && (objectifId === 'portance' || objectifId === 'insitu')
        ? `Les modèles ML ne modélisent pas la catégorie "${objectifId === 'portance' ? 'Portance & compactage' : 'In-situ & pressiométrique'}" — utiliser la source Base.`
        : source === 'l3_vfs'
          ? 'ML L3 VfS-PLS : seul le paramètre VBS surface est disponible (catégorie Argilosité).'
          : source === 'interpolation'
            ? 'Aucune couche kriging pour cette catégorie (seuls IP et VBS sont interpolés côté API).'
            : source === 'ia'
              ? 'Aucune sortie IA disponible pour cette catégorie.'
              : 'Aucun paramètre disponible pour cette combinaison source/catégorie.'
      select.innerHTML = `<option value="" data-description="${hint.replace(/"/g, '&quot;')}">— ${hint} —</option>`
      select.value = ''
      this.updateParameterDescription()
      return
    }

    select.innerHTML = params.map(p => {
      const unitSuffix = p.unit ? ` (${p.unit})` : ''
      return `<option value="${p.id}" 
        data-description="${p.description}"
        data-formula="${p.formula || ''}"
        data-palette="${p.defaultPalette || 'Blues'}"
        data-breaks="${p.defaultBreaks ? JSON.stringify(p.defaultBreaks) : ''}"
      >${p.label}${unitSuffix}</option>`
    }).join('')
    
    const preferred =
      objectif?.defaultParameter && params.some((p) => p.id === objectif.defaultParameter)
        ? objectif.defaultParameter
        : params[0]!.id
    select.value = preferred
    
    // Update description
    this.updateParameterDescription()
    
    // Update palette to objectif default
    if (objectif?.defaultPalette && this.elements.paletteSelect) {
      this.elements.paletteSelect.value = objectif.defaultPalette
    }

    this.updateHorizonRowVisibility()
  }

  /**
   * Horizon H1/H2/H3 visible si source ML (sauf l3_vfs = pas d'horizon, base = pas d'horizon).
   */
  private shouldShowHorizonForSource(source: ThematicSource, param: string): boolean {
    if (source === 'base' || source === 'l3_vfs') return false
    if (param === 'kriging_vbs' || param === 'kriging_ip' || param === 'data_density') return false
    if (param === 'vbs_vfs') return false
    // Pour l1_ked en mode KED_SELECT_PREFIX (ked:vbs), horizon géré par sélecteur
    if (source === 'l1_ked' || source === 'interpolation') {
      if (param.startsWith(KED_SELECT_PREFIX)) return true
      if (parseKedApiParameterId(param)) return true
    }
    // Pour L2a/L2b/L4 : horizon implicite dans l'ID param (vbs_blup_h1 etc.)
    // On affiche quand même le sélecteur horizon pour permettre de switcher H1/H2/H3
    if (source === 'l2a_rk' || source === 'l2b_blup' || source === 'l4_mtgp') {
      return param.match(/_h[123]$/) != null
    }
    return false
  }

  private updateHorizonRowVisibility(): void {
    const row = document.getElementById('thematicHorizonRow')
    const source = ((document.getElementById('thematicAiSource') as HTMLSelectElement | null)?.value || 'base') as ThematicSource
    const param = this.elements.parameterSelect?.value || ''
    const show = this.shouldShowHorizonForSource(source, param)
    if (row) row.style.display = show ? '' : 'none'
    if (show && this.elements.thematicHorizonSelect && source === 'l1_ked') {
      const parsedFlat = parseKedApiParameterId(param)
      if (parsedFlat && !param.startsWith(KED_SELECT_PREFIX)) {
        this.elements.thematicHorizonSelect.value = parsedFlat.horizon
      }
    }
  }

  private assignParameterUiFromApiId(apiParameterId: string): void {
    const select = this.elements.parameterSelect
    if (!select) return

    const parsed = parseKedApiParameterId(apiParameterId)
    if (parsed) {
      const kedVal = `${KED_SELECT_PREFIX}${parsed.baseId}`
      if (Array.from(select.options).some((o) => o.value === kedVal)) {
        select.value = kedVal
        if (this.elements.thematicHorizonSelect) {
          this.elements.thematicHorizonSelect.value = parsed.horizon
        }
      } else {
        const opt = Array.from(select.options).find((o) => o.value === apiParameterId)
        if (opt) select.value = apiParameterId
      }
    } else if (apiParameterId === 'kriging_vbs') {
      const kedVal = `${KED_SELECT_PREFIX}vbs`
      if (Array.from(select.options).some((o) => o.value === kedVal)) {
        select.value = kedVal
        if (this.elements.thematicHorizonSelect) this.elements.thematicHorizonSelect.value = 'H2'
      } else if (Array.from(select.options).some((o) => o.value === 'kriging_vbs')) {
        select.value = 'kriging_vbs'
      }
    } else if (apiParameterId === 'kriging_ip') {
      const kedVal = `${KED_SELECT_PREFIX}ip`
      if (Array.from(select.options).some((o) => o.value === kedVal)) {
        select.value = kedVal
        if (this.elements.thematicHorizonSelect) this.elements.thematicHorizonSelect.value = 'H2'
      } else if (Array.from(select.options).some((o) => o.value === 'kriging_ip')) {
        select.value = 'kriging_ip'
      }
    } else if (Array.from(select.options).some((o) => o.value === apiParameterId)) {
      select.value = apiParameterId
    }

    this.updateParameterDescription()
    this.updateHorizonRowVisibility()
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
            ${p.colorblindSafe ? '<span class="palette-badge" title="Palette adaptée daltonisme">CB</span>' : ''}
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
      
      .palette-badge {
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #94a3b8;
        border: 1px solid #475569;
        border-radius: 4px;
        padding: 1px 5px;
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
    
    // Ouvrir panneau (bouton carte retiré par défaut + entrée barre latérale)
    ;['openThematicPanel', 'openThematicPanelSidebar'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.open())
    })
    
    // Objectif change -> update parameters
    this.elements.objectifSelect?.addEventListener('change', (e) => {
      const objectifId = (e.target as HTMLSelectElement).value as ObjectifMetier
      this.updateParameterList(objectifId)
      this.currentConfig.objectif = objectifId
      const source = ((document.getElementById('thematicAiSource') as HTMLSelectElement | null)?.value || 'base') as ThematicSource
      if (this.elements.minSondagesInput && source !== 'base') this.elements.minSondagesInput.value = '0'
    })

    const sourceSelect = document.getElementById('thematicAiSource') as HTMLSelectElement | null
    sourceSelect?.addEventListener('change', () => {
      const source = (sourceSelect.value || 'base') as ThematicSource
      const objectifId = (this.elements.objectifSelect?.value || 'couverture') as ObjectifMetier

      // Auto-reset : rebuild parameter list pour la nouvelle source.
      // Si le paramètre courant n'est plus valide, updateParameterList sélectionne
      // automatiquement le premier paramètre disponible (voir updateParameterList).
      this.updateParameterList(objectifId)

      if (this.elements.minSondagesInput) {
        this.elements.minSondagesInput.value = source === 'base' ? (this.elements.minSondagesInput.value || '1') : '0'
      }
      this.updateHorizonRowVisibility()
      this.updateModelBadge(source)

      // Avertissement RK SCORPAN sur H2 pour paramètres dégradés
      this.showSourceWarning(source)
    })
    
    // Parameter change -> update description & palette & warning
    this.elements.parameterSelect?.addEventListener('change', () => {
      this.updateParameterDescription()
      this.updatePaletteFromParameter()
      this.updateHorizonRowVisibility()
      const src = (sourceSelect?.value || 'base') as ThematicSource
      this.showSourceWarning(src)
    })

    this.elements.thematicHorizonSelect?.addEventListener('change', () => {
      this.updateHorizonRowVisibility()
      const src = (sourceSelect?.value || 'base') as ThematicSource
      this.showSourceWarning(src)
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

    // Mode expert (roadmap)
    this.elements.toggleExpertModeCheckbox?.addEventListener('change', async (e) => {
      const enabled = (e.target as HTMLInputElement).checked
      await this.applyExpertMode(enabled)
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

    // Zone d'étude (data gap) - Dépression de la Lama
    const bindZoneBtn = (id: string, zoneCode: string) => {
      const el = document.getElementById(id)
      if (el) {
        el.addEventListener('click', () => {
          const openFn = (window as any).openZoneEtudePanel as undefined | ((zoneCode: string) => void)
          if (!openFn) {
            console.warn('[ThematicPanel] openZoneEtudePanel not defined')
            return
          }
          openFn(zoneCode)
        })
      }
    }
    bindZoneBtn('openZoneEtudeLamaBtn', 'DEPRESSION_LAMA_TG')
    bindZoneBtn('openZoneEtudeBadoBtn', 'DEPRESSION_BADO_TG')
    bindZoneBtn('openZoneEtudeMonoBtn', 'PLAINE_MONO_TG')
    bindZoneBtn('openZoneEtudeOtiBtn', 'PLAINE_OTI_TG')
    bindZoneBtn('openZoneEtudeFosseBtn', 'FOSSE_LIONS_TG')

    // Checkboxes visibilité zone (localStorage + setZoneVisibility)
    const initZoneVisCheckboxes = () => {
      document.querySelectorAll<HTMLInputElement>('.zone-vis-chk').forEach((chk) => {
        const zone = chk.dataset.zone || ''
        if (!zone) return
        const stored = localStorage.getItem(`zone_visible_${zone}`)
        chk.checked = stored === 'true'
        // Empêche le clic checkbox de déclencher le bouton parent
        chk.addEventListener('click', (e) => e.stopPropagation())
        chk.addEventListener('change', (e) => {
          e.stopPropagation()
          const visible = chk.checked
          localStorage.setItem(`zone_visible_${zone}`, String(visible))
          const setVis = (window as any).__setZoneVisibility as ((code: string, v: boolean) => void) | undefined
          if (setVis) setVis(zone, visible)
          const refresh = (window as any).__refreshGridStyle as (() => void) | undefined
          if (refresh) refresh()
        })
      })
    }
    initZoneVisCheckboxes()

    const refreshAiBtn = document.getElementById('refreshAiSourcesBtn')
    if (refreshAiBtn) {
      refreshAiBtn.addEventListener('click', async () => {
        try {
          const token = tokenStorage.getAccessToken()
          if (!token) throw new Error('Session expirée: reconnectez-vous')
          const base = (window as any).__API_GEO__ || 'http://localhost:8000'
          const res = await fetch(`${base}/ai/recompute/sources`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            const txt = await res.text().catch(() => '')
            throw new Error(`${res.status} ${txt}`)
          }
          const payload = await res.json()
          this.toast(`IA OK: infer ${payload.infer_count}, kriging ${payload.interpolation_count}, AG ${payload.foundation_count}`, 'success')
        } catch (e: any) {
          this.toast(`Recalcul IA/AG impossible: ${e?.message || e}`, 'error')
        }
      })
    }

    const runKrigingBtn = document.getElementById('runKrigingThematicBtn')
    if (runKrigingBtn) {
      runKrigingBtn.addEventListener('click', async () => {
        try {
          const token = tokenStorage.getAccessToken()
          if (!token) throw new Error('Session expirée: reconnectez-vous')
          const base = (window as any).__API_GEO__ || 'http://localhost:8000'
          const res = await fetch(`${base}/ai/kriging/recompute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            const txt = await res.text().catch(() => '')
            throw new Error(`${res.status} ${txt}`)
          }
          const payload = await res.json()
          this.toast(`Kriging OK: ${payload?.n_predictions ?? 'n/a'} mailles`, 'success')
        } catch (e: any) {
          this.toast(`Kriging impossible: ${e?.message || e}`, 'error')
        }
      })
    }

    const runTrainBtn = document.getElementById('runTrainInferThematicBtn')
    if (runTrainBtn) {
      runTrainBtn.addEventListener('click', async () => {
        try {
          const token = tokenStorage.getAccessToken()
          if (!token) throw new Error('Session expirée: reconnectez-vous')
          const base = (window as any).__API_GEO__ || 'http://localhost:8000'
          const res = await fetch(`${base}/ai/infer/train-supervised`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            const txt = await res.text().catch(() => '')
            throw new Error(`${res.status} ${txt}`)
          }
          const payload = await res.json()
          this.toast(`Train IA OK: ${payload?.n_predictions ?? 'n/a'} mailles`, 'success')
        } catch (e: any) {
          this.toast(`Train IA impossible: ${e?.message || e}`, 'error')
        }
      })
    }
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

    const count = [adm1, adm2, adm3].filter(Boolean).length
    const badge = document.getElementById('filtersActiveBadge')
    if (badge) {
      badge.textContent = String(count)
      badge.style.display = count > 0 ? 'inline' : 'none'
    }

    if (!adm1 && !adm2 && !adm3) {
      summary.style.display = 'none'
      return
    }

    const parts: string[] = []
    if (adm1) parts.push(`Région: <strong>${adm1}</strong>`)
    if (adm2) parts.push(`Préfecture: <strong>${adm2}</strong>`)
    if (adm3) parts.push(`Commune: <strong>${adm3}</strong>`)

    summary.innerHTML = `<div class="filter-badge">${parts.join(' → ')}</div>`
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
    setActiveThematicParameterId(config.parameter)
    // Objectif
    if (this.elements.objectifSelect) {
      this.elements.objectifSelect.value = config.objectif
      this.updateParameterList(config.objectif)
    }
    
    this.assignParameterUiFromApiId(config.parameter)

    if (this.elements.toggleReliabilityOverlayCheckbox && config.expertReliabilityOverlay !== undefined) {
      this.elements.toggleReliabilityOverlayCheckbox.checked = !!config.expertReliabilityOverlay
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
    const source = ((document.getElementById('thematicAiSource') as HTMLSelectElement | null)?.value ||
      'base') as ThematicSource
    let parameter = this.elements.parameterSelect?.value || 'n_sondages'
    const hz = (this.elements.thematicHorizonSelect?.value || 'H2') as KedHorizon
    // L1 KED (et alias legacy 'interpolation') : construit depuis KED_SELECT_PREFIX
    if (source === 'l1_ked' || source === 'interpolation') {
      if (parameter.startsWith(KED_SELECT_PREFIX)) {
        const baseId = parameter.slice(KED_SELECT_PREFIX.length)
        parameter = buildKedApiParameterId(baseId, hz)
      } else {
        const parsed = parseKedApiParameterId(parameter)
        if (parsed) parameter = buildKedApiParameterId(parsed.baseId, hz)
      }
    }
    // L2a RK, L2b BLUP, L4 MTGP : remplace le suffixe _h2 (défaut) par l'horizon choisi
    if (['l2a_rk', 'l2b_blup', 'l4_mtgp'].includes(source)) {
      parameter = parameter.replace(/_h[123]$/, `_${hz.toLowerCase()}`)
    }
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
    let minSondages = parseInt(this.elements.minSondagesInput?.value || '0')
    if (source !== 'base') minSondages = 0
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

    const expertReliabilityOverlay =
      !!(this.elements.toggleExpertModeCheckbox?.checked && this.elements.toggleReliabilityOverlayCheckbox?.checked)
    
    return {
      name: 'Carte temporaire',
      objectif,
      parameter,
      expertReliabilityOverlay,
      type,
      classification: {
        method,
        n_classes: nClasses,
        manual_breaks: manualBreaks
      },
      style: {
        palette,
        opacity,
        stroke_width: 0,
        stroke_color: '#00000000'
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
      const paramVal = this.elements.parameterSelect?.value?.trim() ?? ''
      if (!paramVal) {
        this.toast(
          'Aucun paramètre disponible pour cette source et cette catégorie — change de catégorie ou reviens à « Base ».',
          'error',
        )
        return
      }

      const config = this.buildConfigFromUI()
      this.currentConfig = config

      const applyId = `apply_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const tClick = performance.now()
      
      console.log(`[ThematicUI][Apply] ✅ Palette finale="${config.style.palette}"`)
      console.log('[ThematicPanel] Applying config:', config)
      console.log('[ThematicPerf] Apply click', {
        applyId,
        parameter: config.parameter,
        type: config.type,
        grid: config.filters.grid,
        adm1: config.filters.adm1 ?? null,
        adm2: config.filters.adm2 ?? null,
        adm3: config.filters.adm3 ?? null,
        excludeOutsideAdm: config.filters.exclude_outside_adm ?? false,
      })
      
      // Show loading
      this.setLoading(true)
      
      await this.manager.loadThematicMap(config)
      const tLoaded = performance.now()

      await this.waitForNextPaint()
      const tPaint = performance.now()

      console.log('[ThematicPerf] Apply timings (ms)', {
        applyId,
        loadThematicMap_ms: Math.round(tLoaded - tClick),
        click_to_paint_ms: Math.round(tPaint - tClick),
      })
      
      // Update summary
      this.updateSummary()
      
      this.toast('Carte thématique chargée', 'success')

      setActiveThematicParameterId(config.parameter)
      
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
        ? `${icons.refreshCw()}<span>Chargement…</span>`
        : `${icons.check()}<span>Appliquer</span>`
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
