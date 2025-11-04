# 🔧 IMPLÉMENTATION PR2-5 - Panneau QGIS v2.5.0

**Suite de**: `REFACTOR_PANEL_QGIS_IMPLEMENTATION.md`

---

## 📝 PR2: CONTAINER ONGLETS + ONGLET NOUVEAU

### 2.1 Créer `src/tabs/tab-manager.ts`

```typescript
/**
 * Gestionnaire d'onglets QGIS-like
 * v2.5.0 - Phase UI-01
 */

import { Tab, TabId, TabsState, TabsManager } from '../types/tabs';
import { CONFIG } from '../config';

export function createTabsManager(): TabsManager {
  let state: TabsState = {
    activeTab: CONFIG.ui.defaultTab,
    previousTab: null,
  };
  
  let tabs: Tab[] = [];
  let container: HTMLElement | null = null;
  let headerEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  
  // Listeners pour cleanup
  const listeners: Array<() => void> = [];
  
  /**
   * Initialise le gestionnaire
   */
  function init(containerEl: HTMLElement, tabsConfig: Tab[]) {
    container = containerEl;
    tabs = tabsConfig;
    
    // Charger l'état depuis localStorage
    loadState();
    
    // Créer la structure HTML
    render();
    
    // Activer l'onglet initial
    switchTo(state.activeTab);
    
    // Raccourcis clavier
    setupKeyboardShortcuts();
    
    console.log('[TabsManager] Initialized with tabs:', tabs.map(t => t.id));
  }
  
  /**
   * Rend la structure HTML
   */
  function render() {
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'tabs-container';
    
    // Header (barre d'onglets)
    headerEl = document.createElement('div');
    headerEl.className = 'tabs-header';
    headerEl.setAttribute('role', 'tablist');
    
    tabs.forEach((tab, index) => {
      const button = createTabButton(tab, index);
      headerEl!.appendChild(button);
    });
    
    // Content (contenu des onglets)
    contentEl = document.createElement('div');
    contentEl.className = 'tabs-content';
    
    tabs.forEach(tab => {
      const pane = createTabPane(tab);
      contentEl!.appendChild(pane);
    });
    
    container.appendChild(headerEl);
    container.appendChild(contentEl);
  }
  
  /**
   * Crée un bouton d'onglet
   */
  function createTabButton(tab: Tab, index: number): HTMLElement {
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `tab-pane-${tab.id}`);
    button.setAttribute('aria-selected', 'false');
    button.setAttribute('tabindex', '-1');
    button.dataset.tabId = tab.id;
    
    // Icône
    const icon = document.createElement('span');
    icon.className = 'tab-icon';
    icon.textContent = tab.icon;
    
    // Label
    const label = document.createElement('span');
    label.textContent = tab.label;
    
    button.appendChild(icon);
    button.appendChild(label);
    
    // Badge (si fonction fournie)
    if (tab.badge) {
      const badgeCount = tab.badge();
      if (badgeCount && badgeCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = badgeCount.toString();
        button.appendChild(badge);
      }
    }
    
    // Click handler
    const clickHandler = () => switchTo(tab.id);
    button.addEventListener('click', clickHandler);
    listeners.push(() => button.removeEventListener('click', clickHandler));
    
    return button;
  }
  
  /**
   * Crée un panneau d'onglet
   */
  function createTabPane(tab: Tab): HTMLElement {
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.id = `tab-pane-${tab.id}`;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', `tab-${tab.id}`);
    pane.setAttribute('aria-hidden', 'true');
    pane.dataset.tabId = tab.id;
    
    return pane;
  }
  
  /**
   * Bascule vers un onglet
   */
  function switchTo(tabId: TabId) {
    const previousTabId = state.activeTab;
    
    // Désactiver l'onglet précédent
    if (previousTabId) {
      const prevTab = tabs.find(t => t.id === previousTabId);
      if (prevTab?.component.onDeactivate) {
        prevTab.component.onDeactivate();
      }
      
      // Démonter le composant
      const prevPane = contentEl?.querySelector(`[data-tab-id="${previousTabId}"]`);
      if (prevPane) {
        prevPane.classList.remove('active');
        prevPane.setAttribute('aria-hidden', 'true');
        prevTab?.component.unmount();
      }
      
      // Désactiver le bouton
      const prevButton = headerEl?.querySelector(`[data-tab-id="${previousTabId}"]`);
      if (prevButton) {
        prevButton.classList.remove('active');
        prevButton.setAttribute('aria-selected', 'false');
        prevButton.setAttribute('tabindex', '-1');
      }
    }
    
    // Activer le nouvel onglet
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) {
      console.error(`[TabsManager] Tab not found: ${tabId}`);
      return;
    }
    
    // Activer le bouton
    const button = headerEl?.querySelector(`[data-tab-id="${tabId}"]`);
    if (button) {
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      button.setAttribute('tabindex', '0');
      (button as HTMLElement).focus();
    }
    
    // Activer le panneau
    const pane = contentEl?.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement;
    if (pane) {
      pane.classList.add('active');
      pane.setAttribute('aria-hidden', 'false');
      
      // Monter le composant
      tab.component.mount(pane);
      
      if (tab.component.onActivate) {
        tab.component.onActivate();
      }
    }
    
    // Mettre à jour l'état
    state.previousTab = previousTabId;
    state.activeTab = tabId;
    saveState();
    
    // Émettre événement
    emitEvent('tab:changed', { from: previousTabId, to: tabId });
    
    console.log(`[TabsManager] Switched to tab: ${tabId}`);
  }
  
  /**
   * Retourne l'onglet actif
   */
  function getActive(): TabId {
    return state.activeTab;
  }
  
  /**
   * Rafraîchit l'onglet actif
   */
  async function refresh() {
    const tab = tabs.find(t => t.id === state.activeTab);
    if (tab?.component.refresh) {
      await tab.component.refresh();
    }
  }
  
  /**
   * Configure les raccourcis clavier
   */
  function setupKeyboardShortcuts() {
    const keyHandler = (e: KeyboardEvent) => {
      // Ctrl+Tab: onglet suivant
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === state.activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        switchTo(tabs[nextIndex].id);
      }
      
      // Ctrl+Shift+Tab: onglet précédent
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === state.activeTab);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        switchTo(tabs[prevIndex].id);
      }
      
      // Ctrl+1/2/3/4: accès direct
      if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (tabs[index]) {
          switchTo(tabs[index].id);
        }
      }
    };
    
    document.addEventListener('keydown', keyHandler);
    listeners.push(() => document.removeEventListener('keydown', keyHandler));
  }
  
  /**
   * Charge l'état depuis localStorage
   */
  function loadState() {
    try {
      const saved = localStorage.getItem(CONFIG.storage.tabStateKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (tabs.some(t => t.id === parsed.activeTab)) {
          state.activeTab = parsed.activeTab;
        }
      }
    } catch (e) {
      console.warn('[TabsManager] Failed to load state:', e);
    }
  }
  
  /**
   * Sauvegarde l'état dans localStorage
   */
  function saveState() {
    try {
      localStorage.setItem(CONFIG.storage.tabStateKey, JSON.stringify({
        activeTab: state.activeTab,
      }));
    } catch (e) {
      console.warn('[TabsManager] Failed to save state:', e);
    }
  }
  
  /**
   * Émet un événement
   */
  function emitEvent(type: string, detail: any) {
    const event = new CustomEvent(`tabs:${type}`, { detail });
    document.dispatchEvent(event);
  }
  
  /**
   * Détruit le gestionnaire
   */
  function destroy() {
    // Démonter tous les composants
    tabs.forEach(tab => {
      tab.component.unmount();
    });
    
    // Nettoyer les listeners
    listeners.forEach(cleanup => cleanup());
    listeners.length = 0;
    
    // Nettoyer le DOM
    if (container) {
      container.innerHTML = '';
    }
    
    console.log('[TabsManager] Destroyed');
  }
  
  return {
    init,
    switchTo,
    getActive,
    refresh,
    destroy,
  };
}
```

---

### 2.2 Créer `src/tabs/tab-nouveau.ts`

```typescript
/**
 * Onglet "Nouveau Sondage Géotechnique"
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs';

export function createTabNouveau(): TabComponent {
  let container: HTMLElement | null = null;
  let form: HTMLFormElement | null = null;
  
  function mount(containerEl: HTMLElement) {
    container = containerEl;
    render();
  }
  
  function unmount() {
    if (form) {
      form.removeEventListener('submit', handleSubmit);
    }
    if (container) {
      container.innerHTML = '';
    }
  }
  
  function render() {
    if (!container) return;
    
    container.innerHTML = `
      <div class="tab-content-wrapper">
        <div class="form-container">
          <h3 class="form-title">📝 Nouveau Sondage Géotechnique</h3>
          
          <form id="form-nouveau-sondage" class="form-nouveau">
            <!-- Informations de base -->
            <fieldset class="form-section">
              <legend>Informations de base</legend>
              
              <div class="form-group">
                <label for="code-site">Code site *</label>
                <input 
                  type="text" 
                  id="code-site" 
                  name="code_site" 
                  required 
                  placeholder="Ex: TEKPO_S1"
                  autocomplete="off"
                />
              </div>
              
              <div class="form-group">
                <label for="source">Source *</label>
                <input 
                  type="text" 
                  id="source" 
                  name="source" 
                  required 
                  placeholder="Ex: DAVIE, ETUDE_2024"
                  autocomplete="off"
                />
              </div>
              
              <div class="form-group">
                <label for="date-sondage">Date</label>
                <input 
                  type="date" 
                  id="date-sondage" 
                  name="date"
                />
              </div>
            </fieldset>
            
            <!-- Localisation -->
            <fieldset class="form-section">
              <legend>Localisation</legend>
              
              <div class="form-group">
                <label>Mode de localisation *</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="location_mode" value="exact" checked />
                    <span>Point exact (lat/lon)</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="location_mode" value="adm" />
                    <span>Zone administrative (ADM)</span>
                  </label>
                </div>
              </div>
              
              <!-- Champs lat/lon (affichés par défaut) -->
              <div id="exact-fields" class="location-fields">
                <div class="form-row">
                  <div class="form-group">
                    <label for="latitude">Latitude *</label>
                    <input 
                      type="number" 
                      id="latitude" 
                      name="latitude" 
                      step="0.000001"
                      min="6" 
                      max="12"
                      placeholder="Ex: 6.1234"
                    />
                  </div>
                  
                  <div class="form-group">
                    <label for="longitude">Longitude *</label>
                    <input 
                      type="number" 
                      id="longitude" 
                      name="longitude" 
                      step="0.000001"
                      min="-1" 
                      max="2"
                      placeholder="Ex: 1.2345"
                    />
                  </div>
                </div>
                
                <button type="button" class="btn-secondary" id="btn-pick-map">
                  🗺️ Cliquer sur la carte
                </button>
              </div>
              
              <!-- Champs ADM (cachés par défaut) -->
              <div id="adm-fields" class="location-fields" style="display: none;">
                <div class="form-group">
                  <label for="adm-level">Niveau ADM *</label>
                  <select id="adm-level" name="adm_level">
                    <option value="ADM3">ADM3 (Canton)</option>
                    <option value="ADM2">ADM2 (Préfecture)</option>
                    <option value="ADM1">ADM1 (Région)</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="adm-zone">Zone *</label>
                  <select id="adm-zone" name="adm_code">
                    <option value="">Sélectionner...</option>
                    <!-- Options chargées dynamiquement -->
                  </select>
                </div>
              </div>
            </fieldset>
            
            <!-- Actions -->
            <div class="form-actions">
              <button type="button" class="btn-secondary" id="btn-cancel">
                Annuler
              </button>
              <button type="submit" class="btn-primary">
                💾 Créer le sondage
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // Récupérer le formulaire
    form = container.querySelector('#form-nouveau-sondage');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
    
    // Toggle location mode
    setupLocationModeToggle();
    
    // Bouton "Cliquer sur carte"
    setupMapPicker();
    
    // Bouton "Annuler"
    setupCancelButton();
  }
  
  function setupLocationModeToggle() {
    if (!container) return;
    
    const radios = container.querySelectorAll('input[name="location_mode"]');
    const exactFields = container.querySelector('#exact-fields');
    const admFields = container.querySelector('#adm-fields');
    
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.value === 'exact') {
          exactFields?.removeAttribute('style');
          (admFields as HTMLElement).style.display = 'none';
        } else {
          (exactFields as HTMLElement).style.display = 'none';
          admFields?.removeAttribute('style');
          loadAdmZones();
        }
      });
    });
  }
  
  function setupMapPicker() {
    const btn = container?.querySelector('#btn-pick-map');
    if (btn) {
      btn.addEventListener('click', () => {
        // TODO: Activer le mode "pick" sur la carte
        console.log('[TabNouveau] Map picker activated');
        alert('Cliquez sur la carte pour sélectionner un point');
      });
    }
  }
  
  function setupCancelButton() {
    const btn = container?.querySelector('#btn-cancel');
    if (btn) {
      btn.addEventListener('click', () => {
        if (form) {
          form.reset();
        }
      });
    }
  }
  
  async function loadAdmZones() {
    const select = container?.querySelector('#adm-zone') as HTMLSelectElement;
    if (!select) return;
    
    try {
      const response = await fetch('/adm3');
      const zones = await response.json();
      
      select.innerHTML = '<option value="">Sélectionner...</option>';
      zones.forEach((zone: any) => {
        const option = document.createElement('option');
        option.value = zone.code;
        option.textContent = `${zone.name} (${zone.prefecture})`;
        select.appendChild(option);
      });
    } catch (e) {
      console.error('[TabNouveau] Failed to load ADM zones:', e);
    }
  }
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!form) return;
    
    const formData = new FormData(form);
    const data: any = Object.fromEntries(formData.entries());
    
    // Validation
    if (!data.code_site || !data.source) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      const response = await fetch('/surveys/geotech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[TabNouveau] Survey created:', result);
      
      // Reset form
      form.reset();
      
      // Notification
      alert(`✅ Sondage "${data.code_site}" créé avec succès!`);
      
      // Émettre événement pour rafraîchir la liste
      document.dispatchEvent(new CustomEvent('survey:created', { detail: result }));
      
    } catch (e) {
      console.error('[TabNouveau] Failed to create survey:', e);
      alert('❌ Erreur lors de la création du sondage');
    }
  }
  
  return {
    mount,
    unmount,
  };
}
```

---

### 2.3 Modifier `src/main.ts` (Activer les onglets)

```typescript
import { CONFIG } from './config';
import { createTabsManager } from './tabs/tab-manager';
import { createTabNouveau } from './tabs/tab-nouveau';
import { Tab } from './types/tabs';

// ... code existant ...

function initTabsPanel() {
  console.log('[v2.5.0] Initialisation panneau à onglets');
  
  const container = document.querySelector('#right-panel');
  if (!container) {
    console.error('[v2.5.0] Container #right-panel not found');
    return;
  }
  
  // Définir les onglets
  const tabs: Tab[] = [
    {
      id: 'nouveau',
      label: 'Nouveau',
      icon: '📝',
      component: createTabNouveau(),
    },
    // TODO: PR3 - Ajouter import et liste
    // TODO: PR4-5 - Ajouter geocode
  ];
  
  // Créer et initialiser le gestionnaire
  const manager = createTabsManager();
  manager.init(container as HTMLElement, tabs);
  
  // Exposer globalement pour debug
  (window as any).__tabsManager = manager;
}
```

---

## ✅ CHECKLIST PR2

### Tests Fonctionnels
- [ ] Feature flag ON → Onglets s'affichent
- [ ] Onglet "Nouveau" est actif par défaut
- [ ] Formulaire "Nouveau Sondage" s'affiche
- [ ] Toggle location mode fonctionne (exact ↔ ADM)
- [ ] Bouton "Annuler" reset le formulaire
- [ ] Submit crée un sondage (API call)

### Tests Clavier
- [ ] Ctrl+Tab → onglet suivant
- [ ] Ctrl+Shift+Tab → onglet précédent
- [ ] Ctrl+1 → onglet "Nouveau"
- [ ] Tab/Shift+Tab → navigation dans le formulaire
- [ ] Enter → submit formulaire

### Tests Accessibilité
- [ ] Attributs ARIA corrects (role, aria-selected, aria-controls)
- [ ] Focus visible sur les onglets
- [ ] Labels associés aux inputs (for/id)
- [ ] Fieldsets avec legend

### Tests Persistance
- [ ] Onglet actif sauvegardé dans localStorage
- [ ] Rechargement → onglet actif restauré

---

## 📝 PR3: ONGLETS IMPORT & LISTE

### 3.1 Créer `src/tabs/tab-import-wizard.ts`

```typescript
/**
 * Onglet "Import Wizard"
 * Wrapper pour import-wizard-v2.ts en modal plein écran
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs';

export function createTabImportWizard(): TabComponent {
  let container: HTMLElement | null = null;
  let modal: HTMLElement | null = null;
  
  function mount(containerEl: HTMLElement) {
    container = containerEl;
    render();
  }
  
  function unmount() {
    closeModal();
    if (container) {
      container.innerHTML = '';
    }
  }
  
  function render() {
    if (!container) return;
    
    container.innerHTML = `
      <div class="tab-content-wrapper">
        <div class="empty-state">
          <div class="empty-state-icon">📥</div>
          <h3 class="empty-state-title">Import Wizard</h3>
          <p class="empty-state-description">
            Importez vos données géotechniques depuis Excel, CSV ou autres formats.
            L'assistant vous guidera étape par étape.
          </p>
          <div class="empty-state-action">
            <button id="btn-open-import" class="btn-primary btn-large">
              📥 Ouvrir l'Import Wizard
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Bouton pour ouvrir le wizard
    const btn = container.querySelector('#btn-open-import');
    if (btn) {
      btn.addEventListener('click', openModal);
    }
  }
  
  function openModal() {
    // Créer la modal plein écran
    modal = document.createElement('div');
    modal.className = 'import-wizard-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content modal-fullscreen">
        <div class="modal-header">
          <h2>📥 Import Wizard</h2>
          <button class="btn-close" aria-label="Fermer">×</button>
        </div>
        <div class="modal-body" id="import-wizard-container">
          <!-- Import Wizard sera monté ici -->
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Bouton fermer
    const btnClose = modal.querySelector('.btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', closeModal);
    }
    
    // Fermer avec Escape
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Monter l'Import Wizard
    const wizardContainer = modal.querySelector('#import-wizard-container');
    if (wizardContainer) {
      // TODO: Intégrer import-wizard-v2.ts ici
      console.log('[TabImportWizard] Mounting wizard in:', wizardContainer);
      
      // Placeholder temporaire
      wizardContainer.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <p>🚧 Import Wizard v2 sera intégré ici</p>
          <p style="margin-top: 16px; color: #8aa0b5;">
            Module existant: <code>import-wizard-v2.ts</code>
          </p>
        </div>
      `;
    }
    
    // Focus trap
    modal.querySelector('.btn-close')?.focus();
  }
  
  function closeModal() {
    if (modal) {
      modal.remove();
      modal = null;
    }
  }
  
  function onActivate() {
    console.log('[TabImportWizard] Activated');
  }
  
  function onDeactivate() {
    closeModal();
  }
  
  return {
    mount,
    unmount,
    onActivate,
    onDeactivate,
  };
}
```

---

### 3.2 Créer `src/tabs/tab-liste-sondages.ts`

```typescript
/**
 * Onglet "Liste Sondages"
 * Tableau filtrable des sondages avec recherche
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs';

interface Survey {
  id: string;
  code: string;
  source: string;
  location_mode: string;
  adm3_name: string | null;
  has_geom: boolean;
  created_at: string;
}

interface Filters {
  search: string;
  location_mode: string;
  has_geom: string;
}

export function createTabListeSondages(): TabComponent {
  let container: HTMLElement | null = null;
  let surveys: Survey[] = [];
  let filteredSurveys: Survey[] = [];
  let filters: Filters = {
    search: '',
    location_mode: 'all',
    has_geom: 'all',
  };
  
  function mount(containerEl: HTMLElement) {
    container = containerEl;
    render();
    loadSurveys();
  }
  
  function unmount() {
    if (container) {
      container.innerHTML = '';
    }
  }
  
  function render() {
    if (!container) return;
    
    container.innerHTML = `
      <div class="tab-content-wrapper">
        <!-- Toolbar -->
        <div class="tab-toolbar">
          <div class="tab-toolbar-group">
            <input 
              type="search" 
              id="search-surveys" 
              placeholder="🔍 Rechercher par code ou source..."
              class="search-input"
              value="${filters.search}"
            />
          </div>
          
          <div class="tab-toolbar-separator"></div>
          
          <div class="tab-toolbar-group">
            <label for="filter-mode">Mode:</label>
            <select id="filter-mode" class="filter-select">
              <option value="all">Tous</option>
              <option value="exact">Exact</option>
              <option value="adm_random_cell">ADM random</option>
              <option value="spread">Spread</option>
            </select>
          </div>
          
          <div class="tab-toolbar-group">
            <label for="filter-geom">Géométrie:</label>
            <select id="filter-geom" class="filter-select">
              <option value="all">Tous</option>
              <option value="true">Avec</option>
              <option value="false">Sans</option>
            </select>
          </div>
          
          <div class="tab-toolbar-separator"></div>
          
          <button id="btn-refresh" class="btn-icon" title="Rafraîchir">
            🔄
          </button>
        </div>
        
        <!-- Table -->
        <div class="table-container">
          <table class="data-table" id="surveys-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Source</th>
                <th>Mode</th>
                <th>ADM3</th>
                <th>Géom</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="surveys-tbody">
              <!-- Lignes chargées dynamiquement -->
            </tbody>
          </table>
          
          <div id="loading-state" class="loading-state" style="display: none;">
            <div class="spinner"></div>
            <p>Chargement des sondages...</p>
          </div>
          
          <div id="empty-state" class="empty-state" style="display: none;">
            <div class="empty-state-icon">📋</div>
            <h3 class="empty-state-title">Aucun sondage</h3>
            <p class="empty-state-description">
              Aucun sondage ne correspond à vos critères de recherche.
            </p>
          </div>
        </div>
        
        <!-- Stats -->
        <div class="table-footer">
          <span id="surveys-count">0 sondages</span>
        </div>
      </div>
    `;
    
    // Setup event listeners
    setupFilters();
    setupRefreshButton();
  }
  
  function setupFilters() {
    if (!container) return;
    
    const searchInput = container.querySelector('#search-surveys') as HTMLInputElement;
    const modeSelect = container.querySelector('#filter-mode') as HTMLSelectElement;
    const geomSelect = container.querySelector('#filter-geom') as HTMLSelectElement;
    
    // Debounced search
    let searchTimeout: number;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        filters.search = (e.target as HTMLInputElement).value.toLowerCase();
        applyFilters();
      }, 300);
    });
    
    modeSelect?.addEventListener('change', (e) => {
      filters.location_mode = (e.target as HTMLSelectElement).value;
      applyFilters();
    });
    
    geomSelect?.addEventListener('change', (e) => {
      filters.has_geom = (e.target as HTMLSelectElement).value;
      applyFilters();
    });
  }
  
  function setupRefreshButton() {
    const btn = container?.querySelector('#btn-refresh');
    if (btn) {
      btn.addEventListener('click', () => {
        loadSurveys();
      });
    }
  }
  
  async function loadSurveys() {
    if (!container) return;
    
    const loadingState = container.querySelector('#loading-state') as HTMLElement;
    const emptyState = container.querySelector('#empty-state') as HTMLElement;
    const tbody = container.querySelector('#surveys-tbody');
    
    // Show loading
    if (tbody) tbody.innerHTML = '';
    if (loadingState) loadingState.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';
    
    try {
      const response = await fetch('/surveys');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      surveys = await response.json();
      filteredSurveys = surveys;
      
      applyFilters();
      
    } catch (e) {
      console.error('[TabListeSondages] Failed to load surveys:', e);
      if (loadingState) loadingState.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.querySelector('.empty-state-description')!.textContent = 
          '❌ Erreur lors du chargement des sondages';
      }
    }
  }
  
  function applyFilters() {
    if (!container) return;
    
    // Filtrer les sondages
    filteredSurveys = surveys.filter(survey => {
      // Recherche textuelle
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchCode = survey.code.toLowerCase().includes(searchLower);
        const matchSource = survey.source.toLowerCase().includes(searchLower);
        if (!matchCode && !matchSource) return false;
      }
      
      // Filtre mode
      if (filters.location_mode !== 'all') {
        if (survey.location_mode !== filters.location_mode) return false;
      }
      
      // Filtre géométrie
      if (filters.has_geom !== 'all') {
        const hasGeom = filters.has_geom === 'true';
        if (survey.has_geom !== hasGeom) return false;
      }
      
      return true;
    });
    
    renderTable();
  }
  
  function renderTable() {
    if (!container) return;
    
    const tbody = container.querySelector('#surveys-tbody');
    const loadingState = container.querySelector('#loading-state') as HTMLElement;
    const emptyState = container.querySelector('#empty-state') as HTMLElement;
    const countEl = container.querySelector('#surveys-count');
    
    if (loadingState) loadingState.style.display = 'none';
    
    if (filteredSurveys.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      if (countEl) countEl.textContent = '0 sondages';
      return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // Render rows
    if (tbody) {
      tbody.innerHTML = filteredSurveys.map(survey => `
        <tr data-survey-id="${survey.id}">
          <td><strong>${survey.code}</strong></td>
          <td>${survey.source}</td>
          <td>
            <span class="badge badge-${survey.location_mode}">
              ${formatLocationMode(survey.location_mode)}
            </span>
          </td>
          <td>${survey.adm3_name || '-'}</td>
          <td>
            ${survey.has_geom 
              ? '<span class="status-icon">✅</span>' 
              : '<span class="status-icon">❌</span>'}
          </td>
          <td>${formatDate(survey.created_at)}</td>
          <td>
            <button class="btn-icon btn-view" data-id="${survey.id}" title="Voir">
              👁️
            </button>
            <button class="btn-icon btn-edit" data-id="${survey.id}" title="Éditer">
              ✏️
            </button>
          </td>
        </tr>
      `).join('');
      
      // Setup row actions
      tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = (e.target as HTMLElement).dataset.id;
          viewSurvey(id!);
        });
      });
      
      tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = (e.target as HTMLElement).dataset.id;
          editSurvey(id!);
        });
      });
    }
    
    // Update count
    if (countEl) {
      countEl.textContent = `${filteredSurveys.length} sondage${filteredSurveys.length > 1 ? 's' : ''}`;
    }
  }
  
  function formatLocationMode(mode: string): string {
    const modes: Record<string, string> = {
      'exact': 'Exact',
      'adm_random_cell': 'ADM random',
      'spread': 'Spread',
    };
    return modes[mode] || mode;
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  function viewSurvey(id: string) {
    console.log('[TabListeSondages] View survey:', id);
    // TODO: Ouvrir modal détails ou naviguer vers page détails
    alert(`Voir sondage: ${id}`);
  }
  
  function editSurvey(id: string) {
    console.log('[TabListeSondages] Edit survey:', id);
    // TODO: Ouvrir modal édition
    alert(`Éditer sondage: ${id}`);
  }
  
  async function refresh() {
    await loadSurveys();
  }
  
  function onActivate() {
    console.log('[TabListeSondages] Activated');
    // Rafraîchir si les données sont anciennes
    if (surveys.length === 0) {
      loadSurveys();
    }
  }
  
  return {
    mount,
    unmount,
    refresh,
    onActivate,
  };
}
```

---

### 3.3 Modifier `src/main.ts` (Ajouter onglets Import & Liste)

```typescript
import { createTabImportWizard } from './tabs/tab-import-wizard';
import { createTabListeSondages } from './tabs/tab-liste-sondages';

// ... dans initTabsPanel() ...

const tabs: Tab[] = [
  {
    id: 'nouveau',
    label: 'Nouveau',
    icon: '📝',
    component: createTabNouveau(),
  },
  {
    id: 'import',
    label: 'Import',
    icon: '📥',
    component: createTabImportWizard(),
  },
  {
    id: 'liste',
    label: 'Liste',
    icon: '📋',
    component: createTabListeSondages(),
  },
  // TODO: PR4-5 - Ajouter geocode
];
```

---

### 3.4 Ajouter CSS pour la table

Ajouter dans `src/styles/tabs.css`:

```css
/* ============================================
   TABLE
   ============================================ */

.table-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table thead {
  position: sticky;
  top: 0;
  background: var(--tab-bg);
  z-index: 10;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--tab-text-primary);
  border-bottom: 2px solid var(--tab-border);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--tab-border);
  color: var(--tab-text);
}

.data-table tbody tr:hover {
  background: var(--tab-bg-hover);
}

/* Badges */
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-exact {
  background: #0bb07b;
  color: white;
}

.badge-adm_random_cell {
  background: #3aa6ff;
  color: white;
}

.badge-spread {
  background: #ff9f43;
  color: white;
}

/* Status icons */
.status-icon {
  font-size: 16px;
}

/* Loading state */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  color: var(--tab-text);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--tab-border);
  border-top-color: var(--tab-text-active);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Table footer */
.table-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--tab-border);
  background: var(--tab-bg);
  font-size: 13px;
  color: var(--tab-text);
}

/* Search input */
.search-input {
  min-width: 300px;
  padding: 8px 12px;
  background: var(--bg-input, #0b1220);
  border: 1px solid var(--tab-border);
  border-radius: 4px;
  color: var(--tab-text-primary);
  font-size: 13px;
}

.search-input:focus {
  outline: 2px solid var(--tab-text-active);
  outline-offset: -1px;
}

/* Filter select */
.filter-select {
  padding: 6px 10px;
  background: var(--bg-input, #0b1220);
  border: 1px solid var(--tab-border);
  border-radius: 4px;
  color: var(--tab-text-primary);
  font-size: 13px;
  cursor: pointer;
}

/* Button icon */
.btn-icon {
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--tab-border);
  border-radius: 4px;
  color: var(--tab-text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-icon:hover {
  background: var(--tab-bg-hover);
  color: var(--tab-text-primary);
}
```

---

## ✅ CHECKLIST PR3

### Tests Fonctionnels
- [ ] Onglet "Import" s'affiche
- [ ] Bouton "Ouvrir Import Wizard" ouvre modal plein écran
- [ ] Modal se ferme avec bouton × ou Escape
- [ ] Onglet "Liste" s'affiche
- [ ] Table des sondages se charge
- [ ] Recherche filtre en temps réel
- [ ] Filtres (mode, géométrie) fonctionnent
- [ ] Bouton rafraîchir recharge les données
- [ ] Compteur affiche le bon nombre

### Tests Clavier
- [ ] Ctrl+2 → onglet Import
- [ ] Ctrl+3 → onglet Liste
- [ ] Tab dans la recherche
- [ ] Escape ferme la modal Import

### Tests Performance
- [ ] Recherche debounced (300ms)
- [ ] Table virtualisée si > 1000 lignes (optionnel)
- [ ] Pas de lag lors du filtrage

---

## 📝 PR4: ONGLET GÉOCODAGE (Structure)

### 4.1 Créer `src/geocode/geocode-api.ts`

```typescript
/**
 * Client API pour le géocodage
 * v2.5.0 - Phase UI-01
 */

import { 
  SurveyToGeocode, 
  GeocodePayload, 
  GeocodeSuggestion, 
  GeocodeStats 
} from '../types/geocode';

/**
 * Récupère les sondages sans géométrie
 */
export async function fetchSurveysWithoutGeom(): Promise<SurveyToGeocode[]> {
  const response = await fetch('/surveys/ungeocode');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Géocode un sondage
 */
export async function geocodeSurvey(payload: GeocodePayload): Promise<void> {
  const response = await fetch(`/surveys/${payload.survey_id}/geocode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: payload.method,
      ...payload.data,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP ${response.status}`);
  }
}

/**
 * Récupère les suggestions de géocodage
 */
export async function fetchSuggestions(): Promise<GeocodeSuggestion[]> {
  const response = await fetch('/geocode/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'pending' }),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Accepte une suggestion
 */
export async function acceptSuggestion(id: string): Promise<void> {
  const response = await fetch(`/geocode/suggestions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'accepted' }),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/**
 * Rejette une suggestion
 */
export async function rejectSuggestion(id: string): Promise<void> {
  const response = await fetch(`/geocode/suggestions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected' }),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/**
 * Modifie une suggestion
 */
export async function modifySuggestion(id: string, adm3Code: string): Promise<void> {
  const response = await fetch(`/geocode/suggestions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      status: 'accepted',
      adm3_code_override: adm3Code,
    }),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/**
 * Applique les suggestions acceptées
 */
export async function applyAcceptedSuggestions(): Promise<{ updated: number }> {
  const response = await fetch('/geocode/apply-accepted', {
    method: 'POST',
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Récupère les statistiques de géocodage
 */
export async function fetchGeocodeStats(): Promise<GeocodeStats> {
  const response = await fetch('/geocode/stats');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

### 4.2 Créer `src/geocode/geocode-drawer.ts`

```typescript
/**
 * Drawer de géocodage (modal latérale)
 * v2.5.0 - Phase UI-01
 */

import { SurveyToGeocode, GeocodePayload } from '../types/geocode';
import { geocodeSurvey } from './geocode-api';

export function createGeocodeDrawer() {
  let drawer: HTMLElement | null = null;
  let currentSurvey: SurveyToGeocode | null = null;
  let onSuccess: (() => void) | null = null;
  
  function open(survey: SurveyToGeocode, successCallback: () => void) {
    currentSurvey = survey;
    onSuccess = successCallback;
    render();
  }
  
  function close() {
    if (drawer) {
      drawer.remove();
      drawer = null;
    }
    currentSurvey = null;
    onSuccess = null;
  }
  
  function render() {
    if (!currentSurvey) return;
    
    // Créer le drawer
    drawer = document.createElement('div');
    drawer.className = 'geocode-drawer';
    drawer.innerHTML = `
      <div class="drawer-overlay"></div>
      <div class="drawer-content">
        <div class="drawer-header">
          <h3>🗺️ Géocoder: ${currentSurvey.code}</h3>
          <button class="btn-close" aria-label="Fermer">×</button>
        </div>
        
        <div class="drawer-body">
          <!-- Mode selection -->
          <div class="form-section">
            <label class="section-label">Mode de géocodage</label>
            
            <div class="radio-group-vertical">
              <label class="radio-card">
                <input type="radio" name="geocode-mode" value="exact" checked />
                <div class="radio-card-content">
                  <strong>📍 Point exact (lat/lon)</strong>
                  <p>Saisir les coordonnées GPS précises</p>
                </div>
              </label>
              
              <label class="radio-card">
                <input type="radio" name="geocode-mode" value="adm" />
                <div class="radio-card-content">
                  <strong>🗺️ Zone administrative (ADM)</strong>
                  <p>Placer dans une maille aléatoire déterministe</p>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Exact mode fields -->
          <div id="exact-mode-fields" class="mode-fields">
            <div class="form-group">
              <label for="geocode-lat">Latitude *</label>
              <input 
                type="number" 
                id="geocode-lat" 
                step="0.000001" 
                min="6" 
                max="12"
                placeholder="Ex: 6.1234"
              />
            </div>
            
            <div class="form-group">
              <label for="geocode-lon">Longitude *</label>
              <input 
                type="number" 
                id="geocode-lon" 
                step="0.000001" 
                min="-1" 
                max="2"
                placeholder="Ex: 1.2345"
              />
            </div>
            
            <div class="form-actions-inline">
              <button type="button" class="btn-secondary" id="btn-center-map">
                📍 Centrer la carte
              </button>
              <button type="button" class="btn-secondary" id="btn-pick-map">
                🖱️ Cliquer sur la carte
              </button>
            </div>
          </div>
          
          <!-- ADM mode fields -->
          <div id="adm-mode-fields" class="mode-fields" style="display: none;">
            <div class="form-group">
              <label for="geocode-adm-level">Niveau ADM *</label>
              <select id="geocode-adm-level">
                <option value="ADM3">ADM3 (Canton)</option>
                <option value="ADM2">ADM2 (Préfecture)</option>
                <option value="ADM1">ADM1 (Région)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="geocode-adm-zone">Zone *</label>
              <select id="geocode-adm-zone">
                <option value="">Sélectionner...</option>
              </select>
            </div>
            
            <div class="info-box">
              <strong>ℹ️ Mode ADM random cell</strong>
              <p>Le sondage sera placé dans une maille aléatoire déterministe de la zone sélectionnée.</p>
            </div>
          </div>
        </div>
        
        <div class="drawer-footer">
          <button type="button" class="btn-secondary" id="btn-cancel">
            Annuler
          </button>
          <button type="button" class="btn-primary" id="btn-save">
            💾 Enregistrer
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(drawer);
    
    // Setup event listeners
    setupModeToggle();
    setupButtons();
    setupEscapeKey();
    
    // Focus premier input
    drawer.querySelector<HTMLInputElement>('#geocode-lat')?.focus();
  }
  
  function setupModeToggle() {
    if (!drawer) return;
    
    const radios = drawer.querySelectorAll('input[name="geocode-mode"]');
    const exactFields = drawer.querySelector('#exact-mode-fields') as HTMLElement;
    const admFields = drawer.querySelector('#adm-mode-fields') as HTMLElement;
    
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.value === 'exact') {
          exactFields.style.display = 'block';
          admFields.style.display = 'none';
        } else {
          exactFields.style.display = 'none';
          admFields.style.display = 'block';
          loadAdmZones();
        }
      });
    });
  }
  
  function setupButtons() {
    if (!drawer) return;
    
    // Bouton fermer
    drawer.querySelector('.btn-close')?.addEventListener('click', close);
    drawer.querySelector('#btn-cancel')?.addEventListener('click', close);
    
    // Bouton sauvegarder
    drawer.querySelector('#btn-save')?.addEventListener('click', handleSave);
    
    // Boutons carte
    drawer.querySelector('#btn-center-map')?.addEventListener('click', () => {
      console.log('[GeocodeDrawer] Center map');
      // TODO: Centrer la carte sur les coordonnées
    });
    
    drawer.querySelector('#btn-pick-map')?.addEventListener('click', () => {
      console.log('[GeocodeDrawer] Pick from map');
      // TODO: Activer le mode pick sur la carte
    });
  }
  
  function setupEscapeKey() {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    
    // Cleanup on close
    const originalClose = close;
    close = () => {
      document.removeEventListener('keydown', handler);
      originalClose();
    };
  }
  
  async function loadAdmZones() {
    if (!drawer) return;
    
    const select = drawer.querySelector('#geocode-adm-zone') as HTMLSelectElement;
    if (!select) return;
    
    try {
      const response = await fetch('/adm3');
      const zones = await response.json();
      
      select.innerHTML = '<option value="">Sélectionner...</option>';
      zones.forEach((zone: any) => {
        const option = document.createElement('option');
        option.value = zone.code;
        option.textContent = `${zone.name} (${zone.prefecture})`;
        select.appendChild(option);
      });
    } catch (e) {
      console.error('[GeocodeDrawer] Failed to load ADM zones:', e);
    }
  }
  
  async function handleSave() {
    if (!drawer || !currentSurvey) return;
    
    const mode = drawer.querySelector<HTMLInputElement>('input[name="geocode-mode"]:checked')?.value;
    
    let payload: GeocodePayload;
    
    if (mode === 'exact') {
      const lat = parseFloat(drawer.querySelector<HTMLInputElement>('#geocode-lat')!.value);
      const lon = parseFloat(drawer.querySelector<HTMLInputElement>('#geocode-lon')!.value);
      
      if (isNaN(lat) || isNaN(lon)) {
        alert('❌ Veuillez saisir des coordonnées valides');
        return;
      }
      
      payload = {
        survey_id: currentSurvey.id,
        method: 'exact',
        data: { latitude: lat, longitude: lon },
      };
    } else {
      const admCode = drawer.querySelector<HTMLSelectElement>('#geocode-adm-zone')!.value;
      const admLevel = drawer.querySelector<HTMLSelectElement>('#geocode-adm-level')!.value as 'ADM1' | 'ADM2' | 'ADM3';
      
      if (!admCode) {
        alert('❌ Veuillez sélectionner une zone');
        return;
      }
      
      payload = {
        survey_id: currentSurvey.id,
        method: 'adm_random_cell',
        data: { adm_level: admLevel, adm_code: admCode },
      };
    }
    
    try {
      await geocodeSurvey(payload);
      console.log('[GeocodeDrawer] Survey geocoded:', currentSurvey.code);
      
      if (onSuccess) {
        onSuccess();
      }
      
      close();
    } catch (e) {
      console.error('[GeocodeDrawer] Failed to geocode:', e);
      alert('❌ Erreur lors du géocodage');
    }
  }
  
  return {
    open,
    close,
  };
}
```

---

### 4.3 CSS pour le drawer

Ajouter dans `src/styles/tabs.css`:

```css
/* ============================================
   DRAWER (Modal latérale)
   ============================================ */

.geocode-drawer {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.drawer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}

.drawer-content {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 500px;
  max-width: 90vw;
  background: var(--bg-panel, #0f172a);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--tab-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--tab-text-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--tab-border);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Radio cards */
.radio-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-card {
  display: block;
  padding: 16px;
  border: 2px solid var(--tab-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-card:hover {
  border-color: var(--tab-text-active);
  background: var(--tab-bg-hover);
}

.radio-card input[type="radio"] {
  margin-right: 12px;
}

.radio-card input[type="radio"]:checked + .radio-card-content {
  color: var(--tab-text-active);
}

.radio-card-content p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: var(--tab-text);
}

/* Mode fields */
.mode-fields {
  margin-top: 24px;
}

.form-actions-inline {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Info box */
.info-box {
  margin-top: 16px;
  padding: 12px;
  background: rgba(58, 166, 255, 0.1);
  border-left: 3px solid var(--tab-text-active);
  border-radius: 4px;
}

.info-box strong {
  display: block;
  margin-bottom: 4px;
  color: var(--tab-text-active);
}

.info-box p {
  margin: 0;
  font-size: 13px;
  color: var(--tab-text);
}
```

---

## ✅ CHECKLIST PR4

### Tests Fonctionnels
- [ ] Drawer s'ouvre au clic "Géocoder"
- [ ] Toggle mode (exact ↔ ADM) fonctionne
- [ ] Champs lat/lon acceptent les décimales
- [ ] Select ADM3 se charge dynamiquement
- [ ] Bouton "Enregistrer" géocode le sondage
- [ ] Drawer se ferme après succès
- [ ] Erreurs affichées si validation échoue

### Tests Clavier
- [ ] Escape ferme le drawer
- [ ] Tab/Shift+Tab navigation
- [ ] Enter dans input → focus suivant

### Tests Accessibilité
- [ ] Focus piégé dans le drawer
- [ ] Labels associés aux inputs
- [ ] Bouton fermer accessible

---

## 📝 PR5: SUGGESTIONS ADM (Final)

### 5.1 Créer `src/tabs/tab-geocode.ts` (Complet)

```typescript
/**
 * Onglet "Géocoder & Suggestions"
 * Combine géocodage manuel + suggestions ADM
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs';
import { createGeocodeDrawer } from '../geocode/geocode-drawer';
import { 
  fetchSurveysWithoutGeom, 
  fetchSuggestions, 
  acceptSuggestion,
  rejectSuggestion,
  applyAcceptedSuggestions 
} from '../geocode/geocode-api';

export function createTabGeocode(): TabComponent {
  let container: HTMLElement | null = null;
  const drawer = createGeocodeDrawer();
  
  function mount(containerEl: HTMLElement) {
    container = containerEl;
    render();
    loadData();
  }
  
  function unmount() {
    drawer.close();
    if (container) {
      container.innerHTML = '';
    }
  }
  
  function render() {
    if (!container) return;
    
    container.innerHTML = `
      <div class="tab-content-wrapper">
        <!-- Toolbar -->
        <div class="tab-toolbar">
          <button id="btn-apply-suggestions" class="btn-primary" disabled>
            ✅ Appliquer les suggestions (<span id="count-accepted">0</span>)
          </button>
          <button id="btn-refresh-geocode" class="btn-icon" title="Rafraîchir">
            🔄
          </button>
        </div>
        
        <!-- Section Géocodage Manuel -->
        <div class="geocode-section">
          <h4 class="section-title">📍 Géocodage Manuel</h4>
          <div id="geocode-table-container"></div>
        </div>
        
        <!-- Section Suggestions -->
        <div class="suggestions-section">
          <h4 class="section-title">🤖 Suggestions ADM (<span id="count-pending">0</span>)</h4>
          <div id="suggestions-container"></div>
        </div>
      </div>
    `;
    
    setupToolbar();
  }
  
  function setupToolbar() {
    container?.querySelector('#btn-apply-suggestions')?.addEventListener('click', handleApplySuggestions);
    container?.querySelector('#btn-refresh-geocode')?.addEventListener('click', loadData);
  }
  
  async function loadData() {
    await Promise.all([
      loadSurveysToGeocode(),
      loadSuggestions(),
    ]);
  }
  
  async function loadSurveysToGeocode() {
    const tableContainer = container?.querySelector('#geocode-table-container');
    if (!tableContainer) return;
    
    try {
      const surveys = await fetchSurveysWithoutGeom();
      
      if (surveys.length === 0) {
        tableContainer.innerHTML = `
          <div class="empty-state-small">
            <p>✅ Tous les sondages sont géocodés</p>
          </div>
        `;
        return;
      }
      
      tableContainer.innerHTML = `
        <table class="data-table-compact">
          <thead>
            <tr>
              <th>Code</th>
              <th>Source</th>
              <th>ADM</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${surveys.map(s => `
              <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.source}</td>
                <td>${s.adm3_name || '-'}</td>
                <td>
                  <button class="btn-sm btn-primary" data-id="${s.id}">
                    🗺️ Géocoder
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      // Setup buttons
      tableContainer.querySelectorAll('.btn-sm').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = (e.target as HTMLElement).dataset.id!;
          const survey = surveys.find(s => s.id === id)!;
          drawer.open(survey, loadData);
        });
      });
      
    } catch (e) {
      console.error('[TabGeocode] Failed to load surveys:', e);
    }
  }
  
  async function loadSuggestions() {
    const suggestionsContainer = container?.querySelector('#suggestions-container');
    const countEl = container?.querySelector('#count-pending');
    const btnApply = container?.querySelector('#btn-apply-suggestions') as HTMLButtonElement;
    
    if (!suggestionsContainer) return;
    
    try {
      const suggestions = await fetchSuggestions();
      const pending = suggestions.filter(s => s.status === 'pending');
      const accepted = suggestions.filter(s => s.status === 'accepted');
      
      if (countEl) countEl.textContent = pending.length.toString();
      
      const acceptedCount = container?.querySelector('#count-accepted');
      if (acceptedCount) acceptedCount.textContent = accepted.length.toString();
      if (btnApply) btnApply.disabled = accepted.length === 0;
      
      if (pending.length === 0) {
        suggestionsContainer.innerHTML = `
          <div class="empty-state-small">
            <p>✅ Aucune suggestion en attente</p>
          </div>
        `;
        return;
      }
      
      suggestionsContainer.innerHTML = pending.map(sugg => `
        <div class="suggestion-card">
          <div class="suggestion-header">
            <strong>${sugg.code_site}</strong> - ${sugg.localite}
          </div>
          <div class="suggestion-body">
            ${sugg.top_candidate ? `
              <div class="suggestion-candidate">
                <span class="candidate-name">${sugg.top_candidate.adm3_name}</span>
                <span class="candidate-prefecture">${sugg.top_candidate.prefecture}</span>
                <span class="candidate-score">${Math.round(sugg.top_candidate.score_pct)}%</span>
              </div>
            ` : '<p>Aucun candidat trouvé</p>'}
          </div>
          <div class="suggestion-actions">
            <button class="btn-sm btn-success" data-id="${sugg.id}" data-action="accept">
              ✅ Accepter
            </button>
            <button class="btn-sm btn-danger" data-id="${sugg.id}" data-action="reject">
              ❌ Rejeter
            </button>
          </div>
        </div>
      `).join('');
      
      // Setup actions
      suggestionsContainer.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.target as HTMLElement;
          const id = target.dataset.id!;
          const action = target.dataset.action!;
          
          try {
            if (action === 'accept') {
              await acceptSuggestion(id);
            } else {
              await rejectSuggestion(id);
            }
            await loadData();
          } catch (err) {
            console.error('[TabGeocode] Action failed:', err);
            alert('❌ Erreur lors de l\'action');
          }
        });
      });
      
    } catch (e) {
      console.error('[TabGeocode] Failed to load suggestions:', e);
    }
  }
  
  async function handleApplySuggestions() {
    if (!confirm('Appliquer toutes les suggestions acceptées?')) return;
    
    try {
      const result = await applyAcceptedSuggestions();
      alert(`✅ ${result.updated} sondages géocodés!`);
      await loadData();
    } catch (e) {
      console.error('[TabGeocode] Failed to apply suggestions:', e);
      alert('❌ Erreur lors de l\'application');
    }
  }
  
  async function refresh() {
    await loadData();
  }
  
  return {
    mount,
    unmount,
    refresh,
  };
}
```

---

### 5.2 CSS Suggestions

Ajouter dans `src/styles/tabs.css`:

```css
/* Suggestions */
.suggestion-card {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--tab-border);
  border-radius: 8px;
  background: var(--tab-bg);
}

.suggestion-header {
  margin-bottom: 12px;
  font-size: 14px;
}

.suggestion-candidate {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--tab-bg-hover);
  border-radius: 4px;
}

.candidate-score {
  margin-left: auto;
  font-weight: 600;
  color: var(--tab-text-active);
}

.suggestion-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-success {
  background: #0bb07b;
  color: white;
}

.btn-danger {
  background: #ff6b6b;
  color: white;
}
```

---

### 5.3 Modifier `src/main.ts` (Ajouter onglet Géocode)

```typescript
import { createTabGeocode } from './tabs/tab-geocode';

const tabs: Tab[] = [
  // ... onglets existants ...
  {
    id: 'geocode',
    label: 'Géocoder & Sugg',
    icon: '🗺️',
    component: createTabGeocode(),
    badge: () => {
      // TODO: Retourner le nombre de suggestions pending
      return null;
    },
  },
];
```

---

## ✅ CHECKLIST PR5

### Tests Fonctionnels
- [ ] Onglet "Géocoder & Sugg" s'affiche
- [ ] Table sondages sans géom se charge
- [ ] Bouton "Géocoder" ouvre drawer
- [ ] Suggestions s'affichent avec scores
- [ ] Bouton "Accepter" fonctionne
- [ ] Bouton "Rejeter" fonctionne
- [ ] Bouton "Appliquer suggestions" met à jour
- [ ] Badge affiche le nombre de suggestions

### Tests Intégration
- [ ] Géocodage manuel → table se rafraîchit
- [ ] Accepter suggestion → compteur se met à jour
- [ ] Appliquer suggestions → sondages géocodés

---

## 🎯 RÉSUMÉ FINAL

### Documents Créés
1. ✅ `REFACTOR_PANEL_QGIS_v2.5.0.md` - Design & Architecture
2. ✅ `REFACTOR_PANEL_QGIS_IMPLEMENTATION.md` - PR1 Infrastructure
3. ✅ `REFACTOR_PANEL_QGIS_PR2-5.md` - PR2-5 Implémentation complète

### Fichiers à Créer/Modifier

**Nouveaux fichiers (18)**:
- `src/config.ts`
- `src/types/tabs.ts`
- `src/types/geocode.ts`
- `src/styles/tabs.css`
- `src/tabs/tab-manager.ts`
- `src/tabs/tab-nouveau.ts`
- `src/tabs/tab-import-wizard.ts`
- `src/tabs/tab-liste-sondages.ts`
- `src/tabs/tab-geocode.ts`
- `src/geocode/geocode-api.ts`
- `src/geocode/geocode-drawer.ts`

**Fichiers modifiés (1)**:
- `src/main.ts` (feature flag + init tabs)

**Fichiers dépréciés (2)**:
- `src/geocode-manager.ts` → logique migrée
- `src/suggestions-panel.ts` → logique migrée

### Ordre d'Implémentation
1. **PR1** (2h): Infrastructure + Types + Feature Flag OFF
2. **PR2** (3h): Container + Onglet Nouveau
3. **PR3** (3h): Onglets Import + Liste
4. **PR4** (4h): Géocodage + Drawer
5. **PR5** (4h): Suggestions + Intégration finale

**Total estimé**: 16h de développement

### Rollback
```typescript
// Dans src/config.ts
features: {
  uiPanelTabs: false,  // ← Passer à false pour revenir à l'ancienne UI
}
```

---

**📚 DOCUMENTATION COMPLÈTE - PRÊTE POUR IMPLÉMENTATION** 🚀
