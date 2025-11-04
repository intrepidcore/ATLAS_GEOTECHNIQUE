# 🎯 REFACTOR UI "Panneau Sondages" Style QGIS - v2.5.0

**Date**: 2025-11-04  
**Phase**: UI-01 - Panneau Sondages à Onglets  
**Objectif**: Fusionner Géocoder + Suggestions dans un panneau QGIS-like avec 4 onglets

---

## 📐 DESIGN - Structure du Panneau

### Vue Globale (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│  PANNEAU SONDAGES                                         [×]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────┬────────┬────────┬────────────────────────┐         │
│  │ 📝 Nouveau │ 📥 Import │ 📋 Liste │ 🗺️ Géocoder & Sugg │  │ ← Onglets
│  └────────┴────────┴────────┴────────────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [CONTENU DE L'ONGLET ACTIF]                                   │
│                                                                  │
│  • Onglet 1: Formulaire "Nouveau Sondage Géotechnique"         │
│  • Onglet 2: Import Wizard (modal plein écran)                 │
│  • Onglet 3: Tableau filtrable des sondages                    │
│  • Onglet 4: Géocodage manuel + Suggestions ADM                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Onglet 4 Détaillé: "Géocoder & Suggestions"

```
┌─────────────────────────────────────────────────────────────────┐
│  🗺️ Géocoder & Suggestions                                      │
├─────────────────────────────────────────────────────────────────┤
│  🔧 Barre d'outils                                              │
│  [ADM3 ▼] [🎲 Placer aléatoire] [✅ Appliquer suggestions (3)] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📍 GÉOCODAGE MANUEL                                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Code    │ Source │ Mode   │ ADM  │ Action               │ │
│  ├─────────┼────────┼────────┼──────┼──────────────────────┤ │
│  │ TEKPO   │ DAVIE  │ spread │ -    │ [🗺️ Géocoder]       │ │
│  │ APEHEME │ DAVIE  │ spread │ -    │ [🗺️ Géocoder]       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  🤖 SUGGESTIONS ADM (6 en attente)                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ⚠️ TEKPO - Tekpo                                          │ │
│  │ ├─ Top: Tchekpo (TG030709) - Score: 40%                  │ │
│  │ └─ [✅ Accepter] [✏️ Éditer] [❌ Rejeter]                 │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ ⚠️ APEHEME - Apeheme                                      │ │
│  │ ├─ Top: Lavie/Apedome (TG041208) - Score: 22%            │ │
│  │ └─ [✅ Accepter] [✏️ Éditer] [❌ Rejeter]                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Drawer Interne (Géocodage d'un sondage)

```
┌─────────────────────────────────────────────────────────────────┐
│  🗺️ Géocoder: TEKPO                                       [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📍 Mode de géocodage                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Point exact (lat/lon)                                 │   │
│  │   Latitude:  [________]  Longitude: [________]          │   │
│  │   [📍 Centrer carte] [🖱️ Cliquer sur carte]            │   │
│  │                                                          │   │
│  │ ● ADM → Maille aléatoire (déterministe)                │   │
│  │   Niveau: [ADM3 ▼]                                      │   │
│  │   Zone:   [Tchekpo (TG030709) - Yoto ▼]                │   │
│  │   Mode:   adm_random_cell                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [💾 Enregistrer] [❌ Annuler]                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ ARBORESCENCE FICHIERS

### Structure Actuelle (à analyser)
```
frontend/src/
├── main.ts                      # Point d'entrée
├── right-panel.ts               # Panneau droit actuel
├── geocode-manager.ts           # Géocodage manuel
├── suggestions-panel.ts         # Suggestions ADM
├── import-wizard-v2.ts          # Import Wizard
├── cell-complete-types.ts       # Types /cells/{code}/complete
└── styles/
    └── main.css
```

### Structure Cible (après refactor)
```
frontend/src/
├── main.ts                      # ✏️ MODIFIÉ - Init tabs au lieu de boutons
├── right-panel.ts               # ✏️ MODIFIÉ - Container d'onglets
├── tabs/                        # 📁 NOUVEAU - Modules onglets
│   ├── tab-nouveau.ts           # 📄 NOUVEAU - Form nouveau sondage
│   ├── tab-import-wizard.ts     # 📄 NOUVEAU - Wrapper Import Wizard
│   ├── tab-liste-sondages.ts    # 📄 NOUVEAU - Tableau sondages
│   └── tab-geocode.ts           # 📄 NOUVEAU - Géocodage + Suggestions
├── geocode/                     # 📁 NOUVEAU - Sous-modules géocodage
│   ├── geocode-drawer.ts        # 📄 NOUVEAU - Drawer géocodage
│   ├── geocode-table.ts         # 📄 NOUVEAU - Table sondages sans geom
│   └── suggestions-list.ts      # 📄 NOUVEAU - Liste suggestions
├── geocode-manager.ts           # 🗑️ DÉPRÉCIÉ - Logique migrée
├── suggestions-panel.ts         # 🗑️ DÉPRÉCIÉ - Logique migrée
├── import-wizard-v2.ts          # ✅ CONSERVÉ - Utilisé par tab-import-wizard
├── cell-complete-types.ts       # ✅ CONSERVÉ - Types inchangés
├── types/                       # 📁 NOUVEAU - Types centralisés
│   ├── tabs.ts                  # 📄 NOUVEAU - Types onglets
│   └── geocode.ts               # 📄 NOUVEAU - Types géocodage
└── styles/
    ├── main.css                 # ✏️ MODIFIÉ - Ajout styles tabs
    └── tabs.css                 # 📄 NOUVEAU - Styles onglets QGIS
```

---

## 🎛️ FEATURE FLAG

### Implémentation

**Fichier**: `frontend/src/config.ts` (à créer si n'existe pas)

```typescript
// Configuration globale de l'application
export const CONFIG = {
  // Feature flags
  features: {
    // v2.5.0 - Panneau Sondages à onglets style QGIS
    uiPanelTabs: true,  // ← Toggle ici pour activer/désactiver
  },
  
  // Persistance
  storage: {
    tabStateKey: 'atlas_active_tab',  // localStorage key
  },
};
```

**Usage dans `main.ts`**:
```typescript
import { CONFIG } from './config';

if (CONFIG.features.uiPanelTabs) {
  // Nouvelle UI à onglets
  initTabsPanel();
} else {
  // Ancienne UI avec boutons
  initLegacyPanel();
}
```

---

## 📦 PLAN D'EXÉCUTION EN 5 ÉTAPES (PRs)

### PR1: Infrastructure & Types (1-2h)
**Objectif**: Créer la structure de base sans casser l'existant

**Fichiers**:
- ✅ Créer `src/config.ts` avec feature flag OFF
- ✅ Créer `src/types/tabs.ts`
- ✅ Créer `src/types/geocode.ts`
- ✅ Créer `src/styles/tabs.css`
- ✅ Modifier `main.ts` pour ajouter le switch feature flag

**Tests**:
- [ ] App démarre normalement (flag OFF)
- [ ] Aucune régression visuelle

---

### PR2: Container Onglets + Onglet 1 (2-3h)
**Objectif**: Implémenter le container d'onglets et l'onglet "Nouveau"

**Fichiers**:
- ✅ Créer `src/tabs/` directory
- ✅ Créer `src/tabs/tab-nouveau.ts`
- ✏️ Modifier `src/right-panel.ts` pour devenir container
- ✏️ Modifier `src/main.ts` pour init tabs (flag ON)

**Tests**:
- [ ] Onglets visibles et cliquables
- [ ] Onglet "Nouveau" affiche le formulaire
- [ ] Navigation clavier (Ctrl+Tab)
- [ ] Persistance onglet actif (localStorage)

---

### PR3: Onglets Import & Liste (2-3h)
**Objectif**: Ajouter les onglets Import Wizard et Liste Sondages

**Fichiers**:
- ✅ Créer `src/tabs/tab-import-wizard.ts`
- ✅ Créer `src/tabs/tab-liste-sondages.ts`

**Tests**:
- [ ] Import Wizard s'ouvre en modal plein écran
- [ ] Liste sondages affiche le tableau filtrable
- [ ] Filtres fonctionnent (recherche, ADM, mode)

---

### PR4: Onglet Géocodage (Structure) (3-4h)
**Objectif**: Créer l'onglet Géocodage avec table et toolbar

**Fichiers**:
- ✅ Créer `src/tabs/tab-geocode.ts`
- ✅ Créer `src/geocode/geocode-table.ts`
- ✅ Créer `src/geocode/geocode-drawer.ts`

**Tests**:
- [ ] Table sondages sans geom affichée
- [ ] Bouton "Géocoder" ouvre le drawer
- [ ] Drawer permet saisie lat/lon ou ADM3
- [ ] Géocodage manuel fonctionne

---

### PR5: Suggestions ADM (3-4h)
**Objectif**: Intégrer les suggestions dans l'onglet Géocodage

**Fichiers**:
- ✅ Créer `src/geocode/suggestions-list.ts`
- ✏️ Modifier `src/tabs/tab-geocode.ts` pour inclure suggestions
- 🗑️ Déprécier `src/suggestions-panel.ts`

**Tests**:
- [ ] Suggestions affichées avec scores
- [ ] Actions (Accepter/Rejeter/Éditer) fonctionnent
- [ ] Bouton "Appliquer suggestions" met à jour les sondages
- [ ] Statistiques mises à jour en temps réel

---

## 🎨 CSS - Classes & Styles

### Nouveau fichier: `src/styles/tabs.css`

```css
/* ============================================
   TABS QGIS-LIKE - v2.5.0
   ============================================ */

/* Container principal */
.tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel, #0f172a);
}

/* Barre d'onglets */
.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border, #22304d);
  background: var(--bg-header, #0b1220);
  padding: 0;
  margin: 0;
}

/* Onglet individuel */
.tab-button {
  flex: 0 0 auto;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #8aa0b5);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-button:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #ecf2f8);
}

.tab-button.active {
  color: var(--primary, #3aa6ff);
  border-bottom-color: var(--primary, #3aa6ff);
  background: rgba(58, 166, 255, 0.1);
}

.tab-button:focus-visible {
  outline: 2px solid var(--primary, #3aa6ff);
  outline-offset: -2px;
}

/* Icône onglet */
.tab-icon {
  font-size: 16px;
}

/* Contenu onglet */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Empty states */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-secondary, #8aa0b5);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary, #ecf2f8);
}

.empty-state-description {
  font-size: 14px;
  max-width: 400px;
}
```

---

## 🔧 TYPES TYPESCRIPT

### Fichier: `src/types/tabs.ts`

```typescript
/**
 * Types pour le système d'onglets QGIS-like
 * v2.5.0 - Phase UI-01
 */

export type TabId = 'nouveau' | 'import' | 'liste' | 'geocode';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;  // Emoji ou classe CSS
  component: TabComponent;
  shortcut?: string;  // Ex: "Ctrl+1"
}

export interface TabComponent {
  mount: (container: HTMLElement) => void;
  unmount: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export interface TabsState {
  activeTab: TabId;
  tabs: Tab[];
}

export interface TabsManager {
  init: (container: HTMLElement) => void;
  switchTo: (tabId: TabId) => void;
  getActive: () => TabId;
  destroy: () => void;
}
```

### Fichier: `src/types/geocode.ts`

```typescript
/**
 * Types pour le géocodage et les suggestions
 * v2.5.0 - Phase UI-01
 */

export interface SurveyToGeocode {
  id: string;
  code: string;
  source: string;
  location_mode: 'spread' | 'exact' | 'adm_random_cell';
  adm1_name?: string;
  adm2_name?: string;
  adm3_name?: string;
  adm3_code?: string;
  has_geom: boolean;
}

export interface GeocodeMode {
  type: 'exact' | 'adm_random_cell';
  data: ExactGeocodeData | AdmGeocodeData;
}

export interface ExactGeocodeData {
  latitude: number;
  longitude: number;
}

export interface AdmGeocodeData {
  adm_level: 'ADM1' | 'ADM2' | 'ADM3';
  adm_code: string;
  adm_name: string;
}

export interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  code_site: string;
  localite: string;
  normalized_localite: string;
  status: 'pending' | 'accepted' | 'rejected';
  top_candidate?: {
    adm3_code: string;
    adm3_name: string;
    prefecture: string;
    score_pct: number;
    method: 'synonym' | 'candidate';
  };
  other_candidates?: Array<{
    adm3_code: string;
    adm3_name: string;
    prefecture: string;
    score_pct: number;
  }>;
}

export interface GeocodeStats {
  total_surveys: number;
  without_geom: number;
  suggestions_pending: number;
  suggestions_accepted: number;
}
```

---

*[Suite du document dans le prochain message pour éviter la limite de tokens]*
