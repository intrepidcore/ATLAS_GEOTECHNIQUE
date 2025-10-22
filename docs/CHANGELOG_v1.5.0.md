# 📝 Changelog - Cartes Thématiques v1.5.0

## [1.5.0] - 2025-10-20

### 🎉 Ajouté

#### Base de Données
- **Table `essais_geotechniques`** : Nouvelle table pour essais géotechniques détaillés
  - Granulométrie (passant_80um, passant_2mm, passant_20mm)
  - Atterberg (wl, wp, ip GENERATED)
  - VBS (vbs)
  - Proctor (gamma_d_max, w_opt, proctor_type)
  - Gonflement (eg)
- **Table `thematic_configs`** : Sauvegarde des configurations de cartes
- **Table `refresh_queue`** : File d'attente pour invalidation MatView
- **Vue matérialisée `mailles_geotechnique_stats`** : Agrégats par maille (29,407 mailles)
- **Triggers auto-invalidation** : INSERT/UPDATE/DELETE sur essais_geotechniques
- **10 configurations prédéfinies** : Densité, IP, VBS, Gonflement, etc.

#### Backend (Rust)
- **Module `thematic/`** : 7 fichiers Rust
  - `types.rs` : 24 paramètres thématiques, types et enums
  - `classifier.rs` : Quantiles, Equal Interval, Jenks (avec fallback)
  - `colors.rs` : 6 palettes ColorBrewer
  - `statistics.rs` : Calculs statistiques (mean, median, quantiles, outliers)
  - `cache.rs` : Cache moka TTL 60s
  - `routes.rs` : 7 endpoints HTTP
- **Endpoints HTTP** :
  - `GET /thematic/data` : Données thématiques avec filtres
  - `POST /thematic/classify` : Classification des données
  - `POST /thematic/configs` : Sauvegarde configuration
  - `GET /thematic/configs` : Liste configurations
  - `GET /thematic/configs/:id` : Détail configuration
  - `DELETE /thematic/configs/:id` : Suppression configuration
  - `GET /thematic/palettes` : Liste palettes
- **Dépendances** : statrs, ordered-float, moka
- **22 tests unitaires** : Tous passent

#### Frontend (TypeScript)
- **Module `thematic/`** : 4 fichiers TypeScript/CSS
  - `thematic-types.ts` : 24 paramètres, interfaces complètes
  - `thematic-maps.ts` : Classe ThematicMapManager
  - `thematic-panel.ts` : Classe ThematicPanel
  - `thematic-maps.css` : Styles complets
- **Classe ThematicMapManager** :
  - `loadThematicMap()` : Chargement carte thématique
  - `renderChoropleth()` : Rendu choroplèthe
  - `renderProportional()` : Rendu symboles proportionnels
  - `showLegend()` : Légende interactive
  - `saveConfig()` / `loadConfig()` : Gestion configurations
  - `exportAsGeoJSON()` : Export GeoJSON
  - `clear()` : Nettoyage
- **Classe ThematicPanel** : Gestion UI complète
- **Panneau UI** : Tous les contrôles (catégorie, paramètre, classification, palette, filtres)
- **Bouton flottant** : Accès rapide au panneau

#### Optimisations
- **Simplification géométrique** : Selon zoom (50m-2000m)
- **Cache moka** : TTL 60s, max 1000 entrées
- **Fallback Jenks** : Quantiles si > 1000 valeurs
- **Index spatiaux** : GIST sur géométries
- **Refresh CONCURRENTLY** : Sans bloquer lectures

### 🔧 Modifié

- **Migration 010** : Suppression table `essais` (remplacée par `essais_geotechniques`)
- **Routes backend** : Intégration module thematic
- **Main.ts** : Import et initialisation modules thematic
- **Index.html** : Ajout panneau thématique et bouton flottant

### 🐛 Corrigé (Post-Déploiement)

- **Vue de compatibilité `essais`** : Créée pour éviter erreurs HTTP 500 sur ancien code
- **Défilement indépendant** : Panneau thématique avec scrollbar personnalisée
- **Défilement légende** : Légende avec scrollbar indépendante (max 400px)
- **Scrollbar stylisée** : Couleurs cohérentes avec le thème (#2171b5)
- **Erreur SQL virgule** : Correction quand include_geometry=false

### ⏸️ Reporté (Phase 2)

- **Export PNG** : html2canvas (Phase 2)
- **Split View** : Comparaison 2 cartes synchronisées (Phase 2)
- **RBAC complet** : Permissions et scoping ADM (Phase 2)
- **Filtres ADM1/2/3** : Nécessite jointure avec table administrative (Phase 2)

### 📊 Métriques

- **Fichiers créés** : 23
- **Lignes de code** : ~4,700
- **Tests unitaires** : 22/22 ✅
- **Tests endpoints** : 6/6 ✅
- **Configurations** : 10/10 ✅
- **Paramètres** : 24
- **Palettes** : 6
- **Méthodes classification** : 4

### 🚀 Déploiement

- **Migration SQL** : Appliquée ✅
- **Données test** : 200 essais, 187 mailles ✅
- **Backend Rust** : Compilé et déployé ✅
- **Frontend** : Déployé ✅
- **Tests** : 100% réussis ✅

### 📝 Documentation

- `TODO_CARTES_THEMATIQUES_v1.5.0.md` : Checklist complète
- `IMPLEMENTATION_COMPLETE_v1.5.0.md` : Documentation implémentation
- `IMPLEMENTATION_STATUS.md` : Statut d'avancement
- `VERIFICATION_TODO_v1.5.0.md` : Vérification TODO
- `RAPPORT_DEPLOIEMENT_v1.5.0.md` : Rapport déploiement
- `CARTES_THEMATIQUES_COMPLET.md` : Spécifications techniques
- `CARTES_THEMATIQUES_METRIQUES.md` : Métriques géotechniques

---

## 🔗 Liens

- **API** : http://localhost:8001
- **UI** : http://localhost:3000
- **Endpoints** : http://localhost:8001/thematic/*

---

## 👥 Contributeurs

- Cascade AI - Implémentation complète

---

## 📄 Licence

Propriétaire - Atlas Géotechnique Togo
