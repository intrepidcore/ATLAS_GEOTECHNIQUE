/**
 * Gestionnaire d'onglets QGIS-like
 * v2.5.0 - Phase UI-01
 */

import { Tab, TabId, TabsState, TabsManager } from '../types/tabs'
import { CONFIG } from '../config'
import { getParam, setParam } from '../utils/url-params'

export function createTabsManager(): TabsManager {
  let state: TabsState = {
    activeTab: CONFIG.ui.defaultTab,
    previousTab: null,
  }
  
  let tabs: Tab[] = []
  let container: HTMLElement | null = null
  let headerEl: HTMLElement | null = null
  let contentEl: HTMLElement | null = null
  
  const listeners: Array<() => void> = []
  
  function init(containerEl: HTMLElement, tabsConfig: Tab[]) {
    container = containerEl
    tabs = tabsConfig
    
    loadState()
    render()
    switchTo(state.activeTab)
    setupKeyboardShortcuts()
    
    console.log('[TabsManager] Initialized with tabs:', tabs.map(t => t.id))
  }
  
  function render() {
    if (!container) return
    
    container.innerHTML = ''
    container.className = 'tabs-container'
    
    headerEl = document.createElement('div')
    headerEl.className = 'tabs-header'
    headerEl.setAttribute('role', 'tablist')
    
    tabs.forEach((tab) => {
      const button = createTabButton(tab)
      headerEl!.appendChild(button)
    })
    
    contentEl = document.createElement('div')
    contentEl.className = 'tabs-content'
    
    tabs.forEach(tab => {
      const pane = createTabPane(tab)
      contentEl!.appendChild(pane)
    })
    
    container.appendChild(headerEl)
    container.appendChild(contentEl)
  }
  
  function createTabButton(tab: Tab): HTMLElement {
    const button = document.createElement('button')
    button.className = 'tab-button'
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', `tab-pane-${tab.id}`)
    button.setAttribute('aria-selected', 'false')
    button.setAttribute('tabindex', '-1')
    button.dataset.tabId = tab.id
    
    const icon = document.createElement('span')
    icon.className = 'tab-icon'
    icon.textContent = tab.icon
    
    const label = document.createElement('span')
    label.textContent = tab.label
    
    button.appendChild(icon)
    button.appendChild(label)
    
    if (tab.badge) {
      const badgeCount = tab.badge()
      if (badgeCount && badgeCount > 0) {
        const badge = document.createElement('span')
        badge.className = 'tab-badge'
        badge.textContent = badgeCount.toString()
        button.appendChild(badge)
      }
    }
    
    const clickHandler = () => switchTo(tab.id)
    button.addEventListener('click', clickHandler)
    listeners.push(() => button.removeEventListener('click', clickHandler))
    
    return button
  }
  
  function createTabPane(tab: Tab): HTMLElement {
    const pane = document.createElement('div')
    pane.className = 'tab-pane'
    pane.id = `tab-pane-${tab.id}`
    pane.setAttribute('role', 'tabpanel')
    pane.setAttribute('aria-labelledby', `tab-${tab.id}`)
    pane.setAttribute('aria-hidden', 'true')
    pane.dataset.tabId = tab.id
    
    return pane
  }
  
  function switchTo(tabId: TabId) {
    const previousTabId = state.activeTab
    
    if (previousTabId) {
      const prevTab = tabs.find(t => t.id === previousTabId)
      if (prevTab?.component.onDeactivate) {
        prevTab.component.onDeactivate()
      }
      
      const prevPane = contentEl?.querySelector(`[data-tab-id="${previousTabId}"]`)
      if (prevPane) {
        prevPane.classList.remove('active')
        prevPane.setAttribute('aria-hidden', 'true')
        prevTab?.component.unmount()
      }
      
      const prevButton = headerEl?.querySelector(`[data-tab-id="${previousTabId}"]`)
      if (prevButton) {
        prevButton.classList.remove('active')
        prevButton.setAttribute('aria-selected', 'false')
        prevButton.setAttribute('tabindex', '-1')
      }
    }
    
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) {
      console.error(`[TabsManager] Tab not found: ${tabId}`)
      return
    }
    
    const button = headerEl?.querySelector(`[data-tab-id="${tabId}"]`)
    if (button) {
      button.classList.add('active')
      button.setAttribute('aria-selected', 'true')
      button.setAttribute('tabindex', '0')
      ;(button as HTMLElement).focus()
    }
    
    const pane = contentEl?.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement
    if (pane) {
      pane.classList.add('active')
      pane.setAttribute('aria-hidden', 'false')
      
      tab.component.mount(pane)
      
      if (tab.component.onActivate) {
        tab.component.onActivate()
      }
    }
    
    state.previousTab = previousTabId
    state.activeTab = tabId
    saveState()
    
    history.replaceState(null, '', setParam('tab', tabId))
    
    console.log(`[TabsManager] Switched to tab: ${tabId}`)
  }
  
  function getActive(): TabId {
    return state.activeTab
  }
  
  async function refresh() {
    const tab = tabs.find(t => t.id === state.activeTab)
    if (tab?.component.refresh) {
      await tab.component.refresh()
    }
  }
  
  function setupKeyboardShortcuts() {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const currentIndex = tabs.findIndex(t => t.id === state.activeTab)
        const nextIndex = (currentIndex + 1) % tabs.length
        switchTo(tabs[nextIndex].id)
      }
      
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const currentIndex = tabs.findIndex(t => t.id === state.activeTab)
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        switchTo(tabs[prevIndex].id)
      }
      
      if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (tabs[index]) {
          switchTo(tabs[index].id)
        }
      }
    }
    
    document.addEventListener('keydown', keyHandler)
    listeners.push(() => document.removeEventListener('keydown', keyHandler))
  }
  
  function loadState() {
    const urlTab = getParam('tab')
    if (urlTab && tabs.some(t => t.id === urlTab)) {
      state.activeTab = urlTab as TabId
      return
    }
    
    try {
      const saved = localStorage.getItem(CONFIG.storage.tabStateKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.version === CONFIG.version && tabs.some(t => t.id === parsed.activeTab)) {
          state.activeTab = parsed.activeTab
        }
      }
    } catch (e) {
      console.warn('[TabsManager] Failed to load state:', e)
    }
  }
  
  function saveState() {
    try {
      localStorage.setItem(CONFIG.storage.tabStateKey, JSON.stringify({
        version: CONFIG.version,
        activeTab: state.activeTab,
      }))
    } catch (e) {
      console.warn('[TabsManager] Failed to save state:', e)
    }
  }
  
  function destroy() {
    tabs.forEach(tab => {
      tab.component.unmount()
    })
    
    listeners.forEach(cleanup => cleanup())
    listeners.length = 0
    
    if (container) {
      container.innerHTML = ''
    }
    
    console.log('[TabsManager] Destroyed')
  }
  
  return {
    init,
    switchTo,
    getActive,
    refresh,
    destroy,
  }
}
