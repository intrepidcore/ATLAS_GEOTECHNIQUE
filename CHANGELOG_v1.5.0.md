# 📝 Changelog v1.5.0 - Atlas Géotechnique

**Date de release** : 2025-10-20  
**Type** : Feature Release + Bug Fixes

---

## 🎯 Objectif de la Release

Préparer Atlas pour **déploiement LAN** avec 10 testeurs au laboratoire, en mettant l'accent sur les **cartes thématiques géotechniques**.

---

## ✨ Nouvelles Fonctionnalités

### 1. Cartes Thématiques Complètes

- ✅ **Panneau de configuration** avec tous les paramètres géotechniques
- ✅ **10 catégories de paramètres** :
  - Densité & Couverture (n_sondages, n_essais_geo)
  - Granulométrie (passant 80µm, 2mm, 20mm)
  - Atterberg (WL, WP, IP + écarts-types)
  - VBS (moyenne + écart-type)
  - Proctor (γd max, wopt)
  - Gonflement (eg)
- ✅ **Classification automatique** : Quantiles, Intervalles égaux, Jenks
- ✅ **8 palettes de couleurs** : Verts, Bleus, Rouges, Oranges, Violets, etc.
- ✅ **Filtres** : ADM1/2/3, bbox, min_sondages
- ✅ **Performance** : Simplification géométrique selon zoom

### 2. Import Bulk Wizard (UI)

- ✅ **Interface en 5 étapes** :
  1. Upload (drag & drop)
  2. Mapping automatique des colonnes
  3. Validation des données
  4. Aperçu avant import
  5. Import avec barre de progression
- ✅ **Détection automatique** du format CSV
- ✅ **Templates** : CSV complet et minimal
- ✅ **Validation** : Erreurs et avertissements détaillés

⚠️ **Note** : Backend `/import/bulk` non implémenté → prévu v1.5.1

### 3. Détection de Doublons (UI)

- ✅ **Alerte visuelle** dans le panneau gauche
- ✅ **Affichage sur carte** des sondages proches
- ✅ **Rayon configurable** (50m par défaut)

⚠️ **Note** : Endpoint `/surveys/nearby` nécessite tests → prévu v1.5.1

---

## 🔧 Améliorations Techniques

### Base de Données

- ✅ **Vue matérialisée** `mailles_geotechnique_stats` (29 407 mailles)
  - Agrégation de tous les paramètres géotechniques
  - Index optimisés (GIST spatial + B-tree)
  - Refresh manuel : `REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;`
- ✅ **Fonction** `upsert_sondage_wgs84()` pour conversion WGS84→UTM 25231
- ✅ **UUID auto** sur `sondages` et `essais_geotechniques`
- ✅ **Table** `refresh_queue` pour refresh automatique (prévu v1.5.1)
- ✅ **Vue alias** `grid_stats_geotechnical` pour compatibilité

### API Backend

- ✅ **Alias serde** sur `ThematicParameter` pour accepter les deux syntaxes :
  - `passant_80um_avg` ✅ ET `passant80um_avg` ✅
  - `gamma_d_max_avg` ✅ ET `gamma_d_max_avg` ✅
- ✅ **CORS permissif** (Any origin) pour développement/LAN
- ✅ **Exposition LAN** : API sur 0.0.0.0:8000 (port 8001 externe)
- ✅ **Endpoint** `/thematic/data` avec filtres avancés
- ✅ **Statistiques** : min, max, mean, median, stddev, quantiles

### Docker & Déploiement

- ✅ **Ports exposés sur toutes interfaces** :
  - UI : `0.0.0.0:8080` (au lieu de `127.0.0.1:8080`)
  - API : `0.0.0.0:8001` (au lieu de `127.0.0.1:8001`)
- ✅ **Variable** `CORS_ORIGIN` configurable
- ✅ **Variable** `API_BIND=0.0.0.0:8000`

### Frontend

- ✅ **Contraste amélioré** : Police sombre (#1a1a1a) pour meilleure lisibilité
- ✅ **Accessibilité** : ID dupliqués corrigés
- ✅ **Responsive** : Panneau thématique adaptatif
- ✅ **UX** : Messages d'erreur clairs et informatifs

---

## 🐛 Corrections de Bugs

### Cartes Thématiques

- ✅ **Fix** : Erreur `passant_2mm_avg` non reconnu
  - **Cause** : Mismatch entre UI (`passant_80um_avg`) et API (`passant80um_avg`)
  - **Solution** : Alias serde dans `ThematicParameter`
- ✅ **Fix** : Vue matérialisée vide
  - **Cause** : Pas de données importées
  - **Solution** : Utiliser les 25 620 sondages existants + REFRESH MV
- ✅ **Fix** : SRID incompatible (4326 vs 25231)
  - **Solution** : Fonction `upsert_sondage_wgs84()` avec ST_Transform

### Import

- ✅ **Fix** : Colonne `laboratory` manquante
  - **Solution** : Retirée du script d'import
- ✅ **Fix** : UUID NULL constraint
  - **Solution** : `ALTER TABLE ... ALTER COLUMN id SET DEFAULT gen_random_uuid()`

### UI

- ✅ **Fix** : Textes illisibles (blanc sur blanc)
  - **Solution** : `color: #1a1a1a` sur tous les labels et textes
- ✅ **Fix** : ID dupliqué `thematic-panel`
  - **Solution** : Renommé en `thematic-panel-container`

---

## 📊 Données & Performance

### Statistiques Actuelles

```
Total mailles          : 29 407
Mailles avec données   : 8 307 (28%)
Sondages               : 25 620
Essais géotechniques   : 196
Mailles avec IP        : 150
Mailles avec VBS       : 187
Mailles avec passant   : 187
```

### Performance

- ⚠️ **Requêtes lentes** (>1s) sur 29 407 mailles
- ✅ **Optimisation** : Utiliser `min_sondages >= 3` pour filtrer
- ✅ **Optimisation** : Simplification géométrique selon zoom
- ✅ **Optimisation** : Index GIST + B-tree sur colonnes clés

---

## 📚 Documentation

### Nouveaux Fichiers

- ✅ `DEPLOIEMENT_LAN.md` : Guide complet pour déploiement LAN
- ✅ `RESUME_V1.5.0_FINAL.md` : Résumé technique de la release
- ✅ `INSTRUCTIONS_TEST.md` : Procédure de test étape par étape
- ✅ `SITUATION_FINALE.md` : Analyse technique détaillée
- ✅ `test_api.ps1` : Script PowerShell de test automatique
- ✅ `db/migrations/v1.5.0_complete_setup.sql` : Migration SQL complète

### Fichiers Mis à Jour

- ✅ `docker-compose.yml` : Exposition LAN
- ✅ `services/api-geo/src/thematic/types.rs` : Alias serde
- ✅ `ui/src/import-bulk-wizard.css` : Contraste amélioré
- ✅ `ui/src/main.ts` : Cartes thématiques

---

## 🚀 Migration depuis v1.4.0

### 1. Base de Données

```sql
-- Exécuter la migration
docker compose exec db psql -U atlas -d atlas -f /tmp/v1.5.0_complete_setup.sql

-- Vérifier
SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE n_sondages > 0;
```

### 2. Docker

```powershell
# Rebuild
docker compose build

# Redémarrer
docker compose down
docker compose up -d
```

### 3. Configuration

Ajouter dans `.env` :
```bash
CORS_ORIGIN=*
API_BIND=0.0.0.0:8000
```

---

## ⚠️ Breaking Changes

### Aucun

Cette release est **rétrocompatible** avec v1.4.0.

---

## 🔮 Prochaines Étapes (v1.5.1)

### Priorité Haute

1. **Implémenter `/import/bulk`** (backend Rust)
   - Parser CSV en streaming
   - Insérer sondages + essais
   - Refresh automatique de la MV

2. **Finaliser détection de doublons**
   - Tester `/surveys/nearby`
   - Intégrer avec l'UI

### Priorité Moyenne

3. **Optimiser performance**
   - Cache Redis pour MV
   - Pagination sur `/thematic/data`
   - Index supplémentaires

4. **Tests automatisés**
   - Tests d'intégration API
   - Tests E2E UI (Playwright)

### Priorité Basse

5. **Export GeoPackage** avec données thématiques
6. **Refresh automatique** de la MV (via `refresh_queue`)
7. **Authentification** et gestion des rôles

---

## 👥 Contributeurs

- **Backend** : Rust + PostgreSQL/PostGIS
- **Frontend** : TypeScript + Vite + Leaflet
- **DevOps** : Docker + Docker Compose

---

## 📞 Support

En cas de problème :
1. Consulter `INSTRUCTIONS_TEST.md`
2. Vérifier les logs : `docker compose logs -f`
3. Vérifier l'état : `docker compose ps`

---

**Version** : 1.5.0  
**Statut** : ✅ Production-ready pour LAN  
**Date** : 2025-10-20

🎉 **Prêt pour déploiement avec 10 testeurs !**
