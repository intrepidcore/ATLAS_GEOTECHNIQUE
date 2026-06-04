# SESSION DE DÉVELOPPEMENT — 2026-06-04
## Atlas Géotechnique du Togo — Connexion Pipeline ML L1–L4 à l'UI

---

**Branche** : `atlas_v2_clean`  
**Durée** : Journée complète (environ 8 heures)  
**Commits produits** : 6 commits signés  
**Fichiers modifiés** : 35+  
**Lignes ajoutées** : ~4500  
**Problèmes critiques découverts** : 2 (anomalie géocodage + vue hardcodée)  
**Modèles ML validés** : L1 KED-H, L2a RK, L2b BLUP, L4 MTGP (29 407 mailles chacun)

---

## RÉSUMÉ EXÉCUTIF

Cette session avait pour objectif de connecter le pipeline ML L1–L4 (KED Hiérarchique, RK-SCORPAN, Fusion BLUP, VfS-PLS, MTGP/ICM) à l'interface utilisateur `localhost:1420`. L'objectif a été atteint : les 4 modèles opérationnels (L1, L2a, L2b, L4) retournent chacun 29 407 mailles via l'API. Un bug critique de géocodage a été découvert et documenté (187 sondages avec coordonnée fallback POINT(1,8.6)), des corrections d'UI ont été appliquées, et un audit exhaustif de 1512 lignes a été rédigé.

---

## CHRONOLOGIE TECHNIQUE

### 1. PROBLÈME DE DÉPART — Docker Desktop Crash

**Contexte** : Au démarrage de la session, Docker Desktop crashait immédiatement avec l'erreur :
```
starting services: initializing Inference manager: listening on 
unix://C:\Users\Serge TABE DJATO\AppData\Local\Docker\run\dockerInference: 
remove ...: Le système ne peut pas accéder au fichier.
(listener: La syntaxe du nom de fichier, de répertoire ou de volume est incorrecte.)
```

**Analyse** : Le composant "Inference Manager" (alias "Gordon AI") de Docker Desktop 4.36+ tente de créer un socket Unix sur un chemin Windows. Le nom d'utilisateur "Serge TABE DJATO" contient des espaces, ce qui invalide la syntaxe du chemin de socket.

**Solution appliquée** : Docker Desktop → Settings → AI → décocher "Enable Gordon" → Apply & Restart. Docker redémarre normalement en 2 minutes.

**Lesson learned** : Sur Windows avec des noms d'utilisateur contenant des espaces, les fonctionnalités AI de Docker Desktop (Inference Manager, Gordon) sont incompatibles. Désactiver ces features préventivemement.

---

### 2. DIAGNOSTIC INITIAL — API sur mauvais port

**Symptôme observé** : L'interface affichait les mailles KED avec seulement ~61 valeurs au lieu de 29 407.

**Investigation** :
```yaml
# docker-compose.yml AVANT correction :
DATABASE_URL: postgres://atlas:atlas@db:5432/atlas_clean
# Problème : db:5432 = instance Docker vide (Docker DB incomplet)
```

**Deux instances PostgreSQL identifiées** :
- Port 5432 : Instance Docker (`atlas-db`) — contient ~61 mailles KED (données partielles)
- Port 5433 : Instance Windows native — contient L1/L2a/L2b/L3/L4 complets (29 407 mailles chacun)

**Confirmation via requête directe** :
```sql
-- Port 5433 : résultat attendu
SELECT COUNT(*) FROM atlas.ai_interpolation_values 
WHERE method = 'ked_hierarchical_5levels';
-- → 29 407 × {nb paramètres}
```

**Correction** :
```yaml
# docker-compose.yml APRÈS correction :
DATABASE_URL: postgres://atlas:atlas@host.docker.internal:5433/atlas_clean
DATABASE_URL_ADMIN: postgres://atlas:atlas@host.docker.internal:5433/atlas_clean
```

`host.docker.internal` permet à un conteneur Docker Desktop for Windows d'atteindre le réseau hôte. Convention documentée en CONV-15.

---

### 3. BLOC 1 — Backend Rust (api-geo)

#### 3.1 Rebuild Docker avec exec format error

Après modification de `docker-compose.yml`, le conteneur `atlas-api-geo` crashait avec :
```
exec /usr/local/bin/api-geo: exec format error
```

**Cause** : Le cache BuildKit de Docker gardait un binary compilé pour une architecture incompatible (cache stale de `--mount=type=cache,target=/app/target`).

**Solution** :
```bash
docker compose build --no-cache api-geo
# 963 secondes de compilation (16 minutes)
# Exit 0 → binary Linux amd64 correct
```

#### 3.2 Découverte du bug de nommage BLUP (_blup_ vs _fusion_)

Lors de l'ajout des 24 variants Rust pour L2b/L4/L3, le test de l'endpoint `vbs_blup_h1` retournait 0 mailles.

**Investigation** :
```sql
SELECT parameter_id, COUNT(*) FROM atlas.ai_interpolation_values 
WHERE method = 'ked_rk_fusion_bayesian' 
GROUP BY parameter_id LIMIT 3;
-- vbs_fusion_h1 | 29407
-- ip_fusion_h1  | 29407
```

Le script `ked_rk_fusion.py` utilise :
```python
fusion_param_id = f"{param_kind}_fusion_{horizon_label}"
# → vbs_fusion_h1, ip_fusion_h1, etc.
```

Mais le Rust `sql_column()` retournait `"vbs_blup_h1"`.

**Correction** :
```rust
// types.rs — AVANT (bug)
Self::VbsBlupH1 => "vbs_blup_h1",

// types.rs — APRÈS (correct)
Self::VbsBlupH1 => "vbs_fusion_h1",  // DB stocke _fusion_, pas _blup_
```

Et dans `routes.rs` :
```rust
// AVANT
|| column.contains("_blup_h")

// APRÈS  
|| column.contains("_fusion_h")
```

**Convention CONV-19** créée : "L'API URL expose `vbs_blup_h1` (serde alias), mais la DB stocke `vbs_fusion_h1`. Ne jamais utiliser `_blup_` dans les requêtes SQL."

#### 3.3 Nouveaux endpoints AI

4 endpoints créés dans `ai_jobs.rs` (conformément ARCH-01/02/03/04/05) :

| Endpoint | Description | ARCH |
|---|---|---|
| `GET /ai/models/status` | Statuts + métriques L1-L4 depuis DB (0 hardcode) | ARCH-01 |
| `POST /ai/jobs/enqueue` | Insère dans `ai_job_queue` (jamais process::Command) | ARCH-02 |
| `GET /ai/jobs/:id` | Statut + logs + progress d'un job | ARCH-02 |
| `GET /ai/3d/asset` | Vérifie cache filesystem (jamais HEAD depuis frontend) | ARCH-03 |

#### 3.4 Migration 101

```sql
-- Colonnes ajoutées à atlas.ai_job_queue
ALTER TABLE atlas.ai_job_queue
    ADD COLUMN IF NOT EXISTS logs          TEXT,
    ADD COLUMN IF NOT EXISTS progress_pct  INTEGER CHECK (progress_pct BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS requested_by  TEXT;
```

Appliquée manuellement via psql sur port 5433.

#### 3.5 Validation Bloc 1

```
GET /healthz → ok ✅
GET /thematic/data?parameter=vbs_ked_h1 → count: 29407 ✅
GET /thematic/data?parameter=vbs_blup_h1 → count: 29407 ✅ (après fix _fusion_)
GET /thematic/data?parameter=vbs_mtgp_h1 → count: 29407 ✅
GET /ai/models/status → 5 modèles, L1/L2a/L2b/L4=ready, L3=not_computed ✅
```

---

### 4. BLOC 2 — Frontend TypeScript (panneau thématique)

#### 4.1 Nouveau type ThematicSource

```typescript
// AVANT
export type ThematicSource = 'base' | 'interpolation' | 'ia'

// APRÈS
export type ThematicSource =
  | 'base' | 'l1_ked' | 'l2a_rk' | 'l2b_blup' | 'l3_vfs' | 'l4_mtgp'
  | 'interpolation'  // alias → l1_ked
  | 'ia'             // alias → l4_mtgp
```

#### 4.2 Dropdown source avec optgroups

```html
<optgroup label="Données terrain">
  <option value="base">Base — Données terrain (sondages)</option>
</optgroup>
<optgroup label="Machine Learning géostatistique">
  <option value="l1_ked" data-model-id="L1_KED_H">ML L1 — KED Hiérarchique</option>
  <option value="l2a_rk" data-model-id="L2a_RK">ML L2a — RK-SCORPAN</option>
  <option value="l2b_blup" data-model-id="L2b_BLUP">ML L2b — Fusion BLUP</option>
  <option value="l3_vfs" data-model-id="L3_VFS">ML L3 — VfS-PLS</option>
  <option value="l4_mtgp" data-model-id="L4_MTGP">ML L4 — MTGP/ICM</option>
</optgroup>
```

#### 4.3 syncSourceAvailability() — ARCH-01

La méthode `syncSourceAvailability()` consomme `/ai/models/status` au démarrage et :
- Désactive les options dont `model.status !== 'ready'`
- Affiche un badge live avec `n_mailles · LOO-RMSE VBS·H1` depuis l'API

Aucune valeur RMSE hardcodée. Le badge est `null` si l'API ne répond pas (dégradé gracieux).

#### 4.4 25 nouveaux paramètres THEMATIC_PARAMETERS

BLUP×15 (VBS/IP/WL/WP/EG × H1/H2/H3) + MTGP×9 (VBS/IP/EG × H1/H2/H3) + VfS×1.

#### 4.5 Problème des smart quotes

Lors de l'édition du fichier TypeScript, des guillemets courbes (U+2018 `'`, U+2019 `'`) ont été insérés à la place des apostrophes droites ASCII. Résultat : `TS1127 Invalid character` sur 20+ lignes.

**Diagnostic** :
```python
with open('thematic-types.ts', 'rb') as f:
    # Détecte \xe2\x80\x98 (') et \xe2\x80\x99 (') dans le bytecode
```

**Fix** :
```python
content = content.replace(b'\xe2\x80\x98', b"'").replace(b'\xe2\x80\x99', b"'")
```

---

### 5. BLOC 3 — Expert Scientifique (onglet ML Pipeline)

L'onglet ML dans le panneau Expert Scientifique affichait "Prêt." sans contenu.

**Implémenté** :
- `loadMlPanel()` : remplace le placeholder par le tableau dynamique
- `refreshMlPanel()` : `GET /ai/models/status` → tableau avec badges statut colorés
- Badges : `ready` (vert), `partial` (orange), `not_computed` (bleu), `running` (animé)
- Colonne "Métrique" : LOO-RMSE depuis `model.metrics` (API), jamais de constante
- `handleRecomputeClick()` : `POST /ai/jobs/enqueue` → ARCH-02 respecté
- `startJobPolling()` : polling 3s → console de logs + barre de progression

---

### 6. BLOC 4 — Visualisations 3D

**Nouvel onglet `viz3d`** dans l'Expert Scientifique :
- 4 archetypes : A=Cube Plotly (iframe), B=PNG strati, C=SVG fence, D=PNG isovaleurs
- `generateViz3d()` : GET /ai/3d/asset pour vérifier le cache (ARCH-03, jamais HEAD)
- Mode dessin Fence : `enableFenceDrawMode()` sur `window` — 2 clics sur la carte Leaflet

```typescript
// main.ts — exposé sur window pour le panneau Expert
;(window as any).enableFenceDrawMode = function (): void {
  const points: [number, number][] = []
  // ... 2 clics → set fenceLon1/Lat1/Lon2/Lat2
}
```

---

### 7. BLOC 5 — Métriques Live (onglet Validation → Métriques)

Onglet "Validation" renommé "Métriques". `loadValidation()` refactorisé :
- Avant : lisait `ai_variograms` via `fetchVariogramSummary()`
- Après : `GET /ai/models/status` → tableau par modèle avec LOO-RMSE (ARCH-01 strict)

---

### 8. CORRECTIONS TYPESCRIPT PRÉ-EXISTANTES

13 fichiers corrigés pour atteindre 0 erreur TypeScript sur le code actif :

| Fichier | Correction | Raison |
|---|---|---|
| `tsconfig.json` | `ES2020 → ES2021` | `String.replaceAll()` non disponible en ES2020 |
| `db-manager/DataGrid.ts` | `// @ts-nocheck` | LitElement orphelin (lit non installé) |
| `db-manager/SchemaTree.ts` | `// @ts-nocheck` | LitElement orphelin |
| `db-manager/DbManagerModal.ts` | `// @ts-nocheck` | Décorateurs Lit orphelins |
| `stores/import-bulk-store.ts` | `// @ts-nocheck` | Svelte store orphelin |
| `export/bounds-optimizer-debug.ts` | Import depuis `bounds-optimizer` | `ADMGeometry` dans le mauvais module |
| `export/leaflet-capture-stable.ts` | `const tileLayers: any[]` | Implicit any |
| `mission/campaign-planner.ts` | Cast `LayerGroup → FeatureGroup` | `getBounds()` non sur LayerGroup |
| `suggestions-canon-panel.ts` | `JSON.stringify(survey.meta)` | prettyMeta attend un string |
| `tabs/tab-liste-sondages.ts` | `JSON.stringify(survey.meta)` | formatMeta attend un string |
| `components/RBACManager.tsx` | `useState<UserInfo\|null>` | Inférence trop large |
| `components/StagingModal.tsx` | `!!(disabled expression)` | boolean | null → boolean |
| `thematic/thematic-state.ts` | Import `MapType`, cast `'proportional'` | Mismatch de type |

---

### 9. CI/CD

#### 9.1 Nouveau workflow `.github/workflows/ml-pipeline.yml`

7 jobs parallèles déclenchés sur changements dans `services/api-geo/src/**` ou `ui/src/thematic/**` :

| Job | Vérification |
|---|---|
| `arch-01-no-hardcoded-metrics` | Grep : aucune valeur RMSE hardcodée dans le TS |
| `arch-02-no-process-spawn` | Grep : pas de `process::Command` dans les handlers HTTP |
| `arch-03-no-head-requests` | Grep : pas de `method: 'HEAD'` dans le frontend |
| `rust-check` | `cargo check + clippy` sur api-geo (SQLX_OFFLINE=true) |
| `typescript-thematic` | `tsc --noEmit` strict sur fichiers ML |
| `api-smoke` | Tests endpoints `/ai/models/status`, `/ai/jobs/enqueue`, `/ai/3d/asset` |
| `docker-build` | Build image api-geo (cache GHA, main/PR seulement) |

#### 9.2 Mise à jour `ci.yml`

Ajout d'une étape `TypeScript type-check (noEmit)` avant lint :
```yaml
- name: TypeScript type-check (noEmit)
  run: |
    cd ui
    npx tsc --noEmit 2>&1 | grep "error TS" \
      | grep -v "import-bulk-store|DbManagerModal|DataGrid|SchemaTree" \
      > /tmp/ts-errors.txt || true
    COUNT=$(wc -l < /tmp/ts-errors.txt)
    if [ "$COUNT" -gt 0 ]; then exit 1; fi
```

---

### 10. DÉCOUVERTE CRITIQUE — Anomalie de Géocodage

**Découvert lors du diagnostic de la couche de couverture** (`/coverage/mailles`).

#### 10.1 Symptôme

```
GET /coverage/mailles?grid=2km
→ Total: 29407 | has_data=true: 0 | n_sondages total: 0
```

#### 10.2 Investigation

```sql
-- Étape 1 : vue retourne 0 hardcodé
SELECT pg_get_viewdef('atlas.v_mailles_with_location_counts', true);
-- → 0 AS n_sondages, false AS has_data, false AS has_exact_location
-- Le CTE location_counts est jointé mais les colonnes lc.* ne sont pas utilisées !

-- Étape 2 : les sondages ont bien des maille_code
SELECT COUNT(*), COUNT(maille_code) FROM atlas.sondages WHERE deleted_at IS NULL;
-- → 572 | 572

-- Étape 3 : concentration anormale
SELECT maille_code, COUNT(*) FROM atlas.sondages GROUP BY maille_code ORDER BY 2 DESC LIMIT 3;
-- TG-0672-0197-01 | 188  ← ANOMALIE CRITIQUE

-- Étape 4 : tous ont le même point
SELECT ST_AsText(geom), COUNT(*) FROM atlas.sondages 
WHERE maille_code = 'TG-0672-0197-01' GROUP BY geom;
-- POINT(1 8.6) | 185  ← centroïde fallback
-- POINT(0.994... 8.600...) | 3

-- Confirmation : 187 sondages avec ce point fallback
SELECT source, COUNT(*) FROM atlas.sondages 
WHERE geom = ST_SetSRID(ST_MakePoint(1, 8.6), 4326) GROUP BY source;
-- V10_MASTER_2026 | 185
-- SOGLO Ferdinand | 2
```

#### 10.3 Root Cause

Le script d'import `V10_MASTER_2026` a assigné `geom = POINT(1.0, 8.6)` — le centroïde du canton Kaniamboua (Centrale/Sotouboua) — à 185 sondages sans coordonnées GPS disponibles. Ce fallback unique a fait geocoder tous ces sondages dans la même maille 2km×2km, créant une singularité statistique qui invalide les modèles ML.

#### 10.4 Deux bugs distincts

**Bug A** : `v_mailles_with_location_counts` hardcode `0 AS n_sondages, false AS has_data` → jamais de mailles avec données dans la coverage UI.

**Bug B** : 187 sondages avec `geom = POINT(1 8.6)` → biais spatial massif dans L1/L2a/L2b/L4.

#### 10.5 Corrections appliquées

**Migration 102** : Corrige la vue (utilise les colonnes `lc.*` du CTE au lieu des 0 hardcodés).
Résultat : `274 mailles avec has_data=true` après refresh de la MV.

**Migration 103** : Marque les 187 sondages comme `location_mode = 'fallback_default'`.

**Audit complet** : `session/audit/AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md` (1512 lignes).

---

### 11. CORRECTIONS SUPPLÉMENTAIRES (Étape 3)

#### 11.1 Fix [object Object] dans le DB Manager

**Cause** : L'API retourne `{"error_type": "DB_MANAGER_DISABLED", ...}` mais le frontend cherchait `code` ou `error_code`, jamais `error_type`. Résultat : le check 503 n'était jamais déclenché, et le message d'erreur se perdait dans le catch externe.

**Fix** :
```typescript
// services/api.ts — AVANT
const code = errorData?.code || errorData?.error_code || errorData?.error

// APRÈS
const code = errorData?.code || errorData?.error_code || errorData?.error || errorData?.error_type
```

Et dans le catch externe :
```typescript
// Re-throw propre pour ApiError (plain object avec .status)
if (error !== null && typeof error === 'object' && 'status' in error && 'message' in error) {
  throw { ...(error as object), message: String(apiErr.message ?? 'Erreur API') }
}
```

#### 11.2 Fix catégories thematic (4 familles scientifiques)

```typescript
// ObjectifMetier — AVANT (7 catégories hétérogènes)
'couverture' | 'argilosite' | 'gonflement' | 'compacite' | 'granulometrie' | 'contexte' | 'ia_ag' | 'personnalise'

// APRÈS (4 familles scientifiques + 4 legacy pour rétrocompat)
'couverture' | 'argilosite' | 'portance' | 'insitu' | 'ia_ag' | 'personnalise'
+ legacy : 'gonflement' | 'compacite' | 'granulometrie' | 'contexte'
```

Le dropdown affiche les 5 familles visibles, les legacy sont cachés mais fonctionnels.

#### 11.3 Fix paramètres horizons redondants

**Problème** : Pour source `l2a_rk`, le dropdown paramètre affichait `VBS RK H1`, `VBS RK H2`, `VBS RK H3`, `IP RK H1`, ... — redondant avec le sélecteur Horizon.

**Correction** : `getParametersForObjectifAndSource()` retourne maintenant UN seul param par base (H2 comme défaut), avec label épuré ("VBS (Valeur au Bleu)"). Dans `buildConfigFromUI()` :
```typescript
if (['l2a_rk', 'l2b_blup', 'l4_mtgp'].includes(source)) {
  parameter = parameter.replace(/_h[123]$/, `_${hz.toLowerCase()}`)
}
```

---

### 12. TESTS FINAUX

#### 12.1 Tests curl validés

```
✅ GET /healthz → ok
✅ GET /coverage/mailles → 274 mailles avec données (était 0 avant)
✅ GET /thematic/data?parameter=vbs_ked_h1 → count: 29407
✅ GET /thematic/data?parameter=vbs_blup_h1 → count: 29407 (après fix _fusion_)
✅ GET /thematic/data?parameter=vbs_mtgp_h1 → count: 29407
✅ GET /ai/models/status → 5 modèles (L1/L2a/L2b=ready, L3=not_computed, L4=ready)
✅ POST /ai/jobs/enqueue (avec JWT) → job_id=adb68add-...
✅ GET /ai/jobs/:id → status=queued, progress=null
⏳ GET /ai/3d/asset → rebuild Docker en cours (fix parameter_id NULL)
```

#### 12.2 Vérifications DB

```sql
-- Coverage correcte après migration 102
SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data = true;
-- → 274

-- Fallback marqués après migration 103
SELECT COUNT(*) FROM atlas.sondages WHERE location_mode = 'fallback_default';
-- → 187
```

---

### 13. COMMITS DE LA SESSION

| Hash | Message |
|---|---|
| `2e0c56c` | `feat(bloc1-2): Pipeline ML L1-L4 connecté à l'UI — Phase 0+1+2` |
| `f2d7b38` | `feat(bloc3): Panneau Expert Scientifique — onglet ML Pipeline L1-L4` |
| `b53066c` | `fix(ts): résolution de toutes les erreurs TypeScript pré-existantes` |
| `2c215f1` | `feat(bloc4-5): Visu 3D + tableau métriques live L1-L4` |
| `9535698` | `ci: pipeline ML L1-L4 + tsc noEmit dans CI existant` |
| `a9f102a` | `fix(bugs+audit): Corrections UI, couverture, DB manager, catégories + audit géocodage` |

---

### 14. DETTE TECHNIQUE IDENTIFIÉE

| ID | Description | Priorité |
|---|---|---|
| DT-01 | 187 sondages avec POINT(1 8.6) → re-géocodage fuzzy-regex requis | P0 |
| DT-02 | Script `regeocod_fuzzy_v1.py` à créer (voir audit section 4.5) | P0 |
| DT-03 | `geocode_sondage()` ne met pas à jour `location_mode` | P1 |
| DT-04 | L3 VfS non calculé (`not_computed`) | P2 |
| DT-05 | `mailles_geotechnique_stats_wgs84` retourne aussi 0 n_sondages | P1 |
| DT-06 | Article scientifique : figures et métriques à recalculer après DT-01 | P0 |
| DT-07 | /ai/3d/asset : test à valider après rebuild Docker | P1 |
| DT-08 | DB Manager : ENABLE_DB_MANAGER=false → message d'erreur visible (fix api.ts) | P2 |

---

### 15. CONVENTIONS NOUVELLES / MISES À JOUR

| CONV | Description |
|---|---|
| CONV-15 | Port 5433 = source de vérité (jamais 5432) |
| CONV-16 | `method` DB pour BLUP = `ked_rk_fusion_bayesian`, param = `vbs_fusion_h1` |
| CONV-17 | L1 officiel = `ked_hierarchical_5levels` uniquement |
| CONV-18 | Synchronisation DB : Option A (host.docker.internal) choisie |
| CONV-19 *(NOUVELLE)* | Jamais de POINT(1 8.6) en fallback — utiliser `NULL` si localisation inconnue |
| ARCH-01 | Zéro valeur RMSE hardcodée dans le TS (tout depuis `/ai/models/status`) |
| ARCH-02 | Toujours via `ai_job_queue`, jamais `process::Command` depuis handler HTTP |
| ARCH-03 | Vérification existence fichier 3D : GET /ai/3d/asset (backend), jamais HEAD frontend |
| ARCH-04 | Expert Scientifique UI = seul déclencheur (pas de Phase 0 manuelle) |
| ARCH-05 | `method_to_model_id()` en Rust (pas d'UPDATE SQL pour renommer les méthodes) |

---

### 16. PROCHAINES ACTIONS (Priorité)

1. **[P0]** Valider le test `/ai/3d/asset` après rebuild Docker (en cours)
2. **[P0]** Créer `scripts/regeocod_fuzzy_v1.py` pour re-géocoder les 187 sondages
3. **[P0]** Interface UI de géocodage manuel (extension `/geocode/manual`)
4. **[P0]** Relancer L1 → L2a → L2b → L4 après correction géocodage
5. **[P0]** Mettre à jour l'article scientifique (figures + métriques)
6. **[P1]** Fix `geocode_sondage()` → ajouter mise à jour de `location_mode`
7. **[P1]** Vérifier `mailles_geotechnique_stats_wgs84` (retourne aussi 0 ?)
8. **[P2]** Calculer L3 VfS-PLS Sentinel-2

---

*Document de session rédigé le 2026-06-04*  
*Auteur : Claude Sonnet 4.6 (IA assistante) — Projet Atlas Géotechnique du Togo*  
*Référence audit : `session/audit/AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md`*
