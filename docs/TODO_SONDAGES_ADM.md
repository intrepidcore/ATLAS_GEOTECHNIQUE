# 📋 TODO - Implémentation Sondages ADM (Suite)

**Date :** 18 octobre 2025  
**Commit :** `4faa58f` - feat: v1.4.0 corrections majeures et preparation sondages ADM

---

## ✅ Déjà Fait

### Backend
- ✅ Migration 008 créée (`db/migrations/008_adm_surveys.sql`)
  - ENUM `location_mode_enum` (exact, unknown, centroid, random)
  - Colonnes `location_mode`, `adm1_id`, `adm2_id`, `adm3_id` ajoutées à `sondages`
  - Fonction `get_adm_centroid(adm_level, adm_id)` → centroïde EPSG:25231
  - Fonction `get_adm_random_point(adm_level, adm_id, seed)` → point aléatoire déterministe
  - Fonction `find_maille_for_point(geom)` → trouve la maille contenant un point
  - Vue `sondages_non_geocodes` pour lister les sondages à géocoder
  - Contrainte: `location_mode = 'unknown'` nécessite au moins un ADM

- ✅ Module Rust `surveys_adm.rs` créé
  - `POST /surveys/adm` - Créer un sondage avec mode ADM
  - `POST /surveys/{id}/geocode` - Géocoder un sondage existant
  - `GET /surveys/ungeocode` - Liste des sondages non géocodés
  - Support des 3 modes: unknown, centroid, random
  - Transactions atomiques avec rollback

- ✅ Module ajouté dans `main.rs`

### Frontend
- ✅ Formulaire géotechnique enrichi fonctionnel
- ✅ Sélection sur carte avec retour au formulaire
- ✅ Graphiques Chart.js corrigés
- ✅ Suppression avec mise à jour immédiate

---

## 🚧 À Faire

### 1. Backend - Routes dans main.rs

**Fichier :** `services/api-geo/src/main.rs`

```rust
// Ajouter dans le Router
.route("/surveys/adm", post(surveys_adm::create_survey_adm))
.route("/surveys/:id/geocode", post(surveys_adm::geocode_survey))
.route("/surveys/ungeocode", get(surveys_adm::list_ungeocode_surveys))
```

### 2. Migration 008 - Appliquer

**Commande :**
```bash
docker exec -i atlas-db psql -U postgres -d atlas_geo < db/migrations/008_adm_surveys.sql
```

**Vérification :**
```sql
-- Vérifier les colonnes
\d sondages

-- Vérifier les fonctions
\df get_adm_*

-- Vérifier la vue
SELECT * FROM sondages_non_geocodes LIMIT 5;
```

### 3. Frontend - Modifier le Formulaire Géotechnique

**Fichier :** `ui/src/geotechnical-form.ts`

#### 3.1 Ajouter Section "Mode de Localisation"

Après la section "Type de Sol", ajouter :

```typescript
<!-- Partie 1.5: Mode de Localisation -->
<div class="form-section">
  <h3>1.5 Mode de Localisation</h3>
  
  <div class="form-row">
    <div class="form-group">
      <label for="gt-location-mode">Mode *</label>
      <select id="gt-location-mode" required>
        <option value="">-- Sélectionner --</option>
        <option value="exact">📍 Coordonnées exactes (GPS)</option>
        <option value="unknown">❓ Position inconnue (ADM uniquement)</option>
        <option value="centroid">🎯 Centroïde de la zone ADM</option>
        <option value="random">🎲 Point aléatoire dans la zone ADM</option>
      </select>
    </div>
  </div>
  
  <!-- Sélection ADM (visible si mode != exact) -->
  <div id="gt-adm-section" style="display: none;">
    <div class="form-row">
      <div class="form-group">
        <label for="gt-adm-level">Niveau ADM *</label>
        <select id="gt-adm-level">
          <option value="">-- Sélectionner --</option>
          <option value="ADM1">Région (ADM1)</option>
          <option value="ADM2">Préfecture (ADM2)</option>
          <option value="ADM3">Commune (ADM3)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="gt-adm-id">Zone ADM *</label>
        <select id="gt-adm-id">
          <option value="">-- Sélectionner le niveau d'abord --</option>
        </select>
      </div>
    </div>
    
    <div class="alert alert-info" id="gt-location-warning" style="display: none;">
      <strong>ℹ️ Information :</strong>
      <span id="gt-location-warning-text"></span>
    </div>
  </div>
</div>
```

#### 3.2 Ajouter Event Listeners

```typescript
// Dans attachEventListeners()
const locationModeSelect = document.getElementById('gt-location-mode') as HTMLSelectElement
locationModeSelect?.addEventListener('change', () => {
  const mode = locationModeSelect.value
  const admSection = document.getElementById('gt-adm-section')
  const locSection = document.getElementById('gt-localisation-section')
  const warning = document.getElementById('gt-location-warning')
  const warningText = document.getElementById('gt-location-warning-text')
  
  if (mode === 'exact') {
    // Mode exact: afficher lon/lat, masquer ADM
    if (admSection) admSection.style.display = 'none'
    if (locSection) locSection.style.display = 'block'
    if (warning) warning.style.display = 'none'
  } else {
    // Autres modes: afficher ADM, masquer/désactiver lon/lat
    if (admSection) admSection.style.display = 'block'
    if (locSection) locSection.style.display = mode === 'unknown' ? 'none' : 'block'
    if (warning) warning.style.display = 'block'
    
    // Messages d'avertissement
    const messages = {
      unknown: 'Le sondage sera créé sans coordonnées. Vous pourrez le géocoder ultérieurement.',
      centroid: '⚠️ Le sondage sera placé au centroïde de la zone ADM. Position approximative.',
      random: '⚠️ Le sondage sera placé aléatoirement dans la zone ADM. À utiliser avec précaution.'
    }
    if (warningText) warningText.textContent = messages[mode] || ''
  }
})

// Charger les zones ADM selon le niveau
const admLevelSelect = document.getElementById('gt-adm-level') as HTMLSelectElement
admLevelSelect?.addEventListener('change', async () => {
  const level = admLevelSelect.value
  const admIdSelect = document.getElementById('gt-adm-id') as HTMLSelectElement
  
  if (!level || !admIdSelect) return
  
  // Charger les zones ADM depuis l'API
  try {
    const res = await fetch(`${API_GEO}/adm/${level.toLowerCase()}`)
    if (!res.ok) throw new Error('Failed to load ADM zones')
    
    const zones = await res.json()
    admIdSelect.innerHTML = '<option value="">-- Sélectionner --</option>'
    zones.forEach((zone: any) => {
      const option = document.createElement('option')
      option.value = zone.id
      option.textContent = zone.name
      admIdSelect.appendChild(option)
    })
  } catch (e) {
    console.error('Failed to load ADM zones:', e)
    admIdSelect.innerHTML = '<option value="">Erreur de chargement</option>'
  }
})
```

#### 3.3 Modifier submitForm()

```typescript
private async submitForm() {
  const locationMode = (document.getElementById('gt-location-mode') as HTMLSelectElement).value
  
  if (locationMode === 'exact') {
    // Utiliser l'endpoint existant POST /surveys/geotech
    // ... code actuel ...
  } else {
    // Utiliser le nouvel endpoint POST /surveys/adm
    const admLevel = (document.getElementById('gt-adm-level') as HTMLSelectElement).value
    const admId = (document.getElementById('gt-adm-id') as HTMLSelectElement).value
    
    if (!admLevel || !admId) {
      alert('Veuillez sélectionner un niveau ADM et une zone')
      return
    }
    
    const payload = {
      adm_level: admLevel,
      adm_id: admId,
      location_mode: locationMode,
      survey: {
        code: (document.getElementById('gt-code') as HTMLInputElement).value,
        date: (document.getElementById('gt-date') as HTMLInputElement).value,
        source: (document.getElementById('gt-source') as HTMLInputElement).value,
        operator: (document.getElementById('gt-operator') as HTMLInputElement).value,
        notes: (document.getElementById('gt-notes') as HTMLTextAreaElement).value,
        type_sol: (document.getElementById('gt-type-sol') as HTMLSelectElement).value
      },
      tests: this.buildTestsPayload()
    }
    
    try {
      const res = await fetch(`${this.apiUrl}/surveys/adm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      this.onSuccess(data)
      this.closeForm('geotechFormContainer')
    } catch (e: any) {
      this.onError(e.message)
    }
  }
}
```

### 4. Frontend - Interface de Géocodage

**Nouveau fichier :** `ui/src/geocode-manager.ts`

```typescript
// Module pour gérer le géocodage des sondages non géocodés
export class GeocodeManager {
  constructor(private apiUrl: string) {}
  
  async listUngeocoded(): Promise<any[]> {
    const res = await fetch(`${this.apiUrl}/surveys/ungeocode`)
    if (!res.ok) throw new Error('Failed to load ungeocode surveys')
    return res.json()
  }
  
  async geocode(surveyId: string, mode: 'coords' | 'adm', data: any): Promise<any> {
    const payload = mode === 'coords'
      ? { lon: data.lon, lat: data.lat }
      : { location_mode: data.location_mode, adm_level: data.adm_level, adm_id: data.adm_id }
    
    const res = await fetch(`${this.apiUrl}/surveys/${surveyId}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }
  
  renderUI(containerId: string) {
    // Créer l'interface de géocodage
    // Liste des sondages non géocodés
    // Formulaire de géocodage par sondage
  }
}
```

### 5. Backend - Route GET /adm/{level}

**Fichier :** `services/api-geo/src/routes.rs`

Ajouter une route pour lister les zones ADM :

```rust
pub async fn list_adm_zones(
    State(state): State<AppState>,
    Path(level): Path<String>,
) -> impl IntoResponse {
    let pool = &state.pool;
    
    let table = match level.as_str() {
        "adm1" => "adm1",
        "adm2" => "adm2",
        "adm3" => "adm3",
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "invalid level"}))).into_response(),
    };
    
    let query = format!("SELECT id, name FROM {} ORDER BY name", table);
    
    let zones: Vec<(String, String)> = match sqlx::query_as(&query)
        .fetch_all(pool)
        .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(?e, "Failed to fetch ADM zones");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "db error"}))).into_response();
        }
    };
    
    let result: Vec<serde_json::Value> = zones
        .into_iter()
        .map(|(id, name)| serde_json::json!({"id": id, "name": name}))
        .collect();
    
    (StatusCode::OK, Json(result)).into_response()
}
```

Ajouter dans le Router :
```rust
.route("/adm/:level", get(routes::list_adm_zones))
```

---

## 🎯 Ordre d'Implémentation Recommandé

1. **Backend Routes** (5 min)
   - Ajouter les 3 routes dans `main.rs`
   - Ajouter route `/adm/:level` dans `routes.rs`

2. **Migration 008** (2 min)
   - Appliquer la migration
   - Vérifier les fonctions et la vue

3. **Test Backend** (5 min)
   - Tester `POST /surveys/adm` avec Postman/curl
   - Tester `GET /surveys/ungeocode`
   - Tester `POST /surveys/{id}/geocode`

4. **Frontend Formulaire** (15 min)
   - Ajouter section Mode de Localisation
   - Ajouter event listeners
   - Modifier submitForm()

5. **Frontend Géocodage** (10 min)
   - Créer `geocode-manager.ts`
   - Ajouter bouton "Géocoder les sondages" dans l'UI
   - Interface de géocodage

6. **Tests E2E** (10 min)
   - Créer un sondage en mode "unknown"
   - Vérifier qu'il n'apparaît pas sur la carte
   - Le géocoder en mode "centroid"
   - Vérifier qu'il apparaît sur la carte

---

## 📊 Estimation Totale

**Temps estimé :** ~45 minutes  
**Complexité :** Moyenne  
**Risques :** Faibles (architecture déjà en place)

---

## 🔗 Références

- Migration 008: `db/migrations/008_adm_surveys.sql`
- Module Backend: `services/api-geo/src/surveys_adm.rs`
- Formulaire: `ui/src/geotechnical-form.ts`
- Documentation: `CHANGELOG_v1.4.0.md`

---

**Prochaine étape :** Ajouter les routes dans `main.rs` et appliquer la migration 008.
