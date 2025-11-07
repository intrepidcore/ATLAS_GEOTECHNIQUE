# Migration UI vers Granularité Sondage

**Date**: 2025-11-06  
**Branche**: `feat/sondages-api-ui`  
**Objectif**: Basculer l'UI du géocodage de la granularité "localité agrégée" vers "sondage individuel"

---

## 🎯 Résumé des Changements

### 1. API Backend (Rust)

**Nouveau module**: `services/api-geo/src/sondages.rs`

Endpoints créés:
- `GET /sondages` - Liste paginée avec filtres (search, missing)
- `GET /sondages/stats` - Statistiques globales
- `GET /sondages/:id` - Détails d'un sondage
- `PATCH /sondages/:id/geometry` - Mise à jour géométrie (mode: adm | exact)
- `GET /sondages/:id/adm3-candidates` - Suggestions ADM3 par similarité

**Caractéristiques**:
- Pagination (limit, offset)
- Filtres: `missing=geom|adm3`, `search=<terme>`
- Retourne 230 sondages individuels (pas 1 localité)
- Flag `is_geocoded` calculé automatiquement

### 2. Client TypeScript

**Nouveau fichier**: `ui/src/api/sondages.ts`

Fonctions exportées:
```typescript
listSondages(query?: SondageQuery): Promise<Sondage[]>
getSondagesStats(): Promise<SondagesStats>
getSondage(id: string): Promise<Sondage>
updateSondageGeometry(id: string, payload: UpdateGeometryPayload): Promise<Sondage>
getAdm3Candidates(id: string): Promise<Adm3CandidatesResponse>
extractLocaliteFromCode(code: string): string | null
```

**Helper ajouté**: `apiPatch()` dans `surveys-canon.ts`

### 3. UI Modifiée

#### Modal Sondages (`sondages-modal.ts`)

**Avant**:
- Affichait 1 localité agrégée
- Badge "X sondages"
- API `/surveys-canon`

**Après**:
- Affiche 230 sondages individuels
- Pas de badge agrégé
- API `/sondages`
- Label "Géocodé : Oui/Non" préservé
- Titre JSON: "Objet sondage" (au lieu de "canonique")
- Toast non-bloquant au lieu d'`alert()`

#### Panneau Géocodage (`geocode-canon-panel.ts`)

**Avant**:
- Titre "Villages sans géométrie"
- API `/surveys-canon`
- `alert()` bloquant

**Après**:
- Titre "Sondages sans géométrie"
- API `/sondages`
- Toast non-bloquant
- Clic sur suggestion pré-sélectionne le select ADM3
- Rafraîchissement immédiat des stats après PATCH

#### Panneau Suggestions (`suggestions-canon-panel.ts`)

**Avant**:
- KPI "Total villages"
- Pilule "unknown" dans la liste
- API `/surveys-canon`

**Après**:
- KPI "Total sondages"
- Pas de pilule "unknown" dans la liste (conservée dans fiche détail)
- API `/sondages`

---

## 📊 Statistiques

### Avant (Agrégé)
```json
{
  "total": 1,
  "geocoded": 0,
  "with_geom": 0,
  "with_adm3": 0
}
```

### Après (Individuel)
```json
{
  "total": 230,
  "geocoded": 1,
  "with_geom": 1,
  "with_adm3": 0,
  "missing_geom": 229,
  "missing_adm3": 230
}
```

---

## 🔄 Flux de Géocodage

### Mode ADM3

1. Utilisateur sélectionne un sondage
2. API charge suggestions: `GET /sondages/:id/adm3-candidates`
3. Utilisateur clique sur une suggestion → select pré-rempli
4. Clic "Enregistrer" → `PATCH /sondages/:id/geometry` avec `{mode: "adm", adm3_id: <gid>}`
5. Toast de succès
6. Rafraîchissement automatique des stats et de la liste

### Mode Exact

1. Utilisateur saisit lat/lon
2. Validation (Togo: lat ∈ [5,12], lon ∈ [-1.2, 1.8])
3. `PATCH /sondages/:id/geometry` avec `{mode: "exact", geom: {type: "Point", coordinates: [lon, lat]}}`
4. Toast de succès
5. Rafraîchissement automatique

---

## ✅ Checklist de Conformité

- [x] Tous les panneaux utilisent `/sondages` (pas `/surveys-canon`)
- [x] KPI "Total sondages" (pas "villages")
- [x] Label "Géocodé : Oui/Non" préservé
- [x] Pas de badge "X sondages" dans la liste
- [x] Pas de pilule "unknown" dans la liste
- [x] Toast non-bloquant (pas d'`alert()`)
- [x] Clic suggestion → pré-sélection ADM3
- [x] Rafraîchissement stats après PATCH
- [x] Titre JSON: "Objet sondage"
- [x] Logs console: "[SONDAGES]"

---

## 🧪 Tests Manuels

### 1. Modal Liste
```
✓ Affiche 230 lignes (pas 1)
✓ Chaque ligne: Code + Village + "Géocodé : Oui/Non"
✓ Pas de badge "X sondages"
✓ Clic → fiche détail avec JSON sondage
```

### 2. Panneau Géocodage
```
✓ Titre "Sondages sans géométrie"
✓ Badge "229" (pas 1)
✓ Sélection sondage → suggestions ADM3
✓ Clic suggestion → select pré-rempli
✓ Enregistrer → toast + refresh stats
✓ Badge décrémente immédiatement
```

### 3. Panneau Suggestions
```
✓ KPI "Total sondages: 230"
✓ Pas de pilule "unknown" dans liste
✓ Filtres fonctionnels
```

---

## 🚀 Déploiement

```bash
# Build API
docker compose build api-geo

# Build UI
cd ui && npm run build

# Redémarrer services
docker compose up -d api-geo ui
```

---

## 📝 Notes Techniques

### Base de Données

La colonne `is_geocoded` est une **generated column**:
```sql
is_geocoded BOOLEAN GENERATED ALWAYS AS (
  geom IS NOT NULL OR adm3_id IS NOT NULL
) STORED
```

Pas besoin de la mettre à jour manuellement, elle se calcule automatiquement.

### API Binding

Les paramètres SQL sont toujours bindés dans l'ordre:
1. `$1` = search (ou "" si absent)
2. `$2` = limit
3. `$3` = offset

### Toast System

Utilise `ui/src/ui/toast.ts`:
```typescript
toast.success("Message")
toast.error("Message")
toast.info("Message")
```

---

## 🔮 Prochaines Étapes (Optionnel)

1. **Toggle "Grouper par localité"**
   - Par défaut: vue sondages (actuel)
   - Si activé: basculer sur `/surveys-canon` (vue agrégée)

2. **Batch Geocoding**
   - Sélection multiple de sondages
   - Application ADM3 en masse

3. **Historique des modifications**
   - Tracker qui a géocodé quoi et quand
   - Audit trail

---

## 📚 Références

- Audit complet: `docs/AUDIT_SYNTHESE.md`
- Requêtes SQL: `docs/REQUETES_SQL_UTILES.md`
- ERD: `docs/SCHEMA_ERD.md`
- Migrations: `migrations/fix_is_geocoded_sondages.sql`
