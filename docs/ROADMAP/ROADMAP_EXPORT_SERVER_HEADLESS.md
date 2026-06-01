	# Roadmap — Moteur d'Export Serveur Headless
## Atlas Géotechnique Togo — Intrepid Core Engineering

> **Phrase fondatrice** : *Atlas Engine Headless est un moteur de rendu déterministe, piloté par l'API Atlas, produisant des sorties cartographiques reproductibles, sans aucune dépendance au navigateur ou au viewport.*

**Version** : 1.0  
**Date** : 2026-06-01  
**Statut** : Proposition — prêt pour implémentation  
**Auteur** : Intrepid Core Engineering  

---

## 0. Contexte et motivation

### 0.1 Moteur actuel (frontend-only)

Le moteur d'export actuel (`atlas_reclone/ui/src/export/`) produit des cartes de haute qualité cartographique mais souffre de trois limites structurelles :

| Problème | Impact | Fichier source |
|----------|--------|----------------|
| Attente fixe 3 s par carte (tiles) | ~25 min pour 490 cartes (70 ADM × 7 thématiques) | `ui/src/export/capture-utils.ts:waitForTiles()` |
| Exécution séquentielle sans parallélisme | Impossible de générer plusieurs cartes à la fois | `ui/src/export/export-atlas-dialog.ts:runBatchExportInternal()` |
| html2canvas capte l'état visible de la page | Capture corrompue si l'utilisateur interagit pendant l'export | `ui/src/export/capture-utils.ts:captureLeafletMap()` |

### 0.2 Objectif du moteur serveur

Ajouter un **mode Impression HQ (serveur)** capable de :
- Produire les mêmes cartes visuellement — même style, même palette, même cadre A4
- **10 à 50× plus rapide** (cible : 200–500 ms/carte au lieu de 5–8 s)
- Sans dépendance au viewport ni à un navigateur en ligne
- De façon **déterministe** et **reproductible** (même entrée → même sortie pixel-parfaite)
- En mode **asynchrone** avec suivi de statut (job queue)

### 0.3 Principe de coexistence — ne jamais déconnecter le moteur actuel

```
Phase d'implémentation :
  Moteur frontend (actuel)  ←─── toujours actif, non modifié
  Moteur serveur (nouveau)  ←─── déployé en parallèle

Phase de bascule (après validation serveur) :
  UI : toggle "Web (Rapide)" ↔ "Impression HQ"
  Le moteur frontend reste disponible comme fallback
```

**Règle absolue** : aucune modification des fichiers `ui/src/export/` ne sera faite jusqu'à la validation complète du moteur serveur.

---

## 1. Choix technologique — Analyse comparative

### 1.1 Option A : Puppeteer headless (Phase 1 recommandée)

**Principe** : Exécuter Chrome en mode headless. Le worker charge la page UI Atlas dans un onglet invisible, navigue vers la zone souhaitée, puis capture l'écran.

**Avantages** :
- Réutilise **100% du code frontend existant** (ExportQuickDialog, BoundsOptimizer, etc.)
- Fidélité visuelle parfaite — exactement ce que l'utilisateur voit
- Implémentation rapide (MVP en 3-5 jours)
- Gestion des tiles, des légendes, du cadre A4 : déjà dans le frontend

**Inconvénients** :
- Chrome headless ≈ 300 MB dans le conteneur Docker
- ~500 ms–2 s/carte (amélioration ×3–5 par rapport au frontend)
- Dépend du serveur UI en cours d'exécution

**Stack** : Node.js 20 + Puppeteer 22 + Docker

### 1.2 Option B : MapLibre GL Node (Phase 2 — production)

**Principe** : Utiliser le binding natif Node.js de MapLibre GL pour rendre les cartes sans navigateur. MapLibre GL Native tourne via un contexte OpenGL offscreen (EGL/Mesa sur Linux).

**Avantages** :
- **50–200 ms/carte** (×20–50 vs frontend)
- Image Docker légère (~80 MB sans Chrome)
- Aucune dépendance UI — le worker est autonome
- Styles GL JSON portables, versionables dans le repo
- Compatible avec l'écosystème Rust (appel depuis api-geo via `std::process::Command`)

**Inconvénients** :
- Nécessite de translater les styles Leaflet → styles MapLibre GL JSON
- Dépendance à Mesa/EGL pour le rendu GPU offscreen sur Linux
- Plus de travail initial (3–5 jours supplémentaires vs Puppeteer)

**Stack** : Node.js 20 + `@maplibre/maplibre-gl-node` 5.x + Docker avec Mesa

### 1.3 Décision recommandée

```
Phase 1 (MVP, 1–2 semaines) : Puppeteer headless
  → Même qualité visuelle garantie
  → Validé rapidement
  → Sert de référence de qualité pour la Phase 2

Phase 2 (Production, 2–3 semaines après Phase 1) : MapLibre GL Node
  → Performance maximale
  → Indépendance totale du viewport
  → Basculer l'UI vers Phase 2 quand les rendus sont validés identiques
```

---

## 2. Architecture cible

### 2.1 Vue d'ensemble des services

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (inchangé)                                        │
│  ui/src/export/export-atlas-dialog.ts                       │
│  ui/src/export/export-quick-dialog.ts                       │
│  Toggle "Web" ↔ "Impression HQ"  [nouveau, minimal]        │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /export/hq
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  API GEO (Rust/Axum)  services/api-geo/src/                 │
│  + endpoint POST /export/hq      [nouveau]                  │
│  + endpoint GET  /export/hq/status/:job_id  [nouveau]       │
│  + endpoint GET  /export/hq/download/:job_id [nouveau]      │
│  Insère job dans atlas.hq_export_jobs                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ pg_notify 'hq_export_jobs'
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ATLAS HEADLESS WORKER (Node.js)  services/atlas-headless/  │
│  Phase 1 : Puppeteer → capture UI                           │
│  Phase 2 : MapLibre GL Node → rendu natif                   │
│  Lit atlas.hq_export_jobs (FOR UPDATE SKIP LOCKED)          │
│  Écrit résultat dans exports/hq/:job_id.{png,pdf}           │
│  Met à jour job status → COMPLETED                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ volume partagé exports/hq/
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  POSTGRESQL (atlas_clean)                                    │
│  + atlas.hq_export_jobs [nouvelle table]                    │
│  + atlas.hq_export_style_cache [cache styles GL]            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Positionnement dans le monorepo

```
atlas_reclone/
├── services/
│   ├── api-geo/src/              ← ajouter hq_export.rs (endpoints)
│   └── atlas-headless/           ← nouveau service (Node.js)
│       ├── package.json
│       ├── src/
│       │   ├── index.ts          ← point d'entrée worker
│       │   ├── worker.ts         ← boucle job queue
│       │   ├── renderer/
│       │   │   ├── puppeteer.ts  ← Phase 1
│       │   │   └── maplibre.ts   ← Phase 2
│       │   ├── frame/
│       │   │   └── composer.ts   ← cadre A4, légende, échelle
│       │   └── styles/
│       │       └── atlas-gl.json ← styles MapLibre GL (Phase 2)
│       └── Dockerfile
├── migrations_post_v1/
│   └── 176_hq_export_jobs.sql    ← nouvelle table DB
└── docker-compose.yml             ← ajouter service atlas-headless
```

---

## 3. Schéma de base de données

### 3.1 Table `atlas.hq_export_jobs`

```sql
-- migrations_post_v1/176_hq_export_jobs.sql
CREATE TABLE atlas.hq_export_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status         text NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  payload        jsonb NOT NULL,           -- paramètres de rendu versionnés
  progress       int NOT NULL DEFAULT 0,  -- 0–100%
  error_message  text,
  result_path    text,                     -- chemin relatif exports/hq/:id.png
  result_mime    text DEFAULT 'image/png',
  requested_by   text,                     -- token subject ou user_id
  engine         text NOT NULL DEFAULT 'puppeteer'
                   CHECK (engine IN ('puppeteer','maplibre')),
  duration_ms    int,                      -- durée réelle de rendu
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON atlas.hq_export_jobs (status, created_at);
CREATE INDEX ON atlas.hq_export_jobs (requested_by, created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_hq_export_jobs
  BEFORE UPDATE ON atlas.hq_export_jobs
  FOR EACH ROW EXECUTE FUNCTION atlas.set_updated_at();
```

### 3.2 Format du payload (versionné)

```json
{
  "payload_version": "1.0",
  "thematic_id": "vbs_ked_h1",
  "adm_level": "adm1",
  "adm_name": "Centrale",
  "grid": "2km",
  "output": {
    "format": "png",
    "dpi": 150,
    "width_px": 2480,
    "height_px": 3508
  },
  "style": {
    "palette": "reds",
    "classification": "quantile",
    "n_classes": 5,
    "show_empty_cells": true,
    "frame_style": "double",
    "mask_mode": "adm_boundary"
  },
  "bbox": {
    "north": 9.15,
    "south": 7.85,
    "east": 1.65,
    "west": 0.35
  }
}
```

---

## 4. Endpoints API Rust (api-geo)

### Fichier de référence : `services/api-geo/src/`

Créer `services/api-geo/src/hq_export.rs` avec 3 handlers :

```rust
// POST /export/hq
// Corps : HqExportRequest (payload JSON ci-dessus)
// Retourne : { job_id: uuid, status: "PENDING" }
pub async fn create_hq_export(
    State(pool): State<PgPool>,
    Json(req): Json<HqExportRequest>,
) -> Result<Json<HqExportResponse>, AppError>

// GET /export/hq/status/:job_id
// Retourne : { job_id, status, progress, engine, duration_ms, error }
pub async fn get_hq_export_status(
    State(pool): State<PgPool>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<HqExportStatus>, AppError>

// GET /export/hq/download/:job_id
// Vérifie status=COMPLETED + ownership
// Stream le fichier PNG/PDF
pub async fn download_hq_export(
    State(pool): State<PgPool>,
    Path(job_id): Path<Uuid>,
) -> Result<Response<Body>, AppError>
```

**Câblage dans `services/api-geo/src/main.rs`** :
```rust
.route("/export/hq", post(hq_export::create_hq_export))
.route("/export/hq/status/:id", get(hq_export::get_hq_export_status))
.route("/export/hq/download/:id", get(hq_export::download_hq_export))
```

---

## 5. Worker Node.js — Phase 1 (Puppeteer)

### 5.1 Algorithme principal (`services/atlas-headless/src/worker.ts`)

```typescript
// Boucle principale
async function runWorker() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  while (true) {
    const job = await claimNextJob(pool);  // FOR UPDATE SKIP LOCKED

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const t0 = Date.now();
    try {
      await updateJobProgress(pool, job.id, 10, 'PROCESSING');

      const page = await browser.newPage();
      await page.setViewport({ width: 2480, height: 3508, deviceScaleFactor: 2 });

      // Naviguer vers la page Atlas avec les paramètres du job
      const url = buildAtlasUrl(job.payload);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
      await updateJobProgress(pool, job.id, 30, 'PROCESSING');

      // Déclencher l'export programmatiquement via window.__atlasExportHQ()
      // (fonction exposée dans le frontend pour le mode headless)
      await page.evaluate((payload) => {
        return window.__atlasExportHQ(payload);
      }, job.payload);
      await updateJobProgress(pool, job.id, 60, 'PROCESSING');

      // Attendre que les tiles soient chargées (détection réelle, pas sleep)
      await waitForTilesLoaded(page);
      await updateJobProgress(pool, job.id, 80, 'PROCESSING');

      // Capture
      const outputPath = path.join(EXPORTS_DIR, `${job.id}.png`);
      await page.screenshot({ path: outputPath, fullPage: false, type: 'png' });
      await page.close();

      const duration = Date.now() - t0;
      await completeJob(pool, job.id, outputPath, duration);
    } catch (err) {
      await failJob(pool, job.id, String(err));
    }
  }
}
```

### 5.2 Fonction d'exposition frontend (minimal, non invasif)

Ajouter dans `ui/src/main.ts` (en dehors de tout composant) :

```typescript
// Exposition pour le worker headless — ne modifie rien au comportement normal
if (typeof window !== 'undefined') {
  (window as any).__atlasExportHQ = async (payload: HqExportPayload) => {
    // Sélectionner ADM + thématique sans interaction utilisateur
    await thematicManager.setThematic(payload.thematic_id);
    await admManager.setAdm(payload.adm_level, payload.adm_name);
    await map.fitBounds(payload.bbox, { animate: false });
    // Attendre le rendu complet
    await waitForMapIdle(map);
    return { ready: true };
  };
}
```

**Fichier de référence** : `ui/src/main.ts` lignes 5195–5206 (initialisation ThematicMapManager)

### 5.3 Détection de fin de chargement des tiles (fix Problème 1)

```typescript
// Remplace le sleep(3000) actuel dans capture-utils.ts
async function waitForTilesLoaded(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const map = (window as any).__leafletMap;
      if (!map) return false;
      // Vérifier qu'aucun tile n'est en cours de chargement
      const loading = document.querySelectorAll('.leaflet-tile-loading');
      return loading.length === 0;
    },
    { timeout, polling: 200 }
  );
}
```

---

## 6. Worker Node.js — Phase 2 (MapLibre GL Node)

### 6.1 Principe de rendu natif

```typescript
// services/atlas-headless/src/renderer/maplibre.ts
import { Map, MapOptions } from '@maplibre/maplibre-gl-node';

async function renderMap(payload: HqExportPayload): Promise<Buffer> {
  const style = await buildGLStyle(payload);  // JSON style depuis DB + palette

  const map = new Map({
    style,
    width: payload.output.width_px,
    height: payload.output.height_px,
    zoom: computeZoom(payload.bbox, payload.output),
    center: [
      (payload.bbox.west + payload.bbox.east) / 2,
      (payload.bbox.south + payload.bbox.north) / 2,
    ],
    bearing: 0,
    pitch: 0,
  } as MapOptions);

  // Attendre que toutes les sources soient chargées
  await new Promise((resolve) => map.on('idle', resolve));

  const image = map.image();  // Buffer PNG natif
  map.release();

  // Superposer le cadre A4 (légende, titre, échelle, grille)
  return compositeFrame(image, payload);
}
```

### 6.2 Construction du style MapLibre GL

```typescript
// services/atlas-headless/src/styles/builder.ts
async function buildGLStyle(payload: HqExportPayload): Promise<StyleSpecification> {
  // 1. Fond de carte (OSM ou tile server local)
  const baseStyle = loadBaseStyle();

  // 2. Couche thématique depuis l'API Atlas
  const data = await fetchThematicData(
    payload.thematic_id,
    payload.adm_level,
    payload.adm_name,
    payload.grid
  );

  // 3. Classer les valeurs (même algorithme que le frontend)
  const breaks = computeBreaks(data.features, payload.style);
  const colorStops = breaksToColorStops(breaks, payload.style.palette);

  // 4. Layer MapLibre GL avec fill-color step expression
  const thematicLayer: LayerSpecification = {
    id: 'thematic',
    type: 'fill',
    source: 'atlas-data',
    paint: {
      'fill-color': ['step', ['get', 'value'], '#f0f0f0', ...colorStops],
      'fill-opacity': 0.85,
    },
  };

  return { ...baseStyle, layers: [...baseStyle.layers, thematicLayer] };
}
```

### 6.3 Source de données : appel direct à l'API Atlas

```typescript
// Même endpoint que le frontend thématique
const response = await fetch(
  `${API_BASE_URL}/thematic/data` +
  `?parameter=${thematic_id}&grid=${grid}&adm_level=${adm_level}&adm_name=${adm_name}`
);
const geoJson = await response.json();
```

**Fichier de référence côté API** : `services/api-geo/src/thematic.rs` — endpoint GET `/thematic/data`

---

## 7. Composition du cadre A4 (commune Phase 1 et 2)

### 7.1 Éléments du cadre (référence frontend)

Le cadre actuel est défini dans `ui/src/export/export-frame.ts`. Les éléments à reproduire côté serveur :

| Élément | Implémentation frontend | Implémentation serveur |
|---------|------------------------|----------------------|
| Titre + sous-titre | Canvas text | Sharp/Canvas text |
| Grille de coordonnées | `grid-generator.ts:computeOptimalStep()` | Port TypeScript identique |
| Barre d'échelle | Calcul km/px | Identique |
| Légende (classes + couleurs) | Canvas drawRect | Sharp overlays |
| Cadre double/simple/zèbre | CSS border | Sharp border |
| Rose des vents | SVG inline | SVG → PNG (Sharp) |
| Statistiques (médiane, Q1-Q3) | HTML | Canvas text |

### 7.2 Librarie de composition recommandée

```
sharp (npm) — traitement d'image haute performance (libvips)
  → composite() pour assembler les éléments
  → text() pour les annotations
  → draw() pour les cadres et grilles
```

---

## 8. Docker Compose

```yaml
# À ajouter dans docker-compose.yml
services:
  atlas-headless:
    build:
      context: ./services/atlas-headless
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: ${DATABASE_URL}
      API_BASE_URL: http://api-geo:8000
      ATLAS_UI_URL: http://ui:5173      # Phase 1 Puppeteer uniquement
      EXPORTS_DIR: /data/exports/hq
      ENGINE: puppeteer                 # ou maplibre pour Phase 2
      POLL_INTERVAL_MS: "2000"
    volumes:
      - ./exports/hq:/data/exports/hq
    depends_on:
      - db
      - api-geo
    networks:
      - atlas-net
    restart: unless-stopped
```

### 8.1 Dockerfile Phase 1 (Puppeteer)

```dockerfile
FROM node:20-alpine

# Puppeteer requiert Chromium
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
CMD ["node", "src/index.js"]
```

### 8.2 Dockerfile Phase 2 (MapLibre GL Node)

```dockerfile
FROM node:20-bookworm-slim

# Mesa pour rendu OpenGL offscreen
RUN apt-get update && apt-get install -y \
    libgl1-mesa-dev libegl1-mesa-dev libgbm-dev \
    && rm -rf /var/lib/apt/lists/*

ENV LIBGL_ALWAYS_SOFTWARE=1

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
CMD ["node", "src/index.js"]
```

---

## 9. Intégration UI (toggle non-invasif)

### 9.1 Modification minimale du frontend

Dans `ui/src/export/export-quick-dialog.ts`, ajouter un check au début de `exportSingle()` :

```typescript
async exportSingle(config: ExportConfig): Promise<Blob> {
  // Si mode HQ activé → déléguer au serveur
  if (config.useServerHQ) {
    return this.exportViaServer(config);
  }
  // ... pipeline existant inchangé ...
}

private async exportViaServer(config: ExportConfig): Promise<Blob> {
  const jobId = await this.createHQJob(config);
  const result = await this.pollUntilComplete(jobId);
  return this.downloadResult(result.download_url);
}
```

### 9.2 Toggle dans le panneau thématique

Dans `ui/src/thematic/thematic-panel.ts` (référence : lignes des boutons export) :

```typescript
// Ajouter un toggle radio "Web (Rapide)" / "Impression HQ"
// Stocké dans localStorage pour persister entre sessions
private exportMode: 'web' | 'hq' = 
  (localStorage.getItem('atlas_export_mode') as any) || 'web';
```

---

## 10. Plan d'exécution par milestones

### Milestone A — Infrastructure DB + API (2–3 jours)
- [ ] Écrire et appliquer `migrations_post_v1/176_hq_export_jobs.sql`
- [ ] Créer `services/api-geo/src/hq_export.rs` (3 endpoints)
- [ ] Câbler dans `main.rs`
- [ ] Tests : `curl -X POST /export/hq` → `{ job_id }`

### Milestone B — Worker Phase 1 Puppeteer MVP (3–4 jours)
- [ ] Créer `services/atlas-headless/` (structure Node.js)
- [ ] Implémenter `worker.ts` : boucle job queue + Puppeteer
- [ ] Ajouter `window.__atlasExportHQ()` dans `ui/src/main.ts`
- [ ] Implémenter `waitForTilesLoaded()` (fix Problème 1 simultanément)
- [ ] Dockerfile Phase 1
- [ ] Ajouter au docker-compose
- [ ] Test : 1 carte générée correctement

### Milestone C — Composition cadre A4 + qualité (3–4 jours)
- [ ] Porter `grid-generator.ts` → `frame/grid.ts` (serveur)
- [ ] Porter `export-frame.ts` → `frame/composer.ts` (Sharp)
- [ ] Valider visuellement : comparer 10 cartes serveur vs frontend
- [ ] Critère d'acceptation : différence visuelle < 5% (score SSIM > 0.95)

### Milestone D — Toggle UI + polling (2–3 jours)
- [ ] Ajouter toggle "Web" / "Impression HQ" dans thematic-panel.ts
- [ ] Implémenter polling status dans export-quick-dialog.ts
- [ ] Barre de progression liée au `progress` du job
- [ ] Bouton "Télécharger" quand COMPLETED

### Milestone E — Phase 2 MapLibre GL Node (3–5 jours, après validation Phase 1)
- [ ] Installer `@maplibre/maplibre-gl-node`
- [ ] Écrire `renderer/maplibre.ts` + `styles/builder.ts`
- [ ] Translater les styles Leaflet actuels → styles GL JSON
  - Référence : `ui/src/thematic/thematic-panel.ts` — rendu des cellules
  - Référence : `ui/src/export/export-quick-dialog.ts:buildThematicCellsFromScreenFeatures()`
- [ ] Dockerfile Phase 2 (Mesa)
- [ ] Benchmark : Phase 1 vs Phase 2 (50 cartes)
- [ ] Basculer `ENGINE=maplibre` dans docker-compose si ≥ 90% de la qualité Phase 1

### Milestone F — Robustesse + monitoring (2 jours)
- [ ] Retry automatique sur échec (max 3 tentatives)
- [ ] Nettoyage automatique des fichiers > 7 jours (cron ou endpoint)
- [ ] Métriques : jobs/heure, durée moyenne, taux d'échec
- [ ] Intégrer les jobs HQ dans `atlas.ai_job_queue` monitoring existant

---

## 11. Critères d'acceptation — MVP

| Critère | Seuil |
|---------|-------|
| Qualité visuelle (SSIM vs frontend) | ≥ 0.95 |
| Vitesse Phase 1 | ≤ 3 s/carte |
| Vitesse Phase 2 | ≤ 500 ms/carte |
| Résilience redémarrage | Job survit au restart (statut en DB) |
| Parallélisme | ≥ 3 cartes simultanées (worker pool) |
| Logs | Chaque job tracé dans `hq_export_jobs` avec durée |

---

## 12. Référence des fichiers clés à lire avant implémentation

### Frontend (ne pas modifier avant validation Phase 2)

| Fichier | Lignes clés | Rôle |
|---------|-------------|------|
| `ui/src/export/export-quick-dialog.ts` | `exportSingle()` | Pipeline de rendu complet |
| `ui/src/export/capture-utils.ts` | `captureLeafletMap()`, `waitForTiles()` | Capture + attente tiles |
| `ui/src/export/bounds-optimizer.ts` | `computeOptimalBounds()` | Algorithme bbox binaire |
| `ui/src/export/grid-generator.ts` | `computeOptimalStep()` | Grille coordonnées |
| `ui/src/export/export-frame.ts` | `renderFrame()`, `renderGrid()` | Composition cadre A4 |
| `ui/src/export/export-atlas-dialog.ts` | `runBatchExportInternal()` | Boucle batch |
| `ui/src/thematic/thematic-panel.ts` | boutons export | Intégration UI |
| `ui/src/main.ts` | lignes 5195–5206 | Init ThematicMapManager |

### Backend

| Fichier | Rôle |
|---------|------|
| `services/api-geo/src/thematic.rs` | Endpoint GET `/thematic/data` (source de données pour MapLibre) |
| `services/api-geo/src/ai_jobs.rs` | Pattern job queue existant à reproduire |
| `services/api-geo/src/main.rs` | Câblage des routes |
| `migrations_post_v1/175_bloc_e_backfill_runs_traceability.sql` | Pattern migration SQL |

### Infrastructure

| Fichier | Rôle |
|---------|------|
| `docker-compose.yml` | Ajouter service atlas-headless |
| `.env.example` | Variables d'environnement à ajouter |

---

## 13. Sécurité et nettoyage

- Chaque job associé à `requested_by` (token JWT subject)
- Endpoint download vérifie ownership (ou scope admin)
- Fichiers PNG supprimés automatiquement après 7 jours
- Taille max payload : 10 KB (protection contre les requêtes malformées)
- Rate limiting : max 10 jobs simultanés par utilisateur

---

## 14. Relation avec les autres Blocs de la roadmap scientifique

```
Bloc E (traçabilité, ce sprint)  →  pipeline_worker tracera aussi les jobs HQ
Bloc F (CI/CD LOO-RMSE)          →  indépendant
Bloc G (index matview API)       →  améliore la vitesse du GET /thematic/data
                                    utilisé par le worker MapLibre (Phase 2)
Bloc H (EG H2/H3 complet)        →  indépendant
```

Le worker headless utilise le **même endpoint `/thematic/data`** que le frontend. Toute amélioration de performance sur cet endpoint (Bloc G) bénéficie directement au rendu serveur.

---

## 15. Intégration des nouveaux paramètres V10 dans le rendu serveur

L'import V10_MASTER (batch `v10_master_import_2026`) a ajouté 5 nouvelles familles de paramètres géotechniques. Ils doivent tous être rendus cartographiés par le moteur serveur.

### 15.1 Nouveaux paramètres et leur mapping thématique

| Paramètre | Table source | `thematic_id` côté API | Catégorie UI |
|---|---|---|---|
| CBR 95% | `essais_cbr` | `cbr_95_ked_h1/h2/h3` | Portance routière |
| OPM gamma_d max | `essais_proctor` | `gamma_d_ked_h1/h2/h3` | Compactage |
| Pénétromètre Rd | `essais_penetrometre` | `rd_mpa_ked_h1/h2/h3` | Portance fondations |
| Pressiomètre Em | `essais_pressiometre` | `em_mpa_ked_h1/h2/h3` | Portance fondations |
| Indice de Groupe | `essais_classif.indice_groupe` | dérivé HRB | Classification |

### 15.2 Palettes recommandées pour le rendu

```json
{
  "cbr_95":   { "palette": "greens",   "domain": [0, 80],  "unit": "%" },
  "gamma_d":  { "palette": "oranges",  "domain": [14, 25], "unit": "kN/m³" },
  "rd_mpa":   { "palette": "blues",    "domain": [0, 30],  "unit": "MPa" },
  "em_mpa":   { "palette": "purples",  "domain": [0, 100], "unit": "MPa" },
  "ig":       { "palette": "reds_r",   "domain": [0, 16],  "unit": "—" }
}
```

### 15.3 Vues matérialisées à créer pour le GET `/thematic/data`

Pour que l'endpoint `/thematic/data` renvoie les valeurs interpolées des nouveaux paramètres, les vues suivantes doivent être créées (migration 179) :

```sql
-- Migration 179 — Vues thématiques nouveaux paramètres V10
-- Ajouter les nouveaux paramètres dans maille_geotech_interpolation

-- CBR 95% par horizon
CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_cbr_95_ked AS
SELECT
  v.maille_code,
  v.parameter_id,
  v.value                 AS cbr_95_pct,
  v.variance              AS cbr_95_variance,
  v.method,
  v.run_id,
  m.geom
FROM atlas.ai_interpolation_values v
JOIN atlas.mailles m ON m.code = v.maille_code
WHERE v.parameter_id LIKE 'cbr_95_ked_%'
  AND v.run_id = (
    SELECT id FROM atlas.ai_interpolation_runs r2
    WHERE r2.parameter_id = v.parameter_id
    ORDER BY r2.created_at DESC LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS mv_cbr_95_ked_pk
  ON atlas.mv_cbr_95_ked (maille_code, parameter_id);
```

> **Note** : La même structure s'applique pour `rd_mpa_ked`, `em_mpa_ked`, `gamma_d_ked`.
> La migration 179 devra aussi ajouter l'index UNIQUE manquant sur `mv_mailles_geotech` (cf. section 16).

### 15.4 Cartes thématiques prioritaires (whitepaper)

Pour l'article scientifique V2, les cartes suivantes sont requises en haute résolution (PNG 300 DPI, format A4) :

| Carte | Paramètre | Horizon | Zone |
|---|---|---|---|
| 1. Portance routière CBR 95% | `cbr_95_ked_h1` | H1 | Régions Plateaux + Kara |
| 2. Résistance dynamique Rd | `rd_mpa_ked_h1` | H1 | Togo entier |
| 3. Module pressiométrique Em | `em_mpa_ked_h2` | H2 | Régions Centrale + Kara |
| 4. OPM gamma_d | `gamma_d_ked_h1` | H1 | Corridors routiers V10 |
| 5. VBS (référence) | `vbs_fusion_h1` | H1 | Togo entier |
| 6. IP Fusion | `ip_fusion_h1/h2/h3` | H1+H2+H3 | Togo entier |

---

## 16. Migration 179 — Corrections techniques post-V10 (prerequis roadmap serveur)

Avant de lancer l'implémentation du moteur headless, cette migration doit être appliquée :

```sql
-- migrations_post_v1/179_fix_mv_mailles_geotech_index.sql
\set ON_ERROR_STOP 1
BEGIN;

-- 1. Index UNIQUE pour REFRESH CONCURRENTLY (trigger_refresh_mailles cassé sans lui)
CREATE UNIQUE INDEX IF NOT EXISTS mv_mailles_geotech_maille_code_idx
  ON atlas.mv_mailles_geotech (maille_code);

-- 2. Ré-activer le trigger trigger_refresh_mailles
ALTER TABLE atlas.sondages ENABLE TRIGGER trigger_refresh_mailles;

-- 3. Note sur migration hq_export_jobs :
--    Les migrations 176-178 sont réservées au V10 import.
--    La table hq_export_jobs sera créée en migration 180.

RAISE NOTICE 'Migration 179 OK — mv_mailles_geotech index + trigger reactives';
COMMIT;
```

**Table `atlas.hq_export_jobs`** → sera créée en migration **180** (pas 176 comme indiqué dans §3.1 — cette numérotation est mise à jour).

---

## 17. Timeline résumé (estimation sprints)

```
Sprint 0 (prerequis — 1 jour)
  [x] Import V10_MASTER (sondages, labo, in-situ, CBR, Proctor)
  [x] Migrations 176/177/178 (essais_penetrometre, pressiometre, cbr)
  [ ] Migration 179 (mv_mailles_geotech unique index)
  [ ] Pipeline calculs KED/RK (60 jobs en cours)

Sprint 1 — Infrastructure DB + API (2-3 jours)
  [ ] Migration 180 : table hq_export_jobs
  [ ] services/api-geo/src/hq_export.rs (3 endpoints)
  [ ] Tests curl

Sprint 2 — Worker Puppeteer MVP (3-4 jours)
  [ ] services/atlas-headless/ structure Node.js
  [ ] worker.ts boucle + Puppeteer
  [ ] window.__atlasExportHQ() dans ui/src/main.ts
  [ ] waitForTilesLoaded() (fix Problème 1)
  [ ] Dockerfile Phase 1 + docker-compose

Sprint 3 — Composition cadre A4 (3-4 jours)
  [ ] frame/composer.ts (Sharp)
  [ ] Validation visuelle SSIM > 0.95

Sprint 4 — Toggle UI + polling (2-3 jours)
  [ ] Thematic panel toggle "Web / Impression HQ"
  [ ] Barre de progression dans export-quick-dialog.ts

Sprint 5 — Phase 2 MapLibre GL Node (3-5 jours)
  [ ] @maplibre/maplibre-gl-node renderer
  [ ] styles/builder.ts (GL JSON depuis palettes Atlas)
  [ ] Benchmark Phase 1 vs Phase 2

Sprint 6 — Robustesse + monitoring (2 jours)
  [ ] Retry automatique (max 3)
  [ ] Nettoyage fichiers > 7 jours
  [ ] Métriques jobs/heure, durée, taux d'échec

Total estimé : 16-22 jours de développement
Gains cibles : ×5-50 vs moteur frontend actuel
               Phase 1 : ≤ 3 s/carte (vs 5-8 s actuels)
               Phase 2 : ≤ 500 ms/carte
```

---

## 18. État d'avancement au 2026-06-01

| Section | Statut |
|---|---|
| Contexte et motivation documentés | ✅ Complet |
| Choix technologique analysé | ✅ Complet |
| Architecture cible définie | ✅ Complet |
| Schéma DB `hq_export_jobs` (migration 180) | ✅ Documenté, à appliquer |
| Endpoints API Rust documentés | ✅ Complet |
| Worker Puppeteer Phase 1 documenté | ✅ Complet |
| Worker MapLibre Phase 2 documenté | ✅ Complet |
| Composition cadre A4 documentée | ✅ Complet |
| Docker Compose documenté | ✅ Complet |
| Toggle UI documenté | ✅ Complet |
| Milestones définis | ✅ Complet |
| Nouveaux paramètres V10 intégrés | ✅ Section 15 ajoutée |
| Migration 179 prerequis définie | ✅ Section 16 ajoutée |
| Timeline résumé | ✅ Section 17 ajoutée |
| **Implémentation** | ⏳ Sprint 1 à démarrer |

> La roadmap est **complète et validée**. L'implémentation peut commencer par le Sprint 0 (migration 179) dès que le pipeline géostatistique V10 est terminé.
