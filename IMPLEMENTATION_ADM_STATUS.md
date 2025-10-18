# 📊 Statut Implémentation Sondages ADM

**Date :** 18 octobre 2025  
**Session :** Implémentation complète backend

---

## ✅ Backend Complété

### 1. Migration Base de Données
- ✅ Migration 008 appliquée
- ✅ ENUM `location_mode_enum` créé (exact, unknown, centroid, random)
- ✅ Colonnes `adm1_id`, `adm2_id`, `adm3_id` ajoutées (INTEGER pour gid)
- ✅ Fonction `get_adm_centroid(adm_level TEXT, adm_gid INTEGER)` créée
- ✅ Fonction `get_adm_random_point(adm_level TEXT, adm_gid INTEGER, seed TEXT)` créée
- ✅ Vue `sondages_non_geocodes` créée
- ✅ Index créés sur `adm*_id` et `location_mode`
- ✅ Contrainte `check_unknown_has_adm` ajoutée

### 2. Module Rust `surveys_adm.rs`
- ✅ Adapté pour utiliser `i32` (gid) au lieu de `UUID`
- ✅ `POST /surveys/adm` - Créer sondage avec mode ADM
- ✅ `POST /surveys/{id}/geocode` - Géocoder un sondage
- ✅ `GET /surveys/ungeocode` - Liste des sondages non géocodés
- ✅ Support 3 modes: unknown, centroid, random
- ✅ Transactions atomiques

### 3. Routes API
- ✅ Routes ajoutées dans `main.rs`
- ✅ `GET /adm/:level` - Liste des zones ADM (retourne gid + nom)
- ✅ Fonction `list_adm_zones` dans `routes.rs`

### 4. Corrections Structure ADM
- ✅ Tables ADM utilisent `gid` (INTEGER) au lieu de `id` (UUID)
- ✅ Colonnes de nom: `adm1_fr`, `adm2_fr`, `adm3_fr`
- ✅ Toutes les fonctions et vues adaptées

---

## 🚧 Frontend À Faire

### 1. Modifier Formulaire Géotechnique

**Fichier :** `ui/src/geotechnical-form.ts`

#### Ajouts nécessaires :

**A. Section Mode de Localisation** (après Type de Sol)
```typescript
<div class="form-section">
  <h3>Mode de Localisation</h3>
  <select id="gt-location-mode">
    <option value="exact">📍 Coordonnées exactes (GPS)</option>
    <option value="unknown">❓ Position inconnue</option>
    <option value="centroid">🎯 Centroïde ADM</option>
    <option value="random">🎲 Point aléatoire ADM</option>
  </select>
  
  <div id="gt-adm-section" style="display:none">
    <select id="gt-adm-level">
      <option value="ADM1">Région</option>
      <option value="ADM2">Préfecture</option>
      <option value="ADM3">Commune</option>
    </select>
    <select id="gt-adm-id"></select>
  </div>
</div>
```

**B. Event Listeners**
```typescript
// Afficher/masquer section ADM selon le mode
locationModeSelect.addEventListener('change', () => {
  const mode = locationModeSelect.value
  if (mode === 'exact') {
    admSection.style.display = 'none'
  } else {
    admSection.style.display = 'block'
  }
})

// Charger les zones ADM
admLevelSelect.addEventListener('change', async () => {
  const level = admLevelSelect.value
  const res = await fetch(`${API_GEO}/adm/${level.toLowerCase()}`)
  const zones = await res.json()
  // Remplir le select gt-adm-id
})
```

**C. Modifier submitForm()**
```typescript
if (locationMode === 'exact') {
  // POST /surveys/geotech (existant)
} else {
  // POST /surveys/adm (nouveau)
  const payload = {
    adm_level: admLevel,
    adm_id: parseInt(admId),  // GID en integer
    location_mode: locationMode,
    survey: { ... },
    tests: [ ... ]
  }
}
```

### 2. Interface de Géocodage

**Nouveau fichier :** `ui/src/geocode-manager.ts`

```typescript
export class GeocodeManager {
  async listUngeocoded() {
    const res = await fetch(`${API_GEO}/surveys/ungeocode`)
    return res.json()
  }
  
  async geocode(surveyId, mode, data) {
    const payload = mode === 'coords'
      ? { lon: data.lon, lat: data.lat }
      : { 
          location_mode: data.location_mode,
          adm_level: data.adm_level,
          adm_id: parseInt(data.adm_id)
        }
    
    const res = await fetch(`${API_GEO}/surveys/${surveyId}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return res.json()
  }
}
```

**Ajouter dans `index.html`** :
```html
<button id="geocodeBtn" class="btn">🗺️ Géocoder les sondages</button>
```

---

## 🧪 Tests Backend

### Test 1: Créer un sondage "unknown"

```bash
curl -X POST http://localhost:8001/surveys/adm \
  -H "Content-Type: application/json" \
  -d '{
    "adm_level": "ADM1",
    "adm_id": 1,
    "location_mode": "unknown",
    "survey": {
      "code": "TEST-UNKNOWN-001",
      "date": "2025-10-18",
      "source": "Test Lab",
      "type_sol": "Ferrugineux Tropicaux"
    },
    "tests": [
      {"type": "Atterberg_WL", "value": 45.5, "depth_m": 1.0}
    ]
  }'
```

**Résultat attendu :**
```json
{
  "id": "...",
  "code": "TEST-UNKNOWN-001",
  "location_mode": "unknown",
  "is_geocoded": false,
  "location_accuracy": "unknown",
  "maille_code": null,
  "n_tests": 1
}
```

### Test 2: Créer un sondage "centroid"

```bash
curl -X POST http://localhost:8001/surveys/adm \
  -H "Content-Type": application/json" \
  -d '{
    "adm_level": "ADM3",
    "adm_id": 5,
    "location_mode": "centroid",
    "survey": {
      "code": "TEST-CENTROID-001",
      "type_sol": "Vertisols et Paravertisols"
    },
    "tests": [
      {"type": "Atterberg_WP", "value": 25.0, "depth_m": 1.0}
    ]
  }'
```

**Résultat attendu :**
```json
{
  "id": "...",
  "code": "TEST-CENTROID-001",
  "location_mode": "centroid",
  "is_geocoded": true,
  "location_accuracy": "centroid_adm3",
  "maille_code": "TG-XXXX-XXXX-XX",
  "n_tests": 1
}
```

### Test 3: Liste des sondages non géocodés

```bash
curl http://localhost:8001/surveys/ungeocode
```

**Résultat attendu :**
```json
[
  {
    "id": "...",
    "code": "TEST-UNKNOWN-001",
    "location_mode": "unknown",
    "adm1_name": "Maritime",
    "n_essais": 1
  }
]
```

### Test 4: Géocoder un sondage

```bash
curl -X POST http://localhost:8001/surveys/{id}/geocode \
  -H "Content-Type: application/json" \
  -d '{
    "lon": 1.2345,
    "lat": 6.1234
  }'
```

**Résultat attendu :**
```json
{
  "id": "...",
  "code": "TEST-UNKNOWN-001",
  "location_mode": "exact",
  "is_geocoded": true,
  "location_accuracy": "exact",
  "maille_code": "TG-XXXX-XXXX-XX",
  "lon": 1.2345,
  "lat": 6.1234
}
```

### Test 5: Liste des zones ADM

```bash
curl http://localhost:8001/adm/adm1
curl http://localhost:8001/adm/adm2
curl http://localhost:8001/adm/adm3
```

**Résultat attendu :**
```json
[
  {"id": 1, "name": "Maritime"},
  {"id": 2, "name": "Plateaux"},
  ...
]
```

---

## 📊 Statut Global

| Composant | Statut | Détails |
|-----------|--------|---------|
| Migration DB | ✅ Complété | Tables, fonctions, vue créées |
| Module Rust | ✅ Complété | surveys_adm.rs adapté pour gid |
| Routes API | ✅ Complété | 4 routes ajoutées |
| Backend Build | 🔄 En cours | docker compose build |
| Frontend Form | ⏳ À faire | Ajouter section mode localisation |
| Frontend Geocode | ⏳ À faire | Créer geocode-manager.ts |
| Tests E2E | ⏳ À faire | Après frontend |

---

## 🎯 Prochaines Étapes

1. ✅ **Attendre fin du build backend**
2. **Tester les endpoints API** (5 tests ci-dessus)
3. **Modifier le formulaire géotechnique** (frontend)
4. **Créer l'interface de géocodage** (frontend)
5. **Tests E2E complets**

---

**Temps estimé restant :** ~30 minutes (frontend uniquement)
