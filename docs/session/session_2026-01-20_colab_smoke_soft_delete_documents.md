# Session 2026-01-20 — Colab Studio : Smoke tests + Soft delete (Étudiants/Superviseurs) + Documents

## Objectif du jour

- Restaurer un comportement UX cohérent dans **Colab Studio** :
  - **Désactiver** ≠ **Supprimer** (soft delete)
  - Après suppression, l’élément doit **disparaître de la liste**
- Valider par **smoke tests** :
  - Création étudiant avec **téléphone** et **âge**
  - Désactivation (is_active=false) puis suppression (soft delete) étudiant/superviseur/mission
  - Upload + suppression de document (soft delete)
- Stabiliser l’outil de smoke test PowerShell côté Windows.

## Symptômes observés

### UI
- Le bouton **Supprimer** pour étudiant/superviseur semblait ne rien faire :
  - L’action renvoyait un succès côté UI, mais **l’item restait visible** dans la liste.
- La suppression de mission, elle, semblait fonctionner.

### API (confirmé par smoke tests)
- `DELETE /colab/students/:id` et `DELETE /colab/supervisors/:id` répondaient `200`, mais l’item était **encore présent** dans `GET /colab/students` / `GET /colab/supervisors`.

## Diagnostic (root cause)

### 1) Instance backend non alignée avec le code du repo
Le code Rust du repo (handlers Colab) filtre les listes avec :

- `WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL` (students)
- `WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL` (supervisors)

et met bien `deleted_at = NOW()` dans `DELETE`.

Mais le runtime observé (container `atlas-api-geo`) avait un comportement incohérent :
- `DELETE` renvoyait `200`
- **sans effet sur la liste**

➡️ Conclusion : **l’image Docker en cours d’exécution n’était pas celle correspondant au code actuel**.

### 2) Multiples incompatibilités "runtime" rencontrées pendant les tests
- Les routes Colab étaient servies sur `http://localhost:8000/colab/...` (sans `/api`).
- `POST /colab/missions` exigeait `code` (et `theme`), contrairement à une version où le code est auto-généré.
- Upload document : `document_type` devait correspondre à l’enum Postgres `atlas.document_type`.
  - `"rapport"` est invalide
  - valeurs valides (migration `060_colab_schema.sql`) :
    - `rapport_intermediaire`, `rapport_final`, `fiche_terrain`, `annexe`, `photo`, `plan`, `coupe_geologique`, `resultats_essais`, `autre`

## Implémentations / changements

### 1) Script smoke test PowerShell robuste (Windows)
Fichier ajouté :
- `atlas/smoke_test_colab_20260120.ps1`

Points notables :
- Login via `POST /auth/login`
- Détection automatique du préfixe routes Colab :
  - test `GET /api/colab/students` puis fallback `GET /colab/students`
- Remplacement des appels `Invoke-RestMethod` par `curl.exe` (compat PS / éviter paramètres non supportés)
- Gestion propre du JSON :
  - `curl --data-binary @file.json` + écriture UTF-8 **sans BOM** (sinon `serde_json` échoue : `expected value at line 1 column 1`)
- Upload multipart via `curl -F ...`.
- Vérification post-delete **par présence d’ID** (pas seulement par le compteur total).

### 2) Ajustements de paramètres API
- Création mission : ajout des champs requis dans la version runtime
  - `code`, `theme`
- Alignement parsing : `POST /colab/missions` renvoie `id` (pas `mission_id`)
- Upload document : usage de `document_type=autre`

## Commandes exécutées

### Diagnostic Docker
```powershell
docker compose ps
```

```powershell
docker compose logs api-geo --tail 200
```

### Rebuild + restart de l’API (fix root cause)
```powershell
docker compose build api-geo
```

```powershell
docker compose up -d api-geo
```

```powershell
docker compose ps api-geo
```

### Smoke tests (script)
```powershell
powershell.exe -ExecutionPolicy Bypass -File "c:\PROJET_ATLAS_MASTER\atlas\smoke_test_colab_20260120.ps1"
```

## Erreurs rencontrées & debug

### A) Login échoue / JSON invalide
- Symptôme :
  - `400 Failed to parse the request body as JSON`
  - ou `expected value at line 1 column 1`
- Causes identifiées :
  - quoting PowerShell + `curl.exe` -> JSON cassé
  - `Set-Content -Encoding UTF8` écrit un **BOM** -> rejet par `serde_json`
- Fix :
  - écrire le JSON dans un fichier temporaire en UTF-8 **sans BOM** (`System.IO.File::WriteAllText(..., UTF8Encoding($false))`)
  - envoyer `--data-binary @file`

### B) Routes Colab 404
- Symptôme : `POST /api/colab/students` -> `404 Route non trouvée`
- Cause : routes runtime sur `/colab/*` (sans `/api/*`)
- Fix : détection automatique dans le script.

### C) Mission create exige `code`
- Symptôme : `missing field code`
- Fix : ajout `code` + `theme` dans la payload de création de mission.

### D) Document upload refuse `document_type=rapport`
- Symptôme : `invalid input value for enum document_type: "rapport"`
- Fix : utiliser `document_type=autre` (valeur valide de l’enum DB).

### E) DELETE étudiant/superviseur répond 200 mais l’item reste listé
- Symptôme (avant rebuild) :
  - `student_still_listed = True`
  - `supervisor_still_listed = True`
- Cause : instance `api-geo` pas alignée au code repo
- Fix : `docker compose build api-geo` + `docker compose up -d api-geo`

## Résultats des smoke tests

### Run final (après rebuild api-geo) — ✅ OK
Log :
- `C:\Users\prota\AppData\Local\Temp\colab_smoke_20260120_105159.json`

Résultats :
- **Création étudiant** ✅ (téléphone + âge)
- **Désactivation étudiant/superviseur** ✅ (`PUT is_active=false`)
- **Suppression étudiant/superviseur** ✅ (`DELETE` soft delete)
  - vérifié : `student_still_listed = false`
  - vérifié : `supervisor_still_listed = false`
- **Suppression mission** ✅
- **Upload document PDF** ✅
  - fichier utilisé : `atlas/docs/RAPPORT_EXPORT_2024-12-16.pdf`
  - type utilisé : `autre`
- **Suppression document** ✅ (disparaît de la liste)

### Run avant rebuild (pour comparaison) — ❌ incohérent
Log :
- `C:\Users\prota\AppData\Local\Temp\colab_smoke_20260120_104431.json`

Symptôme confirmé :
- `student_still_listed = true`
- `supervisor_still_listed = true`

## Notes / points d’attention

- Les routes Colab sont actuellement accessibles via `/colab/*` (pas `/api/colab/*`).
  - L’UI doit utiliser le bon préfixe (ou l’API doit être rendue cohérente).
- La création mission côté runtime exige encore `code` + `theme`.
  - Si l’UI a été simplifiée (suppression champ code), il faut s’assurer que le backend déduit `code` automatiquement ou rendre `code` optionnel.

## État en fin de session

- ✅ Backend `api-geo` rebuild/restart : OK
- ✅ Smoke tests : OK sur étudiants/superviseurs/missions/documents
- ✅ Bug “supprimer étudiant/superviseur ne fait rien” : résolu (cause = image Docker obsolète)

## Ajouts Infra (QGIS Headless Worker) — 2026-01-20

### Objectif

- Préparer un worker **QGIS headless** (Docker) capable d’exporter des layouts en PDF.
- Poser la base pour un export **WSIWYG** : valeurs calculées live (API) + géométrie PostGIS + règles de style verrouillées.

### Implémentations

#### 1) Structure `atlas/qgis_worker/`

- Ajout d’un dossier dédié :
  - `atlas/qgis_worker/Dockerfile`
  - `atlas/qgis_worker/requirements.txt`
  - `atlas/qgis_worker/src/worker.py`

#### 2) Docker Compose — service `qgis-worker`

- Ajout d’un service `qgis-worker` dans `atlas/docker-compose.yml` :
  - réseau `atlas-net`
  - dépendances : `db` + `api-geo`
  - sortie PDF montée sur `./exports:/data/exports`

#### 3) Support template QGIS `.qpt`

- Le worker supporte maintenant un template `.qpt` via `QGIS_TEMPLATE`.
- Le fichier `atlas/QGIS/atlas_base_skeleton.qpt` est monté en lecture seule dans le conteneur.
- Le worker charge le layout depuis le template et exporte un PDF de test.

#### 4) Base “Phase 5” (style verrouillé)

- Ajout de logique côté worker pour :
  - récupérer des valeurs thématiques via `GET /thematic/data` (`include_geometry=false`)
  - charger une couche PostGIS (géométrie) dans QGIS
  - injecter un champ `value` et appliquer un rendu gradué à partir de classes `{min,max,color,label}`

### Notes / incidents

- Un build a échoué initialement avec `unexpected EOF` (couches Docker corrompues / download interrompu).
- Un rebuild `--no-cache` a permis de stabiliser la construction de l’image `atlas-qgis-worker`.

## Chantier QGIS Worker Job Queue — 2026-01-20

### Objectif

- Implémenter un **job queue** PostgreSQL pour le worker QGIS headless
- Permettre au worker de **poller** la table `atlas.export_jobs` pour traiter les demandes d’export de manière asynchrone
- Tester la chaîne complète : insertion job → worker → export PDF → mise à jour statut

### Analyses & Décisions

#### 1) Architecture retenue
- **Table `atlas.export_jobs`** : `id`, `status`, `payload`, `result_path`, `error_log`, timestamps
- **Polling atomique** : `SELECT ... FOR UPDATE SKIP LOCKED` pour éviter les doubles traitements
- **Cycle de vie** : `PENDING` → `PROCESSING` → `COMPLETED` ou `FAILED`
- **Payload JSON** : injection dynamique (titre) dans le layout QGIS

#### 2) Choix techniques
- **`jsonb_build_object`** pour l’injection SQL (évite les problèmes de quoting PowerShell)
- **`search_path = atlas, public`** pour garantir la visibilité de la table `atlas.export_jobs`
- **Template `.qpt`** comme source de layout (pas besoin de projet `.qgz` complet)

### Erreurs rencontrées & Solutions

#### A) Docker build corrompu
- **Symptôme** : `unexpected EOF` lors du build de l’image `atlas-qgis-worker`
- **Cause** : couches Docker corrompues / download interrompu
- **Solution** : `docker compose build --no-cache qgis-worker`

#### B) Table `atlas.export_jobs` invisible depuis le worker
- **Symptôme** : `relation "export_jobs" does not exist` dans les logs worker
- **Cause** : `search_path` par défaut ne contenait pas le schéma `atlas`
- **Solution** : `SET search_path TO atlas, public;` dans `_get_db_connection()`

#### C) Quoting PowerShell infernal pour JSON dans `psql -c`
- **Symptôme** : `psql: warning: extra command-line argument ...` et erreurs de syntaxe SQL
- **Cause** : PowerShell interprète les guillemets et accolades avant d’envoyer la commande
- **Solutions tentées** :
  - `--%` (stop-parsing) : échec (arguments encore split)
  - Hérédoc `@"..."@` : échec (JSON mal formé)
  - `$$...$$` : échec (syntax error)
- **Solution finale** : `jsonb_build_object('title','...')` via pipe `| docker exec ... psql -f -`

#### D) Worker utilisait une ancienne image
- **Symptôme** : logs ne montraient pas les nouveaux ajouts (DB sanity, polling)
- **Cause** : conteneur pas rebuild après modifications du code
- **Solution** : `docker compose build qgis-worker` + `docker compose up -d qgis-worker`

### Commandes clés

#### Création table + index
```sql
CREATE TABLE atlas.export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payload JSONB,
    result_path TEXT,
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jobs_status ON atlas.export_jobs(status);
```

#### Injection job test (PowerShell)
```powershell
$sql = @'
INSERT INTO atlas.export_jobs (payload)
VALUES (jsonb_build_object('title','TEST DYNAMIQUE : Ma Premiere Carte'))
RETURNING id, status;
'@
$sql | docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f -
```

#### Monitoring
```powershell
docker logs -f atlas-qgis-worker
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT id, status, result_path FROM atlas.export_jobs ORDER BY created_at DESC LIMIT 5;"
```

### Résultats obtenus

#### Test end-to-end réussi
- **Job ID** : `cf30a38f-4e44-4fe6-8cce-b074e0495b15`
- **Payload** : `{"title":"TEST DYNAMIQUE : Ma Premiere Carte"}`
- **Traitement** : Worker a pris le job, exporté PDF, mis à jour statut
- **Statut final** : `COMPLETED`
- **Fichier généré** : `/data/exports/job_cf30a38f-4e44-4fe6-8cce-b074e0495b15.pdf`

#### Logs worker significatifs
```
[Worker] 🚀 Démarrage...
[Worker] ✅ Layout prêt : atlas_base_skeleton
[Worker] ✅ Connexion DB OK
[Worker] DB sanity: db=atlas_clean user=atlas atlas.export_jobs=export_jobs
[Worker] ⚙️ Traitement du Job cf30a38f-4e44-4fe6-8cce-b074e0495b15...
[Worker] ✅ Job cf30a38f-4e44-4fe6-8cce-b074e0495b15 terminé !
```

### Avancement Roadmap Export HQ (Étapes 1 → 3)

#### ÉTAPE 1 — Connexion des Données PostGIS (Worker HQ) — ✅ OK

- **Décision** : piloter le rendu HQ à partir d’une couche PostGIS chargée explicitement via `QgsDataSourceUri`.
- **Décision** : rendre la couche configurable par variables d’environnement (durable, portable) :
  - `QGIS_PG_HOST`, `QGIS_PG_PORT`, `QGIS_PG_DATABASE`, `QGIS_PG_USER`, `QGIS_PG_PASSWORD`
  - `QGIS_PG_SCHEMA` (défaut `atlas`)
  - `QGIS_PG_TABLE` (défaut `mailles`)
  - `QGIS_PG_GEOM` (défaut `geom`)
  - `QGIS_PG_KEY` (défaut `id`)
  - `QGIS_PG_SRID` (défaut `25231`)

- **Anti-illusion (contrat de vérité)** : log systématique :
  - `layer.isValid()`
  - `layer.featureCount()`
  - `layer.extent()`
  - **si `featureCount == 0` ⇒ job FAILED** (pas d’export “blanc” silencieux)

- **Zoom & rendu** : la carte du template est `MainMap` (ID confirmé dans `.qpt`) ; `zoomToExtent(layer.extent())`.

- **Test** : job `236e903c-c10d-4cf0-b67d-35decee3dd91`
  - logs : `featureCount=14821` + extent non vide
  - résultat : `/data/exports/job_236e903c-c10d-4cf0-b67d-35decee3dd91.pdf`

#### ÉTAPE 2 — Style déterministe piloté par payload (HQ) — ✅ OK (rule_based)

- **Principe validé** : l’API “décide”, le worker “applique”.
- **Implémentation** : `payload.style` supporté (si absent, fallback rendu par défaut).
  - `type = "rule_based"`
  - `rules[]` : `{ label, color, filter_exp }`
  - application via `QgsRuleBasedRenderer` + `QColor(#RRGGBB)`

- **Légende** : item `MainLegend` relié à `MainMap` + `legend.refresh()`.

- **Test** : job `68f9a566-8e47-423b-a699-61b17973748c`
  - payload : 2 règles (rouge/vert) basées sur le champ `code`
  - résultat : `/data/exports/job_68f9a566-8e47-423b-a699-61b17973748c.pdf`

#### ÉTAPE 3 — Habillage dynamique & mise en page (HQ) — 🟡 Partiel OK

- **Template** : `TitleLabel` existe (ID confirmé), mais `SubtitleLabel` / `FooterLabel` ne sont pas présents dans ce `.qpt` (à ajouter si besoin).
- **Décision** : injection robuste : `setText()` seulement si l’item existe (pas d’échec dur si le template n’a pas l’ID).
- **Grille cartographique** : ajout d’un support optionnel `payload.grid` :
  - `enabled: true|false`
  - `interval` (défaut 2000, supposé en unités map — ici SRID 25231 en mètres)

- **Erreur rencontrée** : un `legend.refresh()` s’est retrouvé accidentellement dans `_apply_grid()`
  - **Fix** : remise de `legend.refresh()` dans `_refresh_legend()`

- **Test** : job `accf1ab9-f76a-4e47-8d84-cc9350a66334`
  - payload : `title`, `subtitle`, `footer`, `grid.interval=5000`
  - résultat : `/data/exports/job_accf1ab9-f76a-4e47-8d84-cc9350a66334.pdf`

#### ÉTAPE 3 (bis) — Qualité “production” (rendu + métriques layout) — ✅ OK

- **Problème** : rendu “baveux” (14k polygones + contours) → masse noire / sur-densité.
- **Solution** : suppression systématique du contour sur les symboles de règles (stroke off) lors de l’application du style.

- **Légende** : renommage de la couche avant export (payload `layer_name`, défaut `Mailles Géotechniques`).

- **Layout code-first** : ajout d’une fonction qui écrase les positions/sizes du `.qpt` pour garantir un A4 propre :
  - titre : `TitleLabel`
  - carte : `MainMap`
  - légende : `MainLegend`
  - barre d’échelle : `ScaleBar`

- **Fix zoom/CRS** : forcer le CRS du `MainMap` sur celui de la couche et zoomer sur un extent avec marge (+5%).

- **Échelle en km** : configuration de `ScaleBar` en kilomètres + conversion m → km (`setMapUnitsPerScaleBarUnit(1000)`).

- **Test** : job `4b1c79c6-8325-49ba-8ce5-aa633a7ea391`
  - logs : `📐 Application du Layout 'Code-First'...` + `🔍 Zoom forcé ...`
  - résultat : `/data/exports/job_4b1c79c6-8325-49ba-8ce5-aa633a7ea391.pdf`

#### ÉTAPE 4 — API Rust : Orchestrateur export (web|hq) — ✅ OK (MVP)

- **But** : l’API orchestre et ne dépend pas du moteur.
  - `mode=hq` → insertion job dans `atlas.export_jobs`
  - `mode=web` → pas encore implémenté (retourne `501 Not Implemented`)

- **Routes ajoutées (api-geo)** :
  - `POST /export` → crée un job
  - `GET /export/jobs/:id` → statut + `result_path`/`error_log`

- **Test (PowerShell)** :
```powershell
$body = '{"mode":"hq","payload":{"title":"API Export HQ"}}'
curl.exe -s -H "Content-Type: application/json" -d $body http://localhost:8000/export
```

- **Résultat** : création job `32bc2d63-08bc-44db-9f88-4dcdcbb1b505`.

```powershell
$id = "32bc2d63-08bc-44db-9f88-4dcdcbb1b505"
curl.exe -s http://localhost:8000/export/jobs/$id
```

- **Statut** : `COMPLETED`, PDF : `/data/exports/job_32bc2d63-08bc-44db-9f88-4dcdcbb1b505.pdf`

### Prochaines étapes

- **Vérifier le PDF généré** : confirmer que le titre dynamique apparaît bien dans le layout
- **Charge test** : injecter plusieurs jobs concurrents pour valider `SKIP LOCKED`
- **Intégration UI** : préparer les endpoints REST pour soumettre des jobs et consulter leur statut
- **Gestion d’erreurs** : enrichir `error_log` et implémenter des retries pour jobs `FAILED`

---

## Suite recommandée

- Vérifier côté UI (manuel) après le rebuild :
  - suppression étudiant / superviseur doit maintenant retirer l’élément de la liste après refresh.
- Harmoniser définitivement le routage (`/api` vs sans `/api`) pour éviter les confusions.
- **Valider le PDF généré** par le job queue QGIS worker et préparer l’intégration avec l’UI.
