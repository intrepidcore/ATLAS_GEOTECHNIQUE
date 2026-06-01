# Roadmap d’achèvement V1 — Atlas géotechnique (réalité terrain + blocs)

**Date de référence :** 2026-03-28  
**Périmètre :** `atlas_reclone` — DB PostGIS, `services/api-geo`, UI, scripts Python, dossier `ressource/`.  
**Lecture croisée :** `docs/REGLES_METIER.md`, contrats seed/stabilisation desktop.

Ce document synthétise une **cartographie DB**, des **tests HTTP réels**, une **lecture du code source** et les **écarts aux règles métier / contrats**, puis propose une **roadmap par blocs** pour terminer la vision produit (zones dépressions, IA contextuelle, kriging multi-paramètres, UI, conformité).

---

## 1. Synthèse exécutive (ingénieur logiciel + ingénieur géotechnicien)

| Domaine | État constaté | Lecture civile / métier |
|--------|----------------|-------------------------|
| **API IA** | Routes présentes dans `main.rs`, montées sur `/` **et** `/api` | Les échecs observés en dev sans JWT sont des **401** (`MISSING_TOKEN`), pas des **404** — sauf proxy mal configuré ou binaire obsolète. |
| **Zones d’étude** | **3** zones publiées en base : Lama, Plaine de l’Oti, Fosse aux Lions | **Absents** : Dépression du Bado, Plaine du Mono (non seedés dans les migrations actuelles). |
| **Emprise « Fosse aux Lions »** | Seed `140_other_zones_etude_seed.sql` : polygone ~lon 0.1–0.7°, lat **8.1–8.6°** | Pour une cuvette « extrême nord » (≈10°45′–10°48′ N près de Dapaong), l’emprise seed est **géographiquement incohérente** avec le nom — à corriger avec source SIG ou expert terrain. |
| **Kriging** | Script `kriging_gp_global_interpolate.py` : **régression par processus gaussien** (stationnaire), qualité via incertitude | C’est du **kriging-like / GP global**, pas du kriging géostatistique classique (variogramme, voisinage local) par paramètre. |
| **IA supervisée** | `supervised_rga_train_infer.py` : features **réduites** (`pct_in_lama`, `n_sondages` ; DSM **NULL**) | Les tables/vues **contexte** (`ai_context_features_maille`, géol/pédo/risque) **ne sont pas encore** dans le vecteur d’entraînement — l’objectif « corrélation ressources → géotechnique » est **partiellement préparé en DB**, **non câblé dans le modèle**. |
| **Ressources `ressource/`** | Fichiers listés : surtout `.prj`, `.cpg`, QML/QLR, `Togo_HG.*` sans `.shp` visible dans l’arborescence indexée | Risque de **jeu incomplet sous Git** ; en base, `unites_geologiques` / `unites_pedologiques` sont **peuplées** (120 / 61) — **traçabilité source ↔ dépôt** à formaliser. |
| **Cache features** | `ai_maille_features_fast` : **0 ligne** au moment du contrôle | Incohérent avec une V1 « industrielle » : refresh initial, triggers, ou pipeline d’alimentation à **exiger** avant production. |

---

## 2. Vérifications effectuées (preuves)

### 2.1 API HTTP (`curl`, hôte `127.0.0.1:8000`)

| Requête | Résultat |
|---------|----------|
| `GET /healthz` | **200** |
| `GET /api/zones-etude` | **200** — 3 zones (Lama, Oti, Fosse) avec métadonnées et comptages |
| `GET /api/ai/jobs/recent` | **401** — `MISSING_TOKEN` (route **existe**) |
| `POST /api/ai/recompute/sources` (sans corps auth) | **401** — `MISSING_TOKEN` (route **existe**) |

**Conclusion :** l’hypothèse « routes IA non enregistrées → 404 » est **fausse pour le code actuel** de `services/api-geo/src/main.rs`. En cas de 404 réel côté utilisateur : vérifier **URL de base** (`/api` vs racine), **reverse proxy**, **version du binaire** (rebuild Docker / `cargo run`).

### 2.2 Cartographie base de données (extrait pertinent)

**Zones :**

```text
DEPRESSION_LAMA_TG | published
PLAINE_OTI_TG      | published
FOSSE_LIONS_TG     | published
```

**Volumes indicatifs (instantané de contrôle) :**

| Objet | Rôle | Ordre de grandeur |
|-------|------|-------------------|
| `atlas.mailles` | Grille nationale | 29 407 |
| `atlas.mailles_zones_etude` | Liaison zone ↔ maille | (par zone) |
| `atlas.maille_geotech_infer` | Prédictions / infer persistées | 29 407 |
| `atlas.maille_geotech_interpolation` | Interpolation persistée | 29 407 |
| `atlas.maille_geotech_foundation` | AG / fondation | 29 407 |
| `atlas.unites_geologiques` | Contexte géologique | 120 |
| `atlas.unites_pedologiques` | Contexte pédologique | 61 |
| `atlas.risque_gonflement` | Risque (polygones) | 342 |
| `atlas.hydrogeologie` | Hydrogéologie | 14 |
| `atlas.ai_context_features_maille` | Features contexte par maille | 29 407 (remplissage géol/pédo/risque élevé) |
| `atlas.ai_maille_features_fast` | Cache agrégats rapides | **0** ⚠️ |
| `atlas.dsm_maille_flat_cache` | Cache DSM | 567 ⚠️ (couverture partielle vs 29k mailles) |
| `atlas.ai_parameter_catalog` + `ai_*_runs` + `v_ai_*_plan` | Catalogue paramètres / plans interpolation-prédiction | En place |

**Objets IA / géotech listés côté schéma `atlas` (liste non exhaustive) :**  
`ai_infer_runs`, `ai_opti_runs`, `ai_model_registry`, `ai_training_jobs`, `v_maille_features_ai`, `v_thematic_ai_geotech`, etc.

---

## 3. Code source — inventaire « promesse vs implémentation »

| Composant | Fichiers / entrées | Statut par rapport à la vision « V1 complète » |
|-----------|-------------------|-----------------------------------------------|
| **Enregistrement routes** | `main.rs` : `/ai/*` + `.merge(ai_jobs::ai_jobs_routes())` ; double montage `.nest("/", …)` et `.nest("/api", …)` | **OK** |
| **Jobs worker** | `ai_jobs.rs` + `spawn_job_worker` | **OK** (à valider en Docker : Python, `ATLAS_SCRIPTS_DIR`, droits) |
| **Recompute / kriging / train** | `ai_opti.rs` → scripts Python | **OK** chaîne d’appel ; qualité métier = sujet de **blocs 4–5** |
| **Supervisé multi-tâches** | `supervised_rga_train_infer.py` | **Partiel** : pas d’usage de `ai_context_features_maille` ni DSM cache dans le `SELECT` « all mailles » actuel |
| **Kriging multi-paramètres** | Un script GP + colonnes `maille_geotech_interpolation` | **Partiel** : pas de boucle catalogue `v_ai_interpolation_plan` → **N runs** persistés avec métriques par paramètre |
| **Panneau thématique** | `thematic-panel.ts`, `thematic-maps.ts`, `thematic-types.ts` | **Avancé** (source base / interpolation / IA) ; **affinement** : légende multi-zones homogène, strokes, e2e avec auth |
| **Import ressources** | `scripts/import_resource_layers.py` | **OK** outil ; dépend de **fichiers présents** et tables cibles |
| **Migrations 149+** | `ai_parameter_catalog`, plans, contexte | **OK** socle données ; **exploitation** modèle + jobs à finaliser |

---

## 4. Dossier `ressource/` — réalité dépôt vs base

- **Constat workspace :** pas de fichiers `.shp` / `.dbf` indexés sous `ressource/GEOLOGIQUE` et `ressource/PEDOLOGIQUE` (seulement `.prj`, `.cpg`). `Togo_HG` : métadonnées présentes ; vérifier présence des binaires shapefile sur disque / LFS / `.gitignore`.
- **Constat DB :** couches géol/pédo **non vides** → import a été fait depuis un autre chemin ou une autre machine.
- **Action roadmap :** inventaire **fichier → table → date → version** ; intégrer au **manifest seed** (alignement **BM-10 / BM-11** : traçabilité des jeux de données).

---

## 5. Alignement `REGLES_METIER.md` — écarts et points de vigilance

| ID | Exigence | Commentaire / écart |
|----|----------|---------------------|
| **BM-01 / BM-07** | Maille « active » étudiant = missions actives, `COUNT(DISTINCT colab_missions.maille_id)` | Le code Colab a été itéré (assignments vs `v_maille_status`) : **vérification régression** + tests API sur `/colab/students` obligatoires après chaque changement. |
| **BM-09** | Statut canon via `v_maille_status` ; pas de recalcul local arbitraire | Tension historique résolue pour **KPI maille active** en faveur de la définition **BM-07** : documenter dans la spec API la **source** utilisée par chaque champ JSON. |
| **BM-13 / BM-14** | Validité géographique mission ↔ maille | Les zones seed « approximatives » (Oti, Fosse) **ne remplacent pas** une validation terrain ; risque de **décisions métier** sur emprises fausses — **priorité géotechnique** : corriger Fosse + ajouter Bado/Mono avec sources. |
| **BM-18 – BM-20** | RBAC + audit sur actions sensibles | Les endpoints `/ai/*` modifiant la base doivent rester **derrière auth** + permissions explicites ; vérifier **cohérence** avec l’UI Infer/Opti (pas d’action destructive sans permission). |
| **BM-SYNC-*** | Idempotence, traçabilité sync Desktop | Toute nouvelle migration « lourde » (refresh 29k mailles) doit prévoir **mode batch** + **états** pour ne pas bloquer le Desktop offline-first. |

---

## 6. Contrats (`docs/CONTRAT_*.md`) — implications

- **Stabilisation Desktop / migrations idempotentes :** nouvelles migrations zones + gros `REFRESH` doivent suivre les patterns **guards** et **réversibilité** décrits dans `CONTRAT_STABILISATION_DESKTOP.md`.
- **Seed / packaging :** si les couches SIG sont requises pour l’IA contextuelle, elles doivent entrer dans la **politique de seed** (`CONTRAT_SEED_DUMP*.md`) avec **hash / manifest** (**BM-10, BM-11**).

---

## 7. Roadmap par blocs — jusqu’à achèvement « vision utilisateur »

Les blocs sont ordonnés pour **réduire le risque** (données et géométrie d’abord, puis modèles, puis UX et industrialisation).

### Bloc A — Géographie et zones d’étude (priorité géotechnique)

1. **Corriger l’emprise `FOSSE_LIONS_TG`** (coordonnées nord Togo / Dapaong) à partir d’une source cartographique ou d’un périmètre validé expert ; relancer `recalc_mailles_zones_etude`.
2. **Ajouter `DEPRESSION_BADO_TG` et `PLAINE_MONO_TG`** : géométries provisoires documentées « approximate », puis remplacement par SIG officiel (FAO/ORSTOM, etc.).
3. **Script / procédure** `import_zone_*.py` ou migration dédiée : même pipeline que Lama (geom 25231 + recalcul mailles).
4. **UI carte** : même famille symbologique « dépression / plaine d’étude » pour **toutes** les zones publiées + légende unique « zones d’étude Atlas ».
5. **Critère d’acceptation :** `GET /api/zones-etude` retourne **5** zones cohérentes ; stats `nb_mailles_*` plausibles par rapport au terrain.

### Bloc B — Données contextuelles et répertoire `ressource/`

1. **Inventaire Git** : s’assurer que `.shp/.shx/.dbf` (ou GeoPackage) des unités géol/pédo et risque sont versionnés ou documentés comme **artefacts de build**.
2. **Procédure d’import reproductible** : `import_resource_layers.py` + README court (commandes, SRID, tables).
3. **Contrôle après import :** `COUNT(*)` tables + échantillon spatial ; `refresh_ai_context_features_maille()`.
4. **Critère d’acceptation :** lien traçable **fichier → table → refresh** ; pas de divergence « DB pleine / repo vide ».

### Bloc C — Cache et performance (prérequis ML et Desktop)

1. **Remplir `ai_maille_features_fast`** : `refresh_ai_maille_features_fast()` initial + politique incrémentale (trigger / job) validée sur charge.
2. **Compléter `dsm_maille_flat_cache`** (ou documenter pourquoi DSM exclu volontairement du supervisé) et **réinjecter** dans les features si pertinent civilement (relief, drainage).
3. **Critère d’acceptation :** entraînement supervisé **sans requête multi-minute** ; pas de blocage worker sur `FOR UPDATE` long.

### Bloc D — IA : corrélation contexte → géotechnique (vision produit)

1. **Étendre `supervised_rga_train_infer.py`** (ou modèle successeur) pour joindre `ai_context_features_maille` (géol, pédo, risque, hydro encodés) + optionnellement DSM.
2. **Encodage** : catégories (one-hot / target encoding) avec garde-fous sur fuites et sur petits effectifs par classe.
3. **Multi-cibles** : aligner avec `ai_parameter_catalog` / `v_ai_prediction_plan` — un run **par cible** ou modèle multi-sortie documenté.
4. **Registry** : métriques par cible (`n_*_training`, RMSE, R²) déjà amorcées — standardiser.
5. **Critère d’acceptation :** document **features utilisées** + preuve `psql` sur `ai_model_registry` après run.

### Bloc E — Kriging / interpolation (niveau métier)

1. **Court terme :** conserver GP global comme **baseline** mais **enregistrer** chaque run dans `ai_interpolation_runs` par `parameter_id`.
2. **Moyen terme :** pour chaque couple (catégorie, paramètre) du catalogue : job dédié, stockage colonnes dédiées ou table **EAV** (`maille_id`, `parameter_id`, `value`, `method`, `quality`) — à trancher en conception pour éviter explosion de colonnes.
3. **Option ingénieur géotechnicien :** kriging ordinaire / universal avec variogramme sur **sous-région** ou par **zone d’étude** pour respecter les non-stationnarités.
4. **Critère d’acceptation :** pour chaque paramètre interpolable du catalogue, **run reproductible** + métrique de qualité (ex. CV ou variance GP).

### Bloc F — Module AG / fondation (exploitation UI)

1. Vérifier couverture `maille_geotech_foundation` vs règles de calcul dans `ai_opti.rs`.
2. **UI** : parcours « source → paramètre → carte » pour `ag_*` cohérent avec **BM** permissions.
3. **Critère d’acceptation :** scénario utilisateur complet documenté + tests API.

### Bloc G — Colab Studio (KPI et cohérence liste ↔ métrique)

1. Aligner **KPI** avec définitions **BM-07** et listes missions/étudiants.
2. Tests de non-régression sur `/colab/students` et cartes « maille active ».
3. **Critère d’acceptation :** jeux de tests SQL + réponses API stables.

### Bloc H — Qualité, tests et exploitation

1. **Suite `curl` authentifiée** (token) pour tous les `POST /ai/*` et `GET /ai/jobs/*`.
2. **Tests `psql`** : contraintes, counts, vues `v_thematic_ai_geotech`.
3. **CI** : `cargo check`, `npm run build`, smoke API si disponible.
4. **Documentation utilisateur** : onglet Infer/Opti + panneau thématique (sources, limites des modèles).

---

## 8. Tableau de synthèse « fait / partiel / manquant »

| Item | Statut |
|------|--------|
| Routes IA dans `main.rs` + `/api` | **Fait** |
| 401 sans JWT sur endpoints protégés | **Comportement attendu** |
| 3 zones seed + API | **Fait** (historique) |
| 5 zones publiées (Lama, Bado, Mono, Oti, Fosse) | **Fait** — migrations `151_zones_bado_mono_fosse_nord.sql` + recalcul `mailles_zones_etude` |
| Tables infer / interpolation / foundation 29k | **Fait** |
| Catalogue paramètres + plans SQL | **Fait** (socle) |
| Kriging « métier » par paramètre + variogramme | **Manquant** (hors GP global actuel) |
| IA utilisant géol/pédo/hydro/risque en features | **Fait (V2)** — `scripts/supervised_rga_train_infer.py` + modèle `supervised_ml_gb_v2_context` |
| `ai_maille_features_fast` + DSM cache + pipeline | **Fait** — `152_*` (DSM cache prioritaire + 5 zones), `153_*` (`refresh_atlas_ml_prereqs`) |
| Microservices `api-infer` / `api-opti` + proxy façade | **Fait** — routes internes + `ATLAS_API_*_URL` optionnels dans `api-geo` |
| Repo `ressource/` complet pour géol/pédo | **À sécuriser** |
| KPI Colab alignés BM | **Partiel** — à clôturer bloc G |

---

## 9. Prochaine action immédiate recommandée

1. **JWT** : `POST /api/ai/ml/refresh-prereqs`, `POST /api/ai/infer/train-supervised`, etc. (401 sans token = normal).  
2. **Premier remplissage cache** (DB déjà initialisée) : appliquer manuellement `151`–`153` si le volume Postgres n’a pas rejoué `docker-entrypoint-initdb.d`, puis `SELECT atlas.refresh_atlas_ml_prereqs();` ou `POST /api/ai/ml/refresh-prereqs`.  
3. **Affiner les emprises seed** (Bado, Mono, Oti, Fosse) avec SIG officiel avant usage décisionnel terrain.

---

## 10. Suite implémentée — blocs A–D + microservices (réf. code)

| Livrable | Emplacement / détail |
|----------|----------------------|
| **Bloc A** — 5 zones | `db/migrations/151_zones_bado_mono_fosse_nord.sql` (`DEPRESSION_BADO_TG`, `PLAINE_MONO_TG`, correction `FOSSE_LIONS_TG` nord) |
| **Bloc B** — traçabilité ressources | `docs/RESSOURCES_ATLAS.md` |
| **Bloc C** — cache DSM + features rapides + pipeline | `152_ai_maille_features_fast_dsm_and_zones.sql`, `153_refresh_atlas_ml_prereqs.sql`, endpoint `POST /api/ai/ml/refresh-prereqs` |
| **Bloc D** — supervisé contexte | `scripts/supervised_rga_train_infer.py` (DSM + `ai_context_features_maille` + overlap 5 zones), registry `supervised_ml_gb_v2_context` |
| **api-infer** | `services/api-infer/` — `POST /internal/kriging/recompute`, `POST /internal/supervised/train` (header `X-Internal-Token`) |
| **api-opti** | `services/api-opti/` — `POST /internal/opti/strategie` |
| **Façade** | `services/api-geo/src/internal_services.rs` — si `ATLAS_API_INFER_URL` / `ATLAS_API_OPTI_URL` vides → exécution Python locale inchangée |
| **Docker** | `docker compose --profile ai-split up -d` + dans `.env` : `ATLAS_API_INFER_URL=http://api-infer:8000`, `ATLAS_API_OPTI_URL=http://api-opti:8000`, `ATLAS_INTERNAL_SERVICE_TOKEN=...` (identique sur les 3 services) |

**Vérifications rapides**

- `GET /api/zones-etude` → 5 zones publiées.  
- `cargo check` dans `services/api-geo`, `api-infer`, `api-opti`.  
- `curl -sS http://127.0.0.1:8002/healthz` (api-infer) et `:8003` (api-opti) après profil `ai-split`.

---

*Document généré à partir de l’analyse du dépôt, d’exécutions `curl` et `psql` sur l’environnement disponible au moment de la rédaction. Rejouer les comptages après imports ou migrations locales.*
