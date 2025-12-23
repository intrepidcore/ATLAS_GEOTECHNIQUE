/**
 * Resizable Panel Component
 * 
 * Composant réutilisable pour créer des panneaux redimensionnables.
 * S'intègre facilement dans les layouts existants sans tout réécrire.
 * 
 * @version 3.5.0
 * 
 * Usage:
 * ```typescript
 * import { makeResizable, ResizableConfig } from './components/resizable-panel';
 * 
 * // Rendre un panneau existant resizable
 * makeResizable('#left-panel', {
 *   direction: 'horizontal',
 *   minSize: 200,
 *   maxSize: 500,
 *   defaultSize: 300,
 *   storageKey: 'atlas-left-panel-width'
 * });
 * ```
 */

export interface ResizableConfig {
  /** Direction du redimensionnement: 'horizontal' (largeur) ou 'vertical' (hauteur) */
  direction: 'horizontal' | 'vertical';
  /** Taille minimale en pixels */
  minSize: number;
  /** Taille maximale en pixels */
  maxSize: number;
  /** Taille par défaut en pixels */
  defaultSize: number;
  /** Clé localStorage pour persister la taille (optionnel) */
  storageKey?: string;
  /** Position du handle: 'start' (gauche/haut) ou 'end' (droite/bas) */
  handlePosition?: 'start' | 'end';
  /** Callback appelé lors du redimensionnement */
  onResize?: (newSize: number) => void;
  /** Callback appelé à la fin du redimensionnement */
  onResizeEnd?: (newSize: number) => void;
}

interface ResizableState {
  element: HTMLElement;
  handle: HTMLElement;
  config: ResizableConfig;
  isDragging: boolean;
  startPos: number;
  startSize: number;
}

const states = new Map<HTMLElement, ResizableState>();

/**
 * Rend un élément existant redimensionnable
 */
export function makeResizable(
  selector: string | HTMLElement,
  config: ResizableConfig
): { destroy: () => void } {
  const element = typeof selector === 'string' 
    ? document.querySelector(selector) as HTMLElement
    : selector;
  
  if (!element) {
    console.warn(`[ResizablePanel] Element not found: ${selector}`);
    return { destroy: () => {} };
  }
  
  // Injecter les styles CSS si pas déjà fait
  injectStyles();
  
  // Récupérer la taille sauvegardée ou utiliser la valeur par défaut
  let initialSize = config.defaultSize;
  if (config.storageKey) {
    const saved = localStorage.getItem(config.storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= config.minSize && parsed <= config.maxSize) {
        initialSize = parsed;
      }
    }
  }
  
  // Appliquer la taille initiale
  if (config.direction === 'horizontal') {
    element.style.width = `${initialSize}px`;
    element.style.flexShrink = '0';
  } else {
    element.style.height = `${initialSize}px`;
    element.style.flexShrink = '0';
  }
  
  // Créer le handle de redimensionnement
  const handle = document.createElement('div');
  handle.className = `resizable-handle resizable-handle-${config.direction}`;
  handle.dataset.handlePosition = config.handlePosition || 'end';
  
  // Positionner le handle
  if (config.handlePosition === 'start') {
    element.insertBefore(handle, element.firstChild);
  } else {
    element.appendChild(handle);
  }
  
  // Ajouter la classe au conteneur
  element.classList.add('resizable-panel');
  element.classList.add(`resizable-${config.direction}`);
  
  // État du drag
  const state: ResizableState = {
    element,
    handle,
    config,
    isDragging: false,
    startPos: 0,
    startSize: initialSize
  };
  
  states.set(element, state);
  
  // Event handlers
  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    state.isDragging = true;
    state.startPos = config.direction === 'horizontal' ? e.clientX : e.clientY;
    state.startSize = config.direction === 'horizontal' 
      ? element.offsetWidth 
      : element.offsetHeight;
    
    document.body.classList.add('resizing');
    handle.classList.add('active');
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  const onMouseMove = (e: MouseEvent) => {
    if (!state.isDragging) return;
    
    const currentPos = config.direction === 'horizontal' ? e.clientX : e.clientY;
    let delta = currentPos - state.startPos;
    
    // Inverser le delta si le handle est au début
    if (config.handlePosition === 'start') {
      delta = -delta;
    }
    
    let newSize = state.startSize + delta;
    
    // Appliquer les limites
    newSize = Math.max(config.minSize, Math.min(config.maxSize, newSize));
    
    // Appliquer la nouvelle taille
    if (config.direction === 'horizontal') {
      element.style.width = `${newSize}px`;
    } else {
      element.style.height = `${newSize}px`;
    }
    
    // Callback
    if (config.onResize) {
      config.onResize(newSize);
    }
  };
  
  const onMouseUp = () => {
    if (!state.isDragging) return;
    
    state.isDragging = false;
    document.body.classList.remove('resizing');
    handle.classList.remove('active');
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Sauvegarder la taille
    const finalSize = config.direction === 'horizontal' 
      ? element.offsetWidth 
      : element.offsetHeight;
    
    if (config.storageKey) {
      localStorage.setItem(config.storageKey, String(finalSize));
    }
    
    // Callback
    if (config.onResizeEnd) {
      config.onResizeEnd(finalSize);
    }
  };
  
  // Attacher les événements
  handle.addEventListener('mousedown', onMouseDown);
  
  // Support tactile
  handle.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    onMouseDown({ 
      clientX: touch.clientX, 
      clientY: touch.clientY, 
      preventDefault: () => e.preventDefault() 
    } as MouseEvent);
  });
  
  // Fonction de destruction
  const destroy = () => {
    handle.removeEventListener('mousedown', onMouseDown);
    handle.remove();
    element.classList.remove('resizable-panel', `resizable-${config.direction}`);
    states.delete(element);
  };
  
  return { destroy };
}

/**
 * Crée un layout à 2 ou 3 panneaux redimensionnables
 */
export function createResizableLayout(
  container: string | HTMLElement,
  panels: Array<{
    id: string;
    content: HTMLElement | string;
    config: Partial<ResizableConfig>;
  }>
): { destroy: () => void } {
  const containerEl = typeof container === 'string'
    ? document.querySelector(container) as HTMLElement
    : container;
  
  if (!containerEl) {
    console.warn(`[ResizableLayout] Container not found: ${container}`);
    return { destroy: () => {} };
  }
  
  injectStyles();
  
  containerEl.classList.add('resizable-layout');
  
  const destroyers: Array<() => void> = [];
  
  panels.forEach((panel, index) => {
    const panelEl = document.createElement('div');
    panelEl.id = panel.id;
    panelEl.className = 'resizable-layout-panel';
    
    if (typeof panel.content === 'string') {
      panelEl.innerHTML = panel.content;
    } else {
      panelEl.appendChild(panel.content);
    }
    
    containerEl.appendChild(panelEl);
    
    // Rendre resizable sauf le dernier panneau (qui prend l'espace restant)
    if (index < panels.length - 1) {
      const fullConfig: ResizableConfig = {
        direction: 'horizontal',
        minSize: 150,
        maxSize: 600,
        defaultSize: 300,
        handlePosition: 'end',
        ...panel.config
      };
      
      const { destroy } = makeResizable(panelEl, fullConfig);
      destroyers.push(destroy);
    } else {
      // Dernier panneau: flex-grow
      panelEl.style.flex = '1';
    }
  });
  
  return {
    destroy: () => {
      destroyers.forEach(d => d());
      containerEl.classList.remove('resizable-layout');
    }
  };
}

/**
 * Injecte les styles CSS pour les panneaux redimensionnables
 */
function injectStyles(): void {
  if (document.getElementById('resizable-panel-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'resizable-panel-styles';
  style.textContent = `
    /* Resizable Panel Styles */
    .resizable-panel {
      position: relative;
    }
    
    .resizable-handle {
      position: absolute;
      background: transparent;
      z-index: 100;
      transition: background-color 0.2s;
    }
    
    .resizable-handle:hover,
    .resizable-handle.active {
      background-color: rgba(59, 130, 246, 0.3);
    }
    
    /* Handle horizontal (pour redimensionner la largeur) */
    .resizable-handle-horizontal {
      width: 6px;
      top: 0;
      bottom: 0;
      cursor: col-resize;
    }
    
    .resizable-handle-horizontal[data-handle-position="end"] {
      right: 0;
    }
    
    .resizable-handle-horizontal[data-handle-position="start"] {
      left: 0;
    }
    
    /* Handle vertical (pour redimensionner la hauteur) */
    .resizable-handle-vertical {
      height: 6px;
      left: 0;
      right: 0;
      cursor: row-resize;
    }
    
    .resizable-handle-vertical[data-handle-position="end"] {
      bottom: 0;
    }
    
    .resizable-handle-vertical[data-handle-position="start"] {
      top: 0;
    }
    
    /* État pendant le drag */
    body.resizing {
      cursor: col-resize !important;
      user-select: none !important;
    }
    
    body.resizing * {
      cursor: inherit !important;
    }
    
    /* Layout resizable */
    .resizable-layout {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    .resizable-layout-panel {
      overflow: auto;
      position: relative;
    }
    
    /* Indicateur visuel du handle */
    .resizable-handle::after {
      content: '';
      position: absolute;
      background: #3b82f6;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .resizable-handle-horizontal::after {
      width: 2px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      height: 40px;
      border-radius: 1px;
    }
    
    .resizable-handle-vertical::after {
      height: 2px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      border-radius: 1px;
    }
    
    .resizable-handle:hover::after,
    .resizable-handle.active::after {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Récupère la taille sauvegardée d'un panneau
 */
export function getSavedPanelSize(storageKey: string): number | null {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Réinitialise la taille d'un panneau à sa valeur par défaut
 */
export function resetPanelSize(storageKey: string): void {
  localStorage.removeItem(storageKey);
}
