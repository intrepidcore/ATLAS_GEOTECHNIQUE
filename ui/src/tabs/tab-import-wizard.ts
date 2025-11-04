/**
 * Onglet "Import Wizard"
 * Wrapper pour import-wizard-v2.ts
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs'

export function createTabImportWizard(): TabComponent {
  let container: HTMLElement | null = null
  
  function mount(containerEl: HTMLElement) {
    container = containerEl
    render()
  }
  
  function unmount() {
    if (container) {
      container.innerHTML = ''
    }
  }
  
  function render() {
    if (!container) return
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; text-align: center; color: var(--tab-text); min-height: 300px;">
        <div style="font-size: 56px; margin-bottom: 16px; opacity: 0.4;">📥</div>
        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--tab-text-primary);">Import Wizard</h3>
        <p style="font-size: 14px; max-width: 400px; line-height: 1.5; margin-bottom: 24px;">
          Importez vos données géotechniques depuis Excel, CSV ou autres formats.
          L'assistant vous guidera étape par étape.
        </p>
        <button id="btn-open-import" class="btn-primary" style="padding: 12px 24px; font-size: 16px;">
          📥 Ouvrir l'Import Wizard
        </button>
      </div>
    `
    
    const btn = container.querySelector('#btn-open-import')
    if (btn) {
      btn.addEventListener('click', openImportWizard)
    }
  }
  
  function openImportWizard() {
    console.log('[TabImportWizard] Opening Import Wizard v2.3.0')
    window.dispatchEvent(new CustomEvent('open-import-wizard'))
  }
  
  function onActivate() {
    console.log('[TabImportWizard] Activated')
  }
  
  return {
    mount,
    unmount,
    onActivate,
  }
}
