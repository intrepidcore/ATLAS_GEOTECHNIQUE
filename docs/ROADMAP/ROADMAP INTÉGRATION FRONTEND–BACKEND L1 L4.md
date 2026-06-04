# ROADMAP INTÉGRATION FRONTEND–BACKEND — Atlas Géotechnique Togo
## Pipeline IntrepidCore · Modèles L1–L4 · Révision architecturale 2026-06-04

> **Standards Intrepid Core :** Traçable · Fiable · Durable · Honnête  
> **DB :** `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean` (TOUJOURS port 5433)  
> **API :** `http://localhost:8000` (proxié via nginx sur `localhost:1420/api/`)  
> **Repo :** `C:\PROJET_ATLAS_MASTER\atlas_reclone`

---

## CORRECTIONS ARCHITECTURALES — 5 anti-patterns éliminés

Cette révision corrige cinq défauts graves de l'itération précédente. Ces principes
sont **non-négociables** et s'appliquent à toute l'implémentation.

### [ARCH-01] Zéro Hardcoding — L'UI ne contient aucune constante RMSE

**Problème éliminé :** L'ancien plan hardcodait `const RMSE_TABLE = { l1_ked: { vbs: { h1: 2.94 ...}}}` en JS,
copié d'un fichier Markdown. Quand le modèle se recalibrait, l'interface mentait.

**Règle :** Le frontend ne contient **aucune valeur numérique de métrique**. Il appelle
`GET /ai/models/status` au démarrage et affiche ce que l'API retourne. Si l'API n'a pas
la donnée, l'UI affiche `—` (tiret). Jamais de fallback statique.

### [ARCH-02] Task Queue via DB — Jamais `std::process::Command` direct

**Problème éliminé :** L'ancien plan proposait `tokio::spawn(Command::new("python")...)` dans
le serveur web Rust. Résultat : 10 utilisateurs cliquent → 10 processus MTGP (O(N³)) en
parallèle → crash OOM. Si le serveur redémarre pendant le calcul → run perdu sans trace.

**Règle :** Le backend Rust **insère un enregistrement** dans `atlas.ai_jobs_queue` avec
`status='pending'`. Le worker Python existant (`pipeline_worker.py`, ou `InferOptiCommandCenter`
selon le contexte) dépile et exécute les jobs. Le serveur web ne lance jamais de process.

```
[Frontend] → POST /ai/jobs/enqueue  →  [API Rust] → INSERT ai_jobs_queue (status=pending)
                                                           ↓
                                              [Worker Python, boucle infinie]
                                              → SELECT ... WHERE status='pending' LIMIT 1
                                              → UPDATE status='running'
                                              → exec script Python
                                              → UPDATE status='done'|'failed' + logs
                                                           ↓
[Frontend] → GET /ai/jobs/{id}       ←  [API Rust] → SELECT FROM ai_jobs_queue WHERE id=?
```

### [ARCH-03] Cache côté Backend — Le frontend ne fait jamais de requête HEAD

**Problème éliminé :** L'ancien plan faisait `fetch(staticUrl, { method: 'HEAD' })` depuis
le frontend pour détecter si un PNG existe. Ce pattern génère des 404 dans les logs Nginx,
pollue le réseau, et remet la logique de cache dans le mauvais composant.

**Règle :** Le frontend appelle `GET /ai/3d/asset?param=vbs&archetype=B`. Le backend Rust
vérifie lui-même si `exports_3d_v2/vbs_B_strati_maps.png` existe sur le disque. Si oui, il
répond `{ "url": "/exports/3d/vbs_B_strati_maps.png", "cached": true }`. Si non, il
enqueue un job de génération et répond `{ "job_id": "...", "cached": false }`.

### [ARCH-04] Pas de Phase 0 manuelle — L'UI Expert Scientifique est le point de contrôle

**Problème éliminé :** L'ancien plan demandait d'exécuter les scripts Python à la main
dans le terminal (Phase 0), puis construisait une UI (Phase 4) pour faire exactement la même
chose. Contradiction temporelle : si la Phase 0 réussit, le bouton "Calculer" de Phase 4
n'a plus rien à faire.

**Règle :** Il n'y a pas de Phase 0. L'onglet "Expert Scientifique" (db-manager) EST le
mécanisme de déclenchement. On construit l'UI, et c'est elle qui sert à déclencher ou
mettre à jour les calculs. Les données déjà en base sont simplement affichées comme
`status: ready`.

### [ARCH-05] Mapping method DB au niveau du Code — Jamais d'UPDATE SQL massif

**Problème éliminé :** L'ancien plan proposait un `UPDATE atlas.ai_interpolation_values SET method='ked_hierarchical_5levels'`
pour renommer 352 884 lignes. Opération risquée, irréversible si mal gérée, et doublement
inutile puisque le même plan ajoutait ensuite un mapping dans le code Rust.

**Règle :** La DB garde ses noms existants (`ked_pedologie_ked`, `ked_pedologie_eg`, etc.).
Le backend Rust maintient une table de mapping statique (const en Rust) :

```rust
// Dans src/models/thematic.rs
fn method_to_model_id(method: &str) -> &'static str {
    match method {
        "ked_pedologie_ked" | "ked_hierarchical_5levels" => "L1_KED_H",
        "regression_kriging_scorpan"                     => "L2a_RK",
        "ked_rk_fusion_bayesian"                         => "L2b_BLUP",
        "mtgp_icm_gpflow"                                => "L4_MTGP",
        "maille_spectral_vfs"                            => "L3_VFS",
        _                                                => "UNKNOWN",
    }
}
```

Aucune migration SQL. Aucun risque. Reproductible.

---

## ⚠️ DÉCOUVERTE CRITIQUE — Deux bases de données distinctes

> **Audit du 2026-06-04 — Réf. CONV-15, CONV-16, CONV-17**

Il existe **deux instances PostgreSQL** sur la machine de développement. Toute la confusion  
sur "quels modèles sont calculés" venait de ce fait non documenté.

| Port | Instance | Contenu modèles ML |
|:----:|:--------:|:-----------------:|
| **5433** (natif Windows) | Base canonique de calcul | ked_hierarchical_5levels ✅, ked_rk_fusion_bayesian ✅, mtgp_icm_gpflow ✅, regression_kriging_scorpan ✅ |
| **5432** (Docker atlas-db) | Clone partiel — ancienne version | Seulement ked_pedologie_ked (obsolète), regression_kriging_scorpan partiel |

**L'API REST Docker lit le port 5432 (incomplet). C'est la cause racine de toutes les anomalies UI.**

**Correctif de Phase 0 (avant tout autre développement) :** brancher l'API sur le port 5433.  
Voir CONV-18 pour les deux options d'implémentation.

### Sur le nommage `ked_pedologie_ked` (CONV-16)

Les lignes `ked_pedologie_ked` dans le Docker DB sont issues d'une **version obsolète du script**  
qui hardcodait ce nom. La version courante du script écrit `ked_hierarchical_5levels` (avec `--hierarchical`).  
**Il n'est pas possible de savoir si ces données sont hiérarchiques ou pédologiques** — elles constituent  
une dette technique à purger lors de la synchronisation.

**Le seul L1 officiel : `ked_hierarchical_5levels`** (CONV-17). Le KED pédologique simple est obsolète.

### État réel du port 5433 (source de vérité — dernier run 2026-06-02)

| Méthode | Params | Mailles | Runs enregistrés |
|---------|--------|---------|-----------------|
| `ked_hierarchical_5levels` | 31 | 29 407 | ✅ drift_method=hierarchical_5levels |
| `regression_kriging_scorpan` | 15 | 29 407 | ✅ |
| `ked_rk_fusion_bayesian` | 15 | 29 407 | ✅ |
| `mtgp_icm_gpflow` | 15 | 29 407 | ✅ |
| `derived_avg_from_ked` | 7 | 29 407 | ✅ |

**Tous les modèles L1–L4 sont calculés et valides.** Le problème est uniquement la connexion API.

---

## ÉTAT DES LIEUX (audit DB réel — 2026-06-04)

> **Note :** La section ci-dessous décrit le port **5433** (source de vérité).
> Le port 5432 (Docker) est incomplet et ne doit être utilisé que comme cible de synchronisation.

### Données en base `atlas.ai_interpolation_values` — port 5433

| Modèle | Method DB actuel | Params×Horizons | Mailles | Exposé `/thematic/data` |
|--------|-----------------|-----------------|---------|------------------------|
| **L1 KED Hiérarchique 5N** | `ked_hierarchical_5levels` | 31 | 29 407 | **Non** — API sur 5432 ≠ 5433 |
| **L2a RK-SCORPAN** | `regression_kriging_scorpan` | 15 | 29 407 | Partiel (API lit 5432) |
| **IP dérivé** | `derived_ip_from_wl_wp` | 3 | 29 407 | Partiel |
| **L2b Fusion BLUP** | `ked_rk_fusion_bayesian` | 15 | 29 407 | **Non** |
| **L4 MTGP GPflow** | `mtgp_icm_gpflow` | 15 | 29 407 | **Non** |
| **L3 VfS PLS** | `maille_spectral_vfs` | 1 (surface) | ~24 038 | **Non** |
| ~~ked_pedologie_ked~~ | ~~Obsolète~~ | — | Docker seulement | CONV-16/17 — à purger |

> **Cause racine :** L'API Docker se connecte à `db:5432` (Docker atlas-db, incomplet).
> Tous les modèles L1–L4 sont calculés et à jour sur le port **5433** (derniers runs 2026-06-02).
> **La Phase 0 ci-dessous corrige ce problème en priorité absolue.**

### 3D exports statiques (déjà générés, non exposés en UI)

`exports_3d_v2/` : VBS, IP, WL, WP, CBR, γd, wopt, Rd
- Archetype **A** : HTML Plotly interactif (cube 3D)
- Archetype **B** : PNG 300dpi (colonnes strati H1/H2/H3)
- Archetype **C** : PNG 300dpi (fence / coupe transversale)
- Archetype **D** : PNG 300dpi (isovaleurs / zones critiques)

### Problèmes UI identifiés (à corriger dans cette roadmap)

1. **Source dropdown** : `base / interpolation / ia` — ne reflète pas la hiérarchie L1–L4
2. **Label "Horizon KED"** : restrictif, s'applique désormais à tous les modèles
3. **Catégories** : 7 objectifs métier → 3 familles scientifiques
4. **Onglet ML** (scientific-drawer) : affiche "Prêt." — pas de contenu
5. **3D Viewer** : exports existent sur disque, aucune entrée UI
6. **Paramètres L2b/L3/L4** : absents du dropdown thematic (enum Rust non étendu)

---

## VISION CIBLE

```
localhost:1420/                    ← Carte dynamique (refaite)
  Source : Base terrain
           ML L1 — KED Hiérarchique (5 niveaux)
           ML L2a — RK-SCORPAN
           ML L2b — Fusion Bayésienne BLUP
           ML L3 — VfS-PLS (Sentinel-2)
           ML L4 — MTGP/ICM (Multi-Tâches)
  Catégorie : Argilosité & plasticité | Portance & compactage | In-situ & pressiométrique
  Horizon : H1 / H2 / H3  (label générique, non "KED")
  Badge live : modèle actif + LOO-RMSE depuis /ai/models/status

localhost:1420/db-manager.html    ← Onglet Expert Scientifique (étendu)
  Tab "Modèles ML" :
    Tableau d'état L1–L4 (statut, mailles, RMSE depuis API)
    Boutons "Déclencher recalcul" → enqueue job en DB (ARCH-02)
    Console de progression (polling /ai/jobs/{id})
  Tab "Visualisations 3D" :
    Sélecteur param + archetype (A/B/C/D)
    Affichage PNG statique depuis cache (ARCH-03)
    Fence diagram : saisie coords ou dessin sur carte Leaflet
    Export PNG/PDF
  Tab "Métriques" :
    Tableau LOO-RMSE depuis /ai/models/status (ARCH-01)
    Alertes RK H2 dégradé
```

---

## PHASE 0 — Connexion API au bon port (30 minutes, bloquant tout le reste)

> Réf. CONV-15, CONV-18 · **Doit être faite avant tout test UI/API**

### 0.1 Brancher api-geo sur host PostgreSQL 5433

Modifier `docker-compose.yml`, service `api-geo` :

```yaml
# AVANT (pointe sur le Docker atlas-db incomplet)
DATABASE_URL: postgres://atlas_app_user:${ATLAS_DB_APP_PASSWORD}@db:5432/atlas_clean

# APRÈS (pointe sur le PostgreSQL natif 5433 — source de vérité)
DATABASE_URL: postgres://atlas:atlas@host.docker.internal:5433/atlas_clean
```

> `host.docker.internal` = adresse de l'hôte depuis un container Docker Desktop for Windows.
> Utiliser les credentials `atlas:atlas` (ceux utilisés par tous les scripts de calcul).

### 0.2 Rebuild et redémarrage

```bash
cd C:\PROJET_ATLAS_MASTER\atlas_reclone
docker compose up -d --build api-geo
```

### 0.3 Validation

```bash
# Test : VBS KED Hiérarchique doit retourner 29 407 mailles
curl "http://localhost:1420/api/thematic/data?parameter=vbs_ked_h1&include_geometry=false" \
  | python -c "import sys,json; d=json.load(sys.stdin); print('count:', d['statistics']['count'])"
# Attendu : count: 29407 (et non ~61 comme avant)

# Test : RK SCORPAN
curl "http://localhost:1420/api/thematic/data?parameter=vbs_rk_h1&include_geometry=false" \
  | python -c "import sys,json; d=json.load(sys.stdin); print('count:', d['statistics']['count'])"
# Attendu : count: 29407
```

**Critère de succès :** `vbs_ked_h1` retourne 29 407 mailles (pas ~61).  
Après Phase 0, toute la pyramide L1–L2a est automatiquement visible dans l'UI existante.

---

## PHASE 1 — Backend Rust : exposition des paramètres L1–L4 (priorité absolue)

> Durée estimée : 1–2 jours  
> Fichiers : `services/api-geo/src/` (binaire Rust compilé)

### 1.1 Étendre l'enum `ThematicParameter`

L'API Rust valide les noms de paramètres via un enum strict. Il faut ajouter les
paramètres des modèles L2b, L3 et L4 — ainsi que CBR/γd/wopt/Rd si interpolés.

**Noms canoniques à ajouter (format snake_case, pattern existant respecté) :**

```
# L2b Fusion BLUP (15 params)
vbs_blup_h1, vbs_blup_h2, vbs_blup_h3
ip_blup_h1,  ip_blup_h2,  ip_blup_h3
wl_blup_h1,  wl_blup_h2,  wl_blup_h3
wp_blup_h1,  wp_blup_h2,  wp_blup_h3
eg_blup_h1,  eg_blup_h2,  eg_blup_h3

# L4 MTGP (9 params)
vbs_mtgp_h1, vbs_mtgp_h2, vbs_mtgp_h3
ip_mtgp_h1,  ip_mtgp_h2,  ip_mtgp_h3
eg_mtgp_h1,  eg_mtgp_h2,  eg_mtgp_h3

# L3 VfS (1 param, surface uniquement)
vbs_vfs
```

**Mapping nom API → (method DB, parameter_id DB) :**

| Nom API | `method` en DB | `parameter_id` en DB |
|---------|---------------|---------------------|
| `vbs_blup_h1` | `ked_rk_fusion_bayesian` | `vbs_blup_h1` |
| `vbs_mtgp_h1` | `mtgp_icm_gpflow` | `vbs_mtgp_h1` |
| `vbs_vfs` | `maille_spectral_vfs` | `vbs_vfs` |

Note : le mapping method DB → model_id se fait via la constante Rust de ARCH-05, pas
via migration SQL.

### 1.2 Créer `GET /ai/models/status` — Source de vérité de l'UI

Cet endpoint est la **seule** source de métriques pour le frontend (ARCH-01).
Il interroge la DB en temps réel pour construire sa réponse.

**Logique de construction (côté Rust) :**

```rust
// Pour chaque modèle connu, compter les lignes en base
// et récupérer les métriques depuis ai_interpolation_runs
SELECT
    r.method,
    r.parameter_id,
    r.metrics->>'loo_rmse' AS loo_rmse,
    r.metrics->>'loo_mae'  AS loo_mae,
    r.metrics->>'r2'       AS r2,
    COUNT(v.id)            AS n_mailles,
    MAX(r.created_at)      AS last_run_at
FROM atlas.ai_interpolation_runs r
LEFT JOIN atlas.ai_interpolation_values v
    ON v.method = r.method AND v.parameter_id = r.parameter_id
GROUP BY r.method, r.parameter_id, r.metrics, r.created_at
```

**Format de réponse :**

```json
{
  "models": [
    {
      "id": "L1_KED_H",
      "label": "KED Hiérarchique 5 niveaux",
      "method_db": "ked_pedologie_ked",
      "status": "ready",
      "n_params": 15,
      "n_mailles": 29407,
      "last_run_at": "2026-05-15T14:32:00Z",
      "metrics": {
        "vbs_h1": { "loo_rmse": 2.9407, "loo_mae": null, "r2": null },
        "ip_h1":  { "loo_rmse": 9.7862, "loo_rmse_unit": "%" },
        "eg_h1":  { "loo_rmse": 1.6670 }
      },
      "warnings": []
    },
    {
      "id": "L2a_RK",
      "label": "RK-SCORPAN (Regression Kriging)",
      "method_db": "regression_kriging_scorpan",
      "status": "ready",
      "n_params": 15,
      "n_mailles": 29407,
      "metrics": {
        "vbs_h1": { "loo_rmse": 2.4802 },
        "wl_h2":  { "loo_rmse": 19.9708 }
      },
      "warnings": [
        "H2 dégradé : WL RMSE=19.97, WP RMSE=13.20 (transition lithologique 1–2m)"
      ]
    },
    {
      "id": "L2b_BLUP",
      "label": "Fusion Bayésienne BLUP",
      "method_db": "ked_rk_fusion_bayesian",
      "status": "ready",
      "n_params": 15,
      "n_mailles": 29407,
      "metrics": {
        "variance_reduction_pct": 47.9
      },
      "warnings": []
    },
    {
      "id": "L3_VFS",
      "label": "VfS-PLS Sentinel-2",
      "method_db": "maille_spectral_vfs",
      "status": "partial",
      "n_params": 1,
      "n_mailles": 24038,
      "metrics": {
        "vbs_surface": { "loo_rmse": 2.788 }
      },
      "warnings": ["Couverture partielle : 24 038/29 407 mailles (végétation dense exclue)"]
    },
    {
      "id": "L4_MTGP",
      "label": "MTGP/ICM GPflow (Multi-Tâches)",
      "method_db": "mtgp_icm_gpflow",
      "status": "ready",
      "n_params": 9,
      "n_mailles": 29407,
      "metrics": {},
      "warnings": ["Modèle expérimental — LOO-RMSE non calculée (O(N³))"]
    }
  ],
  "generated_at": "2026-06-04T07:00:00Z"
}
```

> Le champ `status` est calculé dynamiquement : `ready` si `n_mailles > 0`, `not_computed`
> si `n_mailles = 0`, `partial` si `0 < n_mailles < 29407`.

### 1.3 Créer `GET /ai/3d/asset` — Endpoint cache-aware (ARCH-03)

```
GET /ai/3d/asset?param=vbs&archetype=B

Logique backend :
  1. Construire le chemin : $EXPORT_DIR/exports_3d_v2/{param}_{archetype}_*.png
  2. Si le fichier existe → { "cached": true,  "url": "/exports/3d/vbs_B_strati_maps.png" }
  3. Si non             → { "cached": false, "job_id": "uuid-..." }
                           + INSERT INTO ai_jobs_queue (type='3d_render', params=...)
```

Implémentation Rust avec `std::fs::metadata()` (synchrone, rapide, dans un `tokio::task::spawn_blocking`) :

```rust
async fn get_3d_asset(
    State(state): State<AppState>,
    Query(params): Query<Asset3dQuery>,
) -> Json<Asset3dResponse> {
    let filename = build_3d_filename(&params.param, &params.archetype);
    let path = state.export_dir.join("exports_3d_v2").join(&filename);

    if tokio::fs::metadata(&path).await.is_ok() {
        return Json(Asset3dResponse {
            cached: true,
            url: Some(format!("/exports/3d/{}", filename)),
            job_id: None,
        });
    }

    // Enqueue generation job (ARCH-02)
    let job_id = enqueue_3d_job(&state.db, &params).await?;
    Json(Asset3dResponse { cached: false, url: None, job_id: Some(job_id) })
}
```

### 1.4 Créer la table `atlas.ai_jobs_queue` (ARCH-02)

```sql
-- Migration atomique et idempotente (règle DB-11)
CREATE TABLE IF NOT EXISTS atlas.ai_jobs_queue (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type    TEXT NOT NULL,     -- 'ked_recompute' | 'rk_recompute' | 'blup_recompute'
                                   -- | 'mtgp_recompute' | 'vfs_extract' | '3d_render'
    payload     JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending|running|done|failed|cancelled
    priority    INT  NOT NULL DEFAULT 5,          -- 1=haute, 10=basse
    logs        TEXT,
    progress_pct INT,
    requested_by TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_msg   TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON atlas.ai_jobs_queue(status, priority, created_at);
```

### 1.5 Exposer les fichiers 3D statiques via nginx

```nginx
# Ajouter dans nginx.conf (block server existant)
location /exports/3d/ {
    alias /data/exports/exports_3d_v2/;
    autoindex off;
    add_header Cache-Control "public, max-age=86400";
    # Content-Type automatique depuis l'extension
    types {
        image/png  png;
        text/html  html;
        application/pdf pdf;
    }
}
```

**Critère de validation Phase 1 :**

```bash
# Test 1 : Nouveau paramètre exposé
curl "http://localhost:8000/thematic/data?parameter=vbs_blup_h1&include_geometry=false" \
  | python -c "import sys,json; d=json.load(sys.stdin); print('count:', d['statistics']['count'])"
# Attendu : count: 29407

# Test 2 : Models status dynamique
curl "http://localhost:8000/ai/models/status" | python -m json.tool | grep '"status"'
# Attendu : "ready" pour L1, L2a, L2b, L4 | "partial" pour L3

# Test 3 : Cache-aware 3D asset
curl "http://localhost:8000/ai/3d/asset?param=vbs&archetype=B"
# Attendu : { "cached": true, "url": "/exports/3d/vbs_B_strati_maps.png" }
```

---

## PHASE 2 — Refonte Source Dropdown (TypeScript)

> Durée estimée : 0.5 jour  
> Fichiers : `ui/src/thematic/thematic-types.ts` (l.123) + `thematic-panel.ts` (l.228–231)

### 2.1 Nouveau type `ThematicSource`

```typescript
// Fichier : ui/src/thematic/thematic-types.ts

// AVANT (l.123)
export type ThematicSource = 'base' | 'interpolation' | 'ia'

// APRÈS
export type ThematicSource =
  | 'base'      // Données terrain (mesures sondages)
  | 'l1_ked'    // ML L1 — KED Hiérarchique 5 niveaux
  | 'l2a_rk'    // ML L2a — RK-SCORPAN
  | 'l2b_blup'  // ML L2b — Fusion Bayésienne BLUP
  | 'l3_vfs'    // ML L3 — VfS-PLS (Sentinel-2, VBS surface)
  | 'l4_mtgp'   // ML L4 — MTGP/ICM (Multi-Tâches)
```

### 2.2 Nouveau HTML du dropdown (Lucide icons, zéro emoji — ARCH-01 + contrainte icons)

```html
<!-- Fichier : thematic-panel.ts, méthode renderPanel(), remplacer lignes 228–231 -->
<div class="thematic-field">
  <label class="thematic-label" for="thematicAiSource">
    SOURCE DE DONNÉES
  </label>
  <div class="source-select-wrapper">
    <select id="thematicAiSource" class="thematic-select">
      <optgroup label="Données terrain">
        <option value="base">Base — Données terrain (sondages)</option>
      </optgroup>
      <optgroup label="Machine Learning géostatistique" id="srcGroupML">
        <option value="l1_ked" data-model-id="L1_KED_H">
          ML L1 — KED Hiérarchique (5 niveaux)
        </option>
        <option value="l2a_rk" data-model-id="L2a_RK">
          ML L2a — RK-SCORPAN (Regression Kriging)
        </option>
        <option value="l2b_blup" data-model-id="L2b_BLUP">
          ML L2b — Fusion Bayésienne BLUP
        </option>
        <option value="l3_vfs" data-model-id="L3_VFS">
          ML L3 — VfS-PLS (Sentinel-2, VBS uniquement)
        </option>
        <option value="l4_mtgp" data-model-id="L4_MTGP">
          ML L4 — MTGP/ICM (Multi-Tâches, expérimental)
        </option>
      </optgroup>
    </select>
    <!-- Badge dynamique — alimenté par /ai/models/status, pas de valeur hardcodée -->
    <div id="sourceModelBadge" class="source-badge" aria-live="polite">
      <i data-lucide="activity" class="badge-icon"></i>
      <span id="sourceRmseLabel">—</span>
    </div>
  </div>
</div>
```

### 2.3 Activation dynamique des sources depuis l'API (ARCH-01)

```typescript
// Fichier : thematic-panel.ts — ajouter dans init() après cacheElements()

private async syncSourceAvailability(): Promise<void> {
  try {
    const resp = await fetch(`${getApiBase()}/ai/models/status`, {
      headers: this.getAuthHeaders(),
    })
    if (!resp.ok) return

    const data = (await resp.json()) as { models: ModelStatus[] }

    for (const model of data.models) {
      const opt = this.panelElement.querySelector<HTMLOptionElement>(
        `option[data-model-id="${model.id}"]`
      )
      if (!opt) continue

      const isAvailable = model.status === 'ready' || model.status === 'partial'
      opt.disabled = !isAvailable

      if (isAvailable && model.metrics) {
        // Afficher RMSE VBS H1 dans le label si disponible — data vient de l'API
        const rmseVbs = model.metrics['vbs_h1']?.loo_rmse
        if (typeof rmseVbs === 'number') {
          opt.textContent = opt.textContent + ` — RMSE VBS·H1: ${rmseVbs.toFixed(2)}`
        }
      }
    }

    // Stocker les modèles pour le badge live (cf. 2.4)
    this.modelStatusCache = data.models
  } catch {
    // Silencieux : l'UI reste fonctionnelle sans les badges
  }
}
```

### 2.4 Badge live sous la carte (données API, pas hardcodées — ARCH-01)

```typescript
// Appelé à chaque changement de source OU de paramètre
private updateModelBadge(source: ThematicSource): void {
  const badge = document.getElementById('sourceRmseLabel')
  if (!badge) return

  if (source === 'base') {
    badge.textContent = 'Données terrain directes'
    return
  }

  const modelIdMap: Record<ThematicSource, string> = {
    base: '', l1_ked: 'L1_KED_H', l2a_rk: 'L2a_RK',
    l2b_blup: 'L2b_BLUP', l3_vfs: 'L3_VFS', l4_mtgp: 'L4_MTGP',
  }

  const model = this.modelStatusCache?.find(m => m.id === modelIdMap[source])
  if (!model) {
    badge.textContent = '—'
    return
  }

  // ARCH-01 : on affiche ce que l'API renvoie, pas une constante
  const rmse = model.metrics?.['vbs_h1']?.loo_rmse
  const coverage = model.n_mailles
  badge.textContent = rmse != null
    ? `LOO-RMSE VBS·H1: ${rmse.toFixed(2)} · ${coverage.toLocaleString('fr-FR')} mailles`
    : `${coverage.toLocaleString('fr-FR')} mailles · métriques non disponibles`
}
```

### 2.5 Mapping source → paramètres disponibles

```typescript
// Fichier : thematic-types.ts — remplacer getParametersForObjectifAndSource()

export function getParametersForObjectifAndSource(
  objectifId: ScientificFamily,
  source: ThematicSource,
): ThematicParameter[] {
  if (source === 'base') {
    return BASE_PARAMS_BY_FAMILY[objectifId] ?? []
  }

  const horizons: KedHorizon[] = ['H1', 'H2', 'H3']
  const suffix: Record<ThematicSource, string> = {
    base: '', l1_ked: 'ked', l2a_rk: 'rk', l2b_blup: 'blup',
    l3_vfs: 'vfs', l4_mtgp: 'mtgp',
  }
  const sfx = suffix[source]

  if (source === 'l3_vfs') {
    // VfS = VBS surface uniquement, pas d'horizon
    return objectifId === 'argilosite'
      ? [{ id: 'vbs_vfs', label: 'VBS surface (Sentinel-2)', unit: 'g/100g',
           category: 'vbs', description: 'VBS prédit par PLS spectral (SWIR B11/B12)' }]
      : []
  }

  const baseParams: Record<ScientificFamily, string[]> = {
    argilosite: ['vbs', 'ip', 'wl', 'wp', 'eg'],
    portance:   source === 'l1_ked' ? ['cbr_95', 'gamma_d', 'w_opt'] : [],
    insitu:     source === 'l1_ked' ? ['rd_mpa'] : [],
    coverage:   [],
  }

  const params = baseParams[objectifId] ?? []
  const result: ThematicParameter[] = []

  for (const p of params) {
    const hList = (source === 'l4_mtgp' && !['vbs','ip','eg'].includes(p))
      ? []           // MTGP couvre VBS/IP/EG uniquement
      : horizons

    for (const h of hList) {
      const id = `${p}_${sfx}_${h.toLowerCase()}`
      result.push(buildThematicParam(id, p, h, source))
    }
  }

  return result
}
```

**Critère de validation Phase 2 :**
- Dropdown affiche 6 options groupées (terrain + 5 ML)
- Options L2b/L3/L4 disabled si `status !== 'ready'` (dynamique depuis API)
- Badge sous la carte affiche RMSE depuis l'API, change quand source change
- Zéro valeur RMSE codée en dur dans le TS

---

## PHASE 3 — Refonte Catégories & Horizon (TypeScript)

> Durée estimée : 0.5 jour

### 3.1 Trois familles scientifiques (remplacent les 7 objectifs métier)

```typescript
// Fichier : thematic-types.ts — remplacer l'enum ObjectifMetier

export type ScientificFamily =
  | 'coverage'    // Couverture terrain
  | 'argilosite'  // Argilosité & plasticité
  | 'portance'    // Portance & compactage
  | 'insitu'      // In-situ & pressiométrique

export const SCIENTIFIC_FAMILIES: FamilyConfig[] = [
  {
    id: 'coverage',
    label: 'Couverture terrain',
    lucideIcon: 'map-pin',
    description: 'Densité de sondages et instrumentation par maille 2km×2km',
    params_base: ['n_sondages', 'n_echantillons', 'n_essais_total'],
  },
  {
    id: 'argilosite',
    label: 'Argilosité & plasticité',
    lucideIcon: 'layers',
    description: 'VBS, IP, WL, WP, Eg — caractérisation de la fraction argileuse',
    params_base: ['vbs_avg', 'ip_avg', 'wl_avg', 'wp_avg', 'eg_avg'],
    // Params ML : générés dynamiquement par getParametersForObjectifAndSource()
  },
  {
    id: 'portance',
    label: 'Portance & compactage',
    lucideIcon: 'gauge',
    description: 'CBR 95%, γd max, wopt — Proctor et résistance mécanique',
    params_base: ['gamma_d_max_avg', 'w_opt_avg'],
    note: 'H1 uniquement pour les modèles ML (données insuffisantes H2/H3)',
  },
  {
    id: 'insitu',
    label: 'In-situ & pressiométrique',
    lucideIcon: 'drill',
    description: 'Rd (dynamique), NSPT, Cu, Rd MPa — essais en place',
    params_base: ['nspt_avg', 'cu_avg'],
  },
]
```

### 3.2 Renommer "Horizon KED" → "Horizon"

```typescript
// thematic-panel.ts — renderPanel() lignes 247–252

// AVANT
<label class="thematic-label" for="thematicHorizon">HORIZON KED</label>

// APRÈS
<label class="thematic-label" for="thematicHorizon">HORIZON</label>
```

Masquer horizon pour les sources sans multi-horizon :

```typescript
private updateHorizonVisibility(source: ThematicSource): void {
  const container = this.elements.thematicHorizonSelect?.parentElement
  if (!container) return

  // VfS = pas d'horizon (VBS surface uniquement)
  // base = pas d'horizon KED
  const showHorizon = !['base', 'l3_vfs'].includes(source)
  container.style.display = showHorizon ? '' : 'none'
}

// Warning RK H2 dégradé (données depuis l'API, pas hardcodées)
private checkRkH2Warning(source: ThematicSource, param: string, horizon: string): void {
  if (source !== 'l2a_rk' || horizon !== 'H2') return

  const model = this.modelStatusCache?.find(m => m.id === 'L2a_RK')
  const warnings = model?.warnings ?? []
  const h2Warning = warnings.find(w => w.includes('H2'))

  if (h2Warning) {
    this.showInlineWarning(h2Warning)
  }
}
```

**Critère de validation Phase 3 :**
- Label "HORIZON" (sans "KED") dans le DOM
- Sélecteur horizon masqué si source = `base` ou `l3_vfs`
- 4 catégories dans le dropdown (couverture + 3 familles scientifiques)
- Warning RK H2 apparaît depuis les données API (pas d'un string hardcodé)

---

## PHASE 4 — Onglet "Modèles ML" (Expert Scientifique)

> Durée estimée : 2 jours  
> Fichier cible : `ui/src/scientific-drawer.ts` — tab `ml`  
> Principe : **ARCH-01** (API seule) + **ARCH-02** (job queue)

### 4.1 Panneau ML : tableau dynamique depuis `/ai/models/status`

```typescript
// Dans scientific-drawer.ts, remplacer loadMlPanel() (actuellement "Prêt.")

async function loadMlPanel(): Promise<void> {
  const panel = document.getElementById('scientificPanel-ml')
  if (!panel) return

  panel.innerHTML = buildMlPanelSkeleton()
  await refreshMlPanel()
}

async function refreshMlPanel(): Promise<void> {
  const panel = document.getElementById('scientificPanel-ml')
  if (!panel) return

  try {
    const resp = await fetchWithAuth(`${getApiBase()}/ai/models/status`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = (await resp.json()) as { models: ModelStatus[] }
    renderMlTable(panel, data.models)
  } catch (err) {
    panel.querySelector('#mlStatusError')!.textContent =
      `Impossible de charger le statut des modèles: ${err}`
  }
}

function renderMlTable(panel: HTMLElement, models: ModelStatus[]): void {
  const tbody = panel.querySelector<HTMLElement>('#mlModelsBody')
  if (!tbody) return

  tbody.innerHTML = models.map(model => {
    // ARCH-01 : chaque valeur vient de model.metrics (API), jamais hardcodée
    const rmseVbs = model.metrics?.['vbs_h1']?.loo_rmse
    const rmseCell = rmseVbs != null
      ? `${rmseVbs.toFixed(2)} ${model.id === 'L1_KED_H' ? 'g/100g' : ''}`
      : '—'

    const statusBadge = {
      ready:        '<span class="badge badge--ready">Prêt</span>',
      partial:      '<span class="badge badge--partial">Partiel</span>',
      not_computed: '<span class="badge badge--pending">Non calculé</span>',
      running:      '<span class="badge badge--running">En cours</span>',
    }[model.status] ?? '<span class="badge">—</span>'

    const warnings = model.warnings?.length
      ? `<div class="model-warnings">
           <i data-lucide="alert-triangle" class="icon-sm"></i>
           ${model.warnings.join(' | ')}
         </div>`
      : ''

    return `
    <tr data-model-id="${model.id}">
      <td>
        <strong>${model.label}</strong><br>
        <code class="method-tag">${model.method_db}</code>
        ${warnings}
      </td>
      <td>${statusBadge}</td>
      <td>${model.n_params ?? '—'}</td>
      <td>${model.n_mailles?.toLocaleString('fr-FR') ?? '—'}</td>
      <td>${rmseCell}</td>
      <td>
        <button class="btn-sm btn-outline" data-action="recompute" data-model="${model.id}"
          ${model.status === 'running' ? 'disabled' : ''}>
          <i data-lucide="refresh-cw"></i>
          ${model.status === 'not_computed' ? 'Calculer' : 'Recalculer'}
        </button>
      </td>
    </tr>`
  }).join('')

  // Réactiver les icônes Lucide après injection HTML
  if (typeof lucide !== 'undefined') lucide.createIcons()
}

function buildMlPanelSkeleton(): string {
  return `
  <div class="ml-jobs-panel">
    <div class="panel-header">
      <h3><i data-lucide="cpu"></i> Pipeline de calcul L1–L4</h3>
      <button id="mlRefreshBtn" class="btn-sm btn-outline">
        <i data-lucide="refresh-cw"></i> Rafraîchir
      </button>
    </div>

    <p id="mlStatusError" class="error-msg" style="display:none"></p>

    <table class="models-status-table">
      <thead>
        <tr>
          <th>Modèle</th>
          <th>Statut</th>
          <th>Paramètres</th>
          <th>Mailles</th>
          <th>LOO-RMSE VBS·H1</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="mlModelsBody">
        <tr><td colspan="6">Chargement...</td></tr>
      </tbody>
    </table>

    <!-- Console progression — visible uniquement quand un job est actif -->
    <div id="mlJobConsole" class="job-console" style="display:none">
      <div class="console-header">
        <i data-lucide="terminal"></i>
        <span id="consoleJobLabel">Job en cours</span>
        <button id="consoleCancelBtn" class="btn-sm btn-danger">
          <i data-lucide="x-circle"></i> Annuler
        </button>
      </div>
      <pre id="consoleOutput" class="console-output">En attente...</pre>
      <div class="progress-bar-wrapper">
        <div id="progressFill" class="progress-fill" style="width:0%"></div>
        <span id="progressEta" class="progress-eta"></span>
      </div>
    </div>
  </div>`
}
```

### 4.2 Déclenchement d'un job via la queue (ARCH-02)

```typescript
// Handler du bouton "Calculer / Recalculer"
async function handleRecomputeClick(modelId: string): Promise<void> {
  const jobTypeMap: Record<string, string> = {
    L1_KED_H: 'ked_recompute',
    L2a_RK:   'rk_recompute',
    L2b_BLUP: 'blup_recompute',
    L3_VFS:   'vfs_extract',
    L4_MTGP:  'mtgp_recompute',
  }
  const jobType = jobTypeMap[modelId]
  if (!jobType) return

  // POST → le backend insère dans ai_jobs_queue (ARCH-02, pas de process spawn)
  const resp = await fetchWithAuth(`${getApiBase()}/ai/jobs/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_type: jobType, requested_by: 'expert-panel' }),
  })

  if (!resp.ok) {
    showError(`Impossible d'enqueuer le job : HTTP ${resp.status}`)
    return
  }

  const { job_id } = (await resp.json()) as { job_id: string }
  showConsole(modelId)
  startJobPolling(job_id)
}

// Polling toutes les 3s — simple setInterval (pas WebSocket requis)
function startJobPolling(jobId: string): void {
  const interval = setInterval(async () => {
    const resp = await fetchWithAuth(`${getApiBase()}/ai/jobs/${jobId}`)
    if (!resp.ok) return

    const job = (await resp.json()) as JobStatus
    appendConsoleLog(job.logs ?? '')

    const fill = document.getElementById('progressFill')
    if (fill && job.progress_pct != null) {
      fill.style.width = `${job.progress_pct}%`
    }

    if (['done', 'failed', 'cancelled'].includes(job.status)) {
      clearInterval(interval)
      hideConsole()
      // Rafraîchir le tableau depuis l'API (ARCH-01)
      await refreshMlPanel()
    }
  }, 3000)
}
```

### 4.3 Endpoints backend Rust à créer

```
POST /ai/jobs/enqueue         → INSERT INTO ai_jobs_queue (status='pending')
                                 Retourne : { "job_id": "uuid" }

GET  /ai/jobs/{id}            → SELECT FROM ai_jobs_queue WHERE id = ?
                                 Retourne : { status, logs, progress_pct, ... }

POST /ai/jobs/{id}/cancel     → UPDATE ai_jobs_queue SET status='cancelled' WHERE id = ?
```

**Critère de validation Phase 4 :**

```bash
# Enqueue un job
curl -X POST "http://localhost:8000/ai/jobs/enqueue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"job_type":"ked_recompute","requested_by":"test"}'
# → { "job_id": "uuid-..." }

# Vérifier le statut
JOB_ID="..."
curl "http://localhost:8000/ai/jobs/$JOB_ID" -H "Authorization: Bearer $TOKEN"
# → { "status": "pending"|"running"|"done", "progress_pct": ..., "logs": "..." }
```

---

## PHASE 5 — Visualisations 3D (Expert Scientifique)

> Durée estimée : 3 jours  
> Fichier cible : nouveau tab `viz3d` dans `scientific-drawer.ts`

### 5.1 Format de restitution par archetype

| Archetype | Format | Justification |
|-----------|--------|--------------|
| **A — Cube Plotly** | HTML dans `<iframe>` | Déjà en HTML Plotly, interactif WebGL |
| **B — Strati Maps** | `<img>` PNG + zoom modal | Statique, rapide, qualité 300dpi |
| **C — Fence Diagram** | SVG inline | Vectoriel, zoomable, hover CSS possible |
| **D — Isovaleurs** | `<img>` PNG + zoom modal | 6 panneaux complexes, PNG 300dpi optimal |

### 5.2 Nouveau tab "Visualisations 3D"

```typescript
// Ajouter dans scientific-drawer.ts
type ScientificTabId = 'eda' | 'corr' | 'variogram' | 'validation' | 'ml' | 'compare' | 'viz3d'

// HTML du tab
function buildViz3dPanel(): string {
  return `
  <div class="viz3d-panel">
    <!-- CONTRÔLES -->
    <div class="viz3d-controls">
      <div class="ctrl-group">
        <label class="ctrl-label">Paramètre</label>
        <select id="viz3dParam" class="ctrl-select">
          <optgroup label="Argilosité / Plasticité">
            <option value="vbs">VBS (g/100g)</option>
            <option value="ip">IP (%)</option>
            <option value="wl">WL (%)</option>
            <option value="wp">WP (%)</option>
            <option value="eg">Eg (%)</option>
          </optgroup>
          <optgroup label="Portance / Compactage">
            <option value="cbr_95">CBR 95% (%)</option>
            <option value="gamma_d">γd max (t/m³)</option>
            <option value="w_opt">wopt (%)</option>
          </optgroup>
          <optgroup label="In-situ">
            <option value="rd_mpa">Rd (MPa)</option>
          </optgroup>
        </select>
      </div>

      <div class="ctrl-group">
        <label class="ctrl-label">Type de vue</label>
        <div class="archetype-selector" role="radiogroup">
          <label class="arch-option active" data-arch="A">
            <i data-lucide="box"></i>
            <span>Cube 3D</span>
            <small>Plotly interactif</small>
            <input type="radio" name="archetype" value="A" checked hidden>
          </label>
          <label class="arch-option" data-arch="B">
            <i data-lucide="columns"></i>
            <span>Strati H1/H2/H3</span>
            <small>Colonnes comparatives</small>
            <input type="radio" name="archetype" value="B" hidden>
          </label>
          <label class="arch-option" data-arch="C">
            <i data-lucide="scissors"></i>
            <span>Coupe Fence</span>
            <small>Section transversale</small>
            <input type="radio" name="archetype" value="C" hidden>
          </label>
          <label class="arch-option" data-arch="D">
            <i data-lucide="contour"></i>
            <span>Isovaleurs</span>
            <small>Surfaces critiques</small>
            <input type="radio" name="archetype" value="D" hidden>
          </label>
        </div>
      </div>

      <div class="ctrl-actions">
        <button id="viz3dGenerate" class="btn btn-primary">
          <i data-lucide="play"></i> Afficher
        </button>
        <a id="viz3dDownload" class="btn btn-outline" style="display:none" download>
          <i data-lucide="download"></i> PNG 300dpi
        </a>
      </div>
    </div>

    <!-- FENCE CONTROLS — visible uniquement si arch=C -->
    <div id="fenceControls" class="fence-controls" hidden>
      <div class="fence-fields">
        <div>
          <label>Point A — longitude</label>
          <input type="number" id="fenceLon1" min="-0.2" max="1.9" step="0.001"
            placeholder="ex: 0.845">
          <label>latitude</label>
          <input type="number" id="fenceLat1" min="6.0" max="11.2" step="0.001"
            placeholder="ex: 9.234">
        </div>
        <div>
          <label>Point B — longitude</label>
          <input type="number" id="fenceLon2" min="-0.2" max="1.9" step="0.001"
            placeholder="ex: 1.124">
          <label>latitude</label>
          <input type="number" id="fenceLat2" min="6.0" max="11.2" step="0.001"
            placeholder="ex: 8.512">
        </div>
        <div>
          <label>Pas d'interpolation</label>
          <input type="number" id="fenceNPoints" value="100" min="20" max="500">
          <span class="hint">points le long de la coupe</span>
        </div>
      </div>
      <button id="fenceDrawMode" class="btn btn-outline">
        <i data-lucide="pencil"></i> Tracer sur la carte
      </button>
    </div>

    <!-- ZONE DE RÉSULTAT -->
    <div id="viz3dOutput" class="viz3d-output" role="img" aria-live="polite">
      <div class="viz3d-placeholder">
        <i data-lucide="image"></i>
        <p>Sélectionnez un paramètre et un type de vue, puis cliquez "Afficher"</p>
      </div>
    </div>
  </div>`
}
```

### 5.3 Logique de rendu — backend-first, zéro HEAD request (ARCH-03)

```typescript
async function generateViz3d(param: string, arch: string): Promise<void> {
  const output = document.getElementById('viz3dOutput')!
  output.innerHTML = `<div class="spinner"><i data-lucide="loader-2" class="spin"></i>
    Chargement...</div>`
  lucide.createIcons()

  try {
    if (arch === 'A') {
      // Plotly HTML : l'URL est prévisible et nginx la sert directement
      const htmlUrl = `/exports/3d/${param}_A_cube_plotly.html`
      output.innerHTML = `<iframe src="${htmlUrl}" class="plotly-frame"
        title="Cube 3D ${param.toUpperCase()}"></iframe>`
      return
    }

    // ARCH-03 : demander au backend si le cache existe, jamais de HEAD depuis le front
    const assetResp = await fetchWithAuth(
      `${getApiBase()}/ai/3d/asset?param=${param}&archetype=${arch}`
    )
    const asset = (await assetResp.json()) as { cached: boolean; url?: string; job_id?: string }

    if (asset.cached && asset.url) {
      renderStaticAsset(output, asset.url, param, arch)
      return
    }

    // Génération en cours — le backend a enqueuê le job (ARCH-02)
    if (asset.job_id) {
      output.innerHTML = `<div class="generation-msg">
        <i data-lucide="cpu"></i>
        Génération en cours (peut prendre 30–90 secondes)...
        <progress id="genProgress"></progress>
      </div>`
      await pollViz3dJob(asset.job_id, output, param, arch)
    }
  } catch (err) {
    output.innerHTML = `<div class="error-msg">
      <i data-lucide="alert-circle"></i> Erreur: ${err}
    </div>`
    lucide.createIcons()
  }
}

function renderStaticAsset(
  container: HTMLElement,
  url: string,
  param: string,
  arch: string,
): void {
  const archLabel: Record<string, string> = {
    B: 'Cartes stratigraphiques H1/H2/H3',
    C: 'Coupe transversale (Fence)',
    D: 'Isovaleurs',
  }
  container.innerHTML = `
    <figure class="viz3d-figure">
      <img src="${url}" alt="${param.toUpperCase()} — ${archLabel[arch]}"
        class="viz3d-img" loading="lazy"
        onclick="document.getElementById('viz3dDownload').href='${url}'">
      <figcaption>
        <strong>${param.toUpperCase()}</strong> — ${archLabel[arch]}
        <a href="${url}" download class="btn btn-outline btn-sm" id="viz3dDownload">
          <i data-lucide="download"></i> PNG 300dpi
        </a>
      </figcaption>
    </figure>`
  lucide.createIcons()
}

async function pollViz3dJob(
  jobId: string,
  container: HTMLElement,
  param: string,
  arch: string,
): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const resp = await fetchWithAuth(`${getApiBase()}/ai/jobs/${jobId}`)
      const job = (await resp.json()) as JobStatus & { result_url?: string; result_svg?: string }

      const progress = container.querySelector('progress')
      if (progress && job.progress_pct != null) {
        (progress as HTMLProgressElement).value = job.progress_pct
        ;(progress as HTMLProgressElement).max = 100
      }

      if (job.status === 'done') {
        clearInterval(interval)
        if (arch === 'C' && job.result_svg) {
          // SVG inline pour fence : zoomable via CSS/pan
          container.innerHTML = `
            <div class="fence-svg-wrapper" id="fenceSvgWrap">
              ${job.result_svg}
            </div>
            <div class="fence-actions">
              <button onclick="exportSvgToPng('fenceSvgWrap','${param}_fence')"
                class="btn btn-outline btn-sm">
                <i data-lucide="download"></i> Exporter PNG
              </button>
            </div>`
          lucide.createIcons()
        } else if (job.result_url) {
          renderStaticAsset(container, job.result_url, param, arch)
        }
        resolve()
      } else if (['failed', 'cancelled'].includes(job.status)) {
        clearInterval(interval)
        container.innerHTML = `<div class="error-msg">
          <i data-lucide="x-circle"></i>
          Job ${job.status} : ${job.error_msg ?? '—'}
        </div>`
        lucide.createIcons()
        resolve()
      }
    }, 3000)
  })
}
```

### 5.4 Mode dessin fence sur la carte Leaflet

```typescript
// Fichier : ui/src/main.ts — exposer la fonction au drawer
;(window as any).enableFenceDrawMode = function onEnableFenceDrawMode(): void {
  const map = (window as any).__atlasLeafletMap as L.Map
  if (!map) return

  const points: [number, number][] = []
  const drawLayer = L.layerGroup().addTo(map)

  map.getContainer().style.cursor = 'crosshair'
  map.getContainer().title = 'Cliquez 2 points pour définir la coupe'

  const onClick = (e: L.LeafletMouseEvent) => {
    points.push([e.latlng.lng, e.latlng.lat])

    L.circleMarker(e.latlng, {
      radius: 6, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9,
    })
      .bindTooltip(`Point ${points.length === 1 ? 'A' : 'B'}`)
      .addTo(drawLayer)

    if (points.length === 2) {
      L.polyline([points[0].slice().reverse() as L.LatLngExpression,
                  points[1].slice().reverse() as L.LatLngExpression], {
        color: '#dc2626', weight: 2, dashArray: '6,4',
      }).addTo(drawLayer)

      // Remplir les champs du panneau Expert Scientifique
      const set = (id: string, v: number) => {
        const el = document.getElementById(id) as HTMLInputElement | null
        if (el) el.value = String(v.toFixed(6))
      }
      set('fenceLon1', points[0][0]); set('fenceLat1', points[0][1])
      set('fenceLon2', points[1][0]); set('fenceLat2', points[1][1])

      map.off('click', onClick)
      map.getContainer().style.cursor = ''
      map.getContainer().title = ''

      // Confirmation visuelle
      const toast = document.createElement('div')
      toast.className = 'toast toast--success'
      toast.innerHTML = '<i data-lucide="check-circle"></i> Coupe définie. Cliquez "Afficher".'
      document.body.appendChild(toast)
      lucide.createIcons()
      setTimeout(() => toast.remove(), 3000)
    }
  }

  map.on('click', onClick)
}
```

**Critère de validation Phase 5 :**

```bash
# Test : PNG statique servi depuis nginx
curl -I "http://localhost:1420/exports/3d/vbs_B_strati_maps.png"
# → HTTP/1.1 200 OK, Content-Type: image/png

# Test : endpoint cache-aware
curl "http://localhost:8000/ai/3d/asset?param=vbs&archetype=B" -H "Authorization: Bearer $TOKEN"
# → { "cached": true, "url": "/exports/3d/vbs_B_strati_maps.png" }

# Test : génération Fence (param non encore en cache)
curl -X POST "http://localhost:8000/ai/jobs/enqueue" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"job_type":"3d_render","payload":{"param":"vbs","archetype":"C",
       "fence_coords":[{"lon":0.845,"lat":9.234},{"lon":1.124,"lat":8.512}]}}'
# → { "job_id": "uuid-..." }
```

---

## PHASE 6 — Tableau Métriques Live (ARCH-01)

> Durée estimée : 1 jour  
> Principe fondamental : **zéro constante hardcodée**

### 6.1 Panel métriques — consomme exclusivement `/ai/models/status`

```typescript
async function loadValidationPanel(): Promise<void> {
  const panel = document.getElementById('scientificPanel-validation')
  if (!panel) return

  try {
    const resp = await fetchWithAuth(`${getApiBase()}/ai/models/status`)
    const data = (await resp.json()) as { models: ModelStatus[] }
    panel.innerHTML = renderMetricsPanel(data.models)
    lucide.createIcons()
  } catch {
    panel.innerHTML = `<p class="error-msg">
      <i data-lucide="wifi-off"></i>
      Impossible de charger les métriques depuis /ai/models/status
    </p>`
    lucide.createIcons()
  }
}

function renderMetricsPanel(models: ModelStatus[]): string {
  const l1  = models.find(m => m.id === 'L1_KED_H')
  const l2a = models.find(m => m.id === 'L2a_RK')
  const l2b = models.find(m => m.id === 'L2b_BLUP')

  // Construire le tableau UNIQUEMENT à partir des données API
  const params = ['vbs', 'ip', 'wl', 'wp', 'eg']
  const horizons = ['h1', 'h2', 'h3']

  const rows = params.map(p => {
    const cells = horizons.flatMap(h => {
      const kedRmse = l1?.metrics?.[`${p}_${h}`]?.loo_rmse
      const rkRmse  = l2a?.metrics?.[`${p}_${h}`]?.loo_rmse
      const rkDeg   = h === 'h2' && rkRmse != null && kedRmse != null && rkRmse > kedRmse * 1.4
      return [
        `<td class="${kedRmse != null && (rkRmse == null || kedRmse <= rkRmse) ? 'best' : ''}">
          ${kedRmse?.toFixed(2) ?? '—'}
         </td>`,
        `<td class="${rkDeg ? 'degraded' : rkRmse != null && (kedRmse == null || rkRmse < kedRmse) ? 'best' : ''}">
          ${rkRmse?.toFixed(2) ?? '—'}${rkDeg ? ' ⚠' : ''}
         </td>`,
      ]
    }).join('')

    return `<tr>
      <td><strong>${p.toUpperCase()}</strong></td>
      ${cells}
    </tr>`
  }).join('')

  // Variance reduction BLUP depuis l'API
  const blupVarRed = l2b?.metrics?.['variance_reduction_pct']
  const blupSection = blupVarRed != null
    ? `<div class="blup-summary">
         <i data-lucide="trending-down"></i>
         <strong>L2b Fusion BLUP</strong> — réduction de variance moyenne :
         <strong>${blupVarRed.toFixed(1)}%</strong>
         (σ²_fusion ≤ min(σ²_KED, σ²_RK) sur 100% des mailles)
       </div>`
    : `<div class="blup-summary blup-na">
         <i data-lucide="clock"></i> L2b Fusion BLUP — données non disponibles
       </div>`

  // Avertissements depuis l'API
  const l2aWarnings = l2a?.warnings?.map(w =>
    `<li><i data-lucide="alert-triangle"></i> ${w}</li>`
  ).join('') ?? ''

  return `
  <div class="metrics-panel">
    <h3><i data-lucide="bar-chart-2"></i> LOO-RMSE par modèle, paramètre et horizon</h3>
    <p class="metrics-source">
      <i data-lucide="database"></i>
      Source : <code>atlas.ai_interpolation_runs</code>
      — mis à jour <span id="metricsUpdatedAt">—</span>
    </p>

    <table class="rmse-table">
      <thead>
        <tr>
          <th rowspan="2">Paramètre</th>
          <th colspan="6">LOO-RMSE (unité paramètre)</th>
        </tr>
        <tr>
          <th>L1 H1</th><th>L2a H1</th>
          <th>L1 H2</th><th>L2a H2</th>
          <th>L1 H3</th><th>L2a H3</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="7">
            <span class="legend-best">Meilleure valeur</span> par ligne ·
            <span class="legend-deg">⚠ RK H2 dégradé</span> (covariables surface ↓ pouvoir prédictif en profondeur)
          </td>
        </tr>
      </tfoot>
    </table>

    ${blupSection}

    <ul class="warnings-list">${l2aWarnings}</ul>
  </div>`
}
```

**Critère de validation Phase 6 :**
- Aucun chiffre RMSE dans le code TypeScript compilé (`grep -r "2\.94\|9\.78\|47\.9" dist/`)
- Tableau se met à jour après un recalcul sans rebuild de l'app
- Cellules RK H2 marquées `degraded` si et seulement si l'API signale le warning

---

## RÉCAPITULATIF — Plan d'exécution par blocs logiques

### Bloc 0 : Connexion API (J0, 30 min) — **À faire en premier, débloque tout**

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Changer DATABASE_URL → host.docker.internal:5433 | `docker-compose.yml` | 5 min | — |
| Rebuild api-geo | docker compose | 20 min | curl vbs_ked_h1 → 29 407 |
| **Commit Bloc 0** | git | — | L1+L2a visibles sans autre modif |

> Après ce bloc, L1 KED-H et L2a RK sont automatiquement visibles dans l'UI existante.
> Les blocs 1+ ne font qu'exposer L2b/L3/L4 et améliorer l'UI.

### Bloc 1 : Backend Rust (J1–J3) — feu vert requis pour tout le reste

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Étendre enum `ThematicParameter` | `src/routes/thematic.rs` | 4h | curl vbs_blup_h1 → 200 |
| Créer `GET /ai/models/status` | `src/routes/ai.rs` | 4h | JSON avec métriques réelles |
| Créer `GET /ai/3d/asset` (cache-aware) | `src/routes/ai.rs` | 3h | cached:true pour VBS-B |
| Créer table `ai_jobs_queue` | SQL migration | 1h | SELECT * OK |
| Créer `POST /ai/jobs/enqueue` | `src/routes/jobs.rs` | 3h | job_id retourné |
| Créer `GET /ai/jobs/{id}` | `src/routes/jobs.rs` | 2h | status polling |
| Nginx : exposer `/exports/3d/` | `nginx.conf` | 1h | curl 200 PNG |
| **Commit Bloc 1** | git | — | tests curl passent |

### Bloc 2 : Frontend — Thematic Panel (J4–J5)

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Nouveau type `ThematicSource` | `thematic-types.ts` | 2h | TypeScript compile |
| HTML dropdown L1–L4 (Lucide, zéro emoji) | `thematic-panel.ts` | 3h | 6 options visibles |
| `syncSourceAvailability()` | `thematic-panel.ts` | 2h | Options disabled dynamiques |
| `updateModelBadge()` (API only) | `thematic-panel.ts` | 2h | Badge affiche RMSE API |
| 3 familles scientifiques | `thematic-types.ts` | 3h | Catégories correctes |
| Label "HORIZON" (sans KED) | `thematic-panel.ts` | 30min | DOM corrigé |
| Masquage horizon pour VfS/base | `thematic-panel.ts` | 1h | Horizon caché |
| `getParametersForObjectifAndSource()` | `thematic-types.ts` | 4h | Params corrects par source |
| **Commit Bloc 2** | git | — | UI fonctionnelle, build OK |

### Bloc 3 : Expert Scientifique — Jobs ML (J6–J7)

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Tab `ml` : `renderMlTable()` depuis API | `scientific-drawer.ts` | 4h | Tableau dynamique |
| Bouton "Calculer" → `POST /ai/jobs/enqueue` | `scientific-drawer.ts` | 3h | job_id en réponse |
| Console de progression + polling | `scientific-drawer.ts` | 3h | Logs apparaissent |
| Bouton Annuler | `scientific-drawer.ts` | 1h | status=cancelled |
| **Commit Bloc 3** | git | — | Job round-trip OK |

### Bloc 4 : Expert Scientifique — Visualisations 3D (J8–J10)

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Tab `viz3d` : sélecteurs + archetype radio | `scientific-drawer.ts` | 3h | UI visible |
| Archetype A : iframe Plotly | `scientific-drawer.ts` | 2h | HTML interactif chargé |
| Archetypes B/D : `GET /ai/3d/asset` + img | `scientific-drawer.ts` | 3h | PNG affiché |
| Archetype C : fence coords + polling SVG | `scientific-drawer.ts` | 4h | SVG inline |
| Mode dessin Leaflet | `main.ts` | 3h | Click 2pts → coords remplies |
| Export PNG depuis SVG | `scientific-drawer.ts` | 2h | Fichier téléchargé |
| **Commit Bloc 4** | git | — | 4 archetypes fonctionnels |

### Bloc 5 : Métriques & Tests E2E (J11–J13)

| Tâche | Fichier | Durée | Validation |
|-------|---------|-------|-----------|
| Tab `validation` : `renderMetricsPanel()` depuis API | `scientific-drawer.ts` | 3h | Zéro hardcode |
| Vérification `grep` aucun RMSE hardcodé | CI / terminal | 30min | Grep vide |
| Tests E2E manuels : 5 sources × 3 catégories × 3 horizons | navigateur | 2h | Aucune erreur console |
| Tests E2E jobs : enqueue → poll → done | navigateur | 1h | Round-trip complet |
| **Commit Bloc 5** | git | — | Build propre |

---

## CONTRAINTES TECHNIQUES STRICTES

- **Lucide icons uniquement** : `<i data-lucide="nom-icone"></i>` suivi de `lucide.createIcons()`
  Zéro emoji dans le HTML/TS de l'UI. Zéro unicode textuel comme icône.
- **DB port 5433 exclusivement** : `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean`
- **Zéro hardcoding de métriques** dans le frontend (ARCH-01)
- **Zéro `std::process::Command`** pour lancer des scripts depuis le serveur web (ARCH-02)
- **Zéro requête HEAD** depuis le frontend pour détecter des fichiers (ARCH-03)
- **Zéro Phase 0 manuelle** — l'UI est le point de déclenchement (ARCH-04)
- **Zéro UPDATE SQL massif** pour renommer des méthodes — mapping dans le code (ARCH-05)

---

## RISQUES & MITIGATIONS

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| `ai_interpolation_runs` ne contient pas les LOO-RMSE pour certains paramètres (colonne `metrics` vide) | Tableau affiche `—` sans planter | Prévu dans le code : `loo_rmse?.toFixed(2) ?? '—'` |
| Worker Python non démarré → jobs restent `pending` indéfiniment | UX dégradée | Afficher `status: pending` + doc pour démarrer le worker |
| Génération 3D fence > 90s (matplotlib + kriging) | Timeout UX | Progress bar visible, bouton Annuler opérationnel |
| MTGP GPflow — O(N³) si recalcul sur N=29407 | Crash OOM | Job type `mtgp_recompute` avec priority=1 (haute) + queue solo |
| VfS : couverture partielle 24 038/29 407 mailles | Carte incomplète | Warning clair dans badge + tooltip "mailles sans données Sentinel-2" |
| Rebuild binaire Rust requis après extension enum | Downtime 5 min | Planifier en dehors des heures d'usage |

---

## CRITÈRES D'ACCEPTATION GLOBAUX

```bash
# A1 : Aucune valeur RMSE hardcodée dans le bundle JS
grep -r "2\.94\|9\.78\|47\.9\|2\.48\|12\.79" dist/ && echo "FAIL" || echo "OK"

# A2 : Paramètre L2b disponible via thematic
curl "http://localhost:8000/thematic/data?parameter=vbs_blup_h1&include_geometry=false" \
  | python -c "import sys,json;d=json.load(sys.stdin);print('OK' if d['statistics']['count']>0 else 'FAIL')"

# A3 : Models status renvoie données réelles (pas hardcodées)
curl "http://localhost:8000/ai/models/status" \
  | python -c "import sys,json;d=json.load(sys.stdin);
m=next(x for x in d['models'] if x['id']=='L1_KED_H')
assert m['n_mailles']==29407, 'FAIL mailles'
print('OK')"

# A4 : PNG 3D statique accessible
curl -s -o /dev/null -w "%{http_code}" "http://localhost:1420/exports/3d/vbs_B_strati_maps.png"
# → 200

# A5 : Job queue round-trip
TOKEN="..."
JID=$(curl -s -X POST "http://localhost:8000/ai/jobs/enqueue" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"job_type":"ked_recompute"}' | python -c "import sys,json;print(json.load(sys.stdin)['job_id'])")
curl -s "http://localhost:8000/ai/jobs/$JID" -H "Authorization: Bearer $TOKEN" \
  | python -c "import sys,json;d=json.load(sys.stdin);print('OK' if d['status'] in ['pending','running','done'] else 'FAIL')"
```

---

*Document de référence — Révision architecturale 2026-06-04*  
*Remplace la version du 2026-06-04 (itération 1) qui contenait les anti-patterns ARCH-01 à ARCH-05*  
*Validé contre : REGLES_METIER.md, REGLE_BONNE_PRATIQUE_MEMOIRE.MD, standards Intrepid Core*
