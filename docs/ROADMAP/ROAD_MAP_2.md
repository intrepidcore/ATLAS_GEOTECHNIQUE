Parfait. Voici une feuille de route compacte, réaliste et **actionnable** pour aller de **v1.0.0 → v2.0.0** en gardant ton contexte (mono-repo Docker, PostGIS, Rust API, Leaflet UI, usage local/démo mémoire).
Je te propose des versions mineures bien bornées avec objectifs, livrables, critères d’acceptation et estimation d’effort relative.

---

# 🎯 Cap jusqu’à v2.0.0

## v1.1.0 — Saisie enrichie & confort d’usage (UX/CRUD+)

**Objectifs**

* Terminer la boucle “éditer sur carte” proprement et sans friction.

**Fonctionnalités**

* Éditer/Supprimer sondage & essais (UI + API `PATCH/DELETE`).
* Liste “Sondages proches” (rayon 1 km) quand on ajoute un nouveau point → éviter les doublons.
* Historique d’édition (audit minimal) + bouton **Exporter journal** (CSV).
* Snapping visuel : aimantation au centre de la maille lors du placement.
* Chargement paresseux (lazy) des points sondages par **bbox**.

**Critères d’acceptation**

* Je peux créer/éditer/supprimer un sondage & ses essais depuis l’UI, et voir l’historique.
* Aucune requête API ne dépasse 300 ms pour listes en bbox urbaine.

**Effort**: ★★☆

---

## v1.2.0 — Filtres & vues “métier”

**Objectifs**

* Lire/comparer des jeux de données de manière ciblée.

**Fonctionnalités**

* Filtres par **profondeur** (0–5, 5–10, >10 m) + **type d’essai** (SPT_N, qc).
* Vues thématiques rapides :

  * “Densité de sondages par maille”
  * “SPT_N moyen (par maille)”
  * “qc moyen (par maille)”
* Panneau comparatif “Mailles voisines” (stats côte-à-côte).

**Critères d’acceptation**

* Changer de vue ne rafraîchit que la couche utile, ≤ 250 ms.
* Les stats affichées sont cohérentes avec la base (tests spot).

**Effort**: ★★☆

---

## v1.3.0 — Exports & rapports “mémoire”

**Objectifs**

* Accélérer la préparation des livrables (mémoire/défense).

**Fonctionnalités**

* Exports **GeoPackage** (mailles + sondages + essais + ADM tags).
* Exports **Markdown → PDF** auto (gabarit sections : contexte, carte, stats, figures).
* Impression carte (A4/A3, portrait/paysage) avec **échelle** et **légende**.

**Critères d’acceptation**

* Un clic → GeoPackage téléchargeable et chargé dans QGIS sans erreur.
* Un clic → PDF multi-pages avec carte + tableau des KPI.

**Effort**: ★★★

---

## v1.4.0 — Performance & robustesse

**Objectifs**

* Fluidifier l’expérience avec 30–50 k mailles & milliers d’essais.

**Fonctionnalités**

* **Mise en cache** `/coverage/mailles` (materialized view + invalidation sur modifs).
* **Pagination** & **generalisation** (simplifier géométrie au zoom-out).
* Indexation PostGIS (GIST) revue + plan d’exécution monitoré.
* Mode “light tiles” : rendu grille en tuiles vectorielles (optionnel).

**Critères d’acceptation**

* 30k–50k mailles : pan/zoom fluide; `/coverage` ≤ 300 ms à chaud.
* Insertion de 1000 essais batch < 5 s avec cache invalidé correctement.

**Effort**: ★★★

---

## v1.5.0 — Analyse & outils d’aide à la décision

**Objectifs**

* Rendre l’outil utile pour formuler des hypothèses géotechniques rapides.

**Fonctionnalités**

* **Zonage** par classes SPT_N (ex. <10, 10–20, >20) avec palette dédiée.
* Courbes de **distribution** (histogrammes SPT_N & qc) filtrables par zone (bbox/ADM).
* Calculs **IDW batch** pour une zone (liste de mailles sélectionnée).
* Détection basique d’**outliers** (Z-score, IQR) et marquage visuel.

**Critères d’acceptation**

* L’UI me permet de dessiner une bbox → tableau synthèse + courbes.
* Un batch IDW sur 200 mailles < 10 s et feedback visuel de progression.

**Effort**: ★★☆

---

## v1.6.0 — Collaboration locale & qualité

**Objectifs**

* Rassurer sur la qualité & ouvrir l’usage à 2–3 personnes au labo.

**Fonctionnalités**

* Profils locaux (lecture/écriture) sans SSO : **Viewer**, **Editor**, **Admin** (simple).
* **Validation** de saisie : règles renforcées (unités, ranges, cohérence profondeur).
* **Tests** d’intégration API (Rust) + tests UI (Playwright) sur scénarios clés.
* Script `backup/restore` de la base (dump compressé + tag version).

**Critères d’acceptation**

* 100 % des endpoints CRUD testés en intégration.
* Restauration d’une sauvegarde validée sur une machine neuve.

**Effort**: ★★★

---

## v1.7.0 — Connecteurs & import avancé

**Objectifs**

* Faciliter l’ingestion de données réelles.

**Fonctionnalités**

* Import **XLSX** (gabarit + mapping), tolérance aux feuilles multiples.
* Import **ZIP** (CSV+GeoJSON) + pré-validation côté client (preview erreurs).
* Connecteur **WFS** (lecture-only) pour récupérer fonds officiels (si besoin).

**Critères d’acceptation**

* Un ZIP non conforme affiche une **liste d’erreurs** claire (ligne, cause, solution).
* Un XLSX de 10 000 lignes est traité en < 30 s.

**Effort**: ★★☆

---

## v1.8.0 — API d’agrégation & mini-dashboard

**Objectifs**

* Exposer la “valeur data” rapidement à la carte et au rapport.

**Fonctionnalités**

* Endpoints `/stats` : par ADM & par maille (moyennes, min/max, N).
* Mini-dashboard en header (cartes sparkline, compteurs vivants).
* Export “**fiche commune**” (ADM3) en PDF : carte + stats + histogrammes.

**Critères d’acceptation**

* `/stats/adm3?id=…` répond ≤ 200 ms (cache possible).
* Génération fiche commune < 3 s.

**Effort**: ★★☆

---

## v1.9.0 — Moteur spatial avancé (options pro)

**Objectifs**

* Pousser le spatial sans complexifier l’usage de base.

**Fonctionnalités**

* Sélection **polygone libre** (dessin) pour filtrer & exporter.
* **Isolignes** (contours IDW) sur SPT_N (résolution configurable).
* Jointure **administrative hiérarchique** complète (mailles → ADM1/2/3).

**Critères d’acceptation**

* Polygone dessiné → export GeoPackage filtré OK.
* Isolignes lisibles, export GeoJSON.

**Effort**: ★★★

---

## v2.0.0 — Release “présentation pro”

**Objectifs**

* Version stable, rapide, présentable à un encadrant/partenaire.

**Fonctionnalités**

* **Thème** & charte UI finalisés (typographies, palettes, states).
* Page “À propos / Méthodologie” (IDW, SRID, données, limites).
* **Assistant de démo** (script pas-à-pas : zoom Togo → vue Maritime → ajout sondage → IDW).
* **Mode lecture seule packagé** (image Docker “viewer” ultra-légère).
* **Bundle de jeu d’essai** officiel pour démo (sondages + essais + mailles + ADM).

**Critères d’acceptation**

* Démarrage “viewer” : `docker compose up -d viewer` → UI prête en < 10 s.
* Démo guidée réalisable en 5 minutes, sans latence visible.

**Effort**: ★★★

---

# 🧪 Technique & endpoints à prévoir (exemples)

* `GET /surveys?bbox=…&type=SPT_N&qmin=…&qmax=…`
* `GET /stats/mailles?adm3_id=…` ; `GET /stats/adm3/:id`
* `POST /grid/recompute/bulk` (ids mailles)
* `POST /export/geopackage` (payload: couches + filtre)
* `POST /import/xlsx` (+ preview `POST /import/preview`)
* `GET /tiles/grid/{z}/{x}/{y}.pbf` (optionnel si tu pars en tuiles)

---

# ⚠️ Risques & garde-fous

* **Volumes** : si > 100k mailles → passer absolument aux tuiles vectorielles & simplification multi-niveaux.
* **IDW** : veiller à ne pas recalculer *à chaque essai* — utiliser la **queue de mailles modifiées** + batch.
* **Qualité** : sanctuariser v1.6.0 (tests & backup) avant d’empiler des features.
* **UX** : garder l’UI simple (une vue principale + panneaux contextualisés). Éviter l’effet “tableau de bord sapin de Noël”.

---

# 📌 Conseils d’orchestration

* Découper chaque version en **issues** (API / DB / UI / Docs / Tests).
* Ajouter un **CHANGELOG** clair par version.
* Continuer à **mesurer les latences clés** (coverage, stats, IDW) pour éviter la dérive.

---

Super question. En bref :

* **Kriging** et **IA/ML** demandent des **données réelles en volume** + une base “propre” + des stats solides.
* **Pareto** (multi-critères) est un **couche décisionnelle** au-dessus des métriques/predictions — il arrive **après** qu’on sache calculer des indicateurs fiables par maille.

Voici où les placer dans la roadmap (à partir de ta v1.0.0 actuelle) ⬇️

---

## 🧭 Placement recommandé

### v1.5.0 – Analyse & stats (pré-requis)

* Courbes, zonage SPT_N/qc, IDW batch, détection d’outliers.
* Objectif : valider la cohérence des données et les distributions.

### v1.7.0 – Import avancé (pré-requis)

* Import XLSX/ZIP “propre”, contrôle qualité.
* Objectif : **augmenter le volume** (idéalement **≥ 1 000–2 000** sondages exploitables).

### v1.8.0 – API d’agrégation (pré-requis)

* Endpoints `/stats` par maille/ADM, KPI robustes.
* Objectif : disposer d’**indicateurs fiables par maille** pour l’aide à la décision.

---

## 🎯 v2.1.0 — Kriging (Géostatistique)

**Pourquoi maintenant ?**
Tu auras de quoi estimer un **variogramme** stable (sinon le krigeage sur 200 points bruités bat rarement l’IDW).

**Portée**

* Ordinary Kriging 2D sur SPT_N et qc (à profondeur fixée ou “moyenne pondérée” par profondeur).
* Estimation du **variogramme** (exp/sphérique/gaussien), **anisotropie** optionnelle.
* Sorties : **grille** des prédictions + **variance krigeage** (incertitude).
* Bench : **k-fold CV** vs IDW (RMSE, MAE), carte d’incertitude.

**API**

* `POST /kriging/recompute/{code}` (ou par bbox) : `{ variable, range, sill, nugget, model }`
* `GET /kriging/coverage` : tuiles raster/iso-courbes (cache)

**UI**

* Basculer “IDW ↔ Kriging”, afficher isolignes et carte d’incertitude.

**Critères d’acceptation**

* CV montre **>10–15%** de gain RMSE vs IDW sur au moins une zone dense.
* Temps de calcul par maille/bbox acceptable (ex: < 2–3 s la bbox urbaine avec cache).

**Note implémentation**

* Prototype rapide en **Python (PyKrige)** via micro-service; si tu veux rester Rust-only, tu peux commencer par exporter les points et appeler un conteneur `krige` dédié.

---

## 🤖 v2.2.0 — IA / Machine Learning (prédiction)

**Quand ?**
Après kriging et une base étoffée, pour **apprendre** SPT_N à partir d’autres infos (qc, profondeur, tags ADM, distance mer/route/ rivière, altitude…).

**Portée**

* Modèles de base : **Gradient Boosting / Random Forest** (régression).
* Features : `depth_m`, `qc`, stats par maille, ADM (one-hot), distances (Géom), altimétrie si dispo.
* Sorties : prédiction SPT_N + **intervalle** (quantile reg / ensembles).

**Pipeline**

* `train → validate (CV) → register (version) → serve`.
* **Éviter** l’entraînement en ligne : fais un **offline training** reproductible (notebook/CLI).

**API**

* `POST /ml/predict` (lot de points/mailles)
* `GET /ml/models` (registry minimal, version active)

**UI**

* Panneau “Prédiction ML” (sélection modèle, affichage carte + incertitude).
* Comparatif “IDW/Kriging/ML” sur une bbox (tableau RMSE si GT présente).

**Critères d’acceptation**

* Tenir une **traçabilité** (version modèle + features).
* **Ne pas dégrader** les zones où l’IDW/krigeage est déjà bon.
* Explicabilité minimale (feature importances).

---

## 🧩 v2.3.0 — Pareto (Multi-critères, aide à la décision)

**Quand ?**
Quand tu disposes d’un **ensemble d’indicateurs** par maille :
SPT_N prévu, incertitude, densité de sondages, distance routes/points d’eau, pente, risque inondation (si dispo), etc.

**Portée**

* Construction de **vecteurs d’objectifs** par maille (ex : maximiser SPT_N & min. incertitude & min. distance rivière & min. pente).
* Algorithme : **NSGA-II** (ou simple filtrage de Pareto si 2–3 critères).
* Sorties : **front de Pareto** (ensemble non dominé) + **solutions représentatives** (k-medoids sur le front).

**API**

* `POST /pareto` : `{criteria:[{name, direction, weight?, normalize}], filter?{adm, bbox}}`
* `GET /pareto/result/:id` : liste des mailles retenues + scores normalisés.

**UI**

* Panneau “Aide au choix” : curseurs/poids, aperçu du front (scatter 2D si 2–3 critères), liste des mailles candidates, **Export GeoPackage** des solutions.

**Critères d’acceptation**

* Le **front** change en temps réel quand tu ajustes les poids/directions.
* Export des mailles “Pareto-optimales” prêt pour QGIS.

---

## ✅ Résumé “quand quoi”

* **Maintenant (v1.x)** : IDW fiable, stats, import, KPIs, UX, performances.
* **v2.1** : **Kriging** (quand tu as ≥1 000–2 000 points dans quelques zones).
* **v2.2** : **ML** (quand tu as assez de variables explicatives & un pipeline d’entraînement).
* **v2.3** : **Pareto** (quand plusieurs critères sont calculés de façon robuste).

---

## 🚧 Garde-fous rapides

* **Données** : viser au moins **20–30 points** par zone homogène pour un variogramme crédible.
* **Validation** : toujours garder un **jeu de test** tenu à l’écart (pas de fuite).
* **Perf** : mettre en **cache** les surfaces prévues (tuiles/raster) et invalider en lot.
* **Transparence** : documenter **les hypothèses** (stationnarité krigeage, normalisation critères Pareto, etc.).

Si tu veux, je te prépare les **squelettes d’endpoints + schémas de tables** et un **plan d’évaluation** (métriques, CV, tableaux comparatifs) pour lancer v2.1 Kriging dès que tu estimes tes données suffisantes.
