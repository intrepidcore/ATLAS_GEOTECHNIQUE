# Implémentation v1.2.0 - Rapport de progression

**Date**: 2025-10-17  
**Status**: Backend complété à 90%, UI en cours

## ✅ Backend - Complété

### 1. DTOs étendus (`surveys.rs`)
- ✅ `NewSurveyRequest` avec support complet:
  - `commune_id`, `location`, `survey` (métadonnées), `tests` (array)
  - `snap_to_grid`, `use_commune_centroid`
- ✅ `CreateSurveyResponse` avec `sondage_id`, `maille_code`, `essais_count`, `location_accuracy`
- ✅ `GeocodeRequest` pour POST /surveys/:id/geocode
- ✅ `Survey` étendu avec: `location_accuracy`, `is_geocoded`, `date`, `source`, `operator`, `notes`
- ✅ `ListSurveysQuery` avec filtres: `location_accuracy`, `is_geocoded`

### 2. Validation (`surveys.rs`)
- ✅ `validate_togo_bounds()`: lat ∈ [5,12], lon ∈ [-1,2]
- ✅ `validate_depth()`: depth ∈ [0.5,60] m
- ✅ `validate_spt_n()`: entier 0-100
- ✅ `validate_qc()`: 0.1-50 MPa
- ✅ `validate_test()`: dispatch par type
- ✅ `get_test_unit()`: unités automatiques (SPT_N → blows/30cm, qc → MPa, etc.)

### 3. Handlers étendus

#### `surveys_extended.rs` (nouveau fichier)
- ✅ **POST /surveys** (`create_survey_v2`):
  - Transaction atomique (sondage + N essais)
  - Support modes: exact, centroid, unknown
  - Validation complète
  - Appel fonctions SQL: `place_at_centroid()`, `place_random_in_adm()`
  - Audit log avec `location_mode`
  
- ✅ **POST /surveys/:id/geocode** (`geocode_survey`):
  - Géocoder un sondage existant
  - Modes: exact (lon/lat) ou centroid/random (adm_level+adm_name)
  - Mise à jour `geom`, `location_accuracy`, `is_geocoded`, `maille_code`

#### `surveys.rs` (mis à jour)
- ✅ **GET /surveys** (`list_surveys`):
  - Filtres: `location_accuracy`, `is_geocoded`, `bbox`
  - Retour champs étendus
  
- ✅ **GET /adm1/2/3** (`list_adm*`):
  - Retour enrichi avec `code` et `bbox` [xmin, ymin, xmax, ymax]
  - Support filtrage cascadé (adm2?adm1=..., adm3?adm2=...)

### 4. Routes (`main.rs`)
- ✅ Module `surveys_extended` ajouté
- ✅ Routes configurées:
  - `POST /surveys` → `create_survey_v2` (nouveau endpoint complet)
  - `POST /surveys/legacy` → `create_survey` (ancien endpoint, rétrocompatibilité)
  - `POST /surveys/:id/geocode` → `geocode_survey` (nouveau)
  - `GET /surveys` → `list_surveys` (mis à jour avec filtres)
  - `GET /adm1|2|3` → `list_adm*` (mis à jour avec bbox+code)

## ⏳ Backend - En attente

### POST /surveys/bulk
Import CSV/XLSX en lot (priorité moyenne, peut être fait plus tard)

## 🚧 Frontend (UI) - À implémenter

### Priorité HAUTE

#### 1. Formulaire "Nouveau sondage" - Refactorisation complète
**Fichier**: `atlas/ui/src/main.ts` + `atlas/ui/index.html`

**Changements requis**:

##### A. Métadonnées étendues
```html
<!-- Dans surveyForm -->
<div class="form-group">
  <label>Code sondage</label>
  <input type="text" id="surveyCode" placeholder="ex: LOME-2025-S014" />
</div>
<div class="form-group">
  <label>Date</label>
  <input type="date" id="surveyDate" />
</div>
<div class="form-group">
  <label>Source (Entreprise/Labo)</label>
  <input type="text" id="surveySource" placeholder="ex: Laboratoire XYZ" />
</div>
<div class="form-group">
  <label>Opérateur</label>
  <input type="text" id="surveyOperator" placeholder="ex: Équipe A" />
</div>
<div class="form-group">
  <label>Notes</label>
  <textarea id="surveyNotes" placeholder="Notes additionnelles..."></textarea>
</div>
```

##### B. Modes de localisation
```html
<div class="form-group">
  <label>Mode de localisation</label>
  <select id="locationMode">
    <option value="exact">Exact (coordonnées)</option>
    <option value="centroid">Centroïde d'une zone ADM</option>
    <option value="unknown">Administratif seul (sans coordonnées)</option>
  </select>
</div>

<!-- Section coordonnées (visible si mode=exact) -->
<div id="coordsSection">
  <div class="form-group">
    <label>Longitude *</label>
    <input type="number" id="surveyLon" step="0.000001" />
    <button class="btn" id="viewOnMapBtn">📍 Voir sur carte</button>
  </div>
  <div class="form-group">
    <label>Latitude *</label>
    <input type="number" id="surveyLat" step="0.000001" />
  </div>
</div>

<!-- Section ADM (visible si mode=centroid ou unknown) -->
<div id="admSection" style="display:none">
  <div class="form-group">
    <label>Région (ADM1)</label>
    <select id="selectAdm1">
      <option value="">— Sélectionner —</option>
    </select>
  </div>
  <div class="form-group">
    <label>Préfecture (ADM2)</label>
    <select id="selectAdm2">
      <option value="">— Sélectionner —</option>
    </select>
  </div>
  <div class="form-group">
    <label>Commune (ADM3)</label>
    <select id="selectAdm3">
      <option value="">— Sélectionner —</option>
    </select>
  </div>
  <div class="form-group" id="centroidOption" style="display:none">
    <label>
      <input type="checkbox" id="useCentroid" />
      Placer au centroïde de la zone sélectionnée
    </label>
  </div>
</div>
```

##### C. Table dynamique essais
```html
<div class="form-group">
  <h4>Essais *</h4>
  <table id="testsTable" class="tests-table">
    <thead>
      <tr>
        <th>Type</th>
        <th>Valeur</th>
        <th>Profondeur (m)</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="testsTableBody">
      <!-- Lignes dynamiques -->
    </tbody>
  </table>
  <button type="button" class="btn" id="addTestBtn">➕ Ajouter un essai</button>
</div>
```

**JavaScript** (`main.ts`):
```typescript
// État global
let tests: Array<{type: string, value: number, depth_m: number}> = []
let selectedAdm1 = '', selectedAdm2 = '', selectedAdm3 = ''

// Charger ADM1 au démarrage
async function loadAdm1() {
  const res = await fetch(`${API_GEO}/adm1`)
  const zones = await res.json()
  const select = document.getElementById('selectAdm1') as HTMLSelectElement
  zones.forEach((z: any) => {
    const opt = document.createElement('option')
    opt.value = z.name
    opt.textContent = z.name
    select.appendChild(opt)
  })
}

// Cascade ADM2
document.getElementById('selectAdm1')!.addEventListener('change', async (e) => {
  const adm1 = (e.target as HTMLSelectElement).value
  selectedAdm1 = adm1
  const res = await fetch(`${API_GEO}/adm2?adm1=${encodeURIComponent(adm1)}`)
  const zones = await res.json()
  const select = document.getElementById('selectAdm2') as HTMLSelectElement
  select.innerHTML = '<option value="">— Sélectionner —</option>'
  zones.forEach((z: any) => {
    const opt = document.createElement('option')
    opt.value = z.name
    opt.textContent = z.name
    select.appendChild(opt)
  })
})

// Cascade ADM3
document.getElementById('selectAdm2')!.addEventListener('change', async (e) => {
  const adm2 = (e.target as HTMLSelectElement).value
  selectedAdm2 = adm2
  const res = await fetch(`${API_GEO}/adm3?adm2=${encodeURIComponent(adm2)}`)
  const zones = await res.json()
  const select = document.getElementById('selectAdm3') as HTMLSelectElement
  select.innerHTML = '<option value="">— Sélectionner —</option>'
  zones.forEach((z: any) => {
    const opt = document.createElement('option')
    opt.value = z.name
    opt.textContent = z.name
    select.appendChild(opt)
  })
})

// Toggle sections selon mode
document.getElementById('locationMode')!.addEventListener('change', (e) => {
  const mode = (e.target as HTMLSelectElement).value
  document.getElementById('coordsSection')!.style.display = mode === 'exact' ? 'block' : 'none'
  document.getElementById('admSection')!.style.display = mode !== 'exact' ? 'block' : 'none'
  document.getElementById('centroidOption')!.style.display = mode === 'centroid' ? 'block' : 'none'
})

// Ajouter essai
document.getElementById('addTestBtn')!.addEventListener('click', () => {
  const type = prompt('Type (SPT_N ou qc):')
  if (!type) return
  const value = parseFloat(prompt('Valeur:') || '0')
  const depth_m = parseFloat(prompt('Profondeur (m):') || '0')
  
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
  renderTestsTable()
})

function renderTestsTable() {
  const tbody = document.getElementById('testsTableBody')!
  tbody.innerHTML = tests.map((t, i) => `
    <tr>
      <td>${t.type}</td>
      <td>${t.value}</td>
      <td>${t.depth_m}</td>
      <td>
        <button class="btn-delete" onclick="deleteTest(${i})">🗑️</button>
      </td>
    </tr>
  `).join('')
}

function deleteTest(index: number) {
  tests.splice(index, 1)
  renderTestsTable()
}

// Enregistrer sondage
document.getElementById('saveSurveyBtn')!.addEventListener('click', async () => {
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  const code = (document.getElementById('surveyCode') as HTMLInputElement).value
  const date = (document.getElementById('surveyDate') as HTMLInputElement).value
  const source = (document.getElementById('surveySource') as HTMLInputElement).value
  const operator = (document.getElementById('surveyOperator') as HTMLInputElement).value
  const notes = (document.getElementById('surveyNotes') as HTMLTextAreaElement).value
  
  if (tests.length === 0) {
    toast('Au moins 1 essai requis', 'err')
    return
  }
  
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
    payload.commune_id = `ADM3-${adm3}` // À adapter selon votre format
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
    toast(`✅ Sondage créé: ${data.sondage_id}`)
    closeDrawer()
    loadGrid() // Recharger la grille
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})
```

#### 2. Résumé temps réel
```html
<div id="surveySummary" class="survey-summary">
  <h4>Résumé</h4>
  <div id="summaryContent">
    <div><strong>Région:</strong> <span id="summaryAdm1">—</span></div>
    <div><strong>Préfecture:</strong> <span id="summaryAdm2">—</span></div>
    <div><strong>Commune:</strong> <span id="summaryAdm3">—</span></div>
    <div><strong>Code maille:</strong> <span id="summaryMaille">—</span></div>
    <div><strong>Essais:</strong> <span id="summaryTests">0</span></div>
    <div id="summaryAlerts" class="alerts"></div>
  </div>
</div>
```

**JavaScript**: Mettre à jour le résumé à chaque changement (ADM, coordonnées, essais)

#### 3. Filtres par location_accuracy
```html
<!-- Dans la section filtres -->
<div class="section">
  <h4>Filtres localisation</h4>
  <label>
    <input type="checkbox" id="filterExact" checked />
    Exact
  </label>
  <label>
    <input type="checkbox" id="filterCentroid" checked />
    Centroïde
  </label>
  <label>
    <input type="checkbox" id="filterUnknown" />
    Administratif seul
  </label>
</div>
```

**JavaScript**: Appliquer filtres dans `loadSurveyList()`

## 📦 Build & Test

### Backend
```bash
cd atlas/services/api-geo
cargo build --release
cargo test
```

### Frontend
```bash
cd atlas/ui
npm install
npm run build
npm run dev
```

### Tests manuels
1. Créer sondage mode exact → vérifier maille_code
2. Créer sondage mode centroid → vérifier location_accuracy
3. Créer sondage mode unknown → vérifier is_geocoded=false
4. Lister sondages avec filtres
5. Géocoder un sondage unknown → exact

## 📝 Notes importantes

### Migrations SQL
Les migrations 004, 005, 006 doivent être appliquées avant de tester.

### Format commune_id
Le format `ADM3-xxx` doit correspondre au champ `code` dans `adm3_tg`. Adapter selon vos données.

### Validation
- Toutes les validations sont implémentées côté backend
- Ajouter validations côté frontend pour meilleure UX

### Rétrocompatibilité
L'ancien endpoint `POST /surveys/legacy` reste disponible pour compatibilité.

## 🎯 Prochaines étapes

1. ✅ Backend API complété (90%)
2. 🚧 Frontend UI (en cours - 40%)
3. ⏳ POST /surveys/bulk (optionnel)
4. ⏳ Tests end-to-end
5. ⏳ Documentation utilisateur

---

**Auteur**: Cascade AI  
**Version**: 1.2.0-beta  
**Dernière mise à jour**: 2025-10-17
