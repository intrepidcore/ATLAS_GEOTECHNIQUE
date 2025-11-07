# 📋 Documentation - Unification Géocodage UI

## 🎯 Objectif

Aligner toute l'UI (Géocodage Amélioré, Suggestions, Liste des Sondages) sur la **source canonique** exposée par l'API `api-geo`.

## 🏗️ Architecture

### Source de vérité unique

**Endpoint principal:** `/surveys-canon`

**Paramètres:**
- `search` - Recherche accent-insensitive (utilise `atlas.norm()`)
- `limit` - Limite de résultats (max 500)
- `offset` - Pagination
- `missing` - Filtre: `geom` | `adm3`

**Endpoints disponibles:**
```
GET  /surveys-canon              → Liste des surveys canoniques
GET  /surveys-canon/stats        → Statistiques globales
GET  /surveys-canon/resolve      → Résoudre un alias vers le canon
GET  /surveys-canon/:id          → Détails d'un survey
```

### Structure des données

```typescript
interface SurveyCanon {
  id: string;
  code: string;                    // Ex: "BLEU-BASSAR-KPANKISSI"
  localite_canon: string;          // Ex: "bassar-kpankissi" (normalisé)
  localite: string | null;         // Ex: "Bassar-Kpankissi" (humain)
  adm3_id: string | null;
  adm3_name: string | null;        // Ex: "Bassar"
  geom: any | null;                // GeoJSON Point
  location_mode: string | null;   // "unknown" | "exact" | "adm"
  is_geocoded: boolean;
  date: string | null;
  nb_sondages_source: number;      // Nombre de sondages agrégés
  created_at: string;
  updated_at: string;
}

interface SurveyCanonStats {
  total: number;                   // Total villages
  geocoded: number;                // Villages géocodés
  with_geom: number;               // Villages avec géométrie
  with_adm3: number;               // Villages avec ADM3
}
```

## 📁 Fichiers modifiés

### ✅ Nouveaux fichiers créés

1. **`ui/src/api/surveys-canon.ts`**
   - Client API unifié
   - Types TypeScript stricts
   - Fonctions: `listSurveysCanon()`, `getSurveyCanonStats()`, `resolveSurveyAlias()`, `getSurveyCanon()`

2. **`ui/src/geocode-canon-panel.ts`**
   - Panneau "Géocodage Amélioré"
   - Affiche les villages sans géométrie (39)
   - Utilise `/surveys-canon?missing=geom`

3. **`ui/src/suggestions-canon-panel.ts`**
   - Panneau "Suggestions de Géocodage"
   - KPIs: Géocodés, Sans géométrie, Sans ADM3, Total
   - Filtres dynamiques

### ✏️ Fichiers modifiés

1. **`ui/src/modal/sondages-modal.ts`**
   - Imports: `SuggestionsCanonPanel`, `GeocodeCanonPanel`
   - `ensureGeocodeLoaded()` → async, utilise `GeocodeCanonPanel`
   - `ensureSuggestionsLoaded()` → async, utilise `SuggestionsCanonPanel`
   - `loadSurveysList()` → appelle `/surveys-canon`
   - `openSurveyDetails()` → appelle `/surveys-canon/:id`

## 🎨 Règles d'affichage

### Titre d'item (principal)
```typescript
const title = survey.localite || survey.localite_canon || survey.code;
// Ex: "Bassar-Kpankissi"
```

### Sous-titre (gris neutre)
```typescript
const subtitle = [
  survey.code,
  survey.adm3_name ? `Commune: ${survey.adm3_name}` : 'Commune: —'
].join(' • ');
// Ex: "BLEU-BASSAR-KPANKISSI • Commune: Bassar"
```

### Style sous-titre
```css
font-size: 13px;
color: #8b9bb3;  /* Gris neutre, PAS bleu */
```

## 📊 Panneaux UI

### 1. Géocodage Amélioré

**Onglet:** "Géocodage Amélioré"

**Source:** `GET /surveys-canon?missing=geom`

**Affichage:**
- Badge: **39** villages sans géométrie
- Liste: Noms de villages (ex: "Bohou", "Wli")
- Sous-titre: Code + Commune (gris)
- Bouton: "Enregistrer le géocodage"

**Stats:**
```typescript
const missingGeom = stats.total - stats.with_geom; // 40 - 1 = 39
```

### 2. Suggestions de Géocodage

**Onglet:** "Suggestions ADM"

**Source:** `GET /surveys-canon` avec filtres

**KPIs:**
- ✅ Géocodés: `stats.geocoded`
- ❌ Sans géométrie: `stats.total - stats.with_geom`
- ⚠️ Sans ADM3: `stats.total - stats.with_adm3`
- 📊 Total: `stats.total`

**Filtres:**
- Sans géométrie → `?missing=geom`
- Sans ADM3 → `?missing=adm3`
- Tous → pas de filtre

### 3. Liste des Sondages

**Onglet:** "Liste des Sondages"

**Source:** `GET /surveys-canon?limit=100`

**Affichage:**
- Titre: `localite` (village)
- Sous-titre: `code • Commune: adm3_name`
- Badge: `nb_sondages_source` si > 1
- Status: ✅/❌ + `location_mode`

**Détails (panneau droit):**
- Village, Code, Commune
- Mode géocodage, Géocodé, Géométrie
- Sondages source, Dates
- JSON brut de l'objet canonique

## 🔍 Recherche

**Normalisation côté API:**
```sql
atlas.norm(code) LIKE '%' || atlas.norm($search) || '%'
```

**Caractéristiques:**
- Insensible aux accents (Adjengré = Adjengre)
- Insensible aux espaces multiples
- Insensible à la casse

**Debounce UI:** 300ms (à implémenter si nécessaire)

## ✅ Tests de validation

### Après `npm run build`:

1. **Géocodage Amélioré**
   - ✅ Badge: **39** (pas 229)
   - ✅ Liste: Noms de villages (pas GRANULO-)
   - ✅ Sous-titre gris (pas bleu)

2. **Suggestions**
   - ✅ KPIs corrects (40 total, 39 sans géométrie)
   - ✅ Filtres fonctionnels
   - ✅ Noms de villages affichés

3. **Liste des Sondages**
   - ✅ Recherche "kamina" → "Kamina-Barrage"
   - ✅ Détails: objet canonique
   - ✅ Sous-titre gris neutre

4. **Network (DevTools)**
   - ✅ Aucune requête vers `/geocode/suggestions`
   - ✅ Aucune requête vers `/surveys` (ancien)
   - ✅ Toutes les requêtes vers `/surveys-canon`

## 🚧 TODO API (endpoints d'écriture)

### Endpoints manquants pour géocodage complet:

```rust
// Mettre à jour la géométrie d'un survey
PATCH /surveys-canon/:id/geometry
Body: {
  "mode": "exact" | "adm",
  "geom"?: { "type": "Point", "coordinates": [lon, lat] },
  "adm3_id"?: "uuid"
}
Response: SurveyCanon

// Mettre à jour ADM3
PATCH /surveys-canon/:id/adm3
Body: { "adm3_id": "uuid" }
Response: SurveyCanon
```

**Validation:**
- Si `mode=exact` → `geom` requis
- Si `mode=adm` → `adm3_id` requis
- Contraintes CHECK en DB déjà en place

**Après mise à jour:**
- Appeler `atlas.refresh_surveys()` pour rafraîchir la MV
- Ou trigger automatique sur `sondages` table

## 📝 Notes de migration

### Ancien code → Nouveau code

**Avant:**
```typescript
// Ancien endpoint
const response = await fetch('/geocode/suggestions');
const suggestions = await response.json();

// Ancien affichage
const title = suggestion.code; // "GRANULO-ZONGO-1"
```

**Après:**
```typescript
// Nouveau endpoint
import { listSurveysCanon } from './api/surveys-canon';
const surveys = await listSurveysCanon({ missing: 'geom' });

// Nouveau affichage
const title = survey.localite || survey.localite_canon; // "Zongo"
const subtitle = `${survey.code} • Commune: ${survey.adm3_name || '—'}`;
```

### Compteurs

**Avant:**
```typescript
// Comptait les sondages bruts (229)
const count = await fetch('/geocode/manual/stats');
```

**Après:**
```typescript
// Compte les villages unifiés (39)
const stats = await getSurveyCanonStats();
const missingGeom = stats.total - stats.with_geom; // 39
```

## 🔄 Refresh des données

**Côté DB:**
```sql
-- Rafraîchir la vue matérialisée
SELECT atlas.refresh_surveys();
```

**Côté UI:**
```typescript
// Recharger les stats et la liste
await panel.refresh();
panel.renderUI(containerId, onSuccess, onError);
```

## 🎯 Prochaines étapes

1. **Implémenter endpoints d'écriture** (PATCH geometry/adm3)
2. **Ajouter debounce** sur recherche (300ms)
3. **Pagination** si > 500 résultats
4. **Mini-carte** pour visualiser geom
5. **Bulk actions** (géocoder plusieurs villages)
6. **Export** CSV des villages non géocodés

## 📞 Support

**Problèmes courants:**

1. **Badge affiche encore 229**
   - Vider le cache navigateur (Ctrl+F5)
   - Vérifier Network: doit appeler `/surveys-canon`

2. **Sous-titre bleu au lieu de gris**
   - Vérifier le style: `color: #8b9bb3` (pas `#3aa6ff`)

3. **Anciens codes GRANULO-**
   - L'UI lit encore l'ancien endpoint
   - Vérifier les imports dans `sondages-modal.ts`

---

**Version:** 1.0.0  
**Date:** 2025-11-05  
**Auteur:** Atlas Géotechnique Team
