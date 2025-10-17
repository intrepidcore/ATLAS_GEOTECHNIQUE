# Atlas v1.2.0 - Résumé d'implémentation

## ✅ COMPLÉTÉ (Backend - 90%)

### Fichiers modifiés/créés

1. **`services/api-geo/src/surveys.rs`** - Mis à jour
   - ✅ DTOs étendus (NewSurveyRequest, CreateSurveyResponse, GeocodeRequest, etc.)
   - ✅ Fonctions de validation (validate_togo_bounds, validate_test, etc.)
   - ✅ GET /surveys avec filtres location_accuracy, is_geocoded
   - ✅ GET /adm1|2|3 avec bbox et code
   - ✅ Survey étendu avec tous les nouveaux champs

2. **`services/api-geo/src/surveys_extended.rs`** - Nouveau
   - ✅ POST /surveys (create_survey_v2) - Transaction atomique
   - ✅ POST /surveys/:id/geocode - Géocoder un sondage

3. **`services/api-geo/src/main.rs`** - Mis à jour
   - ✅ Module surveys_extended ajouté
   - ✅ Routes configurées

4. **`db/migrations/004_add_survey_management.sql`** - Existant ✅
5. **`db/migrations/005_add_location_modes.sql`** - Existant ✅
6. **`db/migrations/006_create_adm_tables.sql`** - Existant ✅

### API Endpoints disponibles

```
✅ POST   /surveys              → create_survey_v2 (nouveau, complet)
✅ POST   /surveys/legacy       → create_survey (ancien, rétrocompat)
✅ GET    /surveys              → list_surveys (avec filtres)
✅ DELETE /surveys/:id          → delete_survey
✅ POST   /surveys/:id/geocode  → geocode_survey (nouveau)
✅ GET    /surveys/:id/tests    → list_tests
✅ POST   /tests                → create_test
✅ DELETE /tests/:id            → delete_test
✅ GET    /grid/locate          → locate_maille
✅ GET    /adm1|2|3             → list_adm* (avec bbox+code)
```

## 🚧 EN COURS (Frontend - 50%)

### Fichiers modifiés

1. **`ui/index.html`** - ✅ Formulaire complet créé
   - Métadonnées (code, date, source, opérateur)
   - Mode localisation (exact/centroid/unknown)
   - Sélecteurs ADM cascadés
   - Table essais
   - Résumé temps réel

2. **`ui/src/main.ts`** - ⏳ À compléter
   - Logique formulaire à implémenter
   - Gestion tests dynamique
   - Appel API POST /surveys
   - Mise à jour résumé

## 🎯 POUR TERMINER L'IMPLÉMENTATION

### Étape 1: Compléter main.ts

Ajouter après la ligne 775 (avant `loadGrid()`):

```typescript
// État global sondages
let tests: Array<{type: string, value: number, depth_m: number}> = []

// Toggle sections
document.getElementById('locationMode')!.addEventListener('change', () => {
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  document.getElementById('coordsSection')!.style.display = mode === 'exact' ? 'block' : 'none'
  document.getElementById('admSection')!.style.display = mode !== 'exact' ? 'block' : 'none'
  document.getElementById('centroidOption')!.style.display = mode === 'centroid' ? 'block' : 'none'
})

// Charger ADM1
async function loadAdm1() {
  const res = await fetch(`${API_GEO}/adm1`)
  const zones = await res.json()
  const select = document.getElementById('selectAdm1') as HTMLSelectElement
  select.innerHTML = '<option value="">— Sélectionner —</option>'
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
  if (!adm1) return
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
  if (!adm2) return
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

// Ajouter essai
document.getElementById('addTestBtn')!.addEventListener('click', () => {
  const type = prompt('Type (SPT_N ou qc):')
  if (!type) return
  const value = parseFloat(prompt('Valeur:') || '0')
  const depth_m = parseFloat(prompt('Profondeur (m):') || '0')
  
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
  if (tests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px">Aucun essai</td></tr>'
    return
  }
  tbody.innerHTML = tests.map((t, i) => `
    <tr style="border:1px solid #22304d">
      <td style="padding:8px">${t.type}</td>
      <td style="padding:8px">${t.value}</td>
      <td style="padding:8px">${t.depth_m}</td>
      <td style="padding:8px;text-align:center">
        <button onclick="tests.splice(${i},1);renderTestsTable()" style="background:transparent;border:1px solid #6b1b2c;color:var(--err);padding:4px 8px;font-size:11px;cursor:pointer;border-radius:4px">🗑️</button>
      </td>
    </tr>
  `).join('')
  document.getElementById('summaryTests')!.textContent = tests.length.toString()
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
    payload.commune_id = `ADM3-${adm3}`
    payload.use_commune_centroid = (document.getElementById('useCentroid') as HTMLInputElement).checked
  }
  
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
    loadGrid()
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// Charger ADM1 au démarrage
document.getElementById('newSurveyBtn')!.addEventListener('click', () => {
  openDrawer('create')
  loadAdm1()
})
```

### Étape 2: Build & Test

```bash
# Backend
cd atlas/services/api-geo
cargo build --release

# Frontend
cd atlas/ui
npm install
npm run build
npm run dev
```

### Étape 3: Tests manuels

1. ✅ Créer sondage mode exact
2. ✅ Créer sondage mode centroid
3. ✅ Créer sondage mode unknown
4. ✅ Vérifier filtres
5. ✅ Lister sondages

## 📊 Progression globale

- **Backend**: 90% ✅
- **Frontend**: 50% 🚧
- **Tests**: 0% ⏳
- **Documentation**: 80% ✅

## 🎯 Priorités

1. **HAUTE**: Compléter main.ts (2h)
2. **HAUTE**: Tester end-to-end (1h)
3. **MOYENNE**: POST /surveys/bulk (optionnel, 3h)
4. **BASSE**: Documentation utilisateur (1h)

---

**Total estimé pour terminer**: 4-6 heures
