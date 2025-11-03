# 🔧 Spécifications Techniques - Panneau Droit v3.0

**Pour reprendre l'implémentation dans une autre discussion**

---

## 📁 STRUCTURE DES FICHIERS

```
ui/
├── index.html                    (modifié - section panneau droit)
└── src/
    ├── main.ts                   (modifié - imports nouveaux modules)
    ├── version.ts                (modifié - v2.1.0)
    ├── right-panel.ts            (nouveau - 500 lignes)
    ├── filters-manager.ts        (nouveau - 300 lignes)
    ├── search-unified.ts         (nouveau - 200 lignes)
    ├── export-configurator.ts    (nouveau - 250 lignes)
    └── right-panel.css           (nouveau - 200 lignes)
```

---

## 1️⃣ HTML - Structure Accordéons

**Fichier** : `ui/index.html`  
**Section** : `<aside id="sidebar">` (lignes 266-340)

### Remplacer par :

```html
<!-- PANNEAU DROIT: Filtres & Actions -->
<aside id="sidebar">
  
  <!-- 1. RECHERCHE UNIFIÉE (toujours visible) -->
  <div class="search-unified">
    <input 
      type="text" 
      id="unifiedSearch"
      placeholder="🔍 Rechercher maille, sondage, localité..."
      autocomplete="off"
    />
    <div class="search-suggestions" id="searchSuggestions"></div>
  </div>

  <!-- 2. FILTRES (accordéon) -->
  <div class="accordion-section">
    <div class="accordion-header" data-section="filtres">
      <span>🔍 Filtres</span>
      <div class="accordion-right">
        <span class="badge-count" id="filterCount">0</span>
        <span class="accordion-icon">▼</span>
      </div>
    </div>
    <div class="accordion-content" id="filtres-content">
      
      <!-- Badges filtres actifs -->
      <div class="active-filters" id="activeFilters" style="display:none"></div>
      
      <!-- Filtres Géographiques -->
      <div class="filter-group">
        <h5>📍 Géographiques</h5>
        <div class="form-field">
          <label>Région (ADM1)</label>
          <select id="filterAdm1" class="input">
            <option value="">— Toutes régions —</option>
          </select>
        </div>
        <div class="form-field">
          <label>Préfecture (ADM2)</label>
          <select id="filterAdm2" class="input" disabled>
            <option value="">— Toutes préfectures —</option>
          </select>
        </div>
        <div class="form-field">
          <label>Commune (ADM3)</label>
          <select id="filterAdm3" class="input" disabled>
            <option value="">— Toutes communes —</option>
          </select>
        </div>
      </div>

      <!-- Filtres Données -->
      <div class="filter-group">
        <h5>📊 Données</h5>
        <label class="checkbox-label">
          <input type="checkbox" id="filterHasData" checked />
          <span>Mailles avec données</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="filterNoData" checked />
          <span>Mailles sans données</span>
        </label>
        <div class="form-field">
          <label>Min. sondages</label>
          <input type="number" id="filterMinSondages" class="input" value="0" min="0" />
        </div>
        <div class="form-field">
          <label>Min. essais</label>
          <input type="number" id="filterMinEssais" class="input" value="0" min="0" />
        </div>
        <label class="checkbox-label">
          <input type="checkbox" id="filterRealOnly" />
          <span>Données réelles uniquement (pas spread)</span>
        </label>
      </div>

      <!-- Filtres Essais (NOUVEAU) -->
      <div class="filter-group">
        <h5>🔬 Essais</h5>
        <label>Types d'essais</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="filterAtterberg" checked />
            <span>Atterberg</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="filterVBS" checked />
            <span>VBS</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="filterGranulo" checked />
            <span>Granulométrie</span>
          </label>
        </div>
        <div class="form-field">
          <label>Profondeur (m)</label>
          <div class="range-input">
            <input type="number" id="filterDepthMin" placeholder="Min" />
            <span>—</span>
            <input type="number" id="filterDepthMax" placeholder="Max" />
          </div>
        </div>
        <div class="form-field">
          <label>Limite de liquidité (WL)</label>
          <div class="range-input">
            <input type="number" id="filterWLMin" placeholder="Min" />
            <span>—</span>
            <input type="number" id="filterWLMax" placeholder="Max" />
          </div>
        </div>
      </div>

      <!-- Filtres Temporels (NOUVEAU) -->
      <div class="filter-group">
        <h5>📅 Temporel</h5>
        <div class="form-field">
          <label>Période rapide</label>
          <select id="filterPeriod" class="input">
            <option value="">Toutes périodes</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="3m">3 derniers mois</option>
            <option value="6m">6 derniers mois</option>
            <option value="1y">Dernière année</option>
          </select>
        </div>
      </div>

      <!-- Bouton reset -->
      <button id="resetFilters" class="btn btn-block">Réinitialiser</button>
    </div>
  </div>

  <!-- 3. SONDAGES (accordéon) -->
  <div class="accordion-section">
    <div class="accordion-header" data-section="sondages">
      <span>✏️ Sondages</span>
      <span class="accordion-icon">▼</span>
    </div>
    <div class="accordion-content" id="sondages-content">
      
      <!-- Dropdown Nouveau -->
      <div class="dropdown">
        <button class="btn primary dropdown-toggle" id="newSurveyBtn">
          + Nouveau ▼
        </button>
        <div class="dropdown-menu" id="newSurveyMenu">
          <a href="#" data-action="new-geotech">🧪 Géotechnique</a>
          <a href="#" data-action="new-gps">📍 GPS simple</a>
          <a href="#" data-action="import-csv">📥 Import CSV</a>
          <a href="#" data-action="import-bulk">📦 Import Bulk</a>
        </div>
      </div>

      <!-- Actions principales -->
      <div class="survey-actions">
        <button id="listSurveysBtn" class="btn btn-block">📋 Liste</button>
        <button id="geocodeSurveysBtn" class="btn btn-block">🗺️ Géocoder</button>
        <button id="suggestionsBtn" class="btn btn-block">🤖 Suggestions</button>
      </div>
    </div>
  </div>

  <!-- 4. ACTIONS MAILLE (contextuel) -->
  <div class="accordion-section" id="mailleActions" style="display:none">
    <div class="accordion-header" data-section="actions-maille">
      <span>⚙️ Actions Maille</span>
      <div class="accordion-right">
        <span class="maille-code" id="mailleCode"></span>
        <span class="close-maille" id="closeMailleActions">×</span>
      </div>
    </div>
    <div class="accordion-content" id="actions-maille-content">
      <div class="maille-info">
        <div class="maille-stats" id="mailleStats"></div>
      </div>
      <button id="recomputeBtn" class="btn btn-block">🔄 Recalculer IDW</button>
      <button id="shapeBtn" class="btn btn-block">📐 Voir géométrie</button>
      <button id="centerMapBtn" class="btn btn-block">🗺️ Centrer carte</button>
      <button id="zoomTgBtn" class="btn btn-block">🌍 Zoom Togo</button>
    </div>
  </div>

  <!-- 5. EXPORT (accordéon) -->
  <div class="accordion-section">
    <div class="accordion-header" data-section="export">
      <span>📤 Export</span>
      <span class="accordion-icon">▼</span>
    </div>
    <div class="accordion-content" id="export-content">
      
      <!-- Exports rapides -->
      <div class="export-quick">
        <button id="exportGeoJSON" class="btn btn-quick">📄 GeoJSON</button>
        <button id="exportCSV" class="btn btn-quick">📊 CSV</button>
        <button id="exportPDF" class="btn btn-quick">📄 PDF</button>
        <button id="exportExcel" class="btn btn-quick">📊 Excel</button>
      </div>

      <!-- Autres exports -->
      <button id="exportGeoPackage" class="btn btn-block">📦 GeoPackage</button>
      <button id="printMap" class="btn btn-block">🖨️ Imprimer Carte</button>
      <button id="exportAuditCSV" class="btn btn-block">📊 Historique CSV</button>
    </div>
  </div>

</aside>
```

---

## 2️⃣ CSS - Styles Accordéons

**Fichier** : `ui/src/right-panel.css` (nouveau)

```css
/* ============================================
   ACCORDÉONS
   ============================================ */

.accordion-section {
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--panel-light);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.accordion-header:hover {
  background: var(--panel-hover);
}

.accordion-header.active {
  background: var(--accent-dim);
  border-bottom: 1px solid var(--border);
}

.accordion-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.accordion-icon {
  font-size: 10px;
  transition: transform 0.3s ease;
}

.accordion-header.active .accordion-icon {
  transform: rotate(180deg);
}

.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}

.accordion-content.open {
  max-height: 2000px;
  padding: 16px;
}

/* ============================================
   BADGES
   ============================================ */

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--panel-light);
  border-radius: 6px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--accent-dim);
  color: var(--accent);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
}

.filter-badge:hover {
  background: var(--accent);
  color: var(--bg);
}

.badge-remove {
  cursor: pointer;
  font-weight: bold;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.badge-remove:hover {
  opacity: 1;
}

/* ============================================
   DROPDOWN
   ============================================ */

.dropdown {
  position: relative;
  margin-bottom: 10px;
}

.dropdown-toggle::after {
  content: ' ▼';
  font-size: 10px;
  margin-left: 4px;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 1000;
  display: none;
  overflow: hidden;
}

.dropdown-menu.open {
  display: block;
  animation: dropdownFadeIn 0.2s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-menu a {
  display: block;
  padding: 10px 14px;
  color: var(--text);
  text-decoration: none;
  font-size: 13px;
  transition: background 0.2s;
  border-bottom: 1px solid var(--border);
}

.dropdown-menu a:last-child {
  border-bottom: none;
}

.dropdown-menu a:hover {
  background: var(--panel-hover);
}

/* ============================================
   RECHERCHE UNIFIÉE
   ============================================ */

.search-unified {
  position: relative;
  margin-bottom: 16px;
}

.search-unified input {
  width: 100%;
  padding: 10px 12px;
  background: var(--panel-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  transition: all 0.2s;
}

.search-unified input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  display: none;
}

.search-suggestions.open {
  display: block;
  animation: dropdownFadeIn 0.2s ease-out;
}

/* ============================================
   FILTRES
   ============================================ */

.filter-group {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.filter-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.filter-group h5 {
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.form-field {
  margin-bottom: 10px;
}

.form-field label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  cursor: pointer;
  font-size: 12px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-input input {
  flex: 1;
}

.range-input span {
  color: var(--muted);
  font-size: 12px;
}

/* ============================================
   ACTIONS MAILLE
   ============================================ */

.maille-code {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}

.close-maille {
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  color: var(--muted);
  transition: color 0.2s;
}

.close-maille:hover {
  color: var(--danger);
}

.maille-info {
  margin-bottom: 12px;
  padding: 10px;
  background: var(--panel-light);
  border-radius: 6px;
}

.maille-stats {
  font-size: 12px;
  color: var(--muted);
}

/* ============================================
   EXPORT
   ============================================ */

.export-quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}

.btn-quick {
  padding: 8px 12px;
  font-size: 12px;
}

/* ============================================
   BOUTONS
   ============================================ */

.btn-block {
  width: 100%;
  margin-top: 8px;
}

.btn-block:first-child {
  margin-top: 0;
}
```

---

## 3️⃣ TypeScript - Logique Accordéons

**Fichier** : `ui/src/right-panel.ts` (nouveau)

```typescript
// Gestion des accordéons
export function initAccordions() {
  const headers = document.querySelectorAll('.accordion-header')
  
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-section')
      const content = document.getElementById(`${section}-content`)
      
      if (!content) return
      
      // Toggle active
      header.classList.toggle('active')
      content.classList.toggle('open')
      
      // Fermer les autres (optionnel)
      // closeOtherAccordions(section)
    })
  })
}

// Gestion dropdown
export function initDropdowns() {
  const toggles = document.querySelectorAll('.dropdown-toggle')
  
  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      const dropdown = toggle.closest('.dropdown')
      const menu = dropdown?.querySelector('.dropdown-menu')
      
      if (menu) {
        menu.classList.toggle('open')
      }
    })
  })
  
  // Fermer au clic extérieur
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.open').forEach(menu => {
      menu.classList.remove('open')
    })
  })
}

// Gestion actions maille contextuelles
export function showMailleActions(code: string, stats: any) {
  const section = document.getElementById('mailleActions')
  const codeEl = document.getElementById('mailleCode')
  const statsEl = document.getElementById('mailleStats')
  
  if (section && codeEl && statsEl) {
    section.style.display = 'block'
    codeEl.textContent = code
    statsEl.textContent = `${stats.n_sondages} sondages • ${stats.n_essais} essais`
  }
}

export function hideMailleActions() {
  const section = document.getElementById('mailleActions')
  if (section) {
    section.style.display = 'none'
  }
}

// Gestion badges filtres actifs
export function updateFilterBadges(filters: any[]) {
  const container = document.getElementById('activeFilters')
  const countEl = document.getElementById('filterCount')
  
  if (!container || !countEl) return
  
  if (filters.length === 0) {
    container.style.display = 'none'
    countEl.textContent = '0'
    return
  }
  
  container.style.display = 'flex'
  countEl.textContent = filters.length.toString()
  
  container.innerHTML = filters.map(f => `
    <div class="filter-badge" data-filter="${f.id}">
      ${f.label}
      <span class="badge-remove" onclick="removeFilter('${f.id}')">×</span>
    </div>
  `).join('') + `
    <button class="btn-clear-all" onclick="clearAllFilters()">Tout effacer</button>
  `
}

// Raccourcis clavier
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+F : Recherche
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      document.getElementById('unifiedSearch')?.focus()
    }
    
    // Ctrl+N : Nouveau sondage
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      document.getElementById('newSurveyBtn')?.click()
    }
    
    // Ctrl+E : Export rapide
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault()
      document.getElementById('exportGeoJSON')?.click()
    }
    
    // Ctrl+R : Reset filtres
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault()
      document.getElementById('resetFilters')?.click()
    }
    
    // Escape : Fermer tout
    if (e.key === 'Escape') {
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'))
      document.querySelectorAll('.search-suggestions.open').forEach(s => s.classList.remove('open'))
    }
  })
}
```

---

## 4️⃣ Intégration dans main.ts

**Fichier** : `ui/src/main.ts`

```typescript
// Ajouter en haut
import { initAccordions, initDropdowns, initKeyboardShortcuts } from './right-panel'
import './right-panel.css'

// Ajouter dans la fonction d'initialisation
document.addEventListener('DOMContentLoaded', () => {
  // ... code existant ...
  
  // Initialiser panneau droit
  initAccordions()
  initDropdowns()
  initKeyboardShortcuts()
})
```

---

## 📊 CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Structure (2-3h)
- [ ] Remplacer HTML panneau droit
- [ ] Créer `right-panel.css`
- [ ] Créer `right-panel.ts`
- [ ] Intégrer dans `main.ts`
- [ ] Tester accordéons
- [ ] Tester dropdown

### Phase 2 : Filtres (2-3h)
- [ ] Implémenter filtres Essais
- [ ] Implémenter filtres Temporels
- [ ] Créer `filters-manager.ts`
- [ ] Badges filtres actifs
- [ ] Compteur sur header

### Phase 3 : Recherche (1-2h)
- [ ] Créer `search-unified.ts`
- [ ] Input avec placeholder
- [ ] Suggestions basiques
- [ ] Raccourci Ctrl+F

### Phase 4 : Actions (1h)
- [ ] Actions maille contextuelles
- [ ] Bouton fermer
- [ ] Affichage stats

### Phase 5 : Tests (1h)
- [ ] Build UI
- [ ] Tests manuels
- [ ] Corrections bugs
- [ ] Tag v2.1.0

---

## 🚀 COMMANDES

```powershell
# Créer fichiers
New-Item ui/src/right-panel.ts
New-Item ui/src/right-panel.css
New-Item ui/src/filters-manager.ts
New-Item ui/src/search-unified.ts

# Build
cd ui
npm run build

# Test
npm run dev

# Tag
git add .
git commit -m "feat: Panneau droit v2.1.0 - Accordéons + filtres avancés"
git tag v2.1.0
git push && git push --tags
```

---

**Prêt pour implémentation !**
