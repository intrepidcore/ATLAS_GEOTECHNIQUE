# UI Géocodage & Vue Unifiée

Documentation pour l'intégration des composants de géocodage et vue unifiée.

## 📦 Composants Disponibles

### 1. Vue.js Components (Recommandé)

#### `GeocodeSuggestionsPanel.vue`
Composant Vue.js complet pour gérer les suggestions de géocodage.

**Features:**
- Liste des suggestions avec filtres (status, reason)
- Stats en temps réel (total, pending, accepted, rejected)
- Modal d'acceptation avec choix ADM3 ou coordonnées
- Rejet de suggestions
- Auto-refresh

**Usage:**
```vue
<template>
  <GeocodeSuggestionsPanel />
</template>

<script setup>
import GeocodeSuggestionsPanel from '@/components/GeocodeSuggestionsPanel.vue';
</script>
```

#### `UnifiedSurveysPanel.vue`
Composant Vue.js pour la vue unifiée des sondages par localité.

**Features:**
- Liste des localités avec regroupement automatique
- Stats globales (localités, sondages, essais)
- Recherche floue (sans accents)
- Filtres (avec/sans géométrie)
- Détails par localité (modal)
- Refresh de la vue matérialisée

**Usage:**
```vue
<template>
  <UnifiedSurveysPanel />
</template>

<script setup>
import UnifiedSurveysPanel from '@/components/UnifiedSurveysPanel.vue';
</script>
```

### 2. TypeScript/Vanilla JS (Alternative)

#### `geocode-ui.ts`
Module TypeScript avec API clients et fonctions de création d'UI.

**API Clients:**
```typescript
import { GeocodeAPI, UnifiedSurveysAPI } from '@/geocode-ui';

// Suggestions
const geocodeAPI = new GeocodeAPI('/api');
const suggestions = await geocodeAPI.getSuggestions({ status: 'pending' });
const stats = await geocodeAPI.getStats();
await geocodeAPI.acceptSuggestion(id, { adm3_id: 'uuid' });
await geocodeAPI.rejectSuggestion(id);

// Vue unifiée
const unifiedAPI = new UnifiedSurveysAPI('/api');
const surveys = await unifiedAPI.getSurveys({ q: 'adjeng' });
const stats = await unifiedAPI.getStats();
await unifiedAPI.refreshView();
```

**UI Helpers:**
```typescript
import { createGeocodeSuggestionsUI, createUnifiedSurveysUI } from '@/geocode-ui';

// Créer l'UI dans un container
const container = document.getElementById('geocode-container')!;
const ui = createGeocodeSuggestionsUI(container);

// Refresh manuel
ui.refresh();
```

## 🎨 Styles

Importer le CSS dans votre application:

```typescript
import '@/styles/geocode-ui.css';
```

Ou dans un composant Vue:
```vue
<style src="@/styles/geocode-ui.css"></style>
```

## 🔌 Intégration dans main.ts

### Option 1: Avec Vue Router

```typescript
import { createRouter, createWebHistory } from 'vue-router';
import GeocodeSuggestionsPanel from '@/components/GeocodeSuggestionsPanel.vue';
import UnifiedSurveysPanel from '@/components/UnifiedSurveysPanel.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/geocode/suggestions',
      name: 'GeocodeSuggestions',
      component: GeocodeSuggestionsPanel,
    },
    {
      path: '/surveys/unified',
      name: 'UnifiedSurveys',
      component: UnifiedSurveysPanel,
    },
  ],
});
```

### Option 2: Tabs/Panels

```vue
<template>
  <div class="app">
    <nav class="tabs">
      <button @click="activeTab = 'suggestions'" :class="{ active: activeTab === 'suggestions' }">
        🎯 Suggestions
      </button>
      <button @click="activeTab = 'unified'" :class="{ active: activeTab === 'unified' }">
        📍 Localités
      </button>
    </nav>

    <div class="tab-content">
      <GeocodeSuggestionsPanel v-if="activeTab === 'suggestions'" />
      <UnifiedSurveysPanel v-if="activeTab === 'unified'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import GeocodeSuggestionsPanel from '@/components/GeocodeSuggestionsPanel.vue';
import UnifiedSurveysPanel from '@/components/UnifiedSurveysPanel.vue';

const activeTab = ref('suggestions');
</script>
```

### Option 3: Vanilla JS

```typescript
import { createGeocodeSuggestionsUI, createUnifiedSurveysUI } from '@/geocode-ui';
import '@/styles/geocode-ui.css';

// Dans main.ts
document.addEventListener('DOMContentLoaded', () => {
  const suggestionsContainer = document.getElementById('geocode-suggestions');
  const unifiedContainer = document.getElementById('unified-surveys');

  if (suggestionsContainer) {
    createGeocodeSuggestionsUI(suggestionsContainer);
  }

  if (unifiedContainer) {
    createUnifiedSurveysUI(unifiedContainer);
  }
});
```

## 🔗 Endpoints API Utilisés

### Géocodage
- `GET /api/geocode/suggestions?status=pending&limit=100`
- `GET /api/geocode/stats`
- `POST /api/geocode/suggestions/:id/accept` (body: `{adm3_id}` ou `{lon, lat}`)
- `POST /api/geocode/suggestions/:id/reject`
- `POST /api/geocode/apply-accepted`

### Vue Unifiée
- `GET /api/surveys/unified?q=...&has_geometry=true&limit=100`
- `GET /api/surveys/unified/stats`
- `POST /api/surveys/unified/refresh`

### ADM3 (pour le dropdown)
- `GET /api/adm3`

## 📊 Types TypeScript

```typescript
interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  reason: 'missing_location' | 'missing_geometry';
  status: 'pending' | 'done' | 'rejected';
  payload: {
    code: string;
    source: string;
    adm3_id: string | null;
    adm3_name: string | null;
    localite_key: string;
    localite_base: string;
  };
  created_at: string;
  updated_at: string;
}

interface UnifiedSurvey {
  localite_key: string;
  localite: string;
  survey_ids: string[];
  survey_codes: string[];
  has_bleu: boolean;
  has_limite: boolean;
  has_granulo: boolean;
  has_vbs: boolean;
  variants: number;
  adm3_id: string | null;
  adm3_name: string | null;
  has_geometry: boolean;
  latest_date: string | null;
  atterberg_count: number;
  granulo_count: number;
  vbs_count: number;
  echantillons_count: number;
  total_essais: number;
}
```

## 🎯 Workflow Utilisateur

### Suggestions de Géocodage

1. **Voir les suggestions pending**
   - Filtre par statut/raison
   - Affiche code, localité, source, date

2. **Accepter une suggestion**
   - Clic sur "✅ Accepter"
   - Modal s'ouvre avec 2 options:
     - Par ADM3: sélectionner une commune
     - Par coordonnées: entrer lon/lat
   - Confirmer → sondage géocodé

3. **Rejeter une suggestion**
   - Clic sur "❌ Rejeter"
   - Confirmation
   - Suggestion marquée "rejected"

### Vue Unifiée

1. **Explorer les localités**
   - Recherche floue (sans accents)
   - Filtre par géométrie
   - Voir les stats globales

2. **Détails d'une localité**
   - Clic sur une card
   - Modal avec:
     - Liste des codes sondages
     - Compteurs par type d'essai
     - Total essais/échantillons

3. **Refresh la vue**
   - Clic sur "⚡ Refresh Vue"
   - Recalcule la vue matérialisée
   - Mise à jour des stats

## 🚀 Build & Deploy

```bash
# Development
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## 📝 Notes

- Les composants Vue utilisent `lodash-es` pour le debounce (recherche)
- Les styles sont scopés (pas de conflit CSS)
- Les API clients gèrent les erreurs HTTP
- Les modals utilisent `@click.self` pour fermer au clic extérieur
- La recherche floue utilise `atlas.norm_key()` côté backend

## 🐛 Troubleshooting

**Erreur "Cannot find module 'vue'":**
- Normal dans l'éditeur, ignorez
- Assurez-vous que Vue est installé: `npm install vue`

**Endpoints 404:**
- Vérifiez que l'API est démarrée: `docker-compose up -d api-geo`
- Vérifiez l'URL de base dans les API clients

**Styles ne s'appliquent pas:**
- Importez le CSS: `import '@/styles/geocode-ui.css'`
- Vérifiez les classes CSS dans le navigateur

**Suggestions vides:**
- Vérifiez qu'il y a des sondages `location_mode='unknown'`
- Vérifiez la table: `SELECT * FROM atlas.geocode_suggestions WHERE status='pending'`
