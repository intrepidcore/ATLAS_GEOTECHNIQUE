---
description: "Session changelog raisonné — enchaînement roadmap P2→P8 (KED national EG H1–H3, santé données AMESSEFE, P3 IP, P4 granulo KED, P5 IP dérivé WL/WP, P6 RGA depuis KED H2, P7 variogrammes API+cache, P8 file jobs non-bloquante), durcissement CI release, intégrations UI (thématique, drawer scientifique, DB Manager expert), analyse UX layout dual-shell ; blocages Docker/DNS, auth curl, SQL escaping"
date: 2026-04-03
weekday: vendredi
repo: atlas_reclone
backend: services/api-geo (Rust/Axum)
db: PostgreSQL/PostGIS (schema atlas)
pipeline: Python (pykrige, pandas, psycopg2)
ui: ui (Vite — index.html carte vanilla + React db-manager.html)
infra: Docker Compose, GitHub Actions
---

# Session — Changelog raisonné (2026-04-03)

> **Portée documentaire.** Ce fichier synthétise une **session de travail étendue** (conversation agent + implémentations successives) visant la **complétion des phases P2 à P8** de la roadmap géotechnique Atlas, la **correction de données** AMESSEFE avant propagation nationale, le **durcissement CI** (gates SQL/API), et les **correctifs d’intégration UI** liés aux retours utilisateur (panneau thématique, drawer scientifique, gestionnaire BDD). Le texte est structuré pour la **traçabilité qualité** (ingénierie, métier, maintenance).

---

## Table des matières (navigation logique)

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Grille dinformation explicite implicite manquante](#2-grille-dinformation-explicite-implicite-manquante)
3. [Chronologie du développement par phase roadmap](#3-chronologie-du-développement-par-phase-roadmap)
4. [Base de données migrations et schéma](#4-base-de-données-migrations-et-schéma)
5. [Backend API Rust thematic et ai_plots](#5-backend-api-rust-thematic-et-ai_plots)
6. [Pipelines Python et scripts opérationnels](#6-pipelines-python-et-scripts-opérationnels)
7. [Interface utilisateur intégrations et limites architecturales](#7-interface-utilisateur-intégrations-et-limites-architecturales)
8. [CI gates et automatisation release](#8-ci-gates-et-automatisation-release)
9. [Blocages observés stratégies de debug et validations](#9-blocages-observés-stratégies-de-debug-et-validations)
10. [Décisions darchitecture et arbitrages](#10-décisions-darchitecture-et-arbitrages)
11. [Implications métier géotechniques](#11-implications-métier-géotechniques)
12. [Perspectives évolution et stabilisation](#12-perspectives-évolution-et-stabilisation)
13. [Annexe commandes et critères de reproductibilité](#13-annexe-commandes-et-critères-de-reproductibilité)

---

## 1) Synthèse exécutive

### 1.1 Objectif métier global

Mettre en cohérence **toute la chaîne** « terrain → base → interpolation géostatistique (KED / résidu) → dérivés scientifiques (IP à partir de WL/WP interpolés, RGA à partir de règles sur horizons) → restitution cartographique et contrôles automatiques », pour le périmètre **Atlas Togo** et les jeux de données **AMESSEFE** (contrôle qualité avant généralisation sur ~29k mailles).

### 1.2 Objectifs techniques explicites de la session

- **P2** : KED national pour le paramètre **EG** (indice de gonflement) sur horizons **H1, H2, H3**, avec **gates SQL** (couverture, plages physiques, cohérence vues) et **gates API** (`/thematic/data` ou équivalent avec filtres ADM si applicables).
- **Pré-P3** : tableau de **santé AMESSEFE** (Excel brut vs base pour WL, WP, IP calculé ; seuil divergence **> 0.1**), correction des divergences identifiées (priorité localités signalées), **gate stricte** `divergence_gt_0.1 == 0`.
- **P3** : interpolation IP directe (chaîne existante KED VBS / contexte IP), en cohérence avec catalogues et vues.
- **P4** : runner KED **granulométrie** (`passant_2mm`, `passant_80um`) sur H1–H3, persistance `ai_interpolation_*`, `ai_variograms`, supersession des valeurs actives.
- **P5** : script **IP dérivé** `ip_derived_h* = f(WL_ked, WP_ked)` avec règles roadmap (clip négatif, supersession de `ip_ked_h*` et anciens `ip_derived`).
- **P6** : **RGA déterministe** depuis combinaison `ip_derived_h2`, `vbs_ked_h2`, `eg_ked_h2`, métadonnées `source_type` / `model_version` sur `maille_geotech_infer`.
- **P7** : endpoint **`POST /ai/plots/variogram`** avec cache `atlas.ai_plot_cache`, script Python génération SVG, intégration UI drawer avec repli JS.
- **P8** : **file de jobs** `ai_job_queue`, trigger **non bloquant** après insert `sondages`, déduplication sémantique (index partiel unique), colonnes seuils dans `ai_parameter_catalog`.

### 1.3 Livrables transverses

- **Migrations SQL** numérotées (ex. 169–173 selon séquence dépôt).
- **Scripts CI** bash (`scripts/ci/p4_p8_release_gates.sh`) et workflow GitHub Actions déclenché sur **release** / `workflow_dispatch`.
- **Correctifs UI** : catalogue thématique étendu, logique « source interpolation » vs objectifs métier, drawer scientifique (hauteur carte + fetch variogramme), onglet **Expert scientifique avancé** dans le **modal vanilla** DB Manager.

---

## 2) Grille d’information explicite, implicite, manquante

### 2.1 Explicite (énoncés utilisateur ou tickets)

- Enchaînement **P2 puis contrôles** avant P3 ; **tableau santé** AMESSEFE avec seuil **0.1** ; correction des **4 divergences** (priorité **kpadape**, **tchalo**) ; **pas d’attente** entre étapes : exécution autonome.
- Roadmap **P4–P8** lue depuis `docs/roadmap_30_03_2026_4.md` (et variantes _3 / _2 / base selon références session).
- Après implémentation : **durcissement CI** ; liste de **vérifications UI** ; puis retours UX : paramètres thématiques manquants, variogramme invisible ou incorrect, drawer trop haut / superposition, onglet expert absent selon l’écran utilisé.
- Demande finale d’**analyse sans implémentation** : plan de correction layout (drawer ne pousse pas les panneaux latéraux), bbox zones d’étude trop imposante, variogramme « pas un vrai graphe », confusion **shell React db-manager** vs **modal vanilla**.

### 2.2 Implicite (déduit code + architecture)

- **Authentification** requise pour endpoints sensibles (`/ai/plots/variogram` : Bearer) — les tests `curl` doivent inclure **`POST /auth/login`** préalable.
- Les **paramètres thématiques** ne sont visibles que si la combinaison **source** (`base` | `interpolation` | `ia`) + **objectif métier** + éventuellement **mode expert** active le bon sous-ensemble dans `thematic-types.ts` ; l’utilisateur peut croire à un défaut API alors que la **sélection UI** affiche encore `n_sondages` ou une catégorie non « granulo » / « argilosité ».
- **Double application UI** :
  - **Carte** : `index.html` + `main.ts` (vanilla) + panneau thématique injecté, drawer scientifique, ouverture **DB Manager** via module vanilla.
  - **Page** `db-manager.html` : **React** `App.tsx` (onglets Tables, Staging, Infer/Opti via `InferOptiCommandCenterDbPanel`, etc.) — **ne monte pas** `DbManagerModalComponent` où l’onglet « Expert scientifique avancé » a été ajouté.
- Le **variogramme « backend »** : le script Python `generate_variogram_plot.py` construit un SVG qui est avant tout une **représentation tabulaire** des métadonnées `ai_variograms` (ce n’est pas une courbe γ(h) sauf évolution future). L’UI rasterise ce SVG dans un `<canvas>` : le ressenti « brut de données » est **cohérent avec le code actuel**, pas nécessairement avec l’attente métier « variogramme expérimental ».

### 2.3 Manquante ou à compléter en exploitation

- **État exact de la base** sur chaque machine : les gates « données présentes » pour `passant_*_ked_h*`, `ip_derived_h*`, `eg_ked_h*` supposent que les **runners Python** ont été exécutés jusqu’au bout sur **cette** instance PostgreSQL.
- **Réseau Docker build** : échec `apt-get` / résolution `deb.debian.org` lors de `docker compose build` — **bloquant pour rebuild image** mais pas forcément pour hot-reload scripts montés en volume.
- **Preuves utilisateur** : captures montrant Nigeria au lieu du Togo — peut indiquer **jeu de tuiles / vue carte** ou contexte de démo ; à distinguer d’un bug API (vérifier bbox et filtres ADM).

---

## 3) Chronologie du développement par phase roadmap

### 3.1 Phase P2 — KED EG horizons H1–H3

**Compréhension du problème.**  
L’indice de gonflement **EG** doit être modélisé spatialement de façon cohérente avec le reste des couches KED (drift, résidu, domaines), avec **réplicabilité** et **contrôles** avant usage cartographique national.

**Stratégie.**  
S’aligner sur les runners KED existants (ex. patterns `run_ked_*_horizons.py`), garantir :

- enregistrement dans `ai_parameter_catalog` ;
- écriture dans `ai_interpolation_runs`, `ai_variograms`, `ai_interpolation_values` ;
- marquage `is_superseded` pour éviter double vérité.

**Implémentation (logique).**  
Script dédié chargé de parcourir H1–H3, charger les points d’entraînement depuis les tables métier (ex. liaisons sondages / essais / granulo ou EG selon schéma), appliquer RK, LOO RMSE, clipping aux bornes physiques définies roadmap.

**Validation.**  
- **SQL** : comptages de mailles couvertes, min/max sur les horizons, absence de valeurs hors bornes.  
- **API** : requêtes thématiques avec `parameter` = colonnes `eg_ked_h*` reconnues par l’enum Rust.

**Raisonnement métier.**  
L’EG est un indicateur de **potentiel de gonflement** ; son interpolation doit rester **conditionnée** aux covariables et domaines géologiques/pédologiques lorsque le modèle le prévoit, sous peine de lissage non physique.

---

### 3.2 Contrôle qualité AMESSEFE (pré-P3)

**Problème.**  
Des écarts Excel ↔ DB sur WL, WP, IP peuvent **se propager** à 29k+ mailles via l’interpolation ; le coût de correction augmente avec la distance au stockage brut.

**Méthode.**  
- Parsing Excel via utilitaires projet (`scripts/utils/amessefe_excel.py` ou équivalent).  
- Comparaison systématique avec requêtes SQL sur `essais_atterberg` / jointures localités.  
- Calcul IP : alignement sur règle **`ip_generated = wl - wp`** (voir trigger migration **169**).

**Décision trigger `ip_generated`.**  
Migration **`169_fix_trigger_ip_generated.sql`** : fonction `atlas.compute_ip_generated` en `BEFORE INSERT OR UPDATE` sur `atlas.essais_atterberg` pour maintenir la cohérence WL/WP → IP au niveau base.

```sql
-- Principe (extrait conceptuel, fichier réel dans db/migrations/169_*.sql)
IF NEW.wl IS NOT NULL AND NEW.wp IS NOT NULL THEN
  NEW.ip_generated := NEW.wl - NEW.wp;
```

**Gate.**  
Tableau des divergences ; correction **ciblée** des lignes (ex. localités **kpadape**, **tchalo** en priorité) ; régénération du rapport jusqu’à **zéro** divergence au-delà du seuil.

**Implication.**  
Sans cette étape, les phases P3–P5 « améliorent » mathématiquement des **entrées fausses** — erreur d’ingénierie des données.

---

### 3.3 Phase P3 — IP interpolation directe (chaîne KED IP)

**Contexte.**  
Phase nécessaire dans la chronologie avant de **préférer** l’IP dérivé WL/WP (P5) comme source d’autorité pour les couches finales.

**Technique.**  
Runners Python alignés sur VBS/IP/WL/WP ; persistance et vues `v_latest_ai_interpolation` ; cohérence avec `ThematicParameter` côté API.

---

### 3.4 Phase P4 — Granulométrie KED (passant_2mm, passant_80um × H1–H3)

**Script.**  
`scripts/run_ked_granulo_horizons.py` (nouveau), calqué sur la structure des runners horizons existants.

**Points de conception.**

1. **GranuloCfg** : tamis, bornes 0–100 %, unité.  
2. **`ensure_param`** : insertion cataloguée `ai_parameter_catalog`.  
3. **`load_training_points`** depuis `atlas.granulo_points`.  
4. **`run_one`** : drift, RK, clip, LOO, supersession puis insert.

**Migration seed.**  
`170_seed_p4_p5_ked_granulo_ip_derived.sql` : graines pour **6** paramètres granulo KED + **3** paramètres IP dérivé (métadonnées).

**Extension API.**  
Dans `thematic/types.rs` : variantes `Passant2mmKedH1`…, `Passant80umKedH1`…  
Dans `thematic/routes.rs` : élargir `is_ai_parameter` ; refactor **`is_ked_parameter`** pour éviter liste exhaustive :

```rust
// Logique retenue (conceptuelle)
column.contains("_ked_h") || column.starts_with("ip_derived_h")
```

Cela réduit la **dette de maintenance** quand de nouveaux `*_ked_h*` sont ajoutés.

**Qualification SQL ADM.**  
Pour grille **2km** et paramètres KED, qualifier `adm2_name` / `adm3_name` avec alias **`ms.`** pour lever les ambiguïtés de jointure — correction d’erreurs SQL de type « column reference is ambiguous ».

---

### 3.5 Phase P5 — IP dérivé depuis WL_ked et WP_ked

**Script.**  
`scripts/derive_ip_ked_from_wl_wp.py`.

**Règles métier (raisonnement).**  
- Pour chaque horizon : lire `wl_ked_h*` et `wp_ked_h*` dans `v_latest_ai_interpolation`.  
- Calculer `ip_derived = WL_ked - WP_ked`, **clip** des négatifs à `0.0` (roadmap).  
- **Supersession** : marquer `ip_ked_h*` (P3) et anciens `ip_derived_h*` avant insertion — **R5-04** : la chaîne dérivée devient la référence pour l’analyse ultérieure (RGA P6).

**Pourquoi c’est scientifiquement préférable.**  
L’IP n’est pas indépendant de WL et WP ; interpoler IP **directement** peut introduire des incohérences internes ; le dérivé des surfaces WL/WP respecte la **structure physique** des limites d’Atterberg une fois les surfaces lissées.

---

### 3.6 Phase P6 — RGA dérivé des surfaces KED (horizon H2)

**Script.**  
`scripts/derive_rga_from_ked_h2.py`.

**Entrées.**  
- `ip_derived_h2`  
- `vbs_ked_h2`  
- `eg_ked_h2`  

**Sorties.**  
`rga_score`, `rga_class`, `bearing_capacity_kpa`, `settlement_risk_pct`, `confidence_score` dans `atlas.maille_geotech_infer`.

**Migration.**  
`171_p6_source_type_on_maille_geotech_infer.sql` : colonnes `source_type` (défaut `derived_rga_from_rules`), `source_details` JSONB.

**Valeur `source_type` pour ce pipeline.**  
`derived_rga_from_ked` avec `model_version` du type `derived_rga_from_ked_h2_v1` — traçabilité **provenance** vs anciennes règles uniquement RGA.

**Méthode `classify_rga`.**  
Poids et seuils **déterministes** (reproductibles) — indispensable pour audit et comparaisons inter-run.

---

### 3.7 Phase P7 — Variogrammes : API, cache, UI

**Migration.**  
`172_ai_plot_cache_and_variogram_endpoint_support.sql` : table `atlas.ai_plot_cache` (`cache_key` unique, `plot_type`, `parameter_id`, `horizon_label`, `run_id`, `svg`, `payload` JSONB, timestamps).

**Backend Rust.**  
Module `ai_plots.rs` : handler `POST /ai/plots/variogram` :

1. Calcul clé cache ; hit → retour SVG + `cached: true`.  
2. Miss → `run_python_json` sur `scripts/generate_variogram_plot.py` ; UPSERT cache ; retour `cached: false`.

**Script Python — rôle réel.**  
La fonction `make_svg` produit un **tableau texte** des colonnes `created_at`, `model_type`, `loo_rmse`, `fit_quality` — utile pour **audit**, pas pour un jury attendant γ(h) vs distance.

```python
# Extrait significatif — scripts/generate_variogram_plot.py
def make_svg(title: str, rows: list[tuple]) -> str:
    width, height = 900, 420
    ...
    svg_lines.append(
        '<text ...>created_at | model_type | loo_rmse | fit_quality</text>'
    )
    for i, (created_at, model_type, loo_rmse, fit_quality) in enumerate(rows[:10]):
        fq = json.dumps(fit_quality or {}, ensure_ascii=False)[:95]
        txt = f"{created_at} | {model_type or 'n/a'} | {rmse} | {fq}"
```

**Bug corrigé (session).**  
Filtre horizon **sensible à la casse** : stockage `h1` vs requête `H1` → aucune ligne → « No variogram data ».  
**Correctif** : comparaison `LOWER(COALESCE(fit_quality->>'horizon_label','')) = LOWER(%s)`.

**Frontend** `scientific-drawer.ts` :

- `fetchVariogramSvgFromApi` avec `Authorization: Bearer` et timeout.  
- `renderSvgIntoCanvas` : blob SVG → `Image` → `drawImage` sur canvas.  
- **Fallback** : variogramme expérimental approximatif côté client (pairs de points, bins distance) si API échoue.

**UX carte.**  
`setMapHeightForDrawerState` : réduit la hauteur de **`#map`** quand le drawer est ouvert ; `invalidateLeafletMapSize()` ; CSS `#scientificDrawer` hauteur **40vh** (réduction vs 60vh).

**Limite connue (analyse post-session).**  
Seule la **carte** est redimensionnée ; `#dashboard` et `#sidebar` restent en `height: calc(100vh - 52px)` — le drawer **fixed** recouvre le bas des colonnes. Correction future : variable CSS `--scientific-drawer-offset` partagée (voir section 12).

---

### 3.8 Phase P8 — File d’attente IA non bloquante

**Migration.**  
`173_p8_ai_job_queue_non_blocking.sql` :

- Colonnes `min_pts_stratified`, `min_pts_rk` sur `ai_parameter_catalog`.  
- Table `ai_job_queue` avec contraintes `job_type`, `status`.  
- Index unique partiel pour **déduplication** des jobs actifs par `(parameter_id, job_type, coalesce(payload->>'horizon',''))`.  
- Fonction `atlas.enqueue_ai_jobs_after_sondage_non_blocking()` ; trigger `AFTER INSERT` sur `atlas.sondages`.  
- **Bloc `EXCEPTION WHEN OTHERS THEN NULL`** autour de la logique métier — **R8-01** : jamais faire échouer la transaction d’import pour un problème de file.

**Raisonnement.**  
Les imports terrain sont **critiques** ; l’amélioration des modèles est **asynchrone**. Le trigger doit **notifier** sans **bloquer**.

**UI.**  
Dans `DbManagerModalComponent.ts` (vanilla), onglet **Expert scientifique avancé** : tables via `api.getTableData` sur `ai_parameter_catalog`, `ai_job_queue`, `ai_plot_cache`.

---

## 4) Base de données — migrations et schéma

| Fichier (indicatif) | Rôle |
|---------------------|------|
| `169_fix_trigger_ip_generated.sql` | Trigger IP généré sur essais Atterberg |
| `170_seed_p4_p5_ked_granulo_ip_derived.sql` | Catalogue paramètres P4/P5 |
| `171_p6_source_type_on_maille_geotech_infer.sql` | Traçabilité source RGA |
| `172_ai_plot_cache_and_variogram_endpoint_support.sql` | Cache SVG |
| `173_p8_ai_job_queue_non_blocking.sql` | File jobs + trigger |

**Vues / tables consommant les résultats.**  
`v_latest_ai_interpolation`, éventuellement `v_thematic_ai_geotech` selon migrations antérieures — les endpoints thématiques s’appuient sur ces **snapshots** pour éviter de lire toute l’historique des runs.

---

## 5) Backend API — `thematic` et `ai_plots`

### 5.1 Enum et colonnes

Le typage strict `ThematicParameter` garantit que seules les colonnes connues sont injectées dans le SQL dynamique — évolution **P4/P5** = ajout de variantes + méthodes `sql_column`, `label`, `unit`, `category`.

### 5.2 Route variogramme

- **Auth** : même mécanisme que le reste de l’API sécurisée.  
- **Cache** : réduction charge Python + déterminisme des réponses pour l’UI.

### 5.3 Point d’entrée `main.rs`

`mod ai_plots;` et fusion du router `ai_plots::ai_plots_routes()` dans le routeur principal.

---

## 6) Pipelines Python et scripts opérationnels

### 6.1 Dépendances

`pandas`, `numpy`, `psycopg2`, `pykrige` (selon scripts), environnement **`DATABASE_URL`**.

### 6.2 Ordre d’exécution recommandé (exploitation)

1. Migrations jusqu’à 173.  
2. Runners KED par famille (EG, granulo, IP/WL/VBS selon roadmap).  
3. `derive_ip_ked_from_wl_wp.py`.  
4. `derive_rga_from_ked_h2.py`.  
5. Contrôles SQL + appels API + invalidation cache variogramme si besoin (`DELETE` ciblée sur `ai_plot_cache` après changement de logique Python).

### 6.3 Idempotence

Les scripts utilisent **UPSERT** / **ON CONFLICT** / **supersession** pour permettre **relances** sans duplication de vérité.

---

## 7) Interface utilisateur — intégrations et limites architecturales

### 7.1 Thématique — `thematic-types.ts`

- Ajout des définitions **`passant_2mm_ked_h1..h3`**, **`passant_80um_ked_h1..h3`**, **`ip_derived_h1..h3`**.  
- Mise à jour **`THEMATIC_PALETTE_MAP`**, **`getParametersForObjectifAndSource`**, **`getParametersBySource`**.  
- Filtres **IA** incluant `ag_safety_factor`, `ag_cout_millions` où prévu.

**Tests Vitest** : `thematic-types-source.spec.ts` — scénarios « interpolation + argilosité », « interpolation + granulométrie ».

**Pourquoi l’utilisateur peut « ne pas voir » les paramètres.**  
- Objectif **couverture** → paramètres de densité, pas KED.  
- Source **base** au lieu d’**interpolation**.  
- Données absentes en base → carte vide malgré liste correcte.

### 7.2 Drawer scientifique — `scientific-drawer.ts`

- EDA / corrélations : appels **en dur** à `kriging_vbs` et `kriging_ip` — **comportement voulu pour prototype** mais renforce la perception « seuls IP et VBS sont interpolés » dans ce panneau.

### 7.3 DB Manager — dualité critique

| Surface | Technologie | Onglet « Expert scientifique avancé » |
|---------|-------------|--------------------------------------|
| Modal depuis carte | `DbManagerModalComponent` vanilla | **Oui** (implémenté) |
| Page `/db-manager.html` | React `App.tsx` | **Non** — utilise `InferOptiCommandCenterDbPanel` |

**Conséquence.**  
L’utilisateur qui ouvre **uniquement** la page React ne verra **pas** l’onglet ajouté au composant vanilla — ce n’est pas un oubli de refresh : **deux codebases d’UI** pour le même métier « gestion BDD ».

### 7.4 Légende « Zones d’étude Atlas »

Implémentée comme **contrôle Leaflet** `bottomleft` dans `main.ts` (`ensureDepressionsLegendVisible`), HTML inline volumineux.  
**Demande utilisateur** : déplacer vers le **panneau gauche** sous la légende principale — **non implémentée** dans la session décrite ; reste une **perspective UX** (section 12).

---

## 8) CI — gates et automatisation release

### 8.1 Script `scripts/ci/p4_p8_release_gates.sh`

Enchaînement typique :

- Démarrage service `db`, attente readiness.  
- Application migrations **169–173**.  
- Exécution scripts Python P4, P5, P6.  
- Build / start `api-geo`, attente health.  
- Gates SQL (couvertures, plages, RGA, IP non négatif, etc.).  
- Smoke API (thématique, filtres ADM).  
- P7 : login → `POST /ai/plots/variogram` — première réponse `cached=false`, seconde `cached=true`.  
- P8 : test déduplication jobs (double insert → un actif).

### 8.2 Workflow GitHub Actions

Fichier type `.github/workflows/p4-p8-release-gates.yml` : déclenchement **`release.created`**, **`workflow_dispatch`**.

### 8.3 Arbitrage CI

Item **optionnel** restant : scinder **CI rapide** (lint, unit) vs **release lourde** (KED complet) pour ne pas multiplier le coût machine à chaque push — **non clos** dans la session.

---

## 9) Blocages observés, stratégies de debug et validations

### 9.1 Migration absente du conteneur

**Symptôme.**  
`psql: ... No such file or directory` pour fichier sous `/tmp` dans le conteneur.

**Stratégie.**  
`docker cp` du fichier SQL vers le conteneur puis `psql -f` — le système de fichiers hôte n’est pas toujours monté au chemin attendu.

### 9.2 Patch Rust context mismatch

**Symptôme.**  
Échec `apply_patch` sur `routes.rs`.

**Stratégie.**  
Relecture du fichier, patchs **plus petits**, ancrage sur contexte exact.

### 9.3 curl — URL mal formée

**Symptôme.**  
`curl: (3) URL rejected: Port number was not a decimal number`.

**Cause.**  
JSON mailformé dans la chaîne shell — utiliser `json.dumps()` côté Python ou fichiers payload.

### 9.4 Authentification variogramme

**Symptôme.**  
`MISSING_TOKEN` / `Token manquant`.

**Stratégie.**  
Séquence **`POST /auth/login`** avec identifiants seed, réutilisation `Authorization: Bearer`.

### 9.5 psql — chaîne SQL non terminée

**Symptôme.**  
`unterminated quoted string` lors de tests P8 via Python inline.

**Stratégie.**  
Échapper correctement le JSON dans le littéral SQL ou utiliser **paramètres** / fichiers `.sql`.

### 9.6 Docker build — DNS

**Symptôme.**  
`Could not resolve 'deb.debian.org'` pendant `apt-get`.

**Impact.**  
Rebuild image **api-geo** potentiellement bloqué en environnement réseau restreint ; contournement : image prébuild, mirror Debian, ou exécution binaire hors Docker.

### 9.7 Python one-liner multiligne

**Symptôme.**  
`SyntaxError: unexpected character after line continuation character`.

**Stratégie.**  
Script `.py` dédié ou une seule ligne sans `\` mal placés.

---

## 10) Décisions d’architecture et arbitrages

1. **`is_ked_parameter` par pattern** plutôt que `matches!` exhaustif — **maintenabilité** vs risque de faux positif si un futur champ contient accidentellement `_ked_h` (mitigation : convention de nommage stricte).  
2. **IP dérivé** comme couche de référence pour RGA H2 — **cohérence physique** vs simplicité P3.  
3. **Trigger P8 non bloquant** — **priorité à l’import** vs garantie d’enqueue (jobs peut être manquant si erreur aval ; monitoring via file).  
4. **SVG métadonnées** pour P7 — **livraison rapide** contrat roadmap vs **dette** « vrai graphe variographique ».  
5. **Deux UIs DB** — pas unifié dans la session ; **dette UX** assumée.

---

## 11) Implications métier géotechniques

- **EG, VBS, IP, granulométrie** : chaque couche doit être lue avec son **horizon** (H1/H2/H3) — erreur fréquente de mélanger profondeurs.  
- **IP dérivé** : interprétation **compatible** avec la plasticité si WL/WP sont cohérents spatialement.  
- **RGA** : classification **déterministe** permet la **réplication** des cartes de risque pour rapport réglementaire ; documenter version `model_version`.  
- **Zones d’étude** : la légende rappelle chevauchements et transparence — important pour ne pas **sur-interpréter** une maille limite.

---

## 12) Perspectives d’évolution et de stabilisation

### 12.1 UX layout (priorité haute retour utilisateur)

- Propager `--scientific-drawer-height` à `#dashboard`, `#sidebar`, `#thematicPanel`.  
- Ou refactor **flex column** : carte + sidebars dans une région qui **rétrécit** ensemble.

### 12.2 Légende zones d’étude

- Retirer le contrôle Leaflet verbeux ; panneau gauche compact + lien « Aide ».

### 12.3 Variogramme scientifique

- Étendre `ai_variograms` ou `fit_quality` pour **bins** exportables ; deuxième endpoint JSON + Chart.js.  
- Ou afficher SVG **inline** sans rasterisation canvas pour texte.

### 12.4 Unification « Expert »

- Portage React : nouvel onglet ou section dans `InferOptiCommandCenterDbPanel` / `App.tsx` avec mêmes tables.

### 12.5 Drawer scientifique

- Sélecteurs dynamiques de paramètres KED (pas seulement `kriging_vbs` / `kriging_ip`).

### 12.6 CI

- Niveau 1 / niveau 2 ; cache Docker ; artifacts logs SQL.

---

## 13) Annexe — commandes et critères de reproductibilité

### 13.1 Santé API

```bash
curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:8000/healthz"
```

### 13.2 Login (JWT)

```bash
curl -sS -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@atlas.local\",\"password\":\"Atlas2024!\"}"
```

### 13.3 Variogramme (avec token)

```bash
# TOKEN extrait du JSON de login
curl -sS -X POST "http://127.0.0.1:8000/api/ai/plots/variogram" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"parameter_id\":\"eg_ked_h1\",\"horizon\":\"H1\"}"
```

**Critères de succès P7.**  
JSON avec `svg` non vide, `cached` passant de `false` à `true` sur requêtes identiques (après premier remplissage cache).

### 13.4 Thématique (exemple paramètre KED)

```bash
curl -sS -G "http://127.0.0.1:8000/api/thematic/data" \
  --data-urlencode "parameter=passant_2mm_ked_h2" \
  --data-urlencode "grid=2km" \
  --data-urlencode "include_geometry=false" \
  -H "Authorization: Bearer $TOKEN"
```

**Interprétation.**  
Si `features` est vide : vérifier **présence en base** des valeurs interpolées pour ce `parameter_id`, pas seulement l’existence de la route.

### 13.5 Tests UI unitaires

```powershell
cd atlas_reclone/ui
npm run test:unit
```

### 13.6 Build UI

```powershell
npm run build
```

---

## 14) Matrice de traçabilité exigence → artefact

| Exigence | Artefact principal |
|----------|-------------------|
| Cohérence WL/WP/IP terrain | Trigger 169 + corrections SQL ciblées |
| KED EG multi-horizons | Runners + catalog + vues |
| KED granulo | `run_ked_granulo_horizons.py` + migration 170 |
| IP dérivé | `derive_ip_ked_from_wl_wp.py` |
| RGA KED H2 | `derive_rga_from_ked_h2.py` + 171 |
| Variogramme service | 172 + `ai_plots.rs` + Python |
| Auto-amélioration non bloquante | 173 |
| CI release | `p4_p8_release_gates.sh` + workflow |
| UI paramètres | `thematic-types.ts` + tests |
| UI variogramme | `scientific-drawer.ts` + cache |
| UI expert (vanilla) | `DbManagerModalComponent.ts` |

---

## 15) Synthèse des interactions entre composants

```
[Excel AMESSEFE] --> import --> [essais_atterberg + trigger ip_generated]
        |
        v
[sondages / essais] --trigger P8--> [ai_job_queue] (async)
        |
        v
[Scripts Python KED] --> [ai_interpolation_runs / values / ai_variograms]
        |
        v
[derive_ip_ked_from_wl_wp] --> [ip_derived_h*]
        |
        v
[derive_rga_from_ked_h2] --> [maille_geotech_infer]
        |
        v
[api-geo thematic/data] <-- JWT --- [UI carte / thématique]
        |
        +---- [POST /ai/plots/variogram] --> [ai_plot_cache] --> [scientific-drawer]
```

---

## 16) Leçons apprises (ingénierie logicielle)

1. **Symptôme UI ≠ cause** : liste déroulante « interpolation » sans bon objectif → faux diagnostic « API cassée ».  
2. **Contrats visuels** : un SVG peut être **valide** mais **scientifiquement insuffisant** — la gestion des attentes passe par l’intitulé et la doc.  
3. **Multi-shell UI** : toute feature sur un composant non partagé **duplique** le risque de perception « manquante ».  
4. **Gates SQL avant carto nationale** : le coût d’erreur est **multiplié** par le nombre de mailles.

---

## 17) État de clôture session (checklist)

- [x] Roadmap P2–P8 implémentée dans le dépôt (fichiers listés sections 3–8).  
- [x] Contrôle AMESSEFE + corrections divergences + gate 0.1 (session agent).  
- [x] CI gates script + workflow release.  
- [x] Correctifs UI catalogue thématique, drawer, onglet expert vanilla.  
- [ ] Unification Expert sur React `db-manager.html`.  
- [ ] Layout drawer + panneaux latéraux synchronisés.  
- [ ] Variogramme « courbe » scientifique (évolution DB + rendu).  
- [ ] CI deux niveaux (optionnel).

---

## 18) Références fichiers clés (non exhaustif)

- `atlas_reclone/services/api-geo/src/thematic/routes.rs`  
- `atlas_reclone/services/api-geo/src/thematic/types.rs`  
- `atlas_reclone/services/api-geo/src/ai_plots.rs`  
- `atlas_reclone/services/api-geo/src/main.rs`  
- `atlas_reclone/scripts/run_ked_granulo_horizons.py`  
- `atlas_reclone/scripts/derive_ip_ked_from_wl_wp.py`  
- `atlas_reclone/scripts/derive_rga_from_ked_h2.py`  
- `atlas_reclone/scripts/generate_variogram_plot.py`  
- `atlas_reclone/scripts/ci/p4_p8_release_gates.sh`  
- `atlas_reclone/ui/src/thematic/thematic-types.ts`  
- `atlas_reclone/ui/src/thematic/thematic-types-source.spec.ts`  
- `atlas_reclone/ui/src/scientific-drawer.ts`  
- `atlas_reclone/ui/index.html`  
- `atlas_reclone/ui/src/db-manager/components-vanilla/DbManagerModalComponent.ts`  
- `atlas_reclone/ui/src/main.ts` (zones d’étude / légende Leaflet)  
- `atlas_reclone/ui/src/App.tsx` (shell React DB Manager)

---

## 19) Extension — raisonnement détaillé sur la non-ambigüité SQL (KED + ADM)

Lorsque la requête thématique joint la grille aux tables administratives, les colonnes homonymes (`adm2_name`, etc.) peuvent exister à la fois dans la sous-requête des mailles et dans la table des statistiques. Le moteur PostgreSQL exige alors une **qualification explicite**. Le choix d’un alias stable (`ms` pour « maille stats » ou équivalent réel dans le dépôt) n’est pas cosmétique : c’est une **condition de robustesse** pour toute évolution future des jointures. Sans cela, une migration ajoutant une colonne du même nom dans une autre table participante pourrait **cass**er la production sans changement apparent dans le code applicatif Rust — d’où l’intérêt des **tests d’intégration** SQL/API en CI.

---

## 20) Extension — raisonnement sur la supersession des interpolations

Le champ `is_superseded` (ou équivalent) dans les tables de valeurs interpolées matérialise une **version temporelle** du modèle. Du point de vue **métier**, l’utilisateur final ne doit voir que la **dernière vérité** via `v_latest_ai_interpolation`. Du point de vue **audit**, l’historique reste disponible pour comparer RMSE, scénarios de sensibilité, ou revenir en arrière après détection d’erreur de données sources. La décision de **superseder `ip_ked_h*`** lors de l’insertion de `ip_derived_h*` traduit une **priorité scientifique** : la dérivation analytique post-interpolation des limites d’Atterberg prime sur l’interpolation directe de l’IP lorsque WL et WP sont eux-mêmes issus de surfaces lissées.

---

## 21) Extension — stratégie de test des fichiers de jobs (P8)

La déduplication par index unique partiel répond à un cas d’usage réel : imports **CSV massifs** ou **scripts** pouvant insérer plusieurs sondages dans une courte fenêtre. Sans déduplication, la file pourrait contenir des **doublons** inutiles, saturant le worker et retardant des recalculs légitimes. Le test d’intégration qui insère deux fois le même job sémantique et vérifie un seul enregistrement actif est un **proxy** de cette exigence. En revanche, il ne garantit pas la **justesse métier** des seuils `min_pts_*` : ceux-ci relèvent de paramétrage `ai_parameter_catalog` et doivent être **revus** par un géostatisticien selon la densité réelle du réseau de sondages au Togo.

---

## 22) Extension — interaction infer / opti / colab

Le projet Atlas mélange **opérations batch** (Python, SQL) et **interfaces** (Command Center Infer/Opti, Colab Studio). La session documentée ne fusionne pas ces briques en un seul écran : l’**expert avancé** vanilla expose les tables brutes, tandis que **Infer/Opti React** propose un pilotage par **jobs** métier (kriging, entraînement). L’évolution naturelle est un **pont** : depuis l’écran React, liens profonds vers les **mêmes** identifiants de `parameter_id` et `run_id`, et affichage des **métriques** `ai_variograms` alignées sur ce que le chercheur voit dans le drawer scientifique.

---

## 23) Extension — sécurité et JWT

Toute automatisation `curl` doit éviter de **logger** les tokens en clair dans des tickets publics. En CI GitHub Actions, les secrets doivent rester dans **GitHub Secrets** si des comptes techniques sont un jour introduits — aujourd’hui les scripts utilisent souvent des comptes seed en **environnement de développement** ; la **séparation** dev/staging/prod est une hypothèse d’exploitation **non détaillée** dans la session mais **nécessaire** avant mise en production Internet.

---

## 24) Extension — performance front carte

Leaflet exige `invalidateSize()` lorsque le conteneur `#map` change de hauteur. Le `setTimeout` de quelques millisecondes autour de l’appel évite des **races** avec les transitions CSS. Si l’on ajoute la réduction des panneaux latéraux, il faudra **ré-invalider** après transition des trois colonnes — sinon artefacts de tuiles partiellement chargées ou offsets de clic.

---

## 25) Extension — gestion des caches variogramme

Après modification de `generate_variogram_plot.py`, un cache hit peut **masquer** le correctif tant que la clé `(plot_type, parameter_id, horizon_label)` n’est pas invalidée. La procédure opérationnelle : `DELETE FROM atlas.ai_plot_cache WHERE ...` ciblée, ou versioning dans la clé (ex. suffixe `_v2`) — arbitrage entre **simplicité** et **historique** des SVG stockés.

---

## 26) Extension — données manquantes et sensibilité

Les interpolations krigeage sont **sensibles** aux trous de données dans les zones peu instrumentées. Le pipeline national doit être accompagné d’une **carte d’incertitude** ou de **LOO RMSE** spatialisé — partiellement présent via métadonnées variogrammes, mais pas encore une couche utilisateur standard dans le panneau thématique. C’est une **perspective** pour mémoire / rapport d’ingénierie.

---

## 27) Extension — compatibilité version UI

Le bandeau de version « Atlas Géotechnique v2.8.0 » (si présent dans build utilisateur) doit être aligné avec **CHANGELOG** du dépôt lors des releases — éviter décalage entre documentation académique et binaire livré.

---

## 28) Extension — normalisation des horizons

Les horizons H1/H2/H3 correspondent à des **profondeurs** métier (ex. 1 m, 1.5 m, 2 m — valeurs exactes selon paramétrage projet). La cohérence entre **labels** `h1` en base et `H1` en API a été source de bug ; une normalisation future pourrait imposer **UNIQUE** format en base (`lower`) et **affichage** uniquement côté UI — réduisant les erreurs de jointure et de cache.

---

## 29) Extension — granularité des tests

Les tests **Vitest** sur `getParametersForObjectifAndSource` protègent la **logique métier** du panneau ; ils ne remplacent pas des **tests e2e** Playwright sur sélection réelle dans le DOM. La combinaison des deux niveaux est la **pyramide de tests** recommandée : rapide en CI pour la logique, plus lente pour les flux critiques.

---

## 30) Extension — documentation mémoire vs documentation ops

Ce document de session est **ops + ingénierie** : il complète mais ne remplace pas `LIVRABLE_MEMOIRE.md` (orienté figures mémoire académique). Pour un jury, extraire les **schémas** pipeline depuis les sections 3 et 15 ; pour une équipe DevOps, privilégier sections 8, 9, 13.

---

## 31) Extension — traçabilité des décisions « pourquoi Python pour SVG »

Le choix Python pour générer le SVG côté serveur permet de **réutiliser** la connexion DB et les librairies scientifiques déjà présentes dans l’image/outil. Une alternative aurait été **Rust pur** avec crate SVG — moins de dépendance runtime Python mais **duplication** de logique d’accès aux variogrammes. L’arbitrage **pragmatique** favorise un seul langage de traitement déjà utilisé pour les runners.

---

## 32) Extension — impact disque `ai_plot_cache`

Les SVG texte sont petits comparés aux rasters, mais une croissance **non bornée** pourrait poser problème. Une stratégie de **TTL** ou de **purge** par cron PostgreSQL reste à définir — information **manquante** pour une politique de rétention complète.

---

## 33) Extension — corrélation EDA VBS/IP

Le drawer scientifique calcule corrélation de Pearson entre séries **kriging_vbs** et **kriging_ip**. Ce coefficient mesure une relation **linéaire** sur les mailles jointes — utile pour EDA rapide, mais ne remplace pas une analyse géostatistique complète (anisotropie, effet de support, etc.).

---

## 34) Extension — limites du fallback JS variogramme

Le fallback construit un semivariogramme expérimental **approximatif** par binning de distances sur un sous-échantillon — complexité O(n²) bornée par échantillonnage. Il sert de **filet de sécurité** UX, pas de substitut à PyKrige côté serveur.

---

## 35) Extension — alignement roadmap documentaire

Les fichiers `roadmap_30_03_2026_*.md` doivent être **versionnés** avec le code : toute évolution de règle métier (seuils RGA, bornes granulo) doit **référencer** une migration ou un script pour éviter la dérive documentaire.

---

## 36) Extension — gestion des erreurs utilisateur final

Les messages du drawer (`Prêt.`, notes fallback) doivent évoluer vers des textes **actionnables** : « Connectez-vous », « Paramètre sans variogramme en base — lancer runner X » — amélioration **UX** future.

---

## 37) Extension — interactions PostGIS

Les géométries mailles et overlays ADM utilisent PostGIS — les performances des jointures bbox dépendent des **index GIST**. Ce point est **implicite** dans les temps de réponse `/thematic/data` mais rarement visible en développement sur petits jeux.

---

## 38) Extension — duplication fonctionnelle Infer/Opti

Comme noté en session 2026-03-28, **Command Center** carte et **Infer/Opti** React partagent des endpoints — la consolidation UI éviterait la divergence de libellés et de permissions RBAC.

---

## 39) Extension — observabilité

Pour la production, il faudrait **metrics** sur durée des scripts Python appelés depuis `api-geo`, nombre de cache hit/miss variogramme, profondeur de file `ai_job_queue` — **non implémenté** dans la session.

---

## 40) Extension — conclusion ingénierie

La session décrite illustre une démarche **itérative** typique des systèmes géospatiaux lourds : contraintes **données** (AMESSEFE), **statistiques** (KED, dérivés), **interop** (Rust/Python/PostGIS), **UX** (multi-shell), et **qualité** (CI). Les éléments non clos constituent une **backlog** priorisé par risque utilisateur et dette technique — tableau sections 12 et 17.

---

## 41) Annexe — pseudo-code du flux `loadVariogram` (drawer scientifique)

Le flux suivant résume la **machine à états implicite** du chargement variogramme côté client ; il explique pourquoi l’utilisateur peut voir successivement « chargement », puis soit un rendu backend, soit un fallback JS.

```
fonction loadVariogram():
  statut ← "Chargement variogramme…"
  canvas ← #scientificChartVariogram
  notes ← #scientificVarNotes

  essayer:
    payload ← POST /ai/plots/variogram { parameter_id, horizon } avec Bearer
    détruire chartVariogram si existait (mode Chart.js — branche fallback)
    renderSvgIntoCanvas(canvas, payload.svg)
    notes ← "Variogramme backend — cache=" + payload.cached + ", rows=" + payload.rows
    statut ← "Prêt."
    retourner

  attraper erreur:
    notes ← "Fallback JS activé (" + message + ")"
    statut ← "Chargement variogramme (fallback JS)…"
    features ← GET thematic/data kriging_vbs avec géométrie
    extraire points (lat, lon, z) par centroïde
    si points < 30 → message insuffisance ; retourner
    sous-échantillonner ; binning distances haversine ; Chart.js ligne semivariance
    notes ← texte pédagogique "approximation client"
    statut ← "Prêt."
```

**Raisonnement.**  
La **première** branche privilégie la **vérité serveur** (métadonnées DB + cache). La seconde garantit une **dégradation gracieuse** si token absent, timeout réseau, ou indisponibilité Python — critère **robustesse** pour démonstrations terrain.

---

## 42) Annexe — structure HTML/CSS pertinente pour le bug layout (référence)

Les extraits ci-dessous ne sont pas des copies intégrales des fichiers ; ils **ancrent** l’analyse post-session sur des sélecteurs réels.

**Grille trois colonnes + hauteurs latérales fixes :**

```css
#container { display: grid; grid-template-columns: 380px 1fr 380px; min-height: calc(100vh - 52px); }
#dashboard { height: calc(100vh - 52px); overflow-y: auto; /* ... */ }
#sidebar { height: calc(100vh - 52px); overflow-y: auto; /* ... */ }
```

**Drawer scientifique en overlay :**

```css
#scientificDrawer {
  position: fixed; left: 0; right: 0; bottom: -40vh; height: 40vh;
  z-index: 2500; /* au-dessus des panneaux latéraux */
}
#scientificDrawer.open { bottom: 0; }
```

**Conséquence prouvée par composition CSS :**  
`tout élément fixed` avec `z-index` élevé **recouvre** les colonnes dont la hauteur est encore `100vh - topbar`. Seul `#map` est réduit par JS — d’où l’incohérence visuelle documentée par captures utilisateur.

---

## 43) Annexe — distinction `kriging_ip` vs `ip_derived_h2` (risque métier)

| Aspect | `kriging_ip` (proxy interpolation directe) | `ip_derived_h*` |
|--------|---------------------------------------------|-----------------|
| Entrée | Champ IP ou équivalent lissé spatialement | Surfaces `WL_ked`, `WP_ked` |
| Cohérence WL/WP | Non garantie post hoc | Contraint par construction après clip |
| Usage RGA P6 | Non retenu comme chaîne finale roadmap | Base pour `derive_rga_from_ked_h2` |
| Message utilisateur | « IP interpolé » peut être vrai mais ambigu | « IP dérivé WL/WP KED » — plus explicite |

**Recommandation rédactionnelle** (rapports, mémoire) : toujours citer **l’identifiant exact** du paramètre cartographié (`parameter=` dans l’URL API) pour éviter les confusions lors des comparaisons avec la littérature géotechnique.

---

## 44) Annexe — matrice de tests fonctionnels suggérés (hors scope exécution unique)

| ID | Scénario | Prérequis | Résultat attendu |
|----|----------|-----------|------------------|
| TF-01 | Login admin → thematic data `eg_ked_h1` | Données P2 en base | GeoJSON avec `features` non vides sur zone couverte |
| TF-02 | Même chose `passant_2mm_ked_h2` | P4 exécuté | Idem |
| TF-03 | Variogramme `eg_ked_h1` H1 | Lignes `ai_variograms` | SVG avec lignes métadonnées ; 2e appel cached |
| TF-04 | Ouvrir DB Manager vanilla → onglet Expert | Rôle lecture tables | Trois grilles peuplées |
| TF-05 | Ouvrir `/db-manager.html` React → Infer/Opti | Compte admin | Panneau command center sans onglet Expert |
| TF-06 | Drawer ouvert → clic carte | — | Pas d’offset tuiles après `invalidateSize` |

---

## 45) Annexe — registre des risques résiduels (qualité)

| Risque | Probabilité | Impact | Mitigation court terme |
|--------|-------------|--------|-------------------------|
| Données KED absentes sur environnement clone | Moyenne | Cartes vides | Script smoke SQL comptage par `parameter_id` |
| Confusion UI React/vanilla | Élevée | Support utilisateur | Doc + lien depuis Infer/Opti vers modal expert |
| SVG variogramme ≠ attente scientifique | Élevée | Crédibilité | Renommer + roadmap courbe γ(h) |
| CI release long | Moyenne | Friction équipe | Split workflows (section 12.6) |
| DNS Docker build | Faible sauf réseau restreint | Pas de rebuild | Image pré-construite / cache registry |

---

## 46) Annexe — corrélation entre roadmaps multiples (`roadmap_30_03_2026_*.md`)

Les documents numérotés _2, _3, _4 dans le dépôt se succèdent chronologiquement dans la conversation agent : les **fixes bloquants** (trigger IP, qualification SQL, etc.) sont rappelés dans _3 avant d’élargir P4–P8 dans _4. Pour un audite externe, la **règle de lecture** est : appliquer les **numéros de migration** et **identifiants de paramètres** de la version **la plus récente** cohérente avec le dépôt Git, pas une fusion aveugle de toutes les versions PDF/MD historiques.

---

## 47) Annexe — exemple de raisonnement sur le seuil AMESSEFE 0.1

Le seuil **0.1** (unités cohérentes avec WL/WP/IP en pourcentage ou fraction selon convention projet) traduit une **tolérance** sur les erreurs d’import **détectables** avant propagation. Ce n’est pas une incertitude géostatistique : c’est un **contrôle qualité entrée**. Si le seuil était **0.01**, plus de divergences potentielles remonteraient — utile en audit fin, coûteux en correction manuelle. Si **1.0**, on laisserait passer des erreurs grossières. Le choix **0.1** est donc un **arbitrage** entre sensibilité et effort opérationnel ; il doit être **tracé** dans le rapport de campagne AMESSEFE.

---

## 48) Annexe — chaîne d’outils et versions (hypothèses environnement)

- **PostgreSQL** : fonctionnalités JSONB, triggers PL/pgSQL, index partiels.  
- **Rust** : édition stable pour `api-geo` ; `cargo check` recommandé après modification `routes.rs`.  
- **Node** : LTS compatible Vite ; `npm run test:unit` pour régression logique thématique.  
- **Python** : version alignée sur `pykrige` / `psycopg2` du Dockerfile ou de la doc interne — **non figée** dans ce changelog ; à lire dans `Dockerfile` ou `requirements` du service batch si présent.

---

## 49) Annexe — principe de continuité pour la prochaine session développement

1. Implémenter **variables CSS** drawer pour synchroniser les trois colonnes + panneau thématique.  
2. **Porter** l’onglet Expert vers `App.tsx` ou module partagé.  
3. **Enrichir** `generate_variogram_plot.py` ou ajouter endpoint JSON pour **courbe** si données disponibles.  
4. **Documenter** dans `CHANGELOG.md` du dépôt les identifiants de paramètres ajoutés (liste exhaustive).  
5. **Exécuter** `p4_p8_release_gates.sh` sur branche release candidate avant tag.

---

## 50) Glossaire session (termes projet)

- **KED** : Kriging with External Drift (régression des résidus — formulation projet).  
- **RK** : Regression Kriging / résidu — selon nommage scripts.  
- **AMESSEFE** : jeu de données / campagne associée aux imports Excel de contrôle.  
- **Gate** : contrôle bloquant avant étape suivante (SQL ou HTTP).  
- **Supersession** : marquage des anciennes valeurs actives pour ne servir que la dernière génération dans `v_latest_*`.

---

*Fin du document de session — révision recommandée à chaque release majeure ou changement de schéma `atlas.*`.*
