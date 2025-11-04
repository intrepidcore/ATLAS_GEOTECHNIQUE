# 🔧 IMPLÉMENTATION DÉTAILLÉE - Panneau QGIS v2.5.0

**Complément de**: `REFACTOR_PANEL_QGIS_v2.5.0.md`

---

## 📝 PR1: INFRASTRUCTURE & TYPES

### 1.1 Créer `src/config.ts`

```typescript
/**
 * Configuration globale de l'application Atlas
 * v2.5.0
 */

export const CONFIG = {
  // Feature flags
  features: {
    // v2.5.0 - Panneau Sondages à onglets style QGIS
    // Toggle: true = nouvelle UI, false = ancienne UI
    uiPanelTabs: false,  // ← Démarrer à FALSE pour PR1
  },
  
  // Persistance localStorage
  storage: {
    tabStateKey: 'atlas_active_tab',
    filtersStateKey: 'atlas_filters',
  },
  
  // Raccourcis clavier
  shortcuts: {
    nextTab: 'Control+Tab',
    prevTab: 'Control+Shift+Tab',
    closeModal: 'Escape',
  },
  
  // UI
  ui: {
    defaultTab: 'liste' as const,
    animationDuration: 200, // ms
  },
};

export type Config = typeof CONFIG;
```

---

### 1.2 Créer `src/types/tabs.ts`

```typescript
/**
 * Types pour le système d'onglets QGIS-like
 * v2.5.0 - Phase UI-01
 */

export type TabId = 'nouveau' | 'import' | 'liste' | 'geocode';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
  component: TabComponent;
  badge?: () => number | null;  // Badge dynamique (ex: nombre de suggestions)
}

export interface TabComponent {
  /**
   * Monte le composant dans le container
   */
  mount: (container: HTMLElement) => void;
  
  /**
   * Démonte le composant et nettoie les listeners
   */
  unmount: () => void;
  
  /**
   * Appelé quand l'onglet devient actif
   */
  onActivate?: () => void;
  
  /**
   * Appelé quand l'onglet devient inactif
   */
  onDeactivate?: () => void;
  
  /**
   * Appelé pour rafraîchir les données
   */
  refresh?: () => Promise<void>;
}

export interface TabsState {
  activeTab: TabId;
  previousTab: TabId | null;
}

export interface TabsManager {
  /**
   * Initialise le gestionnaire d'onglets
   */
  init: (container: HTMLElement, tabs: Tab[]) => void;
  
  /**
   * Bascule vers un onglet
   */
  switchTo: (tabId: TabId) => void;
  
  /**
   * Retourne l'onglet actif
   */
  getActive: () => TabId;
  
  /**
   * Rafraîchit l'onglet actif
   */
  refresh: () => Promise<void>;
  
  /**
   * Détruit le gestionnaire
   */
  destroy: () => void;
}

/**
 * Événements émis par le gestionnaire d'onglets
 */
export interface TabsEvents {
  'tab:changed': { from: TabId | null; to: TabId };
  'tab:activated': { tabId: TabId };
  'tab:deactivated': { tabId: TabId };
}
```

---

### 1.3 Créer `src/types/geocode.ts`

```typescript
/**
 * Types pour le géocodage et les suggestions
 * v2.5.0 - Phase UI-01
 */

export interface SurveyToGeocode {
  id: string;
  code: string;
  source: string;
  location_mode: 'spread' | 'exact' | 'adm_random_cell' | null;
  adm1_name: string | null;
  adm2_name: string | null;
  adm3_name: string | null;
  adm3_code: string | null;
  has_geom: boolean;
  created_at: string;
}

export type GeocodeMethod = 'exact' | 'adm_random_cell';

export interface GeocodePayload {
  survey_id: string;
  method: GeocodeMethod;
  data: ExactGeocodeData | AdmGeocodeData;
}

export interface ExactGeocodeData {
  latitude: number;
  longitude: number;
}

export interface AdmGeocodeData {
  adm_level: 'ADM1' | 'ADM2' | 'ADM3';
  adm_code: string;
}

export interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  code_site: string;
  localite: string;
  normalized_localite: string;
  status: 'pending' | 'accepted' | 'rejected';
  score_pct: number | null;
  method: 'synonym' | 'candidate' | null;
  top_candidate: SuggestionCandidate | null;
  other_candidates: SuggestionCandidate[];
  created_at: string;
  updated_at: string;
}

export interface SuggestionCandidate {
  adm3_code: string;
  adm3_name: string;
  prefecture: string;
  score_pct: number;
}

export interface GeocodeStats {
  total_surveys: number;
  without_geom: number;
  with_spread: number;
  suggestions_pending: number;
  suggestions_accepted: number;
  suggestions_rejected: number;
}

export interface SuggestionAction {
  type: 'accept' | 'reject' | 'modify';
  suggestion_id: string;
  adm3_code_override?: string;  // Pour 'modify'
}
```

---

### 1.4 Créer `src/styles/tabs.css`

```css
/* ============================================
   TABS QGIS-LIKE - v2.5.0
   Style sobre, inspiré de QGIS
   ============================================ */

:root {
  --tab-bg: #0b1220;
  --tab-bg-hover: rgba(255, 255, 255, 0.05);
  --tab-bg-active: rgba(58, 166, 255, 0.1);
  --tab-border: #22304d;
  --tab-text: #8aa0b5;
  --tab-text-active: #3aa6ff;
  --tab-text-primary: #ecf2f8;
}

/* ============================================
   CONTAINER
   ============================================ */

.tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel, #0f172a);
  overflow: hidden;
}

/* ============================================
   HEADER (Barre d'onglets)
   ============================================ */

.tabs-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--tab-border);
  background: var(--tab-bg);
  padding: 0;
  margin: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.tabs-header::-webkit-scrollbar {
  height: 4px;
}

.tabs-header::-webkit-scrollbar-thumb {
  background: var(--tab-border);
  border-radius: 2px;
}

/* ============================================
   TAB BUTTON
   ============================================ */

.tab-button {
  flex: 0 0 auto;
  min-width: 120px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--tab-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
  white-space: nowrap;
}

.tab-button:hover:not(.active) {
  background: var(--tab-bg-hover);
  color: var(--tab-text-primary);
}

.tab-button.active {
  color: var(--tab-text-active);
  border-bottom-color: var(--tab-text-active);
  background: var(--tab-bg-active);
}

.tab-button:focus-visible {
  outline: 2px solid var(--tab-text-active);
  outline-offset: -2px;
  z-index: 1;
}

.tab-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Icône */
.tab-icon {
  font-size: 16px;
  line-height: 1;
}

/* Badge (notifications) */
.tab-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #ff6b6b;
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ============================================
   CONTENT (Contenu des onglets)
   ============================================ */

.tabs-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.tab-pane {
  display: none;
  height: 100%;
  animation: fadeIn 0.2s ease;
}

.tab-pane.active {
  display: block;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================
   EMPTY STATES
   ============================================ */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  color: var(--tab-text);
  min-height: 300px;
}

.empty-state-icon {
  font-size: 56px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--tab-text-primary);
}

.empty-state-description {
  font-size: 14px;
  max-width: 400px;
  line-height: 1.5;
}

.empty-state-action {
  margin-top: 24px;
}

/* ============================================
   TOOLBAR (Barre d'outils dans onglets)
   ============================================ */

.tab-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--tab-bg);
  border-bottom: 1px solid var(--tab-border);
  flex-wrap: wrap;
}

.tab-toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-toolbar-separator {
  width: 1px;
  height: 24px;
  background: var(--tab-border);
  margin: 0 4px;
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 768px) {
  .tab-button {
    min-width: 80px;
    padding: 10px 12px;
    font-size: 12px;
  }
  
  .tab-icon {
    font-size: 14px;
  }
  
  .tab-badge {
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    font-size: 10px;
  }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */

.tab-button[aria-selected="true"] {
  /* Déjà géré par .active */
}

.tab-pane[aria-hidden="true"] {
  /* Déjà géré par display: none */
}

/* Focus trap (pour modales) */
.focus-trap {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
```

---

### 1.5 Modifier `src/main.ts` (Feature Flag)

```typescript
// Ajout en haut du fichier
import { CONFIG } from './config';

// ... code existant ...

// Remplacer l'initialisation du panneau droit
function initRightPanel() {
  if (CONFIG.features.uiPanelTabs) {
    // v2.5.0 - Nouvelle UI à onglets
    initTabsPanel();
  } else {
    // Ancienne UI (v2.4.x)
    initLegacyPanel();
  }
}

function initTabsPanel() {
  console.log('[v2.5.0] Initialisation panneau à onglets');
  // TODO: PR2 - Implémenter ici
}

function initLegacyPanel() {
  console.log('[Legacy] Initialisation panneau classique');
  // Code existant actuel
  // ... (conserver tel quel)
}
```

---

## ✅ CHECKLIST PR1

### Tests Fonctionnels
- [ ] App démarre sans erreur
- [ ] Feature flag OFF → UI classique fonctionne
- [ ] Feature flag ON → Console affiche "[v2.5.0] Initialisation panneau à onglets"
- [ ] Aucune régression visuelle
- [ ] Build TypeScript réussit sans erreur
- [ ] Aucun warning ESLint

### Tests Non-Régression
- [ ] Carte s'affiche correctement
- [ ] Filtres fonctionnent
- [ ] Import Wizard s'ouvre (ancienne UI)
- [ ] Géocodage manuel fonctionne (ancienne UI)

### Documentation
- [ ] README mis à jour avec feature flag
- [ ] Types documentés (JSDoc)
- [ ] CSS commenté

---

*[Suite avec PR2 dans le prochain fichier]*
