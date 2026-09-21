# 🗺️ Feuille de Route Atlas - v1.0.0 → v2.3.0

Cette feuille de route présente une progression structurée et réaliste pour faire évoluer Atlas d'une application de démonstration vers un outil professionnel d'analyse géotechnique.

**Contexte technique** : mono-repo Docker, PostGIS, API Rust, UI Leaflet, usage local/démo mémoire.

---

## 📊 Échelle d'effort

- ★☆☆ : Légère (1-2 semaines)
- ★★☆ : Modérée (2-4 semaines)
- ★★★ : Importante (4-6 semaines)

---

## 🎯 Phase 1 : Fondations et Expérience Utilisateur (v1.1 - v1.3)

### v1.1.0 — Saisie enrichie & confort d'usage

**Objectif** : Terminer la boucle d'édition complète sans friction

**Fonctionnalités**
- Édition/Suppression de sondages et essais (UI + API `PATCH`/`DELETE`)
- Liste "Sondages proches" (rayon 1 km) pour éviter les doublons
- Historique d'édition minimal avec export CSV
- Snapping visuel : aimantation au centre de la maille lors du placement
- Chargement paresseux des sondages par bbox

**Critères d'acceptation**
- CRUD complet fonctionnel depuis l'UI avec historique visible
- Temps de réponse API ≤ 300 ms pour les listes en bbox urbaine

**Effort** : ★★☆

---

### v1.2.0 — Filtres & vues métier

**Objectif** : Permettre la lecture et la comparaison ciblée des données

**Fonctionnalités**
- Filtres par profondeur (0-5 m, 5-10 m, >10 m) et type d'essai (SPT_N, qc)
- Vues thématiques :
  - Densité de sondages par maille
  - SPT_N moyen par maille
  - qc moyen par maille
- Panneau comparatif "Mailles voisines" avec statistiques côte-à-côte

**Critères d'acceptation**
- Changement de vue sans recharger l'ensemble des données (≤ 250 ms)
- Cohérence des statistiques affichées (validation par tests spot)

**Effort** : ★★☆

---

### v1.3.0 — Exports & rapports mémoire

**Objectif** : Accélérer la préparation des livrables académiques

**Fonctionnalités**
- Export GeoPackage (mailles + sondages + essais + tags ADM)
- Export Markdown → PDF automatique avec gabarit structuré (contexte, carte, stats, figures)
- Impression de carte (A4/A3, portrait/paysage) avec échelle et légende

**Critères d'acceptation**
- Export GeoPackage chargeable dans QGIS sans erreur
- Génération PDF multi-pages avec carte et tableau KPI en un clic

**Effort** : ★★★

---

## ⚡ Phase 2 : Performance et Robustesse (v1.4 - v1.6)

### v1.4.0 — Performance & scalabilité

**Objectif** : Supporter 30-50k mailles et milliers d'essais de manière fluide

**Fonctionnalités**
- Mise en cache de `/coverage/mailles` (materialized view + invalidation automatique)
- Pagination et généralisation géométrique au zoom-out
- Révision de l'indexation PostGIS (GIST) avec monitoring du plan d'exécution
- Mode "light tiles" : rendu grille en tuiles vectorielles (optionnel)

**Critères d'acceptation**
- Pan/zoom fluide avec 30-50k mailles
- Temps de réponse `/coverage` ≤ 300 ms à chaud
- Insertion batch de 1000 essais < 5s avec cache correctement invalidé

**Effort** : ★★★

---

### v1.5.0 — Analyse & aide à la décision

**Objectif** : Formuler des hypothèses géotechniques rapides

**Fonctionnalités**
- Zonage par classes SPT_N (ex: <10, 10-20, >20) avec palette dédiée
- Courbes de distribution (histogrammes SPT_N & qc) filtrables par zone
- Calculs IDW batch pour une zone sélectionnée
- Détection d'outliers (Z-score, IQR) avec marquage visuel

**Critères d'acceptation**
- Dessin bbox → tableau synthèse + courbes générées
- Batch IDW sur 200 mailles < 10s avec progression visuelle

**Effort** : ★★☆

---

### v1.6.0 — Collaboration locale & qualité

**Objectif** : Garantir la qualité et ouvrir l'usage à 2-3 personnes au laboratoire

**Fonctionnalités**
- Profils locaux simples : Viewer, Editor, Admin (sans SSO)
- Validation de saisie renforcée (unités, plages, cohérence profondeur)
- Tests d'intégration API (Rust) + tests UI (Playwright) sur scénarios clés
- Script backup/restore de la base (dump compressé + tag version)

**Critères d'acceptation**
- 100% des endpoints CRUD couverts par tests d'intégration
- Restauration de sauvegarde validée sur machine neuve

**Effort** : ★★★

---

## 🔌 Phase 3 : Connectivité et Valorisation (v1.7 - v1.9)

### v1.7.0 — Connecteurs & import avancé

**Objectif** : Faciliter l'ingestion de données réelles

**Fonctionnalités**
- Import XLSX avec gabarit et mapping automatique (multi-feuilles)
- Import ZIP (CSV + GeoJSON) avec pré-validation côté client
- Connecteur WFS (lecture seule) pour fonds administratifs officiels

**Critères d'acceptation**
- ZIP non conforme → liste d'erreurs claire (ligne, cause, solution)
- Traitement XLSX de 10 000 lignes < 30s

**Effort** : ★★☆

---

### v1.8.0 — API d'agrégation & mini-dashboard

**Objectif** : Exposer rapidement la valeur des données

**Fonctionnalités**
- Endpoints `/stats` par ADM et par maille (moyennes, min/max, N)
- Mini-dashboard en header (sparklines, compteurs vivants)
- Export "fiche commune" (ADM3) en PDF : carte + stats + histogrammes

**Critères d'acceptation**
- `/stats/adm3?id=...` répond en ≤ 200 ms (cache possible)
- Génération fiche commune < 3s

**Effort** : ★★☆

---

### v1.9.0 — Moteur spatial avancé

**Objectif** : Offrir des capacités spatiales avancées sans complexifier l'usage de base

**Fonctionnalités**
- Sélection par polygone libre (dessin manuel)
- Génération d'isolignes (contours IDW) sur SPT_N avec résolution configurable
- Jointure administrative hiérarchique complète (mailles → ADM1/2/3)

**Critères d'acceptation**
- Polygone dessiné → export GeoPackage filtré fonctionnel
- Isolignes lisibles et exportables en GeoJSON

**Effort** : ★★★

---

## 🎓 Phase 4 : Version Professionnelle (v2.0)

### v2.0.0 — Release "présentation pro"

**Objectif** : Version stable, rapide et présentable à un encadrant ou partenaire

**Fonctionnalités**
- Thème UI finalisé (typographies, palettes, états)
- Page "À propos / Méthodologie" (IDW, SRID, sources de données, limites)
- Assistant de démo pas-à-pas (zoom Togo → Maritime → ajout sondage → IDW)
- Mode lecture seule packagé (image Docker "viewer" ultra-légère)
- Bundle de jeu d'essai officiel pour démo (sondages + essais + mailles + ADM)

**Critères d'acceptation**
- Démarrage viewer : `docker compose up -d viewer` → UI prête en < 10s
- Démo guidée réalisable en 5 minutes sans latence visible

**Effort** : ★★★

---

## 🔬 Phase 5 : Analyses Avancées (v2.1 - v2.3)

> **Pré-requis** : Base de données enrichie avec ≥ 1 000-2 000 sondages exploitables

### v2.1.0 — Kriging (Géostatistique)

**Objectif** : Améliorer la qualité des interpolations spatiales

**Portée**
- Ordinary Kriging 2D sur SPT_N et qc (profondeur fixe ou moyenne pondérée)
- Estimation du variogramme (exponentiel/sphérique/gaussien)
- Gestion optionnelle de l'anisotropie
- Grille des prédictions + variance krigeage (incertitude)
- Benchmark k-fold CV vs IDW (RMSE, MAE)

**API**
- `POST /kriging/recompute/{code}` : `{variable, range, sill, nugget, model}`
- `GET /kriging/coverage` : tuiles raster/iso-courbes (cache)

**UI**
- Toggle "IDW ↔ Kriging"
- Affichage isolignes et carte d'incertitude

**Critères d'acceptation**
- Gain RMSE >10-15% vs IDW sur au moins une zone dense
- Temps de calcul bbox urbaine < 2-3s (avec cache)

**Note technique** : Prototype Python (PyKrige) via micro-service ou conteneur dédié

**Effort** : ★★★

---

### v2.2.0 — IA / Machine Learning (prédiction)

**Objectif** : Prédire SPT_N à partir de features multiples

**Portée**
- Modèles : Gradient Boosting / Random Forest (régression)
- Features : `depth_m`, `qc`, stats par maille, ADM (one-hot), distances géométriques, altimétrie
- Sorties : prédiction SPT_N + intervalle de confiance (quantile regression)

**Pipeline**
- Train → Validate (CV) → Register (versioning) → Serve
- Entraînement offline reproductible (notebook/CLI)

**API**
- `POST /ml/predict` : lot de points/mailles
- `GET /ml/models` : registry minimal avec version active

**UI**
- Panneau "Prédiction ML" avec sélection modèle
- Comparatif "IDW/Kriging/ML" sur bbox avec métriques si ground truth disponible

**Critères d'acceptation**
- Traçabilité complète (version modèle + features)
- Performance au moins équivalente à IDW/Kriging dans les zones bien échantillonnées
- Explicabilité minimale (feature importances)

**Effort** : ★★★

---

### v2.3.0 — Pareto (Multi-critères, aide à la décision)

**Objectif** : Sélectionner les mailles optimales selon plusieurs critères

**Portée**
- Construction de vecteurs d'objectifs par maille :
  - Maximiser : SPT_N prévu, densité de sondages
  - Minimiser : incertitude, distance rivière/route, pente, risque inondation
- Algorithme : NSGA-II ou filtrage Pareto simple (2-3 critères)
- Sorties : front de Pareto + solutions représentatives (k-medoids)

**API**
- `POST /pareto` : `{criteria:[{name, direction, weight?, normalize}], filter?{adm, bbox}}`
- `GET /pareto/result/:id` : liste mailles retenues + scores normalisés

**UI**
- Panneau "Aide au choix" avec curseurs/poids
- Aperçu du front (scatter 2D si 2-3 critères)
- Liste des mailles candidates
- Export GeoPackage des solutions

**Critères d'acceptation**
- Front mis à jour en temps réel lors de l'ajustement des poids
- Export des mailles Pareto-optimales prêt pour QGIS

**Effort** : ★★★

---

## 🧪 Endpoints API (exemples techniques)

```
# Recherche et filtrage
GET /surveys?bbox=...&type=SPT_N&qmin=...&qmax=...

# Statistiques
GET /stats/mailles?adm3_id=...
GET /stats/adm3/:id

# Calculs et exports
POST /grid/recompute/bulk
POST /export/geopackage
POST /import/xlsx
POST /import/preview

# Tuiles vectorielles (optionnel)
GET /tiles/grid/{z}/{x}/{y}.pbf

# Kriging
POST /kriging/recompute/{code}
GET /kriging/coverage

# Machine Learning
POST /ml/predict
GET /ml/models

# Pareto
POST /pareto
GET /pareto/result/:id
```

---

## ⚠️ Risques & garde-fous

### Volumes de données
- **Si > 100k mailles** : migrer vers tuiles vectorielles + simplification multi-niveaux obligatoire

### Calculs IDW
- **Ne pas recalculer à chaque essai** : utiliser une queue de mailles modifiées + traitement batch

### Qualité et tests
- **Sanctuariser v1.6.0** (tests + backup) avant d'empiler de nouvelles fonctionnalités

### UX
- **Garder l'UI simple** : une vue principale + panneaux contextualisés
- Éviter l'effet "tableau de bord sapin de Noël"

### Analyses avancées (v2.1+)
- **Données** : viser ≥ 20-30 points par zone homogène pour un variogramme crédible
- **Validation** : toujours conserver un jeu de test séparé (pas de fuite de données)
- **Performance** : mettre en cache les surfaces prévues (tuiles/raster) et invalider en lot
- **Transparence** : documenter les hypothèses (stationnarité krigeage, normalisation Pareto, etc.)

---

## 📌 Conseils d'orchestration

1. **Découper chaque version en issues** : API / DB / UI / Docs / Tests
2. **Maintenir un CHANGELOG** clair par version
3. **Mesurer les latences clés** (coverage, stats, IDW) pour éviter la dérive de performance
4. **Valider chaque version** avant de passer à la suivante
5. **Documenter les décisions techniques** et leurs rationales

---

## 📅 Calendrier récapitulatif

| Phase | Versions | Focus | Durée estimée |
|-------|----------|-------|---------------|
| Phase 1 | v1.1 - v1.3 | Fondations UX | 2-3 mois |
| Phase 2 | v1.4 - v1.6 | Performance & qualité | 3-4 mois |
| Phase 3 | v1.7 - v1.9 | Connectivité & spatial | 2-3 mois |
| Phase 4 | v2.0 | Professionnalisation | 1-2 mois |
| Phase 5 | v2.1 - v2.3 | Analyses avancées | 3-4 mois |

**Total estimé** : 11-16 mois pour v2.3.0 complète

---

## ✅ Prochaines étapes recommandées

1. **Valider la v1.0.0** actuelle avec les fonctionnalités de base
2. **Commencer v1.1.0** : compléter la boucle CRUD
3. **Préparer le backlog** : créer les issues pour v1.1 et v1.2
4. **Mettre en place les métriques** : tracking des latences et performances
5. **Planifier les imports** : identifier les sources de données réelles pour v1.7+

---

**Document** : ROAD_MAP_2.1
**Version** : 1.0
**Date** : Octobre 2025
**Projet** : Atlas - Plateforme d'analyse géotechnique
