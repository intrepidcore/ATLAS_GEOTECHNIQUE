# 📊 AUDIT DONNÉES & GÉOCODAGE - SYNTHÈSE EXÉCUTIVE

**Date:** 2025-11-06  
**Status:** ✅ Migrations DB appliquées, API/UI à implémenter

---

## 🎯 OBJECTIF

Passer d'un géocodage **par localité agrégée** (40 items) à un géocodage **par sondage individuel** (230 items).

---

## 📈 ÉTAT ACTUEL (Après Migrations DB)

### Base de Données

| Métrique | Valeur | Note |
|----------|--------|------|
| **Sondages totaux** | 230 | ✅ Table `sondages` |
| **Localités uniques** | 140 | ✅ Table `atlas.surveys` |
| **Sondages géocodés** | 1 (0.4%) | ⚠️ 229 à géocoder |
| **Sondages avec localite** | 230 (100%) | ✅ Backfill appliqué |
| **Sondages avec ADM3** | 0 (0%) | ⚠️ Aucun lien ADM3 |
| **Mode unknown** | 229 (99.6%) | ⚠️ À géocoder |

### Migrations Appliquées

✅ **Migration 1:** Backfill `localite` depuis `code`  
- 176 sondages mis à jour
- 100% des sondages ont maintenant une localite

✅ **Migration 2:** Recalculer `is_geocoded` (colonne générée)  
- Logique: `geom IS NOT NULL OR adm3_id IS NOT NULL`
- 1 sondage géocodé, 229 non géocodés

✅ **Migration 3:** Recréer vues avec `has_geom` et `has_adm3`  
- `atlas.v_sondages_unifies` recréée
- `atlas.mv_sondages_unifies` recréée et refreshed
- `atlas.surveys` refreshed (140 localités)

---

## 🚨 PROBLÈMES IDENTIFIÉS

### 1. UI affiche localités agrégées (40) au lieu de sondages (230)

**Fichier:** `ui/src/modal/sondages-modal.ts:365`

```typescript
// ACTUEL (MAUVAIS)
const r = await fetch(`${this.apiUrl}/surveys-canon?limit=100`)
// Retourne 140 localités agrégées

// ATTENDU
const r = await fetch(`${this.apiUrl}/sondages?limit=100`)
// Devrait retourner 230 sondages individuels
```

**Impact:** User voit "Ountivou (2 sondages)" au lieu de 2 lignes distinctes.

### 2. Badge "2 sondages" incorrect

**Cause:** `nb_sondages_source` affiché pour localités agrégées.

**Solution:** Supprimer badge pour sondages individuels.

### 3. Sous-titre "LIMITE-OUNTIVOU" au lieu du code sondage

**Cause:** Affiche `s.code` (code canonique = premier code de la localité).

**Solution:** Afficher le code du sondage individuel.

### 4. Géocodage appliqué à la localité, pas au sondage

**Problème:** `PATCH /surveys-canon/:id/geometry` géocode tous les sondages de la localité.

**Solution:** `PATCH /sondages/:id/geometry` géocode 1 sondage.

---

## ✅ SOLUTION: ENDPOINTS `/sondages`

### API Rust (À implémenter)

**Fichier:** `services/api-geo/src/sondages.rs` (nouveau)

**Endpoints:**
- `GET /sondages` - Liste sondages avec filtres
- `GET /sondages/stats` - KPI au niveau sondage
- `GET /sondages/:id` - Détails sondage
- `PATCH /sondages/:id/geometry` - Géocoder 1 sondage
- `GET /sondages/:id/adm3-candidates` - Suggestions ADM3

**Différence avec `/surveys-canon`:**
- `/surveys-canon` → 140 localités agrégées
- `/sondages` → 230 sondages individuels

### Client TypeScript (À implémenter)

**Fichier:** `ui/src/api/sondages.ts` (nouveau)

```typescript
export interface Sondage {
  id: string;
  code: string;  // "GRANULO-KOMAH"
  localite: string;  // "KOMAH"
  adm3_id: string | null;
  adm3_name: string | null;
  is_geocoded: boolean;
  location_mode: string;
  // ...
}

export async function listSondages(params: {
  limit?: number;
  search?: string;
  missing?: 'geom' | 'adm3';
}): Promise<Sondage[]>
```

### UI (À modifier)

**Fichiers:**
1. `ui/src/modal/sondages-modal.ts`
   - Remplacer `/surveys-canon` par `/sondages`
   - Supprimer badge "X sondages"
   - Afficher 230 items

2. `ui/src/geocode-canon-panel.ts`
   - Badge: "229 sondages sans géométrie"
   - Appeler `/sondages/:id/geometry`

3. `ui/src/suggestions-canon-panel.ts`
   - Idem

---

## 📋 PLAN D'IMPLÉMENTATION

### Phase 1: API Rust (2h)

1. Créer `services/api-geo/src/sondages.rs`
2. Copier/adapter depuis `surveys_canon.rs`
3. Ajouter routes dans `main.rs`
4. Build & test

```bash
docker-compose build api-geo
docker-compose up -d api-geo
curl http://localhost:8000/sondages/stats | jq
```

### Phase 2: Client TypeScript (1h)

1. Créer `ui/src/api/sondages.ts`
2. Définir types `Sondage`, `SondagesStats`
3. Implémenter fonctions API

```bash
cd ui && npm run build
```

### Phase 3: UI (1h)

1. Modifier `sondages-modal.ts`
   - Import `listSondages` au lieu de `listSurveysCanon`
   - Supprimer badge
   - Afficher code sondage

2. Modifier `geocode-canon-panel.ts`
   - Stats: "229 sondages" au lieu de "39 villages"
   - Géocoder sondage individuel

3. Modifier `suggestions-canon-panel.ts`
   - Idem

### Phase 4: Test (30min)

1. Ctrl+F5 (purge cache)
2. Ouvrir "Liste des Sondages"
3. Vérifier: 230 items affichés
4. Vérifier: Pas de badge "2 sondages"
5. Ouvrir "Géocodage Amélioré"
6. Badge: "229 sondages sans géométrie"
7. Géocoder 1 sondage
8. Vérifier: Badge passe à 228

---

## 🎁 BONUS: Toggle "Grouper par localité"

**Optionnel:** Ajouter un switch dans l'UI pour basculer entre:
- **Vue Sondages** (230 items) - Par défaut
- **Vue Localités** (140 items) - Avec badge "X sondages"

```typescript
<label>
  <input type="checkbox" id="group-by-locality" />
  Grouper par localité
</label>
```

**Logique:**
```typescript
if (groupByLocality) {
  const surveys = await listSurveysCanon({ limit: 100 })
  // Afficher 140 localités avec badge
} else {
  const sondages = await listSondages({ limit: 100 })
  // Afficher 230 sondages sans badge
}
```

---

## 📊 KPI ATTENDUS (Après Implémentation)

| Métrique | Avant | Après |
|----------|-------|-------|
| Items affichés | 40 localités | 230 sondages |
| Badge "X sondages" | Oui | Non |
| Code affiché | LIMITE-OUNTIVOU (canonique) | GRANULO-KOMAH (sondage) |
| Géocodage | Toute la localité | 1 sondage |
| Stats panel | "39 villages sans géométrie" | "229 sondages sans géométrie" |

---

## 📁 FICHIERS CRÉÉS

### Documentation
- `docs/AUDIT_DONNEES_PART1.md` - Schéma & dictionnaire
- `docs/AUDIT_DONNEES_PART2.md` - Incohérences & recommandations
- `docs/AUDIT_DONNEES_PART3.md` - Checklist & migrations
- `docs/AUDIT_SYNTHESE.md` - Ce fichier

### Migrations SQL (✅ Appliquées)
- `migrations/backfill_localite.sql` - 176 sondages mis à jour
- `migrations/fix_is_geocoded_sondages.sql` - Colonne générée
- `migrations/recreate_views_with_flags.sql` - Vues avec has_geom/has_adm3

---

## 🚀 PROCHAINES ÉTAPES

1. **Implémenter API `/sondages`** (Rust)
2. **Créer client TypeScript** `api/sondages.ts`
3. **Modifier UI** pour utiliser `/sondages`
4. **Tester** workflow complet
5. **Optionnel:** Toggle "Grouper par localité"

**Temps estimé total:** 4h

---

## 📞 SUPPORT

Pour toute question sur l'audit:
- Voir `docs/AUDIT_DONNEES_PART*.md` pour détails
- Migrations SQL prêtes à l'emploi dans `migrations/`
- Exemples de code Rust/TypeScript dans PART2 et PART3

**Status:** ✅ DB prête, API/UI à implémenter
