/**
 * Panel Float — Panneaux détachables / flottants pour la carte principale (vanilla TS)
 *
 * Permet de détacher un panneau ancré (dashboard, sidebar, thematicPanel, scientificDrawer)
 * en une fenêtre flottante draggable + resizable, avec persistance localStorage.
 *
 * Usage:
 * ```typescript
 * import { makeFloatable, initFloatingPanels } from './components/panel-float'
 *
 * // Rendre un panneau détachable
 * makeFloatable('#dashboard', { title: 'Tableau de bord', storageKey: 'atlas-float-dashboard' })
 *
 * // Ou initialiser tous les panneaux par défaut
 * initFloatingPanels()
 * ```
 *
 * @version 3.6.0
 */

export interface FloatableConfig {
  /** Titre affiché dans la barre du panneau flottant */
  title: string
  /** Clé localStorage pour persister la position/taille du panneau flottant */
  storageKey?: string
  /** Largeur par défaut quand flottant (px) */
  defaultFloatWidth?: number
  /** Hauteur par défaut quand flottant (px) */
  defaultFloatHeight?: number
  /** Largeur min quand flottant */
  minFloatWidth?: number
  /** Hauteur min quand flottant */
  minFloatHeight?: number
  /** Callback quand le panneau est détaché */
  onFloat?: () => void
  /** Callback quand le panneau est ré-ancré */
  onDock?: () => void
}

interface FloatingState {
  isFloating: boolean
  x: number
  y: number
  width: number
  height: number
}

interface FloatableInstance {
  element: HTMLElement
  overlay: HTMLElement | null
  config: FloatableConfig
  state: FloatingState
  destroy: () => void
}

const instances = new Map<HTMLElement, FloatableInstance>()

// ─── Styles injectés une seule fois ────────────────────────────────────────
function injectFloatStyles(): void {
  if (document.getElementById('panel-float-styles')) return

  const style = document.createElement('style')
  style.id = 'panel-float-styles'
  style.textContent = `
    .floating-panel {
      position: fixed;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(59,130,246,0.15);
      overflow: hidden;
      background: var(--panel, #0F172A);
      transition: box-shadow 0.2s;
    }
    .floating-panel:hover {
      box-shadow: 0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(59,130,246,0.25);
    }
    .floating-panel-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #1E293B;
      border-bottom: 1px solid #334155;
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }
    .floating-panel-title {
      font-size: 12px;
      font-weight: 600;
      color: #F8FAFC;
      letter-spacing: 0.02em;
    }
    .floating-panel-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .floating-panel-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #94A3B8;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    .floating-panel-btn:hover {
      color: #F8FAFC;
      background: rgba(59,130,246,0.2);
    }
    .floating-panel-body {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    .floating-panel-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 18px;
      height: 18px;
      cursor: nwse-resize;
      z-index: 10;
    }
    .floating-panel-resize-handle::after {
      content: '';
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-right: 2px solid #475569;
      border-bottom: 2px solid #475569;
      border-radius: 0 0 2px 0;
    }
    .floating-panel-resize-handle:hover::after {
      border-color: #3B82F6;
    }
    /* Dock button dans le panneau ancré */
    .dock-float-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 50;
      background: rgba(59,130,246,0.12);
      border: 1px solid rgba(59,130,246,0.25);
      color: #94A3B8;
      border-radius: 6px;
      padding: 3px 6px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .dock-float-btn:hover {
      background: rgba(59,130,246,0.25);
      color: #F8FAFC;
    }
    body.panel-floating-drag {
      cursor: move !important;
      user-select: none !important;
    }
    body.panel-floating-drag * {
      cursor: inherit !important;
      pointer-events: none !important;
    }
    body.panel-floating-resize {
      cursor: nwse-resize !important;
      user-select: none !important;
    }
    body.panel-floating-resize * {
      cursor: inherit !important;
      pointer-events: none !important;
    }
  `
  document.head.appendChild(style)
}

// ─── SVG icônes inline ─────────────────────────────────────────────────────
const ICON_FLOAT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
const ICON_DOCK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
const ICON_CLOSE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

// ─── Sauvegarde / restauration état ────────────────────────────────────────
function saveState(config: FloatableConfig, state: FloatingState): void {
  if (!config.storageKey) return
  try {
    localStorage.setItem(config.storageKey, JSON.stringify(state))
  } catch { /* quota exceeded — ignore */ }
}

function loadState(config: FloatableConfig, defaults: FloatingState): FloatingState {
  if (!config.storageKey) return defaults
  try {
    const raw = localStorage.getItem(config.storageKey)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<FloatingState>
    return {
      isFloating: parsed.isFloating ?? defaults.isFloating,
      x: parsed.x ?? defaults.x,
      y: parsed.y ?? defaults.y,
      width: parsed.width ?? defaults.width,
      height: parsed.height ?? defaults.height,
    }
  } catch {
    return defaults
  }
}

// ─── Création du panneau flottant ──────────────────────────────────────────
function createFloatingPanel(instance: FloatableInstance): HTMLElement {
  const { element, config, state } = instance

  // Créer l'overlay (panneau flottant)
  const overlay = document.createElement('div')
  overlay.className = 'floating-panel'
  overlay.style.left = `${state.x}px`
  overlay.style.top = `${state.y}px`
  overlay.style.width = `${state.width}px`
  overlay.style.height = `${state.height}px`

  // Titlebar
  const titlebar = document.createElement('div')
  titlebar.className = 'floating-panel-titlebar'

  const titleEl = document.createElement('span')
  titleEl.className = 'floating-panel-title'
  titleEl.textContent = config.title

  const actions = document.createElement('div')
  actions.className = 'floating-panel-actions'

  // Bouton Ré-ancrer
  const dockBtn = document.createElement('button')
  dockBtn.className = 'floating-panel-btn'
  dockBtn.innerHTML = ICON_DOCK
  dockBtn.title = 'Ré-ancrer'
  dockBtn.addEventListener('click', () => dockPanel(instance))

  // Bouton Fermer (ré-ancrer et masquer)
  const closeBtn = document.createElement('button')
  closeBtn.className = 'floating-panel-btn'
  closeBtn.innerHTML = ICON_CLOSE
  closeBtn.title = 'Fermer'
  closeBtn.addEventListener('click', () => {
    dockPanel(instance)
  })

  actions.appendChild(dockBtn)
  actions.appendChild(closeBtn)
  titlebar.appendChild(titleEl)
  titlebar.appendChild(actions)

  // Body — on déplace le contenu du panneau original
  const body = document.createElement('div')
  body.className = 'floating-panel-body'

  // Resize handle
  const resizeHandle = document.createElement('div')
  resizeHandle.className = 'floating-panel-resize-handle'

  overlay.appendChild(titlebar)
  overlay.appendChild(body)
  overlay.appendChild(resizeHandle)
  document.body.appendChild(overlay)

  // Déplacer le contenu dans le body flottant
  // On sauvegarde les enfants originaux
  const originalChildren = Array.from(element.childNodes)
  originalChildren.forEach(child => body.appendChild(child))

  // Masquer le panneau ancré
  element.style.display = 'none'

  instance.overlay = overlay

  // ─── Drag (titlebar) ────────────────────────────────────────────────────
  let dragState: { startX: number; startY: number; origX: number; origY: number } | null = null

  titlebar.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.floating-panel-btn')) return
    e.preventDefault()
    dragState = { startX: e.clientX, startY: e.clientY, origX: state.x, origY: state.y }
    document.body.classList.add('panel-floating-drag')

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState) return
      const dx = ev.clientX - dragState.startX
      const dy = ev.clientY - dragState.startY
      state.x = Math.max(0, Math.min(window.innerWidth - 100, dragState.origX + dx))
      state.y = Math.max(0, Math.min(window.innerHeight - 50, dragState.origY + dy))
      overlay.style.left = `${state.x}px`
      overlay.style.top = `${state.y}px`
    }

    const onMouseUp = () => {
      dragState = null
      document.body.classList.remove('panel-floating-drag')
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveState(config, state)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  // ─── Resize (handle bas-droite) ────────────────────────────────────────
  const minW = config.minFloatWidth ?? 280
  const minH = config.minFloatHeight ?? 200

  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startW = state.width
    const startH = state.height
    const startX = e.clientX
    const startY = e.clientY
    document.body.classList.add('panel-floating-resize')

    const onMouseMove = (ev: MouseEvent) => {
      const dw = ev.clientX - startX
      const dh = ev.clientY - startY
      state.width = Math.max(minW, startW + dw)
      state.height = Math.max(minH, startH + dh)
      overlay.style.width = `${state.width}px`
      overlay.style.height = `${state.height}px`
    }

    const onMouseUp = () => {
      document.body.classList.remove('panel-floating-resize')
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveState(config, state)
      // Invalider la taille carte
      invalidateMapSize()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  // Invalider la taille de la carte Leaflet
  invalidateMapSize()

  if (config.onFloat) config.onFloat()

  return overlay
}

// ─── Ré-ancrer le panneau ──────────────────────────────────────────────────
function dockPanel(instance: FloatableInstance): void {
  const { element, overlay, config, state } = instance
  if (!overlay) return

  // Remettre les enfants dans le panneau original
  const body = overlay.querySelector('.floating-panel-body')
  if (body) {
    const children = Array.from(body.childNodes)
    children.forEach(child => element.appendChild(child))
  }

  // Supprimer l'overlay
  overlay.remove()
  instance.overlay = null

  // Réafficher le panneau ancré
  element.style.display = ''

  state.isFloating = false
  saveState(config, state)

  invalidateMapSize()

  if (config.onDock) config.onDock()
}

// ─── Invalider la taille carte Leaflet ─────────────────────────────────────
function invalidateMapSize(): void {
  const mapInstance = (window as any).leafletMap || (window as any).map
  if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
    setTimeout(() => {
      try { mapInstance.invalidateSize({ animate: false }) } catch { /* best-effort */ }
    }, 100)
  }
}

// ─── API publique ──────────────────────────────────────────────────────────

/**
 * Rend un élément existant détachable en panneau flottant.
 * Ajoute un bouton "Flotter" dans le coin supérieur droit du panneau ancré.
 */
export function makeFloatable(
  selector: string | HTMLElement,
  config: FloatableConfig
): { destroy: () => void } {
  const element = typeof selector === 'string'
    ? document.querySelector(selector) as HTMLElement
    : selector

  if (!element) {
    console.warn(`[PanelFloat] Element not found: ${selector}`)
    return { destroy: () => {} }
  }

  injectFloatStyles()

  const defaultW = config.defaultFloatWidth ?? 420
  const defaultH = config.defaultFloatHeight ?? 500

  const defaults: FloatingState = {
    isFloating: false,
    x: Math.max(50, window.innerWidth - defaultW - 30),
    y: 70,
    width: defaultW,
    height: defaultH,
  }

  const state = loadState(config, defaults)

  const instance: FloatableInstance = {
    element,
    overlay: null,
    config,
    state,
    destroy: () => {
      if (instance.overlay) dockPanel(instance)
      const btn = element.querySelector('.dock-float-btn')
      if (btn) btn.remove()
      instances.delete(element)
    }
  }

  instances.set(element, instance)

  // Bouton "Flotter" dans le panneau ancré
  const floatBtn = document.createElement('button')
  floatBtn.className = 'dock-float-btn'
  floatBtn.innerHTML = `${ICON_FLOAT} Flotter`
  floatBtn.title = 'Détacher en fenêtre flottante'
  floatBtn.addEventListener('click', () => {
    state.isFloating = true
    saveState(config, state)
    createFloatingPanel(instance)
  })

  element.style.position = 'relative'
  element.appendChild(floatBtn)

  // Si l'état sauvegardé était flottant, restaurer
  if (state.isFloating) {
    createFloatingPanel(instance)
  }

  return { destroy: instance.destroy }
}

/**
 * Initialise les panneaux flottants par défaut sur la carte principale.
 * Panneaux configurés : dashboard (gauche), sidebar (droite).
 */
export function initFloatingPanels(): void {
  console.log('[PanelFloat] Initialisation des panneaux détachables...')

  // Panneau gauche (dashboard)
  const dashboard = document.getElementById('dashboard')
  if (dashboard) {
    makeFloatable(dashboard, {
      title: 'Tableau de bord',
      storageKey: 'atlas-float-dashboard',
      defaultFloatWidth: 400,
      defaultFloatHeight: 600,
      minFloatWidth: 280,
      minFloatHeight: 300,
      onDock: () => {
        // Réappliquer la largeur sauvegardée du resizable
        const saved = localStorage.getItem('atlas-home-left-panel-width')
        if (saved) {
          const container = document.getElementById('container')
          if (container) container.style.gridTemplateColumns = `${saved}px 1fr 380px`
        }
      }
    })
    console.log('[PanelFloat] ✅ Dashboard floatable')
  }

  // Panneau droit (sidebar)
  const sidebar = document.getElementById('sidebar')
  if (sidebar) {
    makeFloatable(sidebar, {
      title: 'Panneau latéral',
      storageKey: 'atlas-float-sidebar',
      defaultFloatWidth: 400,
      defaultFloatHeight: 600,
      minFloatWidth: 280,
      minFloatHeight: 300,
      onDock: () => {
        const saved = localStorage.getItem('atlas-home-right-panel-width')
        if (saved) {
          const container = document.getElementById('container')
          const leftSaved = localStorage.getItem('atlas-home-left-panel-width') || '380'
          if (container) container.style.gridTemplateColumns = `${leftSaved}px 1fr ${saved}px`
        }
      }
    })
    console.log('[PanelFloat] ✅ Sidebar floatable')
  }

  console.log('[PanelFloat] Initialisation terminée')
}

/**
 * Vérifie si un panneau est actuellement flottant
 */
export function isFloating(selector: string | HTMLElement): boolean {
  const element = typeof selector === 'string'
    ? document.querySelector(selector) as HTMLElement
    : selector
  if (!element) return false
  const instance = instances.get(element)
  return instance?.state.isFloating ?? false
}

/**
 * Force le dock de tous les panneaux flottants
 */
export function dockAll(): void {
  instances.forEach(instance => {
    if (instance.state.isFloating && instance.overlay) {
      dockPanel(instance)
    }
  })
}
