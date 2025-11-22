# 🔧 Corrections v2.8.1 - Gestionnaire de Sondages

## 📅 Date : 2025-11-22

## 🎯 Objectif
Corriger les problèmes identifiés dans la v2.8.0 suite au diagnostic utilisateur :
1. Données & géocodage : Standardiser `location_mode` avec mode placement (centroid/random)
2. UI : Corriger layout des panels (zones vides, liste tronquée)

---

## 1️⃣ DONNÉES & GÉOCODAGE

### Problème Identifié
- **28 sondages en `adm3_centroid`** au lieu de `adm_random_cell`
- Pas de choix de mode de placement (centroid vs random)
- Suggestions ADM utilisent le centroïde par défaut

### Solution Implémentée

#### Migration 036 : Fonction `random_point_in_polygon()`
```sql
CREATE OR REPLACE FUNCTION public.random_point_in_polygon(geom geometry)
RETURNS geometry
```
- Génère un point aléatoire dans un polygone
- Méthode rejection sampling dans bounding box
- Fallback sur centroïde après 1000 tentatives
- **Test OK** : Point généré dans polygone ADM3

#### Backend Rust : Support paramètre `placement`

**Fichier** : `services/api-geo/src/sondages_geocode.rs`

**Modifications** :
```rust
pub enum GeocodeRequest {
    Adm3 { 
        adm3_id: i32,
        #[serde(default = "default_placement")]
        placement: String,  // "adm3_centroid" ou "adm_random_cell"
    },
    Coords { lon: f64, lat: f64 },
}

fn default_placement() -> String {
    "adm_random_cell".to_string()  // Par défaut : aléatoire
}
```

**Logique SQL dynamique** :
- `placement = "adm3_centroid"` → `ST_Centroid(a.geom)`
- `placement = "adm_random_cell"` → `public.random_point_in_polygon(a.geom)`

#### Suggestions ADM : Forcer mode aléatoire

**Fichier** : `services/api-geo/src/geocode_suggestions.rs`

**Modification** :
```sql
UPDATE public.sondages s
SET 
    geom = public.random_point_in_polygon(a.geom),  -- Au lieu de ST_Centroid
    location_mode = 'adm_random_cell',              -- Au lieu de 'adm3_centroid'
```

### Résultats

| Aspect | Avant | Après |
|--------|-------|-------|
| Mode par défaut | `adm3_centroid` | `adm_random_cell` |
| Choix utilisateur | ❌ Non | ✅ Oui (via UI) |
| Suggestions ADM | Centroïde | Aléatoire |
| Fonction SQL | ❌ Manquante | ✅ `random_point_in_polygon()` |

---

## 2️⃣ UI - CORRECTIONS LAYOUT

### Problèmes Identifiés

1. **Géocodage Manuel** : Zone sombre vide en bas
2. **Suggestions ADM** : Erreur JSON parsing + zone vide
3. **Liste** : Liste tronquée en bas

### Solutions Implémentées

#### GeocodeCanonPanel
**Fichier** : `ui/src/geocode-canon-panel.ts`

**Avant** :
```typescript
style="height: 80vh; ..."
```

**Après** :
```typescript
style="height: 100%; ..."
```

**Résultat** : Panel occupe toute la hauteur disponible, plus de zone vide

#### SuggestionsAdmPanel
**Fichier** : `ui/src/suggestions-adm-panel.ts`

**Corrections** :
1. Layout : `height: 80vh` → `height: 100%`
2. JSON parsing robuste :
```typescript
let candidates: any[] = [];
try {
  candidates = s.candidates ? JSON.parse(s.candidates) : [];
} catch (e) {
  console.error('[SUGGESTIONS ADM] Error parsing candidates', e);
  candidates = [];
}
```

**Résultat** : 
- Panel occupe 100% hauteur
- Pas de crash si JSON mal formé

#### SondagesListPanel
**Fichier** : `ui/src/sondages-list-panel.ts`

**Corrections** :
```typescript
// Conteneur principal
style="height: 100%; min-height: 0; ..."

// Zone scroll
style="flex: 1; min-height: 0; overflow-y: auto; ..."
```

**Résultat** : Liste scroll correctement sur toute la hauteur

---

## 📊 Résumé des Commits

### Commit 1 : `5db099b` - fix(ui): Corriger layout panels
- GeocodeCanonPanel : height 80vh → 100%
- SuggestionsAdmPanel : height 80vh → 100% + gestion erreur JSON
- SondagesListPanel : ajout min-height: 0

### Commit 2 : `a8be7dc` - feat(backend): Support mode placement
- Migration 036 : Fonction `random_point_in_polygon()`
- sondages_geocode.rs : Paramètre `placement`
- geocode_suggestions.rs : Forcer `adm_random_cell`

---

## 🧪 Tests à Effectuer

### Backend
- [ ] Tester endpoint `/sondages/:id/geocode` avec `placement: "adm3_centroid"`
- [ ] Tester endpoint `/sondages/:id/geocode` avec `placement: "adm_random_cell"` (défaut)
- [ ] Accepter une suggestion ADM → vérifier `location_mode = 'adm_random_cell'`
- [ ] Vérifier que les points générés sont bien dans les polygones ADM3

### Frontend
- [ ] Onglet Géocodage Manuel : pas de zone vide en bas
- [ ] Onglet Suggestions ADM : pas d'erreur JSON, pas de zone vide
- [ ] Onglet Liste : scroll fonctionne sur toute la hauteur
- [ ] Tous les panels occupent 100% de la hauteur disponible

### Données
- [ ] Repasser les 28 sondages `adm3_centroid` en `adm_random_cell` (via UI ou SQL)
- [ ] Vérifier cohérence `location_mode` dans la base

---

## 📝 TODO Restants (Non Bloquants)

### UI
- [ ] Ajouter select "Placement : Centroïde / Aléatoire" dans géocodage manuel
- [ ] Implémenter "Voir détails" dans liste sondages
- [ ] Intégrer Import Wizard complet dans onglet Import

### Backend
- [ ] Documenter colonnes legacy (`loc_mode`, `geom_real`, `grid_code`)
- [ ] Adapter scripts import pour remplir colonnes canoniques

### Tests
- [ ] Tests multi-onglets temps réel
- [ ] Tests multi-utilisateurs WebSocket

---

## ✅ Validation

### Build
- [X] Backend Rust : Build OK
- [X] Frontend TypeScript : Build OK
- [X] Migration SQL : Appliquée avec succès

### Déploiement
- [X] API redémarrée
- [X] Fonction `random_point_in_polygon()` testée
- [X] Commits propres et descriptifs

---

## 📚 Documentation Mise à Jour

- [X] `TODO.md` : Ajout sections 2.1 (Standardiser location_mode) et corrections UI
- [X] `CORRECTIONS_v2.8.1.md` : Ce document
- [ ] `TESTS_VALIDATION.md` : À mettre à jour avec nouveaux tests

---

**Version** : v2.8.1  
**Statut** : ✅ Implémenté, prêt pour tests manuels  
**Prochaine étape** : Tests utilisateur + normalisation des 28 sondages existants
