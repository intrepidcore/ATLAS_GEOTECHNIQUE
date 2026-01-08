console.log(
  "[DEBUG ATLAS UI] Build actif à",
  new Date().toISOString()
);

// ============================================================================
// GUARD D'AUTHENTIFICATION - Forcer le login à l'entrée
// ============================================================================
import { tokenStorage } from './services/auth-api'

// Vérifier si l'utilisateur est authentifié
const isAuthenticated = tokenStorage.isAuthenticated()
console.log('[Auth] boot isAuthenticated=' + isAuthenticated)

if (!isAuthenticated) {
  // Rediriger vers la page de login (db-manager.html qui contient LoginPage)
  console.log('[Auth] Non authentifié - redirection vers login')
  window.location.href = '/db-manager.html'
  // Arrêter l'exécution du reste du script
  throw new Error('Redirection vers login')
}

// ============================================================================

import L from 'leaflet'
import { Chart, registerables } from 'chart.js'
import proj4 from 'proj4'
import { GeotechnicalFormManager } from './geotechnical-form'
import { GeocodeManager } from './geocode-manager'
import { SuggestionsPanel } from './suggestions-panel'
import { ThematicMapManager } from './thematic/thematic-maps'
import { ThematicPanel } from './thematic/thematic-panel'
// import { ImportBulkWizard } from './import-bulk-wizard' // V2 - désactivé
import { bootImportWizardV3 } from './import-bulk-wizard_v3'
import { ImportWizardV2 } from './import-wizard-v2'
import { APP_VERSION } from './version'
import { initAccordions, initDirectButtons, initKeyboardShortcuts, initFilterListeners, initCloseMailleActions, showMailleActions } from './right-panel'
import { renderPhysiques, renderClassif, renderSurveys, type CellCompleteOut } from './cell-complete-types'
import { buildCellSummary } from './cell-summary'
import { computeCellMetrics, buildSynthese, fmtNumber, type CellMetrics } from './cell-metrics'
import { CONFIG } from './config'
import { SondagesModal } from './modal/sondages-modal'
import { openDbManager } from './db-manager'
import type { Survey } from './types/survey'
import { httpJSON } from './utils/http'
import { initRealtime, onWsEvent } from './realtime'
import { router } from './router'
import { SondagesManagerPage } from './pages/sondages-manager-page'
import { getGridFeatureStyle, COLORS, WEIGHT, OPACITY, CELL_SELECTED_STYLE, GRID_HOVER_STYLE } from './map-style'
import { initUserMenu } from './user-menu'
import { 
  currentFilters, 
  filteredStats,
  syncFiltersFromDOM, 
  featureMatchesFilters, 
  computeFilteredStats, 
  updateStatsDOM,
  notifyFilterChange,
  resetFilters as resetFiltersState
} from './filters-state'
import { loadAndDisplayGlobalStats, invalidateGlobalStatsCache } from './global-stats'
import { initTileLayer, initOfflineTiles, createTileControl, createBasemapLayerControl } from './tile-manager'
import { makeResizable } from './components/resizable-panel'
import './geotechnical-form.css'
import './thematic-maps.css'
import './import-bulk-wizard.css'
import './import-wizard-v2.css'
import './styles/tabs.css'
import './styles/import-wizard.css'

// Définir les systèmes de coordonnées
// EPSG:25231 - UTM Zone 31N (Togo)
proj4.defs('EPSG:25231', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs')
// EPSG:4326 - WGS84 (lat/lon)
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')

// Enregistrer tous les composants Chart.js
Chart.register(...registerables)

// Feature flags
declare global {
  interface Window {
    ATLAS_FLAGS?: {
      showClassificationTab?: boolean
      showSparklines?: boolean
      enableAuditLog?: boolean
    }
  }
}

;(window as any).ATLAS_FLAGS = {
  showClassificationTab: true,
  showSparklines: true,
  enableAuditLog: false
}

// Base URLs with runtime override support
import { getApiBase } from './api-base'

const API_GEO = getApiBase()
console.log('[INIT] API_GEO configuré:', API_GEO)

// Helper pour ajouter des event listeners de manière sûre
function safeAddEventListener(id: string, event: string, handler: EventListener) {
  const el = document.getElementById(id)
  if (el) {
    el.addEventListener(event, handler)
  } else {
    console.warn(`[INIT] Élément #${id} introuvable - event listener ${event} ignoré`)
  }
}

const map = L.map('map', { preferCanvas: true }).setView([8.6195, 0.8248], 7)

// Initialiser les tuiles avec gestion online/offline automatique
// 1) D'abord configurer le tileserver (async), puis initialiser les layers
initOfflineTiles().then(() => {
  initTileLayer(map)
  createTileControl(map).addTo(map)
  
  // Ajouter le contrôle de sélection des fonds de carte (OSM, ESRI, Mapbox, Azure)
  createBasemapLayerControl(map).addTo(map)
  
  console.log('[INIT] Tile layers + basemap control initialized')
})

const codeInput = document.getElementById('codeInput') as HTMLInputElement
let gridLayer: L.GeoJSON<any> | null = null
let shapeLayer: L.GeoJSON<any> | null = null
let boundaryLayer: L.GeoJSON<any> | null = null  // Contour ADM0 (Togo)
let sondagesLayer: L.LayerGroup | null = null
let duplicateMarkers: L.CircleMarker[] = []
let currentDuplicates: any[] = []

// Charger et afficher le contour du Togo (ADM0)
async function loadBoundaryLayer() {
  try {
    // Charger depuis l'API
    const response = await fetch(`${API_GEO}/adm0/geojson`)
    if (!response.ok) throw new Error('Contour non trouvé')
    const geojson = await response.json()
    
    boundaryLayer = L.geoJSON(geojson, {
      style: {
        color: '#374151',
        weight: 2.5,
        fillColor: 'transparent',
        fillOpacity: 0,
        dashArray: '8, 4'
      },
      interactive: false  // Ne pas interférer avec les clics
    }).addTo(map)
    
    // Mettre en arrière-plan
    boundaryLayer.bringToBack()
    console.log('[INIT] ✅ Contour Togo (ADM0) chargé depuis API')
  } catch (error) {
    console.warn('[INIT] Impossible de charger le contour Togo:', error)
  }
}

// Charger le contour au démarrage
loadBoundaryLayer()

// Listener pour clignotement ADM (depuis modal géocodage/suggestions)
window.addEventListener('atlas:flash-adm', async (e: any) => {
  const { adm3, times = 5, color = '#FFD60A' } = e.detail
  console.log('[Flash ADM] Clignotement demandé pour:', adm3, 'times:', times)
  
  if (!gridLayer) {
    console.warn('[Flash ADM] gridLayer pas encore chargé')
    return
  }

  // Cherche la maille ADM3 dans gridLayer
  let targetLayer: any = null
  gridLayer.eachLayer((layer: any) => {
    const props = layer.feature?.properties
    if (props?.adm3 === adm3 || props?.code === adm3) {
      targetLayer = layer
    }
  })

  if (!targetLayer) {
    console.warn('[Flash ADM] Maille introuvable:', adm3)
    return
  }

  // Zoom sur la maille
  const bounds = targetLayer.getBounds()
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })

  // Sauvegarde du style original
  const original = {
    color: targetLayer.options.color,
    weight: targetLayer.options.weight,
    fillOpacity: targetLayer.options.fillOpacity
  }

  // Clignotement
  let i = 0
  const pulse = setInterval(() => {
    const on = i % 2 === 0
    targetLayer.setStyle({
      color: on ? color : original.color,
      weight: on ? 5 : original.weight,
      fillOpacity: on ? 0.15 : original.fillOpacity
    })
    if (++i >= times * 2) {
      clearInterval(pulse)
      targetLayer.setStyle(original)
    }
  }, 500)
})

// Exposer gridLayer globalement pour le gestionnaire de cartes thématiques
declare global {
  interface Window {
    gridLayer?: L.GeoJSON<any> | null
  }
}
;(window as any).gridLayer = gridLayer

// --- UI helpers ---
function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = `toast ${kind}`
  el.style.display = 'block'
  setTimeout(() => el.style.display = 'none', 5000)
}

function setStatus(text: string) {
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

function setKpis(total: number, withData: number) {
  const k = document.getElementById('kpis')
  if (!k) return
  k.innerHTML = `
    <div class="kpi"><span>Mailles</span><b>${total.toLocaleString()}</b></div>
    <div class="kpi"><span>Avec données</span><b>${withData.toLocaleString()}</b></div>
    <div class="kpi"><span>Sans données</span><b>${(total - withData).toLocaleString()}</b></div>
  `
  const b = document.getElementById('gridBadge')
  if (b) b.innerHTML = `<span class="dot" style="background:${withData > 0 ? 'var(--ok)' : 'var(--warn)'}"></span> Grille`
}

// --- Leaflet styles (centralisés dans map-style.ts) ---
function styleFeature(f: any) {
  return getGridFeatureStyle(f, map?.getZoom())
}

// Variables globales pour la sélection et le survol (Chantier A - pattern robuste)
let selectedCell: L.Path | null = null
let hoveredCell: L.Path | null = null
let selectedMailleCode: string | null = null
let selectedMailleProps: any = null  // Propriétés de la maille sélectionnée

/**
 * Retourne le style par défaut pour une feature (selon ses données)
 */
function getDefaultStyle(feature: any): L.PathOptions {
  return getGridFeatureStyle(feature, map?.getZoom())
}

/**
 * Gère le survol d'une maille - modifie le style directement (pas de couche séparée)
 * Pattern robuste : pas de clignotement, pas de couche supplémentaire
 */
function handleMouseOver(layer: L.Path, feature: any) {
  // Si on survole la maille déjà sélectionnée, ne rien faire
  if (layer === selectedCell) return
  
  // Réinitialiser l'ancienne maille survolée (si différente de la sélectionnée)
  if (hoveredCell && hoveredCell !== selectedCell && hoveredCell !== layer) {
    hoveredCell.setStyle(getDefaultStyle((hoveredCell as any).feature))
  }
  
  // Appliquer le style de survol
  hoveredCell = layer
  layer.setStyle(GRID_HOVER_STYLE)
  layer.bringToFront()
  
  // Remettre la sélection au premier plan si elle existe
  if (selectedCell) {
    selectedCell.bringToFront()
  }
}

/**
 * Gère la sortie du survol
 */
function handleMouseOut(layer: L.Path, feature: any) {
  // Si c'est la maille sélectionnée, ne pas réinitialiser
  if (layer === selectedCell) return
  
  // Réinitialiser le style
  layer.setStyle(getDefaultStyle(feature))
  
  if (hoveredCell === layer) {
    hoveredCell = null
  }
}

/**
 * Gère le clic sur une maille
 */
function handleClick(layer: L.Path, feature: any, p: any) {
  console.log('[handleClick] Clic sur maille:', p.code)
  
  // Réinitialiser l'ancienne sélection
  if (selectedCell && selectedCell !== layer) {
    selectedCell.setStyle(getDefaultStyle((selectedCell as any).feature))
  }
  
  // Appliquer le style de sélection
  selectedCell = layer
  selectedMailleCode = p.code
  selectedMailleProps = p
  layer.setStyle(CELL_SELECTED_STYLE)
  layer.bringToFront()
}

// --- État des couches contextuelles actives ---
const activeContextLayers: { geologie: boolean; pedologie: boolean; risque: boolean; dsm: boolean } = {
  geologie: false,
  pedologie: false,
  risque: false,
  dsm: false
}

// Fonction globale pour mettre à jour les couches actives
;(window as any).setActiveContextLayer = (layer: string, active: boolean) => {
  if (layer === 'geologie') activeContextLayers.geologie = active
  if (layer === 'pedologie') activeContextLayers.pedologie = active
  if (layer === 'risque-gonflement' || layer === 'risque') activeContextLayers.risque = active
  if (layer === 'dsm') activeContextLayers.dsm = active
  console.log('[ContextLayers] Active layers:', activeContextLayers)
}

// --- Feature interactions ---

/**
 * Génère le contenu du tooltip enrichi selon les couches contextuelles actives
 */
function buildEnrichedTooltip(p: any): string {
  let content = `<div style="font-size:12px;line-height:1.6;min-width:180px">`
  
  // Code de la maille (toujours affiché)
  const code = p.code || p.code_m28 || p.code_28km_lisible || '—'
  content += `<div style="font-weight:700;color:#3b82f6;margin-bottom:4px;border-bottom:1px solid #334155;padding-bottom:4px">${code}</div>`
  
  // Localisation ADM (toujours affiché si disponible)
  if (p.adm1_name || p.adm2_name || p.adm3_name) {
    const loc = [p.adm1_name, p.adm2_name, p.adm3_name].filter(Boolean).join(' › ')
    content += `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${loc}</div>`
  }
  
  // Statistiques de base (toujours affichées)
  if (p.n_sondages != null) {
    const exactIcon = p.has_exact_location ? '📍' : ''
    const randomIcon = p.has_random_location ? '🎲' : ''
    content += `<div><strong>Sondages:</strong> ${p.n_sondages} ${exactIcon}${randomIcon}</div>`
  }
  if (p.n_echantillons != null && p.n_echantillons > 0) {
    content += `<div><strong>Échantillons:</strong> ${p.n_echantillons}</div>`
  }
  
  // --- Données contextuelles (selon couches cochées) ---
  let hasContextData = false
  
  // Géologie (si couche active)
  if (activeContextLayers.geologie && p.geologie_unite) {
    if (!hasContextData) {
      content += `<div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px"></div>`
      hasContextData = true
    }
    content += `<div><strong>🪨 Géologie:</strong> ${p.geologie_unite}</div>`
  }
  
  // Pédologie (si couche active)
  if (activeContextLayers.pedologie && p.pedologie_unite) {
    if (!hasContextData) {
      content += `<div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px"></div>`
      hasContextData = true
    }
    content += `<div><strong>🌱 Pédologie:</strong> ${p.pedologie_unite}</div>`
  }
  
  // Risque de gonflement (si couche active)
  if (activeContextLayers.risque && p.risque_gonflement) {
    if (!hasContextData) {
      content += `<div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px"></div>`
      hasContextData = true
    }
    const risqueColor = p.risque_gonflement === 'Faible' ? '#22c55e' : p.risque_gonflement === 'Moyen' ? '#f59e0b' : '#ef4444'
    content += `<div><strong>⚠️ Risque:</strong> <span style="color:${risqueColor};font-weight:600">${p.risque_gonflement}</span></div>`
  }
  
  // DSM / Altitude (si couche active)
  if (activeContextLayers.dsm && p.altitude_mean != null) {
    if (!hasContextData) {
      content += `<div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px"></div>`
      hasContextData = true
    }
    content += `<div><strong>🏔️ Altitude:</strong> ${p.altitude_mean.toFixed(0)} m</div>`
  }
  
  // Eg moyen (données géotechniques)
  if (p.eg_moyen != null) {
    content += `<div><strong>Eg moy:</strong> ${p.eg_moyen.toFixed(2)} MPa</div>`
  }
  
  content += `</div>`
  return content
}

function onEachFeature(f: any, layer: any) {
  const p = f.properties || {}
  
  // Tooltip enrichi avec données contextuelles de la feature survolée
  // Le contenu est généré dynamiquement lors du survol
  layer.bindTooltip(() => buildEnrichedTooltip(p), { sticky: true, opacity: 0.95 })
  
  // Chantier A - Pattern robuste : survol et clic sur la même couche
  layer.on({
    mouseover: () => handleMouseOver(layer, f),
    mouseout: () => handleMouseOut(layer, f),
    click: async () => {
      // Appeler le handler de clic centralisé
      handleClick(layer, f, p)
      
      // Zoomer
      map.fitBounds(layer.getBounds(), { maxZoom: 14 })
      
      // Auto-générer le code sondage
      await generateSurveyCode(p.code)
      
      // Auto-remplir lon/lat avec le centre de la maille
      const bounds = layer.getBounds()
      const center = bounds.getCenter()
      const lonInput = document.getElementById('surveyLon') as HTMLInputElement
      const latInput = document.getElementById('surveyLat') as HTMLInputElement
      if (lonInput && latInput) {
        lonInput.value = center.lng.toFixed(6)
        latInput.value = center.lat.toFixed(6)
      }
      
      // Si le formulaire géotechnique était en attente, le rouvrir
      if (sessionStorage.getItem('geotechFormPending') === 'true') {
        sessionStorage.removeItem('geotechFormPending')
        
        // Remplir les champs du formulaire géotechnique
        setTimeout(() => {
          const gtLon = document.getElementById('gt-lon') as HTMLInputElement
          const gtLat = document.getElementById('gt-lat') as HTMLInputElement
          const gtMailleCode = document.getElementById('gt-maille-code')
          const gtSelectedMaille = document.getElementById('gt-selected-maille')
          
          if (gtLon) gtLon.value = center.lng.toFixed(6)
          if (gtLat) gtLat.value = center.lat.toFixed(6)
          if (gtMailleCode) gtMailleCode.textContent = p.code
          if (gtSelectedMaille) gtSelectedMaille.style.display = 'block'
          
          // Rouvrir le formulaire
          const container = document.getElementById('geotechFormContainer')
          if (container) {
            container.classList.add('active')
          }
          
          toast(`✅ Maille ${p.code} sélectionnée pour le sondage`, 'ok')
        }, 300)
        
        return // Ne pas charger les détails de la maille
      }
      
      // Toast de confirmation
      toast(`📍 Maille sélectionnée: ${p.code}`, 'ok')
      
      // Si c'est une maille 28km, afficher bouton "Gérer" pour filtrer sondages
      if (currentGridLevel === '28km') {
        showMaille28kmActions(p)
      } else {
        // Charger les détails complets de la maille (fiche géotechnique) - UNE SEULE FOIS
        await loadMailleDetails(p.code)
        // Charger les mailles voisines
        loadNeighbors(p.code)
      }
    }
  })
}

// Afficher actions pour maille 28km - même workflow que 2km
function showMaille28kmActions(props: any) {
  const mailleDetails = document.getElementById('mailleDetails')
  const mailleEmpty = document.getElementById('mailleEmpty')
  const mailleContent = document.getElementById('mailleContent')
  
  if (!mailleDetails || !mailleEmpty || !mailleContent) return
  
  mailleDetails.classList.add('active')
  mailleEmpty.style.display = 'none'
  mailleContent.style.display = 'block'
  
  // Remplir les infos de base
  const ficheCode = document.getElementById('ficheCode')
  const ficheAdm = document.getElementById('ficheAdm')
  const kpiSondages = document.getElementById('kpiSondages')
  const kpiEchantillons = document.getElementById('kpiEchantillons')
  const kpiEssais = document.getElementById('kpiEssais')
  
  // Afficher le code lisible 28km ou le code brut
  const displayCode = props.code_28km_lisible || props.code || '—'
  if (ficheCode) ficheCode.textContent = displayCode
  if (ficheAdm) {
    // Afficher les badges
    const badges = []
    if (props.n_sondages > 0) badges.push('<span class="badge-data">✅ avec données</span>')
    if (props.has_random_location) badges.push('<span class="badge-adm">🎲 ADM random</span>')
    ficheAdm.innerHTML = `Maille 28km (profil régional) ${badges.join(' ')}`
  }
  if (kpiSondages) kpiSondages.textContent = props.n_sondages || '0'
  if (kpiEchantillons) kpiEchantillons.textContent = props.n_echantillons || '0'
  if (kpiEssais) kpiEssais.textContent = props.n_essais || '0'
  
  // Mettre à jour la section "Sondages de la maille" avec bouton Détail
  const sondagesList = document.getElementById('sondagesList')
  if (sondagesList) {
    const nSondages = props.n_sondages || 0
    const nMailles2km = props.n_mailles_2km || 0
    const nMaillesWithData = props.n_mailles_2km_with_data || 0
    
    sondagesList.innerHTML = `
      <div style="padding:12px;background:#0f172a;border-radius:6px;margin-bottom:8px">
        <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:8px">
          📊 Profil régional (28km)
        </div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.6">
          <div>🗺️ Mailles 2km couvertes: <strong>${nMaillesWithData}</strong> / ${nMailles2km}</div>
          <div>📍 Sondages totaux: <strong>${nSondages}</strong></div>
        </div>
        <button class="btn secondary btn-sm" style="margin-top:10px;width:100%" 
                onclick="window.location.hash='#/sondages?m28=${encodeURIComponent(props.code)}'">
          📋 Détail - Voir les sondages
        </button>
      </div>
    `
  }
  
  // Charger les mailles voisines pour 28km aussi
  loadNeighbors(props.code)
  
  console.log('[showMaille28kmActions] Maille 28km sélectionnée:', displayCode)
}

// Charger les mailles voisines
async function loadNeighbors(mailleCode: string) {
  const neighborsEl = document.getElementById('neighbors')
  if (!neighborsEl) return
  
  try {
    const res = await fetch(`${API_GEO}/grid/${mailleCode}/neighbors`)
    if (!res.ok) {
      neighborsEl.innerHTML = '<div style="color:var(--muted)">Aucune maille voisine trouvée</div>'
      return
    }
    
    const neighbors = await res.json()
    
    if (neighbors.length === 0) {
      neighborsEl.innerHTML = '<div style="color:var(--muted)">Aucune maille voisine trouvée</div>'
      return
    }
    
    const html = neighbors.map((n: any) => {
      const directionIcon = n.direction === 'Nord' ? '⬆️' : n.direction === 'Sud' ? '⬇️' : n.direction === 'Est' ? '➡️' : '⬅️'
      const distance = n.distance_m ? `${(n.distance_m / 1000).toFixed(1)} km` : '—'
      
      return `
        <div style="background:#0f172a;border:1px solid #22304d;border-radius:6px;padding:8px;margin-bottom:6px;cursor:pointer" 
             onclick="window.selectNeighborMaille('${n.code}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:600;color:var(--accent)">${directionIcon} ${n.code}</span>
            <span style="font-size:10px;color:var(--muted)">${distance}</span>
          </div>
          <div style="font-size:10px;line-height:1.5;color:var(--muted)">
            Sondages: ${n.n_sondages} | Essais: ${n.n_essais}
          </div>
        </div>
      `
    }).join('')
    
    neighborsEl.innerHTML = html
  } catch (e) {
    console.error('Erreur chargement voisins:', e)
    neighborsEl.innerHTML = '<div style="color:var(--err)">Erreur de chargement</div>'
  }
}

// Fonction globale pour sélectionner une maille voisine
;(window as any).selectNeighborMaille = (code: string) => {
  codeInput.value = code
  document.getElementById('getBtn')!.click()
}

// Afficher les données de la maille sélectionnée
// Fonction obsolète supprimée - utilise maintenant loadMailleDetails() pour afficher la fiche

// Variables globales pour les charts
let chartGranulo: Chart | null = null
let chartVBS: Chart | null = null
let chartAtterberg: Chart | null = null
let chartDepth: Chart | null = null

// Rendre la liste des sondages avec accordéon
function renderSondagesList(sondages: any[]) {
  const listContainer = document.getElementById('sondagesList')
  const countEl = document.getElementById('sondagesCount')
  
  if (!listContainer) return
  
  if (countEl) countEl.textContent = sondages.length.toString()
  
  if (sondages.length === 0) {
    listContainer.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px;text-align:center">Aucun sondage</div>'
    return
  }
  
  listContainer.innerHTML = sondages.map((s, idx) => {
    const modeIcon = s.mode === 'real' ? '📍' : '📊'
    const modeBadge = s.mode === 'real' 
      ? '<span class="badge-geo">GPS</span>' 
      : '<span class="badge-adm">Spread</span>'
    
    return `
      <div class="sondage-item">
        <div class="sondage-header" onclick="toggleSondage(${idx})">
          <div>
            <strong>${modeIcon} ${s.localite || s.code_site || 'N/A'}</strong>
            ${modeBadge}
          </div>
          <div style="font-size:11px;color:var(--muted)">
            ${s.samples || 0} échantillons • ${s.tests || 0} essais
          </div>
        </div>
        <div class="sondage-content" id="sondage-${idx}">
          <table style="width:100%;font-size:11px;margin-bottom:8px">
            <tr><td style="color:var(--muted)">Code site:</td><td><strong>${s.code_site || 'N/A'}</strong></td></tr>
            <tr><td style="color:var(--muted)">Date:</td><td>${s.date || 'N/A'}</td></tr>
            <tr><td style="color:var(--muted)">ADM3:</td><td>${s.adm3_code || 'N/A'}</td></tr>
            <tr><td style="color:var(--muted)">Mode:</td><td>${s.mode || 'N/A'}</td></tr>
          </table>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" onclick="viewSondageDetails('${s.id}')">👁️ Détails</button>
            <button class="btn-sm" onclick="editSondage('${s.id}')">✏️ Modifier</button>
          </div>
        </div>
      </div>
    `
  }).join('')
  
  console.log(`[renderSondagesList] ${sondages.length} sondages affichés`)
}

// Fonction globale pour toggler l'accordéon
;(window as any).toggleSondage = function(idx: number) {
  const content = document.getElementById(`sondage-${idx}`)
  if (content) {
    const isOpen = content.classList.contains('open')
    content.classList.toggle('open')
    console.log(`[toggleSondage] Sondage ${idx} ${isOpen ? 'fermé' : 'ouvert'}`)
  }
}

// Fonctions globales pour les actions sur les sondages
;(window as any).viewSondageDetails = function(id: string) {
  console.log('[viewSondageDetails] ID:', id)
  toast('Détails du sondage (à implémenter)', 'ok')
}

;(window as any).editSondage = function(id: string) {
  console.log('[editSondage] ID:', id)
  toast('Édition du sondage (à implémenter)', 'ok')
}

// Charger les détails complets d'une maille (v3.7 - Chantier C avec computeCellMetrics)
async function loadMailleDetails(code: string) {
  console.log('[loadMailleDetails] Chargement des détails pour:', code)
  try {
    // Appel au nouvel endpoint /cells/{code}/complete
    const res = await fetch(`${API_GEO}/cells/${code}/complete`)
    if (!res.ok) {
      toast('Erreur chargement détails maille', 'err')
      return
    }
    
    const data = await res.json()
    console.log('[loadMailleDetails] Données reçues:', data)
    
    // Chantier C - Calculer toutes les métriques une seule fois
    const metrics = computeCellMetrics({
      ...data,
      code,
      adm1_name: selectedMailleProps?.adm1_name,
      adm2_name: selectedMailleProps?.adm2_name,
      adm3_name: selectedMailleProps?.adm3_name,
    })
    console.log('[loadMailleDetails] Métriques calculées:', metrics)
    
    // Afficher le contenu de la fiche et masquer le message vide
    const mailleEmpty = document.getElementById('mailleEmpty')
    const mailleContent = document.getElementById('mailleContent')
    if (mailleEmpty) mailleEmpty.style.display = 'none'
    if (mailleContent) mailleContent.style.display = 'block'
    
    // Scroller vers la fiche
    const ficheDiv = document.getElementById('mailleDetails')
    if (ficheDiv) {
      ficheDiv.classList.add('active')
      setTimeout(() => ficheDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    
    // === RENDU DU PANNEAU MAILLE (Chantier C) ===
    renderMailleHeader(code, metrics, data)
    renderMailleKpis(metrics)
    renderMailleDepth(metrics)
    renderMailleEssaisParType(metrics)
    renderMailleArgilosite(metrics)
    renderMailleSynthese(metrics)
    renderMailleSondages(data, code)
    renderMailleEchantillons(data)
    
    // Charger les mailles voisines
    loadNeighbors(code)
    
  } catch (e: any) {
    console.error('[loadMailleDetails] Erreur:', e)
    toast(`Erreur: ${e.message}`, 'err')
  }
}

// === FONCTIONS DE RENDU PANNEAU MAILLE (Chantier C) ===

function renderMailleHeader(code: string, metrics: CellMetrics, data: any) {
  const ficheCode = document.getElementById('ficheCode')
  const ficheAdm = document.getElementById('ficheAdm')
  const ficheDataBadge = document.getElementById('ficheDataBadge') as HTMLElement
  const ficheLocBadge = document.getElementById('ficheLocBadge') as HTMLElement
  
  if (ficheCode) ficheCode.textContent = code
  
  // ADM path
  if (ficheAdm) {
    const admPath = [metrics.region, metrics.prefecture, metrics.commune]
      .filter(Boolean).join(' > ')
    ficheAdm.textContent = admPath || '—'
  }
  
  // Badges
  const hasData = metrics.nSondages > 0
  if (ficheDataBadge) {
    ficheDataBadge.textContent = hasData ? '✅ avec données' : '— sans données'
    ficheDataBadge.style.display = 'inline-block'
    ficheDataBadge.style.background = hasData ? '#22c55e22' : '#64748b22'
    ficheDataBadge.style.color = hasData ? '#22c55e' : '#64748b'
    ficheDataBadge.style.padding = '2px 6px'
    ficheDataBadge.style.borderRadius = '4px'
    ficheDataBadge.style.fontSize = '10px'
  }
  
  // Badge localisation (depuis surveys)
  const locMode = data.surveys?.[0]?.mode || 'unknown'
  if (ficheLocBadge) {
    if (locMode === 'exact') {
      ficheLocBadge.textContent = '📍 exact'
      ficheLocBadge.style.background = '#22c55e22'
      ficheLocBadge.style.color = '#22c55e'
    } else if (locMode === 'adm_random_cell') {
      ficheLocBadge.textContent = '🎲 ADM random'
      ficheLocBadge.style.background = '#f9731622'
      ficheLocBadge.style.color = '#f97316'
    } else {
      ficheLocBadge.textContent = '❓ inconnu'
      ficheLocBadge.style.background = '#64748b22'
      ficheLocBadge.style.color = '#64748b'
    }
    ficheLocBadge.style.display = hasData ? 'inline-block' : 'none'
    ficheLocBadge.style.padding = '2px 6px'
    ficheLocBadge.style.borderRadius = '4px'
    ficheLocBadge.style.fontSize = '10px'
  }
}

function renderMailleKpis(metrics: CellMetrics) {
  const kpiSondages = document.getElementById('kpiSondages')
  const kpiEchantillons = document.getElementById('kpiEchantillons')
  const kpiEssais = document.getElementById('kpiEssais')
  const kpiSummaryLine = document.getElementById('kpiSummaryLine')
  
  if (kpiSondages) kpiSondages.textContent = metrics.nSondages.toString()
  if (kpiEchantillons) kpiEchantillons.textContent = metrics.nEchantillons.toString()
  if (kpiEssais) kpiEssais.textContent = metrics.nEssais.toString()
  if (kpiSummaryLine) {
    kpiSummaryLine.textContent = `Données issues de ${metrics.nSondages} sondage(s), ${metrics.nEchantillons} échantillon(s), ${metrics.nEssais} essai(s)`
  }
}

function renderMailleDepth(metrics: CellMetrics) {
  const cellDepthMin = document.getElementById('cellDepthMin')
  const cellDepthMoy = document.getElementById('cellDepthMoy')
  const cellDepthMax = document.getElementById('cellDepthMax')
  
  if (cellDepthMin) cellDepthMin.textContent = fmtNumber(metrics.depthMin, 'm')
  if (cellDepthMoy) cellDepthMoy.textContent = fmtNumber(metrics.depthMean, 'm')
  if (cellDepthMax) cellDepthMax.textContent = fmtNumber(metrics.depthMax, 'm')
  
  // Mini histogramme profondeur maille
  const [bin0_1, bin1_15, bin15_2, bin2_plus] = metrics.depthBins
  const maxBin = Math.max(...metrics.depthBins, 1)
  
  const cellBar0_1 = document.getElementById('cellBar0_1')
  const cellBar1_15 = document.getElementById('cellBar1_15')
  const cellBar15_2 = document.getElementById('cellBar15_2')
  const cellBar2_plus = document.getElementById('cellBar2_plus')
  
  if (cellBar0_1) cellBar0_1.style.height = `${(bin0_1 / maxBin) * 100}%`
  if (cellBar1_15) cellBar1_15.style.height = `${(bin1_15 / maxBin) * 100}%`
  if (cellBar15_2) cellBar15_2.style.height = `${(bin15_2 / maxBin) * 100}%`
  if (cellBar2_plus) cellBar2_plus.style.height = `${(bin2_plus / maxBin) * 100}%`
}

function renderMailleEssaisParType(metrics: CellMetrics) {
  const types = metrics.essaisParType
  
  const setTypeCount = (id: string, count: number) => {
    const el = document.getElementById(id)
    if (el) {
      el.textContent = count.toString()
      el.style.opacity = count > 0 ? '1' : '0.4'
    }
  }
  
  setTypeCount('cellAtterberg', types.atterberg)
  setTypeCount('cellVbs', types.vbs)
  setTypeCount('cellClassif', types.classif)
  setTypeCount('cellProctor', types.proctor)
  setTypeCount('cellGranulo', types.granulo)
  setTypeCount('cellGonflement', types.gonflement)
}

function renderMailleArgilosite(metrics: CellMetrics) {
  const cellVbsMoy = document.getElementById('cellVbsMoy')
  const cellPctArgileux = document.getElementById('cellPctArgileux')
  const cellIpMoy = document.getElementById('cellIpMoy')
  
  if (cellVbsMoy) cellVbsMoy.textContent = fmtNumber(metrics.vbsMean, '', 1)
  if (cellPctArgileux) cellPctArgileux.textContent = metrics.pctArgileux != null ? `${metrics.pctArgileux.toFixed(0)}%` : '—'
  if (cellIpMoy) cellIpMoy.textContent = fmtNumber(metrics.ipMean, '', 0)
}

function renderMailleSynthese(metrics: CellMetrics) {
  const ficheSummaryText = document.getElementById('ficheSummaryText')
  if (ficheSummaryText) {
    ficheSummaryText.textContent = buildSynthese(metrics)
  }
}

function renderMailleSondages(data: any, gridCode: string) {
  const cellSurveysList = document.getElementById('cellSurveysList')
  const btnOpenSondagesManager = document.getElementById('btnOpenSondagesManager') as HTMLButtonElement | null
  
  if (!cellSurveysList) return
  
  const surveys = data.surveys || []
  
  // Afficher/masquer le bouton "Gérer" selon s'il y a des sondages
  if (btnOpenSondagesManager) {
    if (surveys.length > 0) {
      btnOpenSondagesManager.style.display = 'inline-block'
      btnOpenSondagesManager.onclick = () => {
        // Ouvrir le gestionnaire de sondages avec le filtre maille
        window.location.hash = `#/sondages?grid=${encodeURIComponent(gridCode)}`
      }
    } else {
      btnOpenSondagesManager.style.display = 'none'
    }
  }
  
  if (surveys.length === 0) {
    cellSurveysList.innerHTML = '<span style="color:var(--muted);font-style:italic">Aucun sondage dans cette maille</span>'
  } else {
    cellSurveysList.innerHTML = surveys.map((s: any) => `
      <div style="padding:6px 8px;background:#0a1018;border-radius:4px;margin-bottom:4px">
        <div style="font-weight:600;color:var(--text)">${s.code_site || 'N/A'}</div>
        <div style="display:flex;gap:8px;margin-top:2px;color:var(--muted);font-size:10px">
          <span>${s.mode === 'exact' ? '📍 exact' : '🎲 random'}</span>
          <span>•</span>
          <span>${s.samples || 0} éch.</span>
          <span>•</span>
          <span>${s.tests || 0} essais</span>
        </div>
      </div>
    `).join('')
  }
}

function renderMailleEchantillons(data: any) {
  const cellSamplesBody = document.getElementById('cellSamplesBody')
  if (!cellSamplesBody) return
  
  const samples = data.samples || []
  if (samples.length === 0) {
    cellSamplesBody.innerHTML = '<tr><td colspan="3" style="padding:8px;text-align:center;color:var(--muted)">Aucun échantillon</td></tr>'
  } else {
    cellSamplesBody.innerHTML = samples.map((s: any) => {
      const vbs = s.vbs?.vbs != null ? s.vbs.vbs.toFixed(2) : '—'
      const ip = s.atterberg?.ip != null ? s.atterberg.ip.toFixed(0) : '—'
      return `
        <tr style="border-bottom:1px solid #1c2843">
          <td style="padding:4px;color:var(--text)">${s.depth_m?.toFixed(1) || '—'}m</td>
          <td style="padding:4px;text-align:center;color:#4c6ef5">${vbs}</td>
          <td style="padding:4px;text-align:center;color:#51cf66">${ip}</td>
        </tr>
      `
    }).join('')
  }
}

// Onglet 1: Vue d ensemble
function renderOverview(overview: any) {
  console.log('[renderOverview] Rendu vue ensemble', overview)
  renderChartsFromLabs(overview)
}

// Onglet 2: Essais détaillés
function renderEssais(samples: any[], pctSpread: number, sourceSurveys: any[]) {
  console.log('[renderEssais] Rendu essais détaillés, samples:', samples.length)
  const list = document.getElementById('essaisList')
  if (!list) return
  
  if (samples.length === 0) {
    // Empty state avec explication selon le contexte
    const emptyMessage = pctSpread > 99 
      ? `
        <div style="padding:20px;text-align:center;color:var(--muted)">
          <div style="font-size:40px;margin-bottom:10px">📊</div>
          <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px">
            Aucun essai dans cette maille
          </div>
          <div style="font-size:11px;line-height:1.6">
            Ces valeurs proviennent d'une <strong>diffusion ADM3</strong>.<br>
            ${sourceSurveys.length > 0 ? `Consultez l'onglet <strong>Sondages</strong> pour voir le(s) sondage(s) source(s).` : ''}
          </div>
        </div>
      `
      : `
        <div style="padding:20px;text-align:center;color:var(--muted)">
          <div style="font-size:40px;margin-bottom:10px">🔬</div>
          <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px">
            Aucun essai disponible
          </div>
          <div style="font-size:11px">
            Cette maille ne contient pas encore d'essais géotechniques.
          </div>
        </div>
      `
    list.innerHTML = emptyMessage
    return
  }
  
  list.innerHTML = samples.map((s, idx) => `
    <div class="essai-item">
      <div class="essai-header" onclick="window.toggleEssai(${idx})">
        <strong>Profondeur: ${s.depth_m}m</strong>
        <span>▼</span>
      </div>
      <div class="essai-content" id="essai-${idx}">
        ${renderEssaiDetails(s)}
      </div>
    </div>
  `).join('')
  
  // Boutons Déployer/Replier tout
  const expandAll = document.getElementById('expandAll')
  const collapseAll = document.getElementById('collapseAll')
  if (expandAll) expandAll.onclick = () => {
    document.querySelectorAll('.essai-content').forEach(el => el.classList.add('open'))
  }
  if (collapseAll) collapseAll.onclick = () => {
    document.querySelectorAll('.essai-content').forEach(el => el.classList.remove('open'))
  }
}

function renderEssaiDetails(sample: any): string {
  let html = ''
  
  // Atterberg avec badges intelligents
  if (sample.atterberg) {
    const a = sample.atterberg
    // Calculer IP si manquant mais WL et WP présents
    const ip = a.ip || (a.wl && a.wp ? a.wl - a.wp : null)
    const ipBadge = ip 
      ? ip < 7 
        ? '<span class="badge-ip-faible">Faible</span>' 
        : ip < 17 
          ? '<span class="badge-ip-moyen">Moyen</span>' 
          : '<span class="badge-ip-fort">Fort</span>'
      : ''
    
    html += `
      <div class="essai-group">
        <h5>Atterberg</h5>
        <table>
          ${a.wl ? `<tr><td>WL:</td><td>${a.wl}%</td></tr>` : ''}
          ${a.wp ? `<tr><td>WP:</td><td>${a.wp}%</td></tr>` : ''}
          ${ip ? `<tr><td>IP:</td><td>${ip}% ${ipBadge}</td></tr>` : ''}
          ${a.zone ? `<tr><td>Zone:</td><td><span class="badge-zone">${a.zone}</span></td></tr>` : ''}
        </table>
      </div>
    `
  }
  
  // VBS avec badges intelligents
  if (sample.vbs) {
    const v = sample.vbs
    const vbsValue = v.vbs
    const vbsBadge = vbsValue <= 1.5 
      ? '<span class="badge-vbs-faible">Faible</span>' 
      : vbsValue <= 3 
        ? '<span class="badge-vbs-moyen">Moyen</span>' 
        : '<span class="badge-vbs-eleve">Élevé</span>'
    
    html += `
      <div class="essai-group">
        <h5>VBS</h5>
        <table>
          <tr><td>VBS:</td><td>${vbsValue} g/100g ${vbsBadge}</td></tr>
          ${v.argilosite ? `<tr><td>Argilosité:</td><td>${v.argilosite}</td></tr>` : ''}
        </table>
      </div>
    `
  }
  
  // Granulométrie
  if (sample.granulo) {
    const g = sample.granulo
    html += `
      <div class="essai-group">
        <h5>Granulométrie</h5>
        <table>
          ${g.passant_80um ? `<tr><td>Passant 80µm:</td><td>${g.passant_80um}%</td></tr>` : ''}
          ${g.passant_2mm ? `<tr><td>Passant 2mm:</td><td>${g.passant_2mm}%</td></tr>` : ''}
          ${g.passant_20mm ? `<tr><td>Passant 20mm:</td><td>${g.passant_20mm}%</td></tr>` : ''}
          ${g.indices && g.indices.d10 ? `<tr><td>D10:</td><td>${g.indices.d10.toFixed(3)} mm</td></tr>` : ''}
          ${g.indices && g.indices.d30 ? `<tr><td>D30:</td><td>${g.indices.d30.toFixed(3)} mm</td></tr>` : ''}
          ${g.indices && g.indices.d60 ? `<tr><td>D60:</td><td>${g.indices.d60.toFixed(3)} mm</td></tr>` : ''}
          ${g.indices && g.indices.cu ? `<tr><td>Cu:</td><td>${g.indices.cu.toFixed(2)}</td></tr>` : ''}
          ${g.indices && g.indices.cc ? `<tr><td>Cc:</td><td>${g.indices.cc.toFixed(2)}</td></tr>` : ''}
        </table>
        ${g.points && g.points.length > 0 ? `<button class="mini-chart-btn" onclick="window.showGranuloChart(${JSON.stringify(g.points).replace(/"/g, '&quot;')})">📊 Voir courbe</button>` : ''}
      </div>
    `
  }
  
  // Proctor
  if (sample.proctor) {
    const p = sample.proctor
    html += `
      <div class="essai-group">
        <h5>Proctor</h5>
        <table>
          ${p.gamma_d_max ? `<tr><td>γd max:</td><td>${p.gamma_d_max} kN/m³</td></tr>` : ''}
          ${p.w_opt ? `<tr><td>wopt:</td><td>${p.w_opt}%</td></tr>` : ''}
          ${p.type ? `<tr><td>Type:</td><td>${p.type}</td></tr>` : ''}
        </table>
      </div>
    `
  }
  
  // Gonflement
  if (sample.swelling) {
    const sw = sample.swelling
    html += `
      <div class="essai-group">
        <h5>Gonflement</h5>
        <table>
          <tr><td>Eg:</td><td>${sw.eg}%</td></tr>
          ${sw.risque ? `<tr><td>Risque:</td><td><span class="badge-risk-${sw.risque.toLowerCase()}">${sw.risque}</span></td></tr>` : ''}
        </table>
      </div>
    `
  }
  
  // Classifications avec raisons
  if (sample.classif) {
    const c = sample.classif
    // Gérer les nouvelles structures avec class/reason
    const uscsClass = typeof c.uscs === 'object' ? c.uscs.class : c.uscs
    const uscsReason = typeof c.uscs === 'object' ? c.uscs.reason : null
    const aashtoClass = typeof c.aashto === 'object' ? c.aashto.class : c.aashto
    const aashtoReason = typeof c.aashto === 'object' ? c.aashto.reason : null
    const gtrClass = typeof c.gtr === 'object' ? c.gtr.class : c.gtr
    const gtrReason = typeof c.gtr === 'object' ? c.gtr.reason : null
    
    html += `
      <div class="essai-group">
        <h5>Classifications</h5>
        <table>
          ${uscsClass ? `
            <tr>
              <td>USCS:</td>
              <td>
                <span class="badge-uscs">${uscsClass}</span>
                ${uscsReason ? `<br><small style="color:var(--muted);font-size:9px">${uscsReason}</small>` : ''}
              </td>
            </tr>
          ` : ''}
          ${aashtoClass ? `
            <tr>
              <td>AASHTO:</td>
              <td>
                <span class="badge-aashto">${aashtoClass}</span>
                ${aashtoReason ? `<br><small style="color:var(--muted);font-size:9px">${aashtoReason}</small>` : ''}
              </td>
            </tr>
          ` : ''}
          ${gtrClass ? `
            <tr>
              <td>GTR:</td>
              <td>
                <span class="badge-gtr">${gtrClass}</span>
                ${gtrReason ? `<br><small style="color:var(--muted);font-size:9px">${gtrReason}</small>` : ''}
              </td>
            </tr>
          ` : ''}
        </table>
      </div>
    `
  }
  
  return html || '<div style="font-size:11px;color:var(--muted);padding:10px">Aucune donnée disponible</div>'
}

// Fonction globale pour toggler les essais
;(window as any).toggleEssai = function(idx: number) {
  const content = document.getElementById(`essai-${idx}`)
  if (content) {
    content.classList.toggle('open')
  }
}

// Fonction globale pour afficher une courbe granulo (placeholder)
;(window as any).showGranuloChart = function(points: any[]) {
  console.log('[showGranuloChart] Points:', points)
  toast('Affichage courbe granulo (à implémenter)', 'ok')
}

// Onglet 3: Sondages
function renderSondages(surveys: any[], sourceSurveys: any[]) {
  console.log('[renderSondages] Rendu sondages, surveys:', surveys.length, 'sources:', sourceSurveys.length)
  const list = document.getElementById('sondagesList')
  if (!list) return
  
  let html = ''
  
  // Sondages de la maille
  if (surveys.length > 0) {
    html += surveys.map((s, idx) => {
      const modeIcon = s.mode === 'real' ? '🟢' : '⚪'
      const modeBadge = s.mode === 'real'
        ? '<span class="badge-geo">GPS</span>'
        : '<span class="badge-adm">Spread</span>'
      
      return `
        <div class="sondage-item">
          <div class="sondage-header" onclick="window.toggleSondage(${idx})">
            <div>
              <strong>${modeIcon} ${s.code_site || 'N/A'}</strong>
              ${modeBadge}
            </div>
            <div style="font-size:11px;color:var(--muted)">
              ${s.samples || 0} échantillons • ${s.tests || 0} essais
            </div>
          </div>
          <div class="sondage-content" id="sondage-${idx}">
            <table style="width:100%;font-size:11px;margin-bottom:8px">
              <tr><td style="color:var(--muted)">Code site:</td><td><strong>${s.code_site || 'N/A'}</strong></td></tr>
              <tr><td style="color:var(--muted)">Date:</td><td>${s.date || 'N/A'}</td></tr>
              <tr><td style="color:var(--muted)">ADM3:</td><td>${s.adm3_code || 'N/A'}</td></tr>
              <tr><td style="color:var(--muted)">Mode:</td><td>${s.mode || 'N/A'}</td></tr>
            </table>
            <div style="display:flex;gap:6px">
              <button class="btn-sm" onclick="window.viewSondageDetails('${s.id}')">👁️ Détails</button>
              <button class="btn-sm" onclick="window.editSondage('${s.id}')">✏️ Modifier</button>
            </div>
          </div>
        </div>
      `
    }).join('')
  }
  
  // Sondages sources (si spread-only)
  if (sourceSurveys.length > 0) {
    html += `
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid #1b2740">
        <h5 style="font-size:11px;color:var(--muted);margin:0 0 10px 0;text-transform:uppercase">Sondages sources (diffusion)</h5>
        ${sourceSurveys.map((s, idx) => `
          <div class="sondage-item">
            <div class="sondage-header">
              <div>
                <strong>🔄 ${s.code_site || 'N/A'}</strong>
                <span class="badge-geo">Source</span>
              </div>
              <div style="font-size:11px;color:var(--muted)">
                ${s.adm3_code || 'N/A'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `
  }
  
  list.innerHTML = html || '<div style="font-size:11px;color:var(--muted);padding:10px;text-align:center">Aucun sondage</div>'
}

// Fonction globale pour toggler les sondages
;(window as any).toggleSondage = function(idx: number) {
  const content = document.getElementById(`sondage-${idx}`)
  if (content) {
    content.classList.toggle('open')
  }
}

// Onglet 4: Classification
function renderClassification(samples: any[]) {
  console.log('[renderClassification] Rendu classification, samples:', samples.length)
  const rulesDiv = document.getElementById('classifRules')
  if (!rulesDiv) return
  
  // Compter les classifications
  const uscsCount: Record<string, number> = {}
  const aashtoCount: Record<string, number> = {}
  
  samples.forEach(s => {
    if (s.classif) {
      if (s.classif.uscs && s.classif.uscs !== 'N/A') {
        uscsCount[s.classif.uscs] = (uscsCount[s.classif.uscs] || 0) + 1
      }
      if (s.classif.aashto && s.classif.aashto !== 'N/A') {
        aashtoCount[s.classif.aashto] = (aashtoCount[s.classif.aashto] || 0) + 1
      }
    }
  })
  
  let html = '<h5 style="margin:0 0 8px 0;font-size:11px;color:var(--accent);text-transform:uppercase">Répartition USCS</h5>'
  if (Object.keys(uscsCount).length > 0) {
    html += '<table style="width:100%;font-size:11px;margin-bottom:12px">'
    Object.entries(uscsCount).forEach(([key, count]) => {
      html += `<tr><td><span class="badge-uscs">${key}</span></td><td>${count} échantillon(s)</td></tr>`
    })
    html += '</table>'
  } else {
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:12px">Aucune classification USCS</div>'
  }
  
  html += '<h5 style="margin:12px 0 8px 0;font-size:11px;color:var(--accent);text-transform:uppercase">Répartition AASHTO</h5>'
  if (Object.keys(aashtoCount).length > 0) {
    html += '<table style="width:100%;font-size:11px">'
    Object.entries(aashtoCount).forEach(([key, count]) => {
      html += `<tr><td><span class="badge-aashto">${key}</span></td><td>${count} échantillon(s)</td></tr>`
    })
    html += '</table>'
  } else {
    html += '<div style="font-size:11px;color:var(--muted)">Aucune classification AASHTO</div>'
  }
  
  rulesDiv.innerHTML = html
  
  // TODO: Diagrammes Casagrande et pie charts (nécessite Chart.js)
}

// Rendre les graphiques depuis le nouvel endpoint /cells/{code}/labs
function renderChartsFromLabs(data: any) {
  console.log('[renderChartsFromLabs] Début, data:', data)
  
  // Détruire les anciens charts
  if (chartGranulo) chartGranulo.destroy()
  if (chartVBS) chartVBS.destroy()
  if (chartAtterberg) chartAtterberg.destroy()
  if (chartDepth) chartDepth.destroy()
  
  // Préparer données Atterberg
  const atterbergWL: {x: number, y: number}[] = []
  const atterbergWP: {x: number, y: number}[] = []
  if (data.atterberg && data.atterberg.length > 0) {
    data.atterberg.forEach((pt: any) => {
      if (pt.wl !== null) atterbergWL.push({ x: pt.depth_m, y: pt.wl })
      if (pt.wp !== null) atterbergWP.push({ x: pt.depth_m, y: pt.wp })
    })
  }
  
  // Préparer données VBS
  const vbsData: {x: number, y: number}[] = []
  if (data.vbs && data.vbs.length > 0) {
    data.vbs.forEach((pt: any) => {
      if (pt.vbs !== null) vbsData.push({ x: pt.depth_m, y: pt.vbs })
    })
  }
  
  // Préparer histogramme profondeurs
  const depthLabels: string[] = []
  const depthCounts: number[] = []
  if (data.depth_hist && data.depth_hist.length > 0) {
    const bins = [0, 5, 10, 15, 20, 25, 30]
    data.depth_hist.forEach((item: any) => {
      const binIdx = item.bin - 1
      if (binIdx >= 0 && binIdx < bins.length - 1) {
        depthLabels.push(`${bins[binIdx]}-${bins[binIdx + 1]}m`)
        depthCounts.push(item.n)
      }
    })
  }
  
  console.log('[renderChartsFromLabs] Atterberg WL:', atterbergWL.length, 'WP:', atterbergWP.length, 'VBS:', vbsData.length, 'Depth bins:', depthCounts.length)
  
  // Chart Atterberg - CONDITIONNEL
  const ctxAtterberg = document.getElementById('chartAtterberg') as HTMLCanvasElement
  if (ctxAtterberg) {
    if (atterbergWL.length > 0 || atterbergWP.length > 0) {
      ctxAtterberg.style.display = 'block'
      chartAtterberg = new Chart(ctxAtterberg, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'WL',
              data: atterbergWL,
              backgroundColor: '#ff6b9d',
              borderColor: '#ff6b9d',
              pointRadius: 4
            },
            {
              label: 'WP',
              data: atterbergWP,
              backgroundColor: '#c77dff',
              borderColor: '#c77dff',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: false,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: true, labels: { color: '#8aa0b5', font: { size: 9 } } },
            title: { display: true, text: 'Limites d\'Atterberg (%)', color: '#c9d7e3', font: { size: 11 } }
          },
          scales: {
            x: { title: { display: true, text: 'Profondeur (m)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } },
            y: { title: { display: true, text: '%', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
          }
        }
      })
    } else {
      ctxAtterberg.style.display = 'none'
      console.log('[renderChartsFromLabs] Atterberg masqué (pas de données)')
    }
  }
  
  // Chart VBS - CONDITIONNEL
  const ctxVBS = document.getElementById('chartVBS') as HTMLCanvasElement
  if (ctxVBS) {
    if (vbsData.length > 0) {
      ctxVBS.style.display = 'block'
      chartVBS = new Chart(ctxVBS, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'VBS',
            data: vbsData,
            backgroundColor: '#0bb07b',
            borderColor: '#0bb07b',
            pointRadius: 4
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Bleu de Méthylène (VBS)', color: '#c9d7e3', font: { size: 11 } }
          },
          scales: {
            x: { title: { display: true, text: 'Profondeur (m)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } },
            y: { title: { display: true, text: 'VBS (g/100g)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
          }
        }
      })
    } else {
      ctxVBS.style.display = 'none'
      console.log('[renderChartsFromLabs] VBS masqué (pas de données)')
    }
  }
  
  // Histogramme profondeurs - CONDITIONNEL
  const ctxDepth = document.getElementById('chartDepth') as HTMLCanvasElement
  if (ctxDepth) {
    if (depthCounts.length > 0) {
      ctxDepth.style.display = 'block'
      chartDepth = new Chart(ctxDepth, {
        type: 'bar',
        data: {
          labels: depthLabels,
          datasets: [{
            label: 'Échantillons',
            data: depthCounts,
            backgroundColor: '#f4b740',
            borderColor: '#f4b740',
            borderWidth: 1
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Distribution Profondeurs', color: '#c9d7e3', font: { size: 11 } }
          },
          scales: {
            x: { ticks: { color: '#8aa0b5', font: { size: 9 } }, grid: { color: '#1c2843' } },
            y: { title: { display: true, text: 'Nombre', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
          }
        }
      })
    } else {
      ctxDepth.style.display = 'none'
      console.log('[renderChartsFromLabs] Depth masqué (pas de données)')
    }
  }
  
  // Masquer chartGranulo (pas de données granulo pour l'instant)
  const ctxGranulo = document.getElementById('chartGranulo') as HTMLCanvasElement
  if (ctxGranulo) {
    ctxGranulo.style.display = 'none'
  }
}

// Rendre les graphiques
function renderCharts(sondages: any[]) {
  console.log('[renderCharts] Début, sondages:', sondages?.length || 0, sondages)
  
  if (!sondages || sondages.length === 0) {
    console.warn('[renderCharts] Aucun sondage à afficher')
    return
  }
  
  // Détruire les anciens charts
  if (chartGranulo) {
    console.log('[renderCharts] Destruction chartGranulo')
    chartGranulo.destroy()
  }
  if (chartVBS) {
    console.log('[renderCharts] Destruction chartVBS')
    chartVBS.destroy()
  }
  if (chartAtterberg) {
    console.log('[renderCharts] Destruction chartAtterberg')
    chartAtterberg.destroy()
  }
  if (chartDepth) {
    console.log('[renderCharts] Destruction chartDepth')
    chartDepth.destroy()
  }
  
  // Extraire les données
  const granuloData: {x: number, y: number}[] = []
  const vbsData: {x: number, y: number}[] = []
  const atterbergWL: {x: number, y: number}[] = []
  const atterbergWP: {x: number, y: number}[] = []
  const depths: number[] = []
  
  sondages.forEach(s => {
    s.essais.forEach((e: any) => {
      const type = e.type_essai || e.type
      const value = e.valeur_numerique || e.value
      const depth = e.profondeur_m || e.depth_m || 0
      
      if (type === 'Granulometrie' && value !== null && value !== undefined) {
        granuloData.push({ x: depth, y: parseFloat(value) })
      } else if (type === 'BleuMethylene_VBS' && value !== null && value !== undefined) {
        vbsData.push({ x: depth, y: parseFloat(value) })
      } else if (type === 'Atterberg_WL' && value !== null && value !== undefined) {
        atterbergWL.push({ x: depth, y: parseFloat(value) })
      } else if (type === 'Atterberg_WP' && value !== null && value !== undefined) {
        atterbergWP.push({ x: depth, y: parseFloat(value) })
      }
      if (depth > 0) {
        depths.push(depth)
      }
    })
  })
  
  console.log('[renderCharts] Données extraites - Granulo:', granuloData.length, 'VBS:', vbsData.length, 'Atterberg:', atterbergWL.length, 'depths:', depths.length)
  
  // Chart Granulométrie vs Profondeur
  const ctxGranulo = document.getElementById('chartGranulo') as HTMLCanvasElement
  if (ctxGranulo) {
    chartGranulo = new Chart(ctxGranulo, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Granulométrie',
          data: granuloData,
          backgroundColor: '#3aa6ff',
          borderColor: '#3aa6ff',
          pointRadius: 4
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Granulométrie (% passant)', color: '#c9d7e3', font: { size: 11 } }
        },
        scales: {
          x: { title: { display: true, text: 'Profondeur (m)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } },
          y: { title: { display: true, text: '% passant', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' }, min: 0, max: 100 }
        }
      }
    })
  }
  
  // Chart VBS vs Profondeur
  const ctxVBS = document.getElementById('chartVBS') as HTMLCanvasElement
  if (ctxVBS) {
    chartVBS = new Chart(ctxVBS, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'VBS',
          data: vbsData,
          backgroundColor: '#0bb07b',
          borderColor: '#0bb07b',
          pointRadius: 4
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Bleu de Méthylène (VBS)', color: '#c9d7e3', font: { size: 11 } }
        },
        scales: {
          x: { title: { display: true, text: 'Profondeur (m)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } },
          y: { title: { display: true, text: 'VBS (g/100g)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
        }
      }
    })
  }
  
  // Chart Atterberg vs Profondeur
  const ctxAtterberg = document.getElementById('chartAtterberg') as HTMLCanvasElement
  if (ctxAtterberg) {
    chartAtterberg = new Chart(ctxAtterberg, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'WL',
            data: atterbergWL,
            backgroundColor: '#ff6b9d',
            borderColor: '#ff6b9d',
            pointRadius: 4
          },
          {
            label: 'WP',
            data: atterbergWP,
            backgroundColor: '#c77dff',
            borderColor: '#c77dff',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true, labels: { color: '#8aa0b5', font: { size: 9 } } },
          title: { display: true, text: 'Limites d\'Atterberg (%)', color: '#c9d7e3', font: { size: 11 } }
        },
        scales: {
          x: { title: { display: true, text: 'Profondeur (m)', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } },
          y: { title: { display: true, text: '%', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
        }
      }
    })
  }
  
  // Histogramme profondeur
  const depthBins = [0, 5, 10, 15, 20, 25, 30]
  const depthCounts = new Array(depthBins.length - 1).fill(0)
  depths.forEach(d => {
    for (let i = 0; i < depthBins.length - 1; i++) {
      if (d >= depthBins[i] && d < depthBins[i + 1]) {
        depthCounts[i]++
        break
      }
    }
  })
  
  const ctxDepth = document.getElementById('chartDepth') as HTMLCanvasElement
  chartDepth = new Chart(ctxDepth, {
    type: 'bar',
    data: {
      labels: depthBins.slice(0, -1).map((v, i) => `${v}-${depthBins[i+1]}m`),
      datasets: [{
        label: 'Essais',
        data: depthCounts,
        backgroundColor: '#f4b740',
        borderColor: '#f4b740',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Distribution Profondeurs', color: '#c9d7e3', font: { size: 11 } }
      },
      scales: {
        x: { ticks: { color: '#8aa0b5', font: { size: 9 } }, grid: { color: '#1c2843' } },
        y: { title: { display: true, text: 'Nombre', color: '#8aa0b5', font: { size: 10 } }, ticks: { color: '#8aa0b5' }, grid: { color: '#1c2843' } }
      }
    }
  })
}

// Localiser un sondage sur la carte
function locateSurvey(lon: number | null, lat: number | null, hasCoords: boolean) {
  if (hasCoords && lon && lat) {
    map.setView([lat, lon], 16)
    toast('📍 Sondage localisé', 'ok')
  } else {
    toast('⚠️ Sondage ADM-only (pas de coordonnées précises)', 'err')
  }
}
(window as any).locateSurvey = locateSurvey

// Exporter GeoJSON d'une maille
async function exportMailleGeoJSON(code: string) {
  try {
    const res = await fetch(`${API_GEO}/grid/${code}/shape`)
    const geojson = await res.json()
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maille_${code}.geojson`
    a.click()
    URL.revokeObjectURL(url)
    toast('✅ GeoJSON exporté', 'ok')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

// Recalculer IDW
async function recomputeIdw(code: string) {
  try {
    const res = await fetch(`${API_GEO}/grid/recompute/${code}`, { method: 'POST' })
    if (res.ok) {
      toast('✅ IDW recalculé', 'ok')
      loadMailleDetails(code)
    } else {
      toast('Erreur recalcul IDW', 'err')
    }
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

// Générer automatiquement le code sondage
async function generateSurveyCode(mailleCode: string) {
  try {
    // Récupérer les sondages existants dans cette maille
    const res = await fetch(`${API_GEO}/surveys?maille=${mailleCode}`)
    const surveys = res.ok ? await res.json() : []
    
    // Incrémenter le numéro
    const nextNum = surveys.length + 1
    const code = `${mailleCode}-${String(nextNum).padStart(3, '0')}`
    
    const codeInput = document.getElementById('surveyCode') as HTMLInputElement
    if (codeInput) {
      codeInput.value = code
    }
  } catch (e) {
    console.error('Erreur génération code:', e)
  }
}

// Vérifier les doublons à proximité (rayon 1 km)
async function checkNearbyDuplicates(lon: number, lat: number, alertsEl: HTMLElement) {
  try {
    const res = await fetch(`${API_GEO}/surveys/nearby?lat=${lat}&lon=${lon}&radius=1000`)
    if (!res.ok) return
    
    const nearby = await res.json()
    if (nearby.length > 0) {
      const list = nearby.slice(0, 3).map((s: any) => 
        `<div>• ${s.code} (${Math.round(s.distance_m)}m)</div>`
      ).join('')
      
      alertsEl.innerHTML = `
        <div style="color:var(--warn);background:#f4b74022;padding:8px;border-radius:4px;margin-top:8px">
          <div style="font-weight:600;margin-bottom:4px">⚠️ ${nearby.length} sondage(s) à proximité :</div>
          ${list}
        </div>
      `
    }
  } catch (e) {
    console.error('Erreur vérification doublons:', e)
  }
}

// --- Grid loading ---
let isLoadingGrid = false
let lastBounds: L.LatLngBounds | null = null
let currentGridLevel: '2km' | '28km' = '2km'

async function loadGrid(useBbox = false) {
  console.log('[loadGrid] Début - API_GEO:', API_GEO, 'isLoadingGrid:', isLoadingGrid, 'gridLevel:', currentGridLevel)
  if (!API_GEO || isLoadingGrid) {
    console.error('[loadGrid] ABORT - API_GEO vide ou déjà en cours de chargement')
    return
  }
  isLoadingGrid = true

  setStatus('Chargement de la grille…')
  try {
    const params = new URLSearchParams()
    params.set('grid', currentGridLevel)
    
    // Chargement paresseux par bbox si demandé et carte déplacée
    if (useBbox && map) {
      const bounds = map.getBounds()
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]
      params.set('bbox', bbox.join(','))
    }
    
    const url = `${API_GEO}/coverage/mailles?${params.toString()}`
    console.log('[loadGrid] Fetching URL:', url)
    
    const res = await fetch(url)
    console.log('[loadGrid] Response status:', res.status, res.statusText)
    if (!res.ok) {
      toast(`HTTP ${res.status}`, 'err')
      setStatus('Erreur de chargement')
      isLoadingGrid = false
      return
    }
    const gj = await res.json()
    console.log('[loadGrid] GeoJSON reçu, features:', gj.features?.length)

    let withData = 0
    gj.features.forEach((f: any) => {
      if (f.properties?.has_data) withData++
    })

    setKpis(gj.features.length, withData)
    console.log('[loadGrid] KPIs mis à jour -', gj.features.length, 'mailles,', withData, 'avec données')
    setStatus(`Grille chargée: ${gj.features.length.toLocaleString()} mailles (${withData} avec données)`)
    
    // Mettre à jour les stats de grille dans le panneau droit
    const gridTotal = document.getElementById('gridTotal')
    const gridWithData = document.getElementById('gridWithData')
    if (gridTotal) gridTotal.textContent = gj.features.length.toLocaleString()
    if (gridWithData) gridWithData.textContent = withData.toLocaleString()

    if (gridLayer) {
      map.removeLayer(gridLayer)
    }
    
    // Chantier A - Réinitialiser les états de survol et sélection
    if (selectedCell) {
      selectedCell = null
      selectedMailleCode = null
      selectedMailleProps = null
    }
    hoveredCell = null
    
    gridLayer = L.geoJSON(gj, {
      style: styleFeature,
      onEachFeature
    }).addTo(map)
    
    // Mettre à jour la référence globale
    ;(window as any).gridLayer = gridLayer

    const bounds = gridLayer.getBounds()
    if (bounds.isValid() && !useBbox) map.fitBounds(bounds, { padding: [12, 12] })

    // Attacher les événements une seule fois (éviter les doublons)
    if (!(window as any)._gridEventsAttached) {
      // Redessiner les mailles lors du zoom pour ajuster les contours
      map.on('zoomend', () => {
        // Chantier A - Réinitialiser le survol lors du zoom
        if (hoveredCell && hoveredCell !== selectedCell) {
          hoveredCell.setStyle(getDefaultStyle((hoveredCell as any).feature))
          hoveredCell = null
        }
        
        // Redessiner les mailles avec le nouveau zoom
        if (gridLayer) {
          gridLayer.eachLayer((layer: any) => {
            const feature = layer.feature
            if (feature && layer !== selectedCell) {
              // Ne redessiner que les mailles visibles (qui passent les filtres)
              if (featureMatchesFilters(feature, currentFilters)) {
                layer.setStyle(styleFeature(feature))
              }
            }
          })
        }
      })
      
      // Chantier A - Réinitialiser le survol lors du déplacement
      map.on('movestart', () => {
        if (hoveredCell && hoveredCell !== selectedCell) {
          hoveredCell.setStyle(getDefaultStyle((hoveredCell as any).feature))
          hoveredCell = null
        }
      })
      
      ;(window as any)._gridEventsAttached = true
      console.log('[loadGrid] Événements zoomend/movestart attachés (une seule fois)')
    }

    buildAdmFilters(gj)
    lastBounds = map.getBounds()
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur de chargement')
  } finally {
    isLoadingGrid = false
  }
}

// Fonction désactivée - Les sondages sont maintenant représentés par la couleur des mailles
// async function loadSondages() { ... }

// Fonction vide pour compatibilité
;(window as any).reloadSondages = () => {
  console.log('[reloadSondages] Fonction désactivée - les sondages sont affichés via les mailles')
}

// Exposer loadGrid, setGridLevel et currentGridLevel globalement
;(window as any).loadGrid = loadGrid
;(window as any).setGridLevel = (level: '2km' | '28km') => {
  console.log('[setGridLevel] Changement de niveau:', currentGridLevel, '->', level)
  currentGridLevel = level
  loadGrid()
}
;(window as any).getCurrentGridLevel = () => currentGridLevel

// Connecter le sélecteur de grille
const gridLevelSelect = document.getElementById('gridLevelSelect') as HTMLSelectElement
if (gridLevelSelect) {
  gridLevelSelect.addEventListener('change', (e) => {
    const level = (e.target as HTMLSelectElement).value as '2km' | '28km'
    ;(window as any).setGridLevel(level)
    toast(`Grille ${level} chargée`, 'ok')
  })
  console.log('[INIT] Sélecteur grille connecté')
}

// Charger la grille immédiatement au démarrage
setTimeout(() => {
  loadGrid(false)
}, 100)

// Chargement paresseux DÉSACTIVÉ - on charge tout au démarrage
// Commenté pour revenir au comportement original (chargement total)
// let moveTimeout: number | null = null
// map.on('moveend', () => {
//   if (moveTimeout) clearTimeout(moveTimeout)
//   moveTimeout = window.setTimeout(() => {
//     const currentBounds = map.getBounds()
//     if (!lastBounds || !currentBounds.equals(lastBounds)) {
//       loadGrid(true)
//     }
//   }, 500)
// })

// --- ADM filters avec cascades ---
let allFeatures: any[] = []
let admData: {
  adm2ByAdm1: Map<string, Set<string>>,
  adm3ByAdm2: Map<string, Set<string>>
} = {
  adm2ByAdm1: new Map(),
  adm3ByAdm2: new Map()
}

function buildAdmFilters(gj: any) {
  allFeatures = gj.features
  console.log('[buildAdmFilters] Constru ction des filtres ADM avec cascades pour', allFeatures.length, 'mailles')

  // Construire la structure de données hiérarchique
  const adm1Set = new Set<string>()

  allFeatures.forEach((f: any) => {
    const adm1 = f.properties?.adm1_name
    const adm2 = f.properties?.adm2_name
    const adm3 = f.properties?.adm3_name

    if (adm1) {
      adm1Set.add(adm1)

      // Map ADM2 par ADM1
      if (adm2) {
        if (!admData.adm2ByAdm1.has(adm1)) {
          admData.adm2ByAdm1.set(adm1, new Set())
        }
        admData.adm2ByAdm1.get(adm1)!.add(adm2)

        // Map ADM3 par ADM2 (avec clé unique adm1|adm2)
        if (adm3) {
          const key = `${adm1}|${adm2}`
          if (!admData.adm3ByAdm2.has(key)) {
            admData.adm3ByAdm2.set(key, new Set())
          }
          admData.adm3ByAdm2.get(key)!.add(adm3)
        }
      }
    }
  })

  // Remplir ADM1 (toutes les régions)
  const adm1Select = document.getElementById('filterAdm1') as HTMLSelectElement
  if (adm1Select) {
    adm1Select.innerHTML = '<option value="">— toutes régions —</option>'
    ;[...adm1Set].sort().forEach(v => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      adm1Select.appendChild(opt)
    })
    console.log('[buildAdmFilters] ADM1:', adm1Set.size, 'régions')
  }

  // Event listener ADM1 → filtre ADM2
  const adm1El = document.getElementById('filterAdm1') as HTMLSelectElement
  const adm2El = document.getElementById('filterAdm2') as HTMLSelectElement
  const adm3El = document.getElementById('filterAdm3') as HTMLSelectElement

  if (adm1El) {
    adm1El.onchange = () => {
      const selectedAdm1 = adm1El.value
      console.log('[ADM1 change]', selectedAdm1)

      // Réinitialiser ADM2 et ADM3
      if (adm2El) {
        adm2El.innerHTML = '<option value="">— toutes préfectures —</option>'
        adm2El.disabled = !selectedAdm1

        if (selectedAdm1 && admData.adm2ByAdm1.has(selectedAdm1)) {
          const adm2List = [...admData.adm2ByAdm1.get(selectedAdm1)!].sort()
          adm2List.forEach(adm2 => {
            const opt = document.createElement('option')
            opt.value = adm2
            opt.textContent = adm2
            adm2El.appendChild(opt)
          })
          console.log('[ADM2 populated]', adm2List.length, 'préfectures pour', selectedAdm1)
        }
      }

      if (adm3El) {
        adm3El.innerHTML = '<option value="">— toutes communes —</option>'
        adm3El.disabled = true
      }

      applyFilters()
    }
  }

  // Event listener ADM2 → filtre ADM3
  if (adm2El) {
    adm2El.onchange = () => {
      const selectedAdm1 = adm1El?.value || ''
      const selectedAdm2 = adm2El.value
      console.log('[ADM2 change]', selectedAdm2)

      // Réinitialiser ADM3
      if (adm3El) {
        adm3El.innerHTML = '<option value="">— toutes communes —</option>'
        adm3El.disabled = !selectedAdm2

        if (selectedAdm1 && selectedAdm2) {
          const key = `${selectedAdm1}|${selectedAdm2}`
          if (admData.adm3ByAdm2.has(key)) {
            const adm3List = [...admData.adm3ByAdm2.get(key)!].sort()
            adm3List.forEach(adm3 => {
              const opt = document.createElement('option')
              opt.value = adm3
              opt.textContent = adm3
              adm3El.appendChild(opt)
            })
            console.log('[ADM3 populated]', adm3List.length, 'communes pour', key)
          }
        }
      }

      applyFilters()
    }
  }

  // Event listener ADM3
  if (adm3El) {
    adm3El.onchange = () => applyFilters()
  }

  // Attach data filter handlers
  safeAddEventListener('filterHasData', 'change', () => applyFilters())
  safeAddEventListener('filterNoData', 'change', () => applyFilters())
  safeAddEventListener('filterMinSondages', 'input', () => applyFilters())

  // Reset button
  safeAddEventListener('resetFilters', 'click', () => {
    const adm1El = document.getElementById('filterAdm1') as HTMLSelectElement
    const adm2El = document.getElementById('filterAdm2') as HTMLSelectElement
    const adm3El = document.getElementById('filterAdm3') as HTMLSelectElement
    if (adm1El) adm1El.value = ''
    if (adm2El) adm2El.value = ''
    if (adm3El) adm3El.value = ''
    ;(document.getElementById('filterHasData') as HTMLInputElement).checked = true
    ;(document.getElementById('filterNoData') as HTMLInputElement).checked = true
    ;(document.getElementById('filterMinSondages') as HTMLInputElement).value = '0'
    applyFilters()
  })

  // Initial stats - appeler applyFilters pour calculer toutes les stats y compris par type d'essai
  applyFilters()
}

// Fonction applyFilters déplacée plus bas avec les filtres avancés

/**
 * Met à jour les statistiques filtrées (utilise l'état centralisé)
 */
function updateFilterStats() {
  // Synchroniser les filtres depuis le DOM
  syncFiltersFromDOM()
  
  // Filtrer les features avec l'état centralisé
  const filtered = allFeatures.filter((f: any) => featureMatchesFilters(f, currentFilters))
  
  // Calculer et afficher les stats
  const stats = computeFilteredStats(filtered)
  updateStatsDOM(stats)
}

// --- Button handlers ---
safeAddEventListener('getBtn', 'click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  setStatus('Requête en cours…')
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}`)
    const out = document.getElementById('json')
    if (!res.ok) {
      if (out) out.textContent = JSON.stringify({ status: res.status, error: await res.text() }, null, 2)
      toast('Erreur GET', 'err')
      setStatus('Erreur')
      return
    }
    const data = await res.json()
    if (out) out.textContent = JSON.stringify(data, null, 2)
    toast('OK')
    setStatus('OK')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur')
  }
})

safeAddEventListener('recomputeBtn', 'click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  setStatus('Recalcul IDW…')
  try {
    const res = await fetch(`${API_GEO}/grid/recompute/${encodeURIComponent(code)}`, { method: 'POST' })
    const out = document.getElementById('json')
    if (!res.ok) {
      if (out) out.textContent = JSON.stringify({ status: res.status, error: await res.text() }, null, 2)
      toast('Erreur compute', 'err')
      setStatus('Erreur')
      return
    }
    const data = await res.json()
    if (out) out.textContent = JSON.stringify(data, null, 2)
    toast('Recalcul OK')
    setStatus('OK')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur')
  }
})

safeAddEventListener('shapeBtn', 'click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}/shape`)
    if (!res.ok) {
      toast('Erreur shape', 'err')
      return
    }
    const gj = await res.json()
    const out = document.getElementById('json')
    if (out) out.textContent = JSON.stringify(gj, null, 2)
    
    if (shapeLayer) shapeLayer.remove()
    shapeLayer = L.geoJSON(gj, { style: { color: '#3aa6ff', weight: 2, fillOpacity: 0.1 } }).addTo(map)
    const b = shapeLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.2))
    toast('Shape chargée')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// --- Export functions ---
async function getCurrentGridData() {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code de maille', 'err')
    return null
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

safeAddEventListener('exportGeoJSON', 'click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}/shape`)
    if (!res.ok) {
      toast('Export impossible', 'err')
      return
    }
    const gj = await res.json()
    downloadFile(JSON.stringify(gj, null, 2), `${code}.geojson`, 'application/geo+json')
    toast('GeoJSON exporté')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

safeAddEventListener('exportMarkdown', 'click', async () => {
  const data = await getCurrentGridData()
  if (!data) {
    toast('Impossible de récupérer les données', 'err')
    return
  }
  
  const code = data.code
  const md = `# Maille ${code}

## Informations générales

- **Code**: ${code}
- **BBox**: [${data.bbox.map((v: number) => v.toFixed(6)).join(', ')}]
- **Région**: ${data.adm1_name || 'N/A'}
- **Préfecture**: ${data.adm2_name || 'N/A'}
- **Commune**: ${data.adm3_name || 'N/A'}

## Statistiques

- **Sondages**: ${data.summary?.n_sondages || 0}
- **Essais**: ${data.summary?.n_essais || 0}

### Répartition par type d'essai

${Object.entries(data.summary?.by_type || {}).map(([type, count]) => `- **${type}**: ${count}`).join('\\n')}

## IDW (Inverse Distance Weighting)

${data.stats?.idw ? `- **Type**: ${data.stats.idw.type}
- **Valeur**: ${data.stats.idw.value.toFixed(2)}
- **Puissance**: ${data.stats.idw.p}
- **Échantillons**: ${data.stats.samples}` : '_Pas de données IDW disponibles_'}

---

_Généré le ${new Date().toLocaleString('fr-FR')}_
`
  
  downloadFile(md, `${code}.md`, 'text/markdown')
  toast('Markdown exporté')
})

safeAddEventListener('exportPDF', 'click', async () => {
  const data = await getCurrentGridData()
  if (!data) {
    toast('Impossible de récupérer les données', 'err')
    return
  }
  
  // Génération PDF simple (HTML to PDF via print)
  const code = data.code
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast('Popup bloquée', 'err')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Maille ${code}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #0b1220; }
        h2 { color: #3aa6ff; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Maille ${code}</h1>
      <h2>Informations générales</h2>
      <table>
        <tr><th>Code</th><td>${code}</td></tr>
        <tr><th>Région</th><td>${data.adm1_name || 'N/A'}</td></tr>
        <tr><th>Préfecture</th><td>${data.adm2_name || 'N/A'}</td></tr>
        <tr><th>Commune</th><td>${data.adm3_name || 'N/A'}</td></tr>
      </table>
      
      <h2>Statistiques</h2>
      <table>
        <tr><th>Sondages</th><td>${data.summary?.n_sondages || 0}</td></tr>
        <tr><th>Essais</th><td>${data.summary?.n_essais || 0}</td></tr>
      </table>
      
      ${data.stats?.idw ? `
      <h2>IDW</h2>
      <table>
        <tr><th>Type</th><td>${data.stats.idw.type}</td></tr>
        <tr><th>Valeur</th><td>${data.stats.idw.value.toFixed(2)}</td></tr>
        <tr><th>Échantillons</th><td>${data.stats.samples}</td></tr>
      </table>
      ` : '<p><em>Pas de données IDW disponibles</em></p>'}
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Généré le ${new Date().toLocaleString('fr-FR')}
      </p>
    </body>
    </html>
  `)
  
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    toast('PDF généré (impression)')
  }, 500)
})

safeAddEventListener('exportAll', 'click', async () => {
  toast('Export complet en cours...', 'ok')
  // Pour un vrai export ZIP, il faudrait une bibliothèque comme JSZip
  // Pour l'instant, on exporte séquentiellement
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  
  // Export GeoJSON
  const geoBtn = document.getElementById('exportGeoJSON')
  if (geoBtn) geoBtn.dispatchEvent(new Event('click'))
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Export Markdown
  const mdBtn = document.getElementById('exportMarkdown')
  if (mdBtn) mdBtn.dispatchEvent(new Event('click'))
  await new Promise(resolve => setTimeout(resolve, 500))
  
  toast('Exports terminés (GeoJSON + MD)')
})

safeAddEventListener('exportAuditCSV', 'click', async () => {
  try {
    const url = `${API_GEO}/audit/export/csv?limit=10000`
    window.open(url, '_blank')
    toast('📊 Export historique lancé')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

safeAddEventListener('exportGeoPackage', 'click', async () => {
  try {
    const bounds = map.getBounds()
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ].join(',')
    
    const adm1 = (document.getElementById('filterAdm1') as HTMLSelectElement).value
    const adm2 = (document.getElementById('filterAdm2') as HTMLSelectElement).value
    const adm3 = (document.getElementById('filterAdm3') as HTMLSelectElement).value
    
    let url = `${API_GEO}/exports/geopackage?bbox=${bbox}`
    if (adm1) url += `&adm1=${encodeURIComponent(adm1)}`
    if (adm2) url += `&adm2=${encodeURIComponent(adm2)}`
    if (adm3) url += `&adm3=${encodeURIComponent(adm3)}`
    
    window.open(url, '_blank')
    toast('📦 Export GeoPackage lancé')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

safeAddEventListener('exportPDFPro', 'click', async () => {
  try {
    const bounds = map.getBounds()
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ].join(',')
    
    const adm1 = (document.getElementById('filterAdm1') as HTMLSelectElement).value
    const adm2 = (document.getElementById('filterAdm2') as HTMLSelectElement).value
    const adm3 = (document.getElementById('filterAdm3') as HTMLSelectElement).value
    
    let url = `${API_GEO}/exports/pdf?bbox=${bbox}`
    if (adm1) url += `&adm1=${encodeURIComponent(adm1)}`
    if (adm2) url += `&adm2=${encodeURIComponent(adm2)}`
    if (adm3) url += `&adm3=${encodeURIComponent(adm3)}`
    
    window.open(url, '_blank')
    toast('📄 Export PDF professionnel lancé')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// Impression de carte haute résolution
safeAddEventListener('printMap', 'click', () => {
  const modal = document.getElementById('printModal')
  if (modal) modal.style.display = 'flex'
})

safeAddEventListener('cancelPrint', 'click', () => {
  const modal = document.getElementById('printModal')
  if (modal) modal.style.display = 'none'
})

safeAddEventListener('confirmPrint', 'click', async () => {
  const format = (document.getElementById('printFormat') as HTMLSelectElement).value
  const orientation = (document.getElementById('printOrientation') as HTMLSelectElement).value
  const scale = (document.getElementById('printScale') as HTMLSelectElement).value
  const dpi = parseInt((document.getElementById('printDPI') as HTMLSelectElement).value)
  const includeLegend = (document.getElementById('printLegend') as HTMLInputElement).checked
  const includeScale = (document.getElementById('printScale2') as HTMLInputElement).checked
  const includeNorth = (document.getElementById('printNorth') as HTMLInputElement).checked
  const includeTitle = (document.getElementById('printTitle') as HTMLInputElement).checked
  
  const modal = document.getElementById('printModal')
  if (modal) modal.style.display = 'none'
  toast('🖨️ Génération de la carte en cours...', 'ok')
  
  try {
    // Calculer les dimensions en pixels selon le format et DPI
    const formats: Record<string, [number, number]> = {
      'A4': [210, 297],
      'A3': [297, 420],
      'Letter': [216, 279]
    }
    
    let [width, height] = formats[format]
    if (orientation === 'landscape') {
      [width, height] = [height, width]
    }
    
    // Convertir mm en pixels (1 inch = 25.4 mm)
    const widthPx = Math.round(width / 25.4 * dpi)
    const heightPx = Math.round(height / 25.4 * dpi)
    
    // Créer un canvas pour la carte
    const canvas = document.createElement('canvas')
    canvas.width = widthPx
    canvas.height = heightPx
    const ctx = canvas.getContext('2d')!
    
    // Fond blanc
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, widthPx, heightPx)
    
    // Titre
    if (includeTitle) {
      ctx.fillStyle = '#0b1220'
      ctx.font = `bold ${Math.round(dpi / 4)}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText('Atlas Géotechnique du Togo', widthPx / 2, dpi / 2)
      
      ctx.font = `${Math.round(dpi / 6)}px Arial`
      ctx.fillStyle = '#666'
      const date = new Date().toLocaleDateString('fr-FR')
      ctx.fillText(`Généré le ${date}`, widthPx / 2, dpi / 2 + dpi / 4)
    }
    
    // Capturer la carte (simplification - dans un vrai système, utiliser leaflet-image ou mapbox-gl-export)
    const mapContainer = document.getElementById('map')!
    const mapCanvas = await html2canvas(mapContainer, {
      width: widthPx - dpi,
      height: heightPx - dpi * 1.5,
      scale: dpi / 96,
      useCORS: true,
      logging: false
    })
    
    ctx.drawImage(mapCanvas, dpi / 2, dpi, widthPx - dpi, heightPx - dpi * 1.5)
    
    // Légende
    if (includeLegend) {
      const legendX = widthPx - dpi * 2
      const legendY = heightPx - dpi * 1.2
      
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(legendX, legendY, dpi * 1.8, dpi * 0.8)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.strokeRect(legendX, legendY, dpi * 1.8, dpi * 0.8)
      
      ctx.fillStyle = '#0b1220'
      ctx.font = `bold ${Math.round(dpi / 8)}px Arial`
      ctx.textAlign = 'left'
      ctx.fillText('Légende', legendX + 10, legendY + 25)
      
      ctx.fillStyle = '#e85d68'
      ctx.fillRect(legendX + 10, legendY + 35, 20, 20)
      ctx.fillStyle = '#333'
      ctx.font = `${Math.round(dpi / 10)}px Arial`
      ctx.fillText('Avec données', legendX + 40, legendY + 50)
      
      ctx.fillStyle = '#cfd8e3'
      ctx.fillRect(legendX + 10, legendY + 60, 20, 20)
      ctx.fillText('Sans données', legendX + 40, legendY + 75)
    }
    
    // Échelle graphique
    if (includeScale) {
      const scaleX = dpi / 2
      const scaleY = heightPx - dpi / 2
      const scaleWidth = dpi * 2
      
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(scaleX, scaleY - 30, scaleWidth, 50)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.strokeRect(scaleX, scaleY, scaleWidth, 10)
      
      ctx.fillStyle = '#333'
      ctx.fillRect(scaleX, scaleY, scaleWidth / 2, 10)
      
      ctx.fillStyle = '#0b1220'
      ctx.font = `${Math.round(dpi / 10)}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText('0', scaleX, scaleY + 25)
      ctx.fillText('5 km', scaleX + scaleWidth / 2, scaleY + 25)
      ctx.fillText('10 km', scaleX + scaleWidth, scaleY + 25)
    }
    
    // Rose des vents
    if (includeNorth) {
      const northX = widthPx - dpi / 2
      const northY = dpi * 1.5
      const northSize = dpi / 3
      
      // Flèche Nord
      ctx.fillStyle = '#3aa6ff'
      ctx.beginPath()
      ctx.moveTo(northX, northY - northSize)
      ctx.lineTo(northX - northSize / 3, northY)
      ctx.lineTo(northX + northSize / 3, northY)
      ctx.closePath()
      ctx.fill()
      
      ctx.fillStyle = '#0b1220'
      ctx.font = `bold ${Math.round(dpi / 8)}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText('N', northX, northY + northSize / 2)
    }
    
    // Télécharger l'image
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `atlas_carte_${format}_${orientation}_${dpi}dpi.png`
        a.click()
        URL.revokeObjectURL(url)
        toast('✅ Carte exportée avec succès', 'ok')
      }
    }, 'image/png')
    
  } catch (e: any) {
    console.error('Erreur impression:', e)
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// Fonction html2canvas simplifiée (à remplacer par la vraie bibliothèque)
async function html2canvas(element: HTMLElement, options: any): Promise<HTMLCanvasElement> {
  // Simulation - dans un vrai projet, utiliser la bibliothèque html2canvas
  const canvas = document.createElement('canvas')
  canvas.width = options.width || 800
  canvas.height = options.height || 600
  const ctx = canvas.getContext('2d')!
  
  // Fond de carte simplifié
  ctx.fillStyle = '#e0e7ee'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  ctx.fillStyle = '#0b1220'
  ctx.font = '20px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Carte Atlas Géotechnique', canvas.width / 2, canvas.height / 2)
  ctx.font = '14px Arial'
  ctx.fillText('(Aperçu simplifié - installer html2canvas pour export réel)', canvas.width / 2, canvas.height / 2 + 30)
  
  return canvas
}

safeAddEventListener('zoomTgBtn', 'click', () => {
  if (gridLayer) {
    const b = gridLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.1))
  } else {
    map.fitBounds([[6.1, 0.7], [11.2, 1.8]])
  }
})

// --- Survey Management v1.2.0 ---
const surveyDrawer = document.getElementById('surveyDrawer')
const drawerTitle = document.getElementById('drawerTitle')
const surveyForm = document.getElementById('surveyForm')
const surveyListView = document.getElementById('surveyListView')
let currentSurveyId: string | null = null
let surveyMarkers: L.Marker[] = []
let highlightedLayer: any = null

// État global pour le nouveau formulaire
let tests: Array<{type: string, value: number, depth_m: number}> = []
let selectedAdm1 = '', selectedAdm2 = '', selectedAdm3 = ''

// Highlight maille avec animation
function highlightMaille(lat: number, lon: number) {
  if (!gridLayer) return
  
  // Trouver la maille contenant le point
  let targetLayer: any = null
  gridLayer.eachLayer((layer: any) => {
    const bounds = layer.getBounds()
    if (bounds.contains([lat, lon])) {
      targetLayer = layer
    }
  })
  
  if (!targetLayer) return
  
  // Retirer ancien highlight
  if (highlightedLayer && gridLayer) {
    gridLayer.resetStyle(highlightedLayer)
  }
  
  // Appliquer animation
  targetLayer.setStyle({
    color: '#3aa6ff',
    weight: 3,
    fillOpacity: 0.3
  })
  
  // Animer 5 fois
  let count = 0
  const interval = setInterval(() => {
    if (count >= 10) {
      clearInterval(interval)
      if (gridLayer) gridLayer.resetStyle(targetLayer)
      highlightedLayer = null
      return
    }
    
    if (count % 2 === 0) {
      targetLayer.setStyle({
        color: '#ff3a6f',
        weight: 5,
        fillOpacity: 0.6
      })
    } else {
      targetLayer.setStyle({
        color: '#3aa6ff',
        weight: 3,
        fillOpacity: 0.3
      })
    }
    count++
  }, 300)
  
  highlightedLayer = targetLayer
}

function openDrawer(mode: 'create' | 'list' | 'import') {
  if (!surveyDrawer) return
  surveyDrawer.classList.add('open')
  const importView = document.getElementById('importCsvView')
  
  if (mode === 'create') {
    if (drawerTitle) drawerTitle.textContent = 'Nouveau sondage'
    if (surveyForm) surveyForm.style.display = 'block'
    if (surveyListView) surveyListView.style.display = 'none'
    if (importView) importView.style.display = 'none'
    resetSurveyForm()
  } else if (mode === 'import') {
    if (drawerTitle) drawerTitle.textContent = '📥 Import CSV/Bulk'
    if (surveyForm) surveyForm.style.display = 'none'
    if (surveyListView) surveyListView.style.display = 'none'
    if (importView) importView.style.display = 'block'
  } else {
    if (drawerTitle) drawerTitle.textContent = 'Liste des sondages'
    if (surveyForm) surveyForm.style.display = 'none'
    if (surveyListView) surveyListView.style.display = 'block'
    if (importView) importView.style.display = 'none'
    loadSurveyList()
  }
}

function closeDrawer() {
  if (surveyDrawer) surveyDrawer.classList.remove('open')
  currentSurveyId = null
}

function resetSurveyForm() {
  ;(document.getElementById('surveyCode') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyDate') as HTMLInputElement).value = ''
  ;(document.getElementById('surveySource') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyOperator') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyLon') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyLat') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyNotes') as HTMLTextAreaElement).value = ''
  ;(document.getElementById('locationMode') as HTMLSelectElement).value = 'exact'
  tests = []
  selectedAdm1 = ''
  selectedAdm2 = ''
  selectedAdm3 = ''
  renderTestsTable()
  updateSummary()
  toggleLocationSections()
  currentSurveyId = null
}

// Toggle sections selon mode de localisation
function toggleLocationSections() {
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  document.getElementById('coordsSection')!.style.display = mode === 'exact' ? 'block' : 'none'
  document.getElementById('admSection')!.style.display = mode !== 'exact' ? 'block' : 'none'
  document.getElementById('centroidOption')!.style.display = mode === 'centroid' ? 'block' : 'none'
}

// Charger ADM1
async function loadAdm1() {
  try {
    const res = await fetch(`${API_GEO}/adm1`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm1') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM1:', e)
  }
}

// Render tests table
function renderTestsTable() {
  const tbody = document.getElementById('testsTableBody')!
  if (tests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px">Aucun essai</td></tr>'
  } else {
    tbody.innerHTML = tests.map((t, i) => `
      <tr style="border:1px solid #22304d">
        <td style="padding:8px">${t.type}</td>
        <td style="padding:8px">${t.value}</td>
        <td style="padding:8px">${t.depth_m}</td>
        <td style="padding:8px;text-align:center">
          <button onclick="window.deleteTest(${i})" style="background:transparent;border:1px solid #6b1b2c;color:var(--err);padding:4px 8px;font-size:11px;cursor:pointer;border-radius:4px">🗑️</button>
        </td>
      </tr>
    `).join('')
  }
  updateSummary()
}

// Fonction globale pour supprimer un essai
(window as any).deleteTest = (index: number) => {
  tests.splice(index, 1)
  renderTestsTable()
}

// Mettre à jour le résumé
function updateSummary() {
  const summaryAdm1 = document.getElementById('summaryAdm1')
  const summaryAdm2 = document.getElementById('summaryAdm2')
  const summaryAdm3 = document.getElementById('summaryAdm3')
  const summaryTests = document.getElementById('summaryTests')
  
  if (summaryAdm1) summaryAdm1.textContent = selectedAdm1 || '—'
  if (summaryAdm2) summaryAdm2.textContent = selectedAdm2 || '—'
  if (summaryAdm3) summaryAdm3.textContent = selectedAdm3 || '—'
  if (summaryTests) summaryTests.textContent = tests.length.toString()
  
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  const alerts = document.getElementById('summaryAlerts')
  
  if (mode === 'exact') {
    const lon = parseFloat((document.getElementById('surveyLon') as HTMLInputElement).value)
    const lat = parseFloat((document.getElementById('surveyLat') as HTMLInputElement).value)
    if (!isNaN(lon) && !isNaN(lat)) {
      // Localiser la maille
      fetch(`${API_GEO}/grid/locate?lon=${lon}&lat=${lat}`)
        .then(r => r.json())
        .then(data => {
          const mailleEl = document.getElementById('summaryMaille')
          if (mailleEl) mailleEl.textContent = data.code || '—'
          selectedAdm1 = data.adm1_name || ''
          selectedAdm2 = data.adm2_name || ''
          selectedAdm3 = data.adm3_name || ''
          
          const summaryAdm1El = document.getElementById('summaryAdm1')
          const summaryAdm2El = document.getElementById('summaryAdm2')
          const summaryAdm3El = document.getElementById('summaryAdm3')
          if (summaryAdm1El) summaryAdm1El.textContent = selectedAdm1 || '—'
          if (summaryAdm2El) summaryAdm2El.textContent = selectedAdm2 || '—'
          if (summaryAdm3El) summaryAdm3El.textContent = selectedAdm3 || '—'
          if (alerts) alerts.innerHTML = ''
          
          // Vérifier les doublons à proximité
          if (alerts) checkNearbyDuplicates(lon, lat, alerts)
        })
        .catch(() => {
          const mailleEl = document.getElementById('summaryMaille')
          if (mailleEl) mailleEl.textContent = '—'
          if (alerts) alerts.innerHTML = '<div style="color:var(--err)">⚠️ Point hors grille</div>'
        })
    }
  } else {
    const mailleEl = document.getElementById('summaryMaille')
    if (mailleEl) mailleEl.textContent = mode === 'unknown' ? 'N/A' : '(calculé après création)'
    if (alerts) alerts.innerHTML = mode === 'unknown' ? '<div style="color:var(--warn)">ℹ️ Sondage sans coordonnées</div>' : ''
  }
}

// Create survey v1.2.0
safeAddEventListener('saveSurveyBtn', 'click', async () => {
  // Si on est en mode édition, appeler la fonction update
  if (currentSurveyId) {
    await updateSurveySubmit()
    return
  }
  
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  const code = (document.getElementById('surveyCode') as HTMLInputElement).value.trim()
  const date = (document.getElementById('surveyDate') as HTMLInputElement).value
  const source = (document.getElementById('surveySource') as HTMLInputElement).value.trim()
  const operator = (document.getElementById('surveyOperator') as HTMLInputElement).value
  const notes = (document.getElementById('surveyNotes') as HTMLTextAreaElement).value
  
  // Validation champs obligatoires
  const errors: string[] = []
  if (!code) errors.push('Code sondage')
  if (!source) errors.push('Source')
  if (tests.length === 0) errors.push('Au moins 1 essai')
  
  if (errors.length > 0) {
    toast(`❌ Champs obligatoires manquants: ${errors.join(', ')}`, 'err')
    return
  }
  
  // Construire le payload
  let payload: any = {
    survey: { code, date, source, operator, notes },
    tests,
    snap_to_grid: true
  }
  
  if (mode === 'exact') {
    const lon = parseFloat((document.getElementById('surveyLon') as HTMLInputElement).value)
    const lat = parseFloat((document.getElementById('surveyLat') as HTMLInputElement).value)
    if (isNaN(lon) || isNaN(lat)) {
      toast('Coordonnées requises', 'err')
      return
    }
    payload.location = { lon, lat }
  } else if (mode === 'centroid') {
    const adm3 = (document.getElementById('selectAdm3') as HTMLSelectElement).value
    if (!adm3) {
      toast('Sélectionner une commune', 'err')
      return
    }
    payload.commune_id = `ADM3-${adm3}`
    payload.use_commune_centroid = (document.getElementById('useCentroid') as HTMLInputElement).checked
  }
  // mode 'unknown': pas de location ni commune_id
  
  try {
    const res = await fetch(`${API_GEO}/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      const err = await res.json()
      toast(`Erreur: ${err.error}`, 'err')
      return
    }
    
    const data = await res.json()
    toast(`✅ Sondage créé: ${data.sondage_id.substring(0, 8)}... (${data.essais_count} essais, maille: ${data.maille_code || 'N/A'})`)
    
    // NE PAS fermer le drawer, juste réinitialiser le formulaire
    resetSurveyForm()
    loadGrid()
    
    // Message de confirmation convivial
    const summaryDiv = document.getElementById('surveySummary')
    if (summaryDiv) summaryDiv.innerHTML = `
      <div style="background: var(--ok); color: white; padding: 12px; border-radius: 6px; margin-top: 12px;">
        <div style="font-weight: bold; margin-bottom: 6px;">✅ Sondage enregistré avec succès !</div>
        <div style="font-size: 0.9em; opacity: 0.9;">
          ID: ${data.sondage_id.substring(0, 13)}...<br>
          Maille: ${data.maille_code || 'N/A'}<br>
          Essais: ${data.essais_count}
        </div>
      </div>
    `
    setTimeout(() => updateSummary(), 3000)
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

safeAddEventListener('cancelSurveyBtn', 'click', closeDrawer)
safeAddEventListener('closeDrawer', 'click', closeDrawer)

// Event listeners pour le formulaire
safeAddEventListener('locationMode', 'change', () => {
  toggleLocationSections()
  updateSummary()
})

safeAddEventListener('surveyLon', 'input', updateSummary)
safeAddEventListener('surveyLat', 'input', updateSummary)

// Cascade ADM2
safeAddEventListener('selectAdm1', 'change', async (e) => {
  const adm1 = (e.target as HTMLSelectElement).value
  selectedAdm1 = adm1
  selectedAdm2 = ''
  selectedAdm3 = ''
  
  if (!adm1) {
    ;(document.getElementById('selectAdm2') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    ;(document.getElementById('selectAdm3') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    updateSummary()
    return
  }
  
  try {
    const res = await fetch(`${API_GEO}/adm2?adm1=${encodeURIComponent(adm1)}`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm2') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM2:', e)
  }
  
  updateSummary()
})

// Cascade ADM3
safeAddEventListener('selectAdm2', 'change', async (e) => {
  const adm2 = (e.target as HTMLSelectElement).value
  selectedAdm2 = adm2
  selectedAdm3 = ''
  
  if (!adm2) {
    ;(document.getElementById('selectAdm3') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    updateSummary()
    return
  }
  
  try {
    const res = await fetch(`${API_GEO}/adm3?adm2=${encodeURIComponent(adm2)}`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm3') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM3:', e)
  }
  
  updateSummary()
})

safeAddEventListener('selectAdm3', 'change', (e) => {
  selectedAdm3 = (e.target as HTMLSelectElement).value
  updateSummary()
})

// Ajouter essai avec dropdown
safeAddEventListener('addTestBtn', 'click', () => {
  const tbody = document.getElementById('testsTableBody')
  if (!tbody) return
  
  // Créer une nouvelle ligne avec dropdown
  const row = document.createElement('tr')
  row.style.background = '#0f172a'
  row.style.border = '1px solid #22304d'
  row.innerHTML = `
    <td style="padding:8px">
      <select class="test-type-select" style="width:100%;padding:6px;border-radius:4px;border:1px solid #22304d;background:#0a1018;color:var(--text);font-size:12px">
        <option value="">-- Type --</option>
        <option value="SPT_N">SPT-N</option>
        <option value="qc">qc (MPa)</option>
      </select>
    </td>
    <td style="padding:8px">
      <input type="number" class="test-value-input" placeholder="Valeur" step="0.1" style="width:100%;padding:6px;border-radius:4px;border:1px solid #22304d;background:#0a1018;color:var(--text);font-size:12px" />
    </td>
    <td style="padding:8px">
      <input type="number" class="test-depth-input" placeholder="Prof." step="0.5" style="width:100%;padding:6px;border-radius:4px;border:1px solid #22304d;background:#0a1018;color:var(--text);font-size:12px" />
    </td>
    <td style="padding:8px;text-align:center">
      <button class="btn-add-test" style="background:var(--ok);border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px">✓</button>
      <button class="btn-cancel-test" style="background:var(--err);border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;margin-left:4px">✕</button>
    </td>
  `
  tbody.appendChild(row)
  
  // Bouton ajouter
  row.querySelector('.btn-add-test')!.addEventListener('click', () => {
    const type = (row.querySelector('.test-type-select') as HTMLSelectElement).value
    const valueStr = (row.querySelector('.test-value-input') as HTMLInputElement).value
    const depthStr = (row.querySelector('.test-depth-input') as HTMLInputElement).value
    
    if (!type || !valueStr || !depthStr) {
      toast('Tous les champs sont requis', 'err')
      return
    }
    
    const value = parseFloat(valueStr)
    const depth_m = parseFloat(depthStr)
    
    // Validation
    if (type === 'SPT_N' && (value < 0 || value > 100 || value % 1 !== 0)) {
      toast('SPT_N invalide (entier 0-100)', 'err')
      return
    }
    if (type === 'qc' && (value < 0.1 || value > 50)) {
      toast('qc invalide (0.1-50 MPa)', 'err')
      return
    }
    if (depth_m < 0.5 || depth_m > 60) {
      toast('Profondeur invalide (0.5-60 m)', 'err')
      return
    }
    
    tests.push({type, value, depth_m})
    tbody.removeChild(row)
    renderTestsTable()
    toast('✓ Essai ajouté', 'ok')
  })
  
  // Bouton annuler
  row.querySelector('.btn-cancel-test')!.addEventListener('click', () => {
    tbody.removeChild(row)
  })
})

// Note: newSurveyBtn est maintenant géré par le dropdown dans right-panel.ts
// L'ancien listener est supprimé pour éviter les conflits

// Initialiser le formulaire géotechnique
const geotechForm = new GeotechnicalFormManager(
  API_GEO,
  (response) => {
    console.log('[GEOTECH] Sondage créé:', response)
    toast(`✅ Sondage ${response.code} créé avec succès! (${response.n_essais} essais, ${response.n_classifications} classifications)`, 'ok')
    // Recharger la grille si on est sur une maille
    if (codeInput.value) {
      setTimeout(() => {
        const getBtn = document.getElementById('getBtn')
        if (getBtn) getBtn.click()
      }, 500)
    }
  },
  (error) => {
    console.error('[GEOTECH] Erreur:', error)
    toast(`❌ Erreur: ${error}`, 'err')
  }
)

// Exposer pour le modal Sondages
;(window as any).geotechnicalFormManager = geotechForm

// Écouter l'événement custom pour ouvrir le formulaire géotechnique (depuis dropdown)
window.addEventListener('open-geotech-form', () => {
  console.log('[MAIN] Ouverture formulaire géotechnique')
  geotechForm.initForm('geotechFormContainer')
})

// Initialiser le geocode manager
const geocodeManager = new GeocodeManager(API_GEO)
const suggestionsPanel = new SuggestionsPanel(API_GEO)

// Bouton pour ouvrir le geocode manager
safeAddEventListener('geocodeSurveysBtn', 'click', () => {
  geocodeManager.renderUI(
    'geocodeContainer',
    (result) => {
      console.log('[GEOCODE] Sondage géocodé:', result)
      toast(`✅ Sondage ${result.code} géocodé avec succès!`, 'ok')
      // Recharger la grille
      loadGrid()
      // Recharger la fiche si on est sur une maille
      if (codeInput.value) {
        setTimeout(() => {
          const getBtn = document.getElementById('getBtn')
          if (getBtn) getBtn.click()
        }, 500)
      }
    },
    (error) => {
      console.error('[GEOCODE] Erreur:', error)
      toast(`❌ Erreur: ${error}`, 'err')
    }
  )
})

// Bouton pour ouvrir le panel de suggestions
safeAddEventListener('suggestionsBtn', 'click', () => {
  suggestionsPanel.renderUI(
    'suggestionsContainer',
    (msg) => {
      console.log('[SUGGESTIONS]', msg)
      toast(msg, 'ok')
      // Recharger la grille
      loadGrid()
    },
    (error) => {
      console.error('[SUGGESTIONS] Erreur:', error)
      toast(`❌ Erreur: ${error}`, 'err')
    }
  )
})

// Open drawer for survey list
safeAddEventListener('listSurveysBtn', 'click', () => openDrawer('list'))

// Open drawer for CSV import (old version - deprecated)
// safeAddEventListener('importCsvBtn', 'click', () => openDrawer('import'))

// Open Import Bulk Wizard (new version)
// Event listener sera enregistré dans bootstrap() après initialisation du wizard

// Cancel import
safeAddEventListener('cancelImportBtn', 'click', closeDrawer)

// File input handler
safeAddEventListener('csvFileInput', 'change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  // Check file size (max 50 MB)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    toast(`Fichier trop volumineux (max 50 MB). Taille: ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'err')
    input.value = ''
    return
  }
  
  try {
    // Read file content
    const text = await file.text()
    const csvInput = document.getElementById('csvInput') as HTMLTextAreaElement
    if (csvInput) {
      csvInput.value = text
      toast(`Fichier chargé: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'ok')
    }
  } catch (error) {
    console.error('Erreur lecture fichier:', error)
    toast('Erreur lors de la lecture du fichier', 'err')
    input.value = ''
  }
})

// Process CSV import
safeAddEventListener('processCsvBtn', 'click', async () => {
  const csvText = (document.getElementById('csvInput') as HTMLTextAreaElement).value.trim()
  if (!csvText) {
    toast('Veuillez saisir des données CSV', 'err')
    return
  }
  
  // Parser CSV
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    toast('CSV invalide (minimum 2 lignes)', 'err')
    return
  }
  
  const headers = lines[0].split(',')
  const rows = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const row: any = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim()
    })
    rows.push({
      code: row.code,
      date: row.date,
      source: row.source,
      operator: row.operator,
      lat: parseFloat(row.lat),
      lon: parseFloat(row.lon),
      test_type: row.test_type,
      test_value: parseFloat(row.test_value),
      test_depth_m: parseFloat(row.test_depth_m),
      notes: row.notes
    })
  }
  
  try {
    const res = await fetch(`${API_GEO}/surveys/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    })
    
    if (!res.ok) {
      toast('Erreur import', 'err')
      return
    }
    
    const data = await res.json()
    const resultsDiv = document.getElementById('importResults')!
    resultsDiv.innerHTML = `
      <div style="background: var(--ok); color: white; padding: 12px; border-radius: 6px;">
        <div style="font-weight: bold;">✅ Import terminé !</div>
        <div style="margin-top: 8px;">
          Créés: ${data.created}<br>
          Rejetés: ${data.rejected}
        </div>
      </div>
    `
    
    if (data.errors && data.errors.length > 0) {
      resultsDiv.innerHTML += `
        <div style="background: var(--err); color: white; padding: 12px; border-radius: 6px; margin-top: 8px; max-height: 200px; overflow-y: auto;">
          <div style="font-weight: bold;">Erreurs:</div>
          ${data.errors.map((e: any) => `<div style="margin-top: 4px; font-size: 12px;">Ligne ${e.row}: ${e.error}</div>`).join('')}
        </div>
      `
    }
    
    toast(`✅ Import: ${data.created} créés, ${data.rejected} rejetés`)
    loadGrid()
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// Load survey list
async function loadSurveyList() {
  try {
    const surveys = await httpJSON<Survey[]>(`${API_GEO}/surveys`)
    renderSurveyList(surveys)
  } catch (e: any) {
    toast(e instanceof Error ? `Erreur: ${e.message}` : 'Erreur chargement sondages', 'err')
  }
}

function renderSurveyList(surveys: Survey[]) {
  const list = document.getElementById('surveyList')!
  if (surveys.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Aucun sondage</p>'
    return
  }

  list.innerHTML = surveys.map(s => {
    const code = s.code || `Sondage-${s.id?.substring(0, 8) || '?'}`
    const maille = s.maille_code || '—'
    const lon = typeof s.lon === 'number' ? s.lon.toFixed(4) : '—'
    const lat = typeof s.lat === 'number' ? s.lat.toFixed(4) : '—'
    const depthMin = typeof s.depth_m_min === 'number' ? s.depth_m_min.toFixed(1) : '—'
    const depthMax = typeof s.depth_m_max === 'number' ? s.depth_m_max.toFixed(1) : '—'
    const region = [s.adm1_name, s.adm2_name, s.adm3_name].filter(Boolean).join(' › ')
    const localite = s.localite ?? s.localite_base ?? '-'
    const badges = [
      s.location_mode ? `<span class="tag">${s.location_mode}</span>` : null,
      s.is_geocoded ? '<span class="tag tag-ok">Géocodé</span>' : '<span class="tag tag-warn">À localiser</span>',
      s.deleted_at ? '<span class="tag tag-err">Supprimé</span>' : null,
    ].filter(Boolean).join(' ')

    return `
      <div class="survey-card" data-id="${s.id}">
        <div class="survey-card-header">
          <div class="survey-card-code">${code}</div>
          <div style="font-size:11px;color:var(--muted)">${maille}</div>
        </div>
        <div class="survey-card-meta">
          📍 ${lon}, ${lat}<br>
          📏 ${depthMin} – ${depthMax} m<br>
          ${region ? `📌 ${region}` : ''}<br>
          🏷️ ${localite}
        </div>
        <div class="survey-card-tags">${badges}</div>
        <div style="display:flex;gap:4px;margin-top:8px">
          <button onclick="window.editSurvey('${s.id}')" style="flex:1;padding:6px;background:var(--accent);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px">✏️ Modifier</button>
          <button onclick="window.deleteSurvey('${s.id}', '${code}')" style="flex:1;padding:6px;background:var(--err);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px">🗑️ Supprimer</button>
        </div>
      </div>
    `
  }).join('')

  // Click to view on map
  list.querySelectorAll('.survey-card').forEach(card => {
    card.addEventListener('click', async () => {
      const survey = surveys.find(s => s.id === card.getAttribute('data-id'))
      if (survey && survey.lat && survey.lon) {
        // Zoom et highlight
        map.setView([survey.lat, survey.lon], 15)
        
        // Ajouter un marqueur temporaire
        const tempMarker = L.circleMarker([survey.lat, survey.lon], {
          radius: 12,
          fillColor: '#3aa6ff',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.8,
          className: 'survey-marker-pulse'
        }).addTo(map)
        
        tempMarker.bindPopup(`<b>${survey.code}</b><br>📏 ${survey.depth_m_min || 0}-${survey.depth_m_max || 0}m<br>📌 ${survey.adm1_name || 'N/A'}`).openPopup()
        
        // Retirer après 5s
        setTimeout(() => {
          map.removeLayer(tempMarker)
        }, 5000)
        
        // Vérifier les doublons
        const duplicates = await checkDuplicates(survey.lat, survey.lon, survey.code)
        showDuplicateAlert(duplicates, survey.code)
      }
    })
  })
}

// Search surveys
safeAddEventListener('searchSurveys', 'input', (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase()
  document.querySelectorAll('.survey-card').forEach(card => {
    const text = card.textContent?.toLowerCase() || ''
    ;(card as HTMLElement).style.display = text.includes(query) ? 'block' : 'none'
  })
})

// --- CRUD Update/Delete ---
async function editSurvey(surveyId: string) {
  try {
    const res = await fetch(`${API_GEO}/surveys/${surveyId}`)
    if (!res.ok) {
      toast('Erreur chargement sondage', 'err')
      return
    }
    const survey = await res.json()
    
    openDrawer('create')
    currentSurveyId = surveyId
    if (drawerTitle) drawerTitle.textContent = '✏️ Modifier le sondage'
    
    ;(document.getElementById('surveyCode') as HTMLInputElement).value = survey.code || ''
    ;(document.getElementById('surveyDate') as HTMLInputElement).value = survey.date || ''
    ;(document.getElementById('surveySource') as HTMLInputElement).value = survey.source || ''
    ;(document.getElementById('surveyOperator') as HTMLInputElement).value = survey.operator || ''
    ;(document.getElementById('surveyNotes') as HTMLTextAreaElement).value = survey.notes || ''
    
    if (survey.lon && survey.lat) {
      ;(document.getElementById('surveyLon') as HTMLInputElement).value = survey.lon.toFixed(6)
      ;(document.getElementById('surveyLat') as HTMLInputElement).value = survey.lat.toFixed(6)
    }
    
    const testsRes = await fetch(`${API_GEO}/surveys/${surveyId}/tests`)
    if (testsRes.ok) {
      const testsData = await testsRes.json()
      tests = testsData.map((t: any) => ({
        type: t.test_type,
        value: t.value,
        depth_m: t.depth_m
      }))
      renderTestsTable()
    }
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

async function deleteSurvey(surveyId: string, surveyCode: string) {
  if (!confirm(`Supprimer le sondage ${surveyCode} ?\n\nCette action est irréversible.`)) {
    return
  }
  
  try {
    const res = await fetch(`${API_GEO}/surveys/${surveyId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      toast(`✅ Sondage ${surveyCode} supprimé`)
      loadSurveyList()
      
      // Recharger la grille pour mettre à jour les couleurs
      await loadGrid()
      
      // Si une maille est affichée, recharger ses détails
      const codeValue = codeInput.value.trim()
      if (codeValue) {
        await loadMailleDetails(codeValue)
      }
    } else {
      toast('Erreur suppression', 'err')
    }
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

;(window as any).editSurvey = editSurvey
;(window as any).deleteSurvey = deleteSurvey

async function updateSurveySubmit() {
  const code = (document.getElementById('surveyCode') as HTMLInputElement).value.trim()
  const date = (document.getElementById('surveyDate') as HTMLInputElement).value
  const source = (document.getElementById('surveySource') as HTMLInputElement).value.trim()
  const operator = (document.getElementById('surveyOperator') as HTMLInputElement).value
  const notes = (document.getElementById('surveyNotes') as HTMLTextAreaElement).value
  const lon = parseFloat((document.getElementById('surveyLon') as HTMLInputElement).value)
  const lat = parseFloat((document.getElementById('surveyLat') as HTMLInputElement).value)
  
  if (!source) {
    toast('Source obligatoire', 'err')
    return
  }
  
  try {
    const payload: any = { code, date, source, operator, notes }
    if (!isNaN(lon) && !isNaN(lat)) {
      payload.lon = lon
      payload.lat = lat
    }
    
    const res = await fetch(`${API_GEO}/surveys/${currentSurveyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      toast('Erreur mise à jour', 'err')
      return
    }
    
    toast(`✅ Sondage mis à jour`)
    closeDrawer()
    loadGrid()
    loadSurveyList()
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

// Marqueur de snapping
let snapMarker: L.CircleMarker | null = null

// Map click to create survey avec snapping
map.on('click', async (e: L.LeafletMouseEvent) => {
  if (surveyDrawer && surveyForm && surveyDrawer.classList.contains('open') && surveyForm.style.display !== 'none') {
    let finalLng = e.latlng.lng
    let finalLat = e.latlng.lat
    
    // Trouver la maille contenant le point cliqué
    try {
      const res = await fetch(`${API_GEO}/grid/locate?lon=${finalLng}&lat=${finalLat}`)
      if (res.ok) {
        const maille = await res.json()
        
        // Récupérer le centre de la maille
        const mailleRes = await fetch(`${API_GEO}/grid/${maille.code}/shape`)
        if (mailleRes.ok) {
          const mailleGeoJSON = await mailleRes.json()
          
          // Calculer le centroïde
          if (mailleGeoJSON.geometry && mailleGeoJSON.geometry.coordinates) {
            const coords = mailleGeoJSON.geometry.coordinates[0]
            let sumLng = 0, sumLat = 0, count = 0
            
            coords.forEach((coord: number[]) => {
              sumLng += coord[0]
              sumLat += coord[1]
              count++
            })
            
            const centerLng = sumLng / count
            const centerLat = sumLat / count
            
            // Calculer la distance au centre
            const R = 6371000 // Rayon de la Terre en mètres
            const dLat = (centerLat - finalLat) * Math.PI / 180
            const dLng = (centerLng - finalLng) * Math.PI / 180
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(finalLat * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2)
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            const distance = R * c
            
            // Snapping si distance < 50m
            if (distance < 50) {
              finalLng = centerLng
              finalLat = centerLat
              toast('📍 Sondage aimanté au centre de la maille', 'ok')
              
              // Animation visuelle du snapping
              if (snapMarker) map.removeLayer(snapMarker)
              
              snapMarker = L.circleMarker([finalLat, finalLng], {
                radius: 12,
                color: '#3aa6ff',
                fillColor: '#3aa6ff',
                fillOpacity: 0.4,
                weight: 3
              }).addTo(map)
              
              // Animation pulse
              let pulseCount = 0
              const pulseInterval = setInterval(() => {
                if (pulseCount >= 6) {
                  clearInterval(pulseInterval)
                  if (snapMarker) {
                    map.removeLayer(snapMarker)
                    snapMarker = null
                  }
                  return
                }
                
                if (snapMarker) {
                  if (pulseCount % 2 === 0) {
                    snapMarker.setStyle({ radius: 16, fillOpacity: 0.6 })
                  } else {
                    snapMarker.setStyle({ radius: 12, fillOpacity: 0.4 })
                  }
                }
                pulseCount++
              }, 200)
            }
          }
        }
      }
    } catch (e) {
      console.error('Erreur snapping:', e)
    }
    
    ;(document.getElementById('surveyLon') as HTMLInputElement).value = finalLng.toFixed(6)
    ;(document.getElementById('surveyLat') as HTMLInputElement).value = finalLat.toFixed(6)
    toast('Coordonnées remplies depuis la carte')
    updateSummary()
  }
})

// --- Filtres avancés ---
let currentView = 'default'

document.getElementById('applyFilters')?.addEventListener('click', () => {
  applyFilters()
})

document.getElementById('resetFilters')?.addEventListener('click', () => {
  // Réinitialiser tous les filtres
  (document.getElementById('filterHasData') as HTMLInputElement).checked = true;
  (document.getElementById('filterNoData') as HTMLInputElement).checked = true;
  (document.getElementById('filterMinSondages') as HTMLInputElement).value = '0';
  (document.getElementById('filterAdm1') as HTMLSelectElement).value = '';
  (document.getElementById('filterAdm2') as HTMLSelectElement).value = '';
  (document.getElementById('filterAdm3') as HTMLSelectElement).value = '';

  // Réactiver les selects ADM2 et ADM3 et vider leurs options
  const adm2El = document.getElementById('filterAdm2') as HTMLSelectElement
  const adm3El = document.getElementById('filterAdm3') as HTMLSelectElement
  if (adm2El) {
    adm2El.innerHTML = '<option value="">— toutes préfectures —</option>'
    adm2El.disabled = true
  }
  if (adm3El) {
    adm3El.innerHTML = '<option value="">— toutes communes —</option>'
    adm3El.disabled = true
  }

  applyFilters()
  toast('Filtres réinitialisés', 'ok')
})

/**
 * Applique les filtres à toutes les couches de la carte
 * Utilise l'état centralisé depuis filters-state.ts
 */
function applyFilters() {
  if (!gridLayer) return
  
  // 1. Synchroniser l'état des filtres depuis le DOM
  syncFiltersFromDOM()
  
  // 2. Vider les couches de survol et sélection pour éviter les artefacts
  clearHoverAndSelection()
  
  // 3. Filtrer les features et calculer les stats
  const filteredFeatures: any[] = []
  
  gridLayer.eachLayer((layer: any) => {
    const feature = layer.feature
    if (!feature) return
    
    const visible = featureMatchesFilters(feature, currentFilters)
    
    if (visible) {
      filteredFeatures.push(feature)
      // Appliquer le style normal avec opacité visible
      const style = getGridFeatureStyle(feature, map?.getZoom())
      layer.setStyle({ ...style, opacity: 1 })
    } else {
      // Masquer complètement la maille
      layer.setStyle({ opacity: 0, fillOpacity: 0 })
    }
  })
  
  // 4. Calculer et afficher les statistiques
  const stats = computeFilteredStats(filteredFeatures)
  updateStatsDOM(stats)
  
  // 5. Notifier les autres composants du changement
  notifyFilterChange()
  
  // 6. Charger les stats globales depuis l'API (profondeurs, argilosité)
  invalidateGlobalStatsCache()
  loadAndDisplayGlobalStats()
  
  console.log(`[applyFilters] ${stats.visibleCount} mailles visibles, ${stats.withDataCount} avec données, ${stats.sondagesCount} sondages, ${stats.essaisCount} essais`)
}

/**
 * Chantier A - Vide les états de survol et de sélection
 */
function clearHoverAndSelection() {
  // Réinitialiser le survol
  if (hoveredCell) {
    hoveredCell.setStyle(getDefaultStyle((hoveredCell as any).feature))
    hoveredCell = null
  }
  // Réinitialiser la sélection
  if (selectedCell && gridLayer) {
    selectedCell.setStyle(getDefaultStyle((selectedCell as any).feature))
    selectedCell = null
    selectedMailleCode = null
    selectedMailleProps = null
  }
}

// --- Vues thématiques (OBSOLÈTE - Remplacé par le panneau Cartes Thématiques) ---
// Le code ci-dessous est conservé pour compatibilité mais n'est plus utilisé
// Utilisez le bouton flottant 🗺️ pour accéder aux cartes thématiques

// document.getElementById('thematicView')?.addEventListener('change', (e) => {
//   currentView = (e.target as HTMLSelectElement).value
//   applyThematicView()
// })

// function applyThematicView() { ... }

// NOTE: loadGrid(false) est maintenant appelé via setTimeout() juste après sa définition (ligne 639)
// pour éviter qu'une erreur dans les event listeners ne bloque le chargement

// Initialiser la table des tests
renderTestsTable()

// Initialiser les cartes thématiques
console.log('[INIT] Initialisation cartes thématiques...')
const thematicManager = new ThematicMapManager(map, API_GEO)
const thematicPanel = new ThematicPanel(thematicManager)
console.log('[INIT] ✅ Cartes thématiques initialisées (Export Pro intégré dans le panneau)')

// Écouter les clics sur les mailles thématiques pour propager vers la grille
map.on('thematicmap:cellclick', async (e: any) => {
  const { code, properties, latlng, layer } = e
  console.log('[Main] Clic thématique reçu pour maille:', code)
  
  // Mettre à jour la sélection visuelle
  if (selectedCell && selectedCell !== layer) {
    selectedCell.setStyle(getDefaultStyle((selectedCell as any).feature))
  }
  selectedCell = layer
  selectedMailleCode = code
  selectedMailleProps = properties
  layer.setStyle(CELL_SELECTED_STYLE)
  layer.bringToFront()
  
  // Zoomer sur la maille
  const bounds = layer.getBounds()
  map.fitBounds(bounds, { maxZoom: 14 })
  
  // Auto-générer le code sondage
  await generateSurveyCode(code)
  
  // Auto-remplir lon/lat avec le centre de la maille
  const center = bounds.getCenter()
  const lonInput = document.getElementById('surveyLon') as HTMLInputElement
  const latInput = document.getElementById('surveyLat') as HTMLInputElement
  if (lonInput && latInput) {
    lonInput.value = center.lng.toFixed(6)
    latInput.value = center.lat.toFixed(6)
  }
  
  // Toast de confirmation
  toast(`📍 Maille sélectionnée: ${code}`, 'ok')
  
  // Charger les détails complets de la maille
  await loadMailleDetails(code)
  
  // Charger les mailles voisines
  loadNeighbors(code)
})

// Le wizard sera initialisé dans bootstrap() pour éviter les problèmes de portée
// V2 - désactivé pour tests
// const importWizard = new ImportBulkWizard('importBulkWizard', API_GEO, () => {
//   console.log('[IMPORT] Import terminé, rechargement de la grille...')
//   loadGrid(false)
// })

// --- Détection de Doublons (Rayon 1 km) ---
async function checkDuplicates(lat: number, lon: number, code: string) {
  try {
    const response = await fetch(`${API_GEO}/surveys/nearby?lat=${lat}&lon=${lon}&radius=1000&exclude=${encodeURIComponent(code)}`)
    if (!response.ok) return []
    
    const data = await response.json()
    return data.surveys || []
  } catch (error) {
    console.error('Erreur détection doublons:', error)
    return []
  }
}

function showDuplicateAlert(duplicates: any[], referenceCode: string) {
  const alertEl = document.getElementById('duplicateAlert')
  const contentEl = document.getElementById('duplicateContent')
  
  if (!alertEl || !contentEl) return
  
  if (duplicates.length === 0) {
    alertEl.style.display = 'none'
    return
  }
  
  currentDuplicates = duplicates
  
  const message = `<strong>${duplicates.length} sondage${duplicates.length > 1 ? 's' : ''} trouvé${duplicates.length > 1 ? 's' : ''} dans un rayon de 1 km :</strong><br><br>`
  const list = duplicates.map(d => {
    const distance = Math.round(d.distance)
    return `• <strong>${d.code}</strong> (${distance}m)`
  }).join('<br>')
  
  contentEl.innerHTML = message + list
  alertEl.style.display = 'block'
}

function highlightDuplicatesOnMap() {
  // Effacer les anciens marqueurs
  duplicateMarkers.forEach(m => map.removeLayer(m))
  duplicateMarkers = []
  
  if (currentDuplicates.length === 0) return
  
  // Ajouter des marqueurs pour chaque doublon
  currentDuplicates.forEach(dup => {
    if (dup.lat && dup.lon) {
      const marker = L.circleMarker([dup.lat, dup.lon], {
        radius: 8,
        fillColor: '#ef476f',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map)
      
      marker.bindPopup(`
        <strong>${dup.code}</strong><br>
        Distance: ${Math.round(dup.distance)}m<br>
        <small>Doublon potentiel</small>
      `)
      
      duplicateMarkers.push(marker)
    }
  })
  
  // Zoomer sur la zone des doublons
  if (duplicateMarkers.length > 0) {
    const group = L.featureGroup(duplicateMarkers)
    map.fitBounds(group.getBounds().pad(0.2))
    toast(`${duplicateMarkers.length} doublon(s) affiché(s)`, 'ok')
  }
}

// Event listener pour le bouton d'affichage
safeAddEventListener('showDuplicatesBtn', 'click', () => {
  highlightDuplicatesOnMap()
})

/* =========================
   Bootstrap Import Wizard V3
   ========================= */

function registerImportHandlers(wizardV2: ImportWizardV2) {
  if (!wizardV2) {
    console.error('[BOOTSTRAP] Wizard non initialisé, handlers non enregistrés')
    return
  }

  // Écouter l'événement custom depuis les boutons directs
  window.addEventListener('open-import-wizard', () => {
    console.log('[IMPORT] Événement open-import-wizard reçu')
    console.log('[IMPORT] Ouverture Import Wizard v2.3.0...')
    wizardV2.open()
  })

  console.log('[BOOTSTRAP] ✅ Handlers import enregistrés')
}

function bootstrapImportWizard() {
  console.log('[BOOTSTRAP] Initialisation Import Wizard v2.3.0...')
  
  // Créer le container pour le wizard
  let wizardContainer = document.getElementById('importWizardV2Container')
  if (!wizardContainer) {
    wizardContainer = document.createElement('div')
    wizardContainer.id = 'importWizardV2Container'
    wizardContainer.style.display = 'none'
    document.body.appendChild(wizardContainer)
  }
  
  const wizardV2 = new ImportWizardV2('importWizardV2Container', API_GEO)
  
  if (wizardV2) {
    console.log('[BOOTSTRAP] ✅ Import Wizard v2.3.0 initialisé')
    registerImportHandlers(wizardV2)
  } else {
    console.error('[BOOTSTRAP] ❌ Échec initialisation Import Wizard v2.3.0')
  }
}

// Mettre à jour la version dynamiquement
function updateAppVersion() {
  const versionEl = document.getElementById('appVersion')
  if (versionEl) {
    versionEl.textContent = APP_VERSION
    console.log(`[INIT] Version affichée: ${APP_VERSION}`)
  }
}

// Initialiser les onglets
function initTabs() {
  const tabs = document.querySelectorAll('.tab')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab')
      if (!targetTab) return
      
      // Désactiver tous les onglets et contenus
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
      
      // Activer l'onglet et le contenu sélectionnés
      tab.classList.add('active')
      const content = document.getElementById(`tab-${targetTab}`)
      if (content) content.classList.add('active')
      
      console.log(`[initTabs] Onglet activé: ${targetTab}`)
    })
  })
}

/* =========================
   v2.5.0 - Panneau QGIS-like
   ========================= */

function initRightPanel() {
  if (CONFIG.features.uiPanelTabs) {
    // v2.5.0 - Nouvelle UI à onglets
    console.log('[v2.5.0] Initialisation panneau à onglets QGIS-like')
    initTabsPanel()
  } else {
    // Ancienne UI (v2.4.x)
    console.log('[Legacy] Initialisation panneau classique')
    initLegacyPanel()
  }
}

function initTabsPanel() {
  console.log('[v2.5.0] Initialisation TabsManager')
  
  // Chercher #sidebar (ancien nom) ou #right-panel (nouveau nom)
  const container = document.querySelector('#sidebar') || document.querySelector('#right-panel')
  if (!container) {
    console.error('[v2.5.0] Container #sidebar ou #right-panel not found')
    return
  }
  
  // Vider le container pour la nouvelle UI
  container.innerHTML = ''
  
  // Import dynamique pour éviter le chargement si flag OFF
  import('./tabs/tab-manager').then(({ createTabsManager }) => {
    return Promise.all([
      import('./tabs/tab-nouveau'),
      import('./tabs/tab-import-wizard'),
      import('./tabs/tab-liste-sondages'),
      import('./tabs/tab-geocode'),
    ]).then(([tabNouveau, tabImport, tabListe, tabGeocode]) => {
      const tabs = [
        {
          id: 'nouveau' as const,
          label: 'Nouveau',
          icon: '📝',
          component: tabNouveau.createTabNouveau(API_GEO),
        },
        {
          id: 'import' as const,
          label: 'Import',
          icon: '📥',
          component: tabImport.createTabImportWizard(),
        },
        {
          id: 'liste' as const,
          label: 'Liste',
          icon: '📋',
          component: tabListe.createTabListeSondages(API_GEO),
        },
        {
          id: 'geocode' as const,
          label: 'Géocoder',
          icon: '🗺️',
          component: tabGeocode.createTabGeocode(API_GEO),
        },
      ]
      
      const manager = createTabsManager()
      manager.init(container as HTMLElement, tabs)
      
      // Exposer pour debug
      ;(window as any).__tabsManager = manager
      
      console.log('[v2.5.0] ✅ TabsManager initialized with 4 tabs')
    })
  }).catch(err => {
    console.error('[v2.5.0] Failed to initialize TabsManager:', err)
  })
}

function initLegacyPanel() {
  // Code existant
  initAccordions()
  initDirectButtons()
  initKeyboardShortcuts()
  initFilterListeners()
  initCloseMailleActions()
}

/* =========================
   v2.5.0 - Modal Sondages
   ========================= */

function initSondagesModal() {
  const modal = new SondagesModal(API_GEO)
  
  // Écouter l'événement d'ouverture
  window.addEventListener('open-sondages-modal', () => {
    console.log('[v2.5.0] Ouverture modal Sondages')
    modal.open()
  })
  
  console.log('[v2.5.0] ✅ Modal Sondages initialisée')
}

/* =========================
   v2.6.0 - DB Manager
   ========================= */

function initDbManager() {
  const btn = document.getElementById('dbManagerBtn')
  if (btn) {
    btn.addEventListener('click', () => {
      console.log('[v2.6.0] Ouverture Gestionnaire BDD')
      openDbManager()
    })
    console.log('[v2.6.0] ✅ Gestionnaire BDD initialisé')
  } else {
    console.warn('[v2.6.0] Bouton #dbManagerBtn introuvable')
  }
}

// Initialiser WebSocket temps réel
function initWebSocket() {
  console.log('[REALTIME] Initialisation WebSocket...')
  const realtime = initRealtime(API_GEO)
  
  // Écouter les événements de géocodage
  onWsEvent('sondage.geocoded', (data: any) => {
    console.log('[WS] Sondage géocodé:', data)
    toast(`✅ Sondage ${data.code || data.id} géocodé`, 'ok')
    
    // Rafraîchir la grille si nécessaire
    if (gridLayer) {
      loadGrid()
    }
    
    // Rafraîchir les stats mailles (carte principale)
    // Dispatch event pour que les composants puissent réagir
    window.dispatchEvent(new CustomEvent('atlas:refresh-stats'))
  })
  
  // Écouter les événements de suggestions
  onWsEvent('suggestion.accepted', (data: any) => {
    console.log('[WS] Suggestion acceptée:', data)
    toast(`✅ Suggestion acceptée pour sondage ${data.sondage_id}`, 'ok')
    
    // Rafraîchir les stats
    window.dispatchEvent(new CustomEvent('atlas:refresh-stats'))
  })
  
  onWsEvent('suggestion.rejected', (data: any) => {
    console.log('[WS] Suggestion rejetée:', data)
    
    // Rafraîchir les stats
    window.dispatchEvent(new CustomEvent('atlas:refresh-stats'))
  })
  
  console.log('[REALTIME] ✅ WebSocket initialisé')
}

// Initialiser le routing et les pages
let sondagesPage: SondagesManagerPage | null = null

function initRouting() {
  console.log('[ROUTER] Initialisation routing...')
  
  // Route principale (carte)
  router.on('/', () => {
    console.log('[ROUTER] Route: Home (carte)')
    showMainMap()
  })
  
  // Route page sondages
  router.on('/sondages', async () => {
    console.log('[ROUTER] Route: Sondages Manager')
    await showSondagesPage()
  })
  
  console.log('[ROUTER] ✅ Routing initialisé')
}

function showMainMap() {
  // Afficher la carte principale
  const appContainer = document.getElementById('app')
  if (appContainer) {
    appContainer.style.display = 'grid'
  }
  
  // Masquer la page sondages
  const sondagesContainer = document.getElementById('sondages-page-container')
  if (sondagesContainer) {
    sondagesContainer.style.display = 'none'
  }
  
  // Détruire l'instance si elle existe
  if (sondagesPage) {
    sondagesPage.destroy()
    sondagesPage = null
  }
}

async function showSondagesPage() {
  // Masquer la carte principale
  const appContainer = document.getElementById('app')
  if (appContainer) {
    appContainer.style.display = 'none'
  }
  
  // Fermer le modal sondages s'il est ouvert
  const modal = document.getElementById('sondages-modal')
  if (modal) {
    modal.style.display = 'none'
  }
  
  // Créer le container si nécessaire
  let sondagesContainer = document.getElementById('sondages-page-container')
  if (!sondagesContainer) {
    sondagesContainer = document.createElement('div')
    sondagesContainer.id = 'sondages-page-container'
    sondagesContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;'
    document.body.appendChild(sondagesContainer)
  }
  
  sondagesContainer.style.display = 'block'
  
  // Créer et afficher la page
  if (!sondagesPage) {
    sondagesPage = new SondagesManagerPage(API_GEO)
    await sondagesPage.render('sondages-page-container')
  }
}

// ============================================================================
// CORRECTION RESIZABLE: Modifier grid-template-columns au lieu de width
// ============================================================================
function initResizablePanels() {
  console.log('[Resizable] Initialisation des panneaux redimensionnables...')
  
  const container = document.getElementById('container')
  if (!container) {
    console.warn('[Resizable] Container non trouvé')
    return
  }
  
  // Callback pour invalider la taille de la carte Leaflet après resize
  const invalidateMapSize = () => {
    const mapInstance = (window as any).map || (window as any).leafletMap
    if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
      setTimeout(() => {
        mapInstance.invalidateSize({ animate: false })
        console.log('[Resizable] ✅ map.invalidateSize() appelé')
      }, 50)
    }
  }
  
  // Panneau gauche (dashboard) - handle à DROITE
  const dashboard = document.getElementById('dashboard')
  if (dashboard) {
    const savedWidth = localStorage.getItem('atlas-home-left-panel-width')
    const initialWidth = savedWidth ? parseInt(savedWidth) : 380
    
    makeResizable('#dashboard', {
      direction: 'horizontal',
      minSize: 200,
      maxSize: 500,
      defaultSize: initialWidth,
      storageKey: 'atlas-home-left-panel-width',
      handlePosition: 'end',
      onResize: (newWidth) => {
        // Modifier grid-template-columns du container
        container.style.gridTemplateColumns = `${newWidth}px 1fr 380px`
        console.log(`[Resizable] Dashboard resize: ${newWidth}px`)
      },
      onResizeEnd: (newWidth) => {
        container.style.gridTemplateColumns = `${newWidth}px 1fr 380px`
        invalidateMapSize()
        console.log(`[Resizable] Dashboard final: ${newWidth}px`)
      }
    })
    // Appliquer la largeur initiale
    container.style.gridTemplateColumns = `${initialWidth}px 1fr 380px`
    console.log('[Resizable] ✅ Panneau gauche (dashboard) activé')
  }
  
  // Panneau droit (sidebar) - handle à GAUCHE
  const sidebar = document.getElementById('sidebar')
  if (sidebar) {
    const savedWidth = localStorage.getItem('atlas-home-right-panel-width')
    const initialWidth = savedWidth ? parseInt(savedWidth) : 380
    const dashboardWidth = dashboard ? parseInt(dashboard.style.width || '380') : 380
    
    makeResizable('#sidebar', {
      direction: 'horizontal',
      minSize: 250,
      maxSize: 600,
      defaultSize: initialWidth,
      storageKey: 'atlas-home-right-panel-width',
      handlePosition: 'start',
      onResize: (newWidth) => {
        // Modifier grid-template-columns du container
        const leftWidth = dashboard ? parseInt(dashboard.style.width || '380') : 380
        container.style.gridTemplateColumns = `${leftWidth}px 1fr ${newWidth}px`
        console.log(`[Resizable] Sidebar resize: ${newWidth}px`)
      },
      onResizeEnd: (newWidth) => {
        const leftWidth = dashboard ? parseInt(dashboard.style.width || '380') : 380
        container.style.gridTemplateColumns = `${leftWidth}px 1fr ${newWidth}px`
        invalidateMapSize()
        console.log(`[Resizable] Sidebar final: ${newWidth}px`)
      }
    })
    // Appliquer la largeur initiale
    const leftWidth = dashboard ? parseInt(dashboard.style.width || '380') : 380
    container.style.gridTemplateColumns = `${leftWidth}px 1fr ${initialWidth}px`
    console.log('[Resizable] ✅ Panneau droit (sidebar) activé')
  }
  
  // Panneau thématique (apparaît dynamiquement) - Observer pour l'activer quand il devient visible
  const thematicPanel = document.getElementById('thematicPanel')
  if (thematicPanel) {
    let thematicResizableInitialized = false
    
    const initThematicResizable = () => {
      makeResizable('#thematicPanel', {
        direction: 'horizontal',
        minSize: 280,
        maxSize: 450,
        defaultSize: 320,
        storageKey: 'atlas-thematic-panel-width',
        handlePosition: 'start',
        onResize: invalidateMapSize,
        onResizeEnd: (size) => {
          invalidateMapSize()
          console.log(`[Resizable] ThematicPanel width: ${size}px`)
        }
      })
      thematicResizableInitialized = true
      console.log('[Resizable] ✅ Panneau thématique activé')
    }
    
    const observer = new MutationObserver(() => {
      if (!thematicResizableInitialized && thematicPanel.style.display !== 'none') {
        initThematicResizable()
        observer.disconnect()
      }
    })
    
    observer.observe(thematicPanel, {
      attributes: true,
      attributeFilter: ['style']
    })
    
    // Tenter l'activation immédiate si déjà visible
    if (thematicPanel.style.display !== 'none') {
      initThematicResizable()
      observer.disconnect()
    }
  }
  
  console.log('[Resizable] Initialisation terminée')
}

// Garantit l'ordre : d'abord boot, ensuite listeners
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateAppVersion()
    bootstrapImportWizard()
    initTabs()
    // Panneau droit (feature flag)
    initRightPanel()
    // v2.5.0: Modal Sondages
    initSondagesModal()
    // v2.6.0: DB Manager
    initDbManager()
    // v2.7.0: WebSocket temps réel
    initWebSocket()
    // v2.8.0: Routing
    initRouting()
    // v3.0.0: Menu profil utilisateur
    initUserMenu()
    // v3.5.2: Panneaux redimensionnables
    initResizablePanels()
  }, { once: true })
} else {
  updateAppVersion()
  bootstrapImportWizard()
  initTabs()
  // Panneau droit (feature flag)
  initRightPanel()
  // v2.5.0: Modal Sondages
  initSondagesModal()
  // v2.6.0: DB Manager
  initDbManager()
  // v2.7.0: WebSocket temps réel
  initWebSocket()
  // v2.8.0: Routing
  initRouting()
  // v3.0.0: Menu profil utilisateur
  initUserMenu()
  // v3.5.2: Panneaux redimensionnables
  initResizablePanels()
}
