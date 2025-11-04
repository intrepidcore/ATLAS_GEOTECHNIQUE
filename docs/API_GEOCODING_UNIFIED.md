# API Géocodage & Vue Unifiée

Documentation des nouveaux endpoints pour la gestion des suggestions de géocodage et la vue unifiée des sondages par localité.

## 📍 Endpoints Géocodage

### GET `/geocode/suggestions`

Liste les suggestions de géocodage avec filtres.

**Query Parameters:**
- `status` (optional): `pending`, `done`, `rejected`
- `reason` (optional): `missing_location`, `missing_geometry`, etc.
- `limit` (optional): nombre max de résultats (défaut: 100, max: 500)
- `offset` (optional): pagination (défaut: 0)

**Response:**
```json
[
  {
    "id": "uuid",
    "sondage_id": "uuid",
    "reason": "missing_location",
    "status": "pending",
    "payload": {
      "code": "GRANULO-ADJENGRE",
      "source": "Granulométrie",
      "localite_key": "ADJENGRE",
      "localite_base": "ADJENGRE"
    },
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

**Exemple:**
```bash
curl "http://localhost:8000/geocode/suggestions?status=pending&limit=50"
```

---

### POST `/geocode/suggestions/:id/accept`

Accepte une suggestion et géocode le sondage.

**Path Parameters:**
- `id`: UUID de la suggestion

**Body (JSON):**
```json
{
  "adm3_id": "uuid",           // Option 1: Géocodage par ADM3
  "lon": 1.234,                // Option 2: Coordonnées exactes
  "lat": 6.789,
  "location_mode": "exact"     // optional
}
```

**Response:**
```json
{
  "id": "uuid",
  "sondage_id": "uuid",
  "reason": "missing_location",
  "status": "done",
  "payload": {...},
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Exemple:**
```bash
# Géocodage par ADM3
curl -X POST "http://localhost:8000/geocode/suggestions/{id}/accept" \
  -H "Content-Type: application/json" \
  -d '{"adm3_id": "uuid-adm3"}'

# Géocodage par coordonnées
curl -X POST "http://localhost:8000/geocode/suggestions/{id}/accept" \
  -H "Content-Type: application/json" \
  -d '{"lon": 1.234, "lat": 6.789}'
```

---

### POST `/geocode/suggestions/:id/reject`

Rejette une suggestion.

**Path Parameters:**
- `id`: UUID de la suggestion

**Response:**
```json
{
  "id": "uuid",
  "sondage_id": "uuid",
  "status": "rejected",
  ...
}
```

**Exemple:**
```bash
curl -X POST "http://localhost:8000/geocode/suggestions/{id}/reject"
```

---

### GET `/geocode/stats`

Statistiques des suggestions de géocodage.

**Response:**
```json
{
  "total": 229,
  "accepted": 0,
  "pending": 229,
  "rejected": 0,
  "no_suggestion": 0
}
```

**Exemple:**
```bash
curl "http://localhost:8000/geocode/stats"
```

---

### POST `/geocode/apply-accepted`

Refresh la vue matérialisée unifiée après acceptation de suggestions.

**Response:**
```json
{
  "applied_count": 10,
  "refreshed": true
}
```

**Exemple:**
```bash
curl -X POST "http://localhost:8000/geocode/apply-accepted"
```

---

## 🗺️ Endpoints Vue Unifiée

### GET `/surveys/unified`

Liste unifiée des sondages regroupés par localité.

**Query Parameters:**
- `q` (optional): recherche floue sur le nom de localité
- `adm3_id` (optional): filtrer par ADM3
- `has_geometry` (optional): `true` ou `false`
- `limit` (optional): nombre max de résultats (défaut: 100, max: 500)
- `offset` (optional): pagination (défaut: 0)

**Response:**
```json
[
  {
    "localite_key": "ADJENGRE",
    "localite": "Adjengre",
    "survey_ids": ["uuid1", "uuid2", "uuid3"],
    "survey_codes": ["GRANULO-ADJENGRE", "BLEU-ADJENGRE", "LIMITE-ADJENGRE"],
    "has_bleu": true,
    "has_limite": true,
    "has_granulo": true,
    "has_vbs": false,
    "variants": 3,
    "adm3_id": "uuid",
    "adm3_name": "Adjengre",
    "has_geometry": true,
    "latest_date": "2024-01-01",
    "atterberg_count": 12,
    "granulo_count": 36,
    "vbs_count": 9,
    "echantillons_count": 15,
    "total_essais": 57
  }
]
```

**Exemple:**
```bash
# Toutes les localités
curl "http://localhost:8000/surveys/unified"

# Recherche floue
curl "http://localhost:8000/surveys/unified?q=adjeng"

# Sans géométrie
curl "http://localhost:8000/surveys/unified?has_geometry=false"

# Par ADM3
curl "http://localhost:8000/surveys/unified?adm3_id=uuid-adm3"
```

---

### GET `/surveys/unified/stats`

Statistiques globales de la vue unifiée.

**Response:**
```json
{
  "total_localites": 139,
  "total_sondages": 230,
  "localites_avec_doublons": 9,
  "total_essais": 952,
  "sondages_sans_geom": 107
}
```

**Exemple:**
```bash
curl "http://localhost:8000/surveys/unified/stats"
```

---

### POST `/surveys/unified/refresh`

Force le refresh de la vue matérialisée (concurrent, sans lock).

**Response:**
```json
{
  "success": true,
  "message": "Vue unifiée rafraîchie avec succès"
}
```

**Exemple:**
```bash
curl -X POST "http://localhost:8000/surveys/unified/refresh"
```

---

## 🔄 Workflow Complet

### 1. Lister les suggestions pending
```bash
curl "http://localhost:8000/geocode/suggestions?status=pending"
```

### 2. Accepter une suggestion (par ADM3)
```bash
curl -X POST "http://localhost:8000/geocode/suggestions/{id}/accept" \
  -H "Content-Type: application/json" \
  -d '{"adm3_id": "uuid-adm3"}'
```

### 3. Refresh la vue unifiée
```bash
curl -X POST "http://localhost:8000/geocode/apply-accepted"
```

### 4. Vérifier les stats
```bash
curl "http://localhost:8000/geocode/stats"
curl "http://localhost:8000/surveys/unified/stats"
```

---

## 🎯 Cas d'Usage UI

### Onglet "Suggestions de Géocodage"

```javascript
// Charger les suggestions pending
const suggestions = await fetch('/geocode/suggestions?status=pending').then(r => r.json());

// Afficher sur la carte
suggestions.forEach(s => {
  const { code, localite_base } = s.payload;
  // Afficher marker avec popup
});

// Accepter une suggestion
async function acceptSuggestion(id, adm3_id) {
  await fetch(`/geocode/suggestions/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adm3_id })
  });
  
  // Refresh la vue
  await fetch('/geocode/apply-accepted', { method: 'POST' });
  
  // Recharger les suggestions
  loadSuggestions();
}
```

### Onglet "Liste Unifiée"

```javascript
// Charger la liste unifiée
const unified = await fetch('/surveys/unified').then(r => r.json());

// Afficher dans un tableau
unified.forEach(loc => {
  console.log(`${loc.localite}: ${loc.variants} sondages, ${loc.total_essais} essais`);
  console.log(`  Types: Granulo=${loc.has_granulo}, VBS=${loc.has_vbs}, Atterberg=${loc.has_limite}`);
});

// Recherche floue
const results = await fetch('/surveys/unified?q=adjeng').then(r => r.json());

// Filtrer sans géométrie
const noGeom = await fetch('/surveys/unified?has_geometry=false').then(r => r.json());
```

### Dashboard Stats

```javascript
const geocodeStats = await fetch('/geocode/stats').then(r => r.json());
const unifiedStats = await fetch('/surveys/unified/stats').then(r => r.json());

console.log(`Suggestions: ${geocodeStats.pending} pending, ${geocodeStats.accepted} done`);
console.log(`Localités: ${unifiedStats.total_localites} uniques (${unifiedStats.localites_avec_doublons} avec doublons)`);
console.log(`Essais: ${unifiedStats.total_essais} total`);
```

---

## 🔍 Recherche Floue

La recherche utilise la fonction `atlas.norm_key()` qui:
- Supprime les accents (é → e)
- Convertit en majuscules
- Supprime les caractères spéciaux
- Permet la recherche partielle avec `LIKE`

**Exemples:**
- `q=adjeng` → trouve "Adjengre", "ADJENGRE-POUNPOUNI"
- `q=kpime` → trouve "Kpimé", "KPIME-SEVA"
- `q=wome` → trouve "Womé", "WOME-CASCADE", "WOME-VILLE"

---

## 📊 Intégration Frontend

### Composant SuggestionsList.vue

```vue
<template>
  <div class="suggestions-panel">
    <div class="stats">
      <span>{{ stats.pending }} en attente</span>
      <span>{{ stats.accepted }} acceptées</span>
    </div>
    
    <div v-for="s in suggestions" :key="s.id" class="suggestion-card">
      <h3>{{ s.payload.code }}</h3>
      <p>Localité: {{ s.payload.localite_base }}</p>
      <button @click="accept(s.id)">Accepter</button>
      <button @click="reject(s.id)">Rejeter</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const suggestions = ref([]);
const stats = ref({});

async function loadData() {
  suggestions.value = await fetch('/geocode/suggestions?status=pending').then(r => r.json());
  stats.value = await fetch('/geocode/stats').then(r => r.json());
}

async function accept(id) {
  // Afficher modal pour choisir ADM3 ou coordonnées
  const adm3_id = await showAdm3Picker();
  await fetch(`/geocode/suggestions/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adm3_id })
  });
  loadData();
}

async function reject(id) {
  await fetch(`/geocode/suggestions/${id}/reject`, { method: 'POST' });
  loadData();
}

onMounted(loadData);
</script>
```

---

## 🚀 Déploiement

Les endpoints sont automatiquement disponibles après compilation et redémarrage de l'API:

```bash
cd services/api-geo
cargo build --release
docker-compose restart api-geo
```

Vérifier le démarrage:
```bash
curl http://localhost:8000/healthz
curl http://localhost:8000/geocode/stats
curl http://localhost:8000/surveys/unified/stats
```
