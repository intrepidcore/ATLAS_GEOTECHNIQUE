# Implémentation DSM COP30 - Atlas Géotechnique

## 📋 Vue d'ensemble

Intégration complète du **Modèle Numérique de Surface COP30** (Copernicus DEM GLO-30) dans Atlas Géotechnique, permettant l'analyse de l'altitude et du relief par maille 2km et 28km.

**Date**: 6 janvier 2026  
**Statut**: ✅ Infrastructure complète - Prêt pour import du raster

---

## 🎯 Objectifs atteints

### Phase 1-2: Couches contextuelles (TERMINÉ ✅)
- ✅ Migration 090: Tables géologie, pédologie, risque de gonflement
- ✅ Migration 092: Mapping colonnes depuis GPKG importés
- ✅ Script `import_context_layers_v2.ps1`: Import robuste via Docker
- ✅ Routes API: `/layers/geologie`, `/layers/pedologie`, `/layers/risque-gonflement`
- ✅ **Données importées**: 120 géo, 61 pédo, 342 risque (SRID 25231)

### Phase 3: Infrastructure DSM COP30 (TERMINÉ ✅)
- ✅ Migration 091: Table `atlas.dsm_cop30` avec extension PostGIS raster
- ✅ Migration 093: Vues d'agrégation par maille (2km et 28km)
- ✅ Script `import_dsm_cop30.ps1`: Import raster avec `raster2pgsql`
- ✅ DSM reprojeté en EPSG:25231 (UTM 31N)
- ✅ Module Rust `dsm.rs`: Handler API
- ✅ Route API: `/coverage/mailles-dsm?grid=2km|28km`

### Phase 4: À compléter
- ⏳ Import du raster DSM (opération longue ~5-15 min)
- ⏳ Tests avec données DSM réelles
- ⏳ Intégration UI (optionnel)

---

## 📁 Structure des fichiers

### Migrations SQL
```
db/migrations/
├── 090_create_context_layers.sql      # Tables géologie, pédologie, risque
├── 091_create_dsm_cop30.sql           # Table raster DSM
├── 092_fix_context_layers_columns.sql # Mapping colonnes GPKG
└── 093_create_dsm_views.sql           # Vues agrégation DSM par maille
```

### Scripts PowerShell
```
scripts/
├── import_context_layers_v2.ps1  # Import couches contextuelles
└── import_dsm_cop30.ps1          # Import raster DSM COP30
```

### Code Rust API
```
services/api-geo/src/
├── dsm.rs                        # Module DSM (nouveau)
├── layers.rs                     # Couches contextuelles (modifié)
└── main.rs                       # Routes (modifié)
```

### Données sources
```
ressource/
├── GEOLOGIQUE/unites_geologique_V2.gpkg
├── PEDOLOGIE/unites_pedologique_V2.gpkg
├── RISQUE_GONFLEMENT/carte_risque_gonflement.gpkg
└── DSM/rasters_COP30/
    ├── output_hh.tif              # DSM original (EPSG:4326)
    └── dsm_cop30_25231.tif        # DSM reprojeté (EPSG:25231) ✅
```

---

## 🔧 Procédure d'utilisation

### 1. Vérifier l'état actuel

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas

# Vérifier les couches contextuelles
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT 'geologie' AS layer, COUNT(*) FROM atlas.unites_geologiques
UNION ALL
SELECT 'pedologie', COUNT(*) FROM atlas.unites_pedologiques
UNION ALL
SELECT 'risque', COUNT(*) FROM atlas.risque_gonflement;"

# Vérifier le DSM
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT COUNT(*) as nb_tuiles, ST_SRID(rast) as srid 
FROM atlas.dsm_cop30 
GROUP BY ST_SRID(rast);"
```

**Résultat attendu**:
- Géologie: 120 lignes
- Pédologie: 61 lignes
- Risque: 342 lignes
- DSM: 0 tuiles (avant import)

### 2. Importer le DSM COP30 (PROCHAINE ÉTAPE)

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas\scripts
powershell -ExecutionPolicy Bypass -File .\import_dsm_cop30.ps1
```

**Durée estimée**: 5-15 minutes selon la taille du raster  
**Espace disque**: ~500 MB dans PostgreSQL

**Sortie attendue**:
```
=== Import DSM COP30 dans PostGIS ===
Conteneur: atlas-db
Base de données: atlas_clean
Raster source: C:\...\dsm_cop30_25231.tif

Préparation du conteneur...
Copie du raster dans le conteneur...
Génération du SQL d'import...
  Options: tuilage automatique (-t auto), index spatial (-I), contraintes (-C)
Import dans PostgreSQL...
  (Cela peut prendre plusieurs minutes selon la taille du raster)
✓ DSM importé avec succès

=== Vérification de l'import ===
 nb_tuiles | srid | largeur_tuile | hauteur_tuile | resolution_x | resolution_y
-----------+------+---------------+---------------+--------------+--------------
       XXX | 25231|           100 |           100 |           30 |          -30

=== Statistiques du DSM ===
 altitude_min | altitude_max | altitude_moyenne | ecart_type
--------------+--------------+------------------+------------
            0 |          XXX |              XXX |        XXX

Import DSM terminé !
```

### 3. Tester les endpoints API

```powershell
# Test couches contextuelles
curl "http://localhost:8000/layers/geologie?bbox=0,6,2,11" | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object
# Attendu: Count = 119

curl "http://localhost:8000/layers/pedologie?bbox=0,6,2,11" | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object
# Attendu: Count = 61

curl "http://localhost:8000/layers/risque-gonflement?bbox=0,6,2,11" | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object
# Attendu: Count = 342

# Test DSM (après import)
curl "http://localhost:8000/coverage/mailles-dsm?grid=2km&bbox=0,6,2,11" | ConvertFrom-Json | Select-Object -ExpandProperty features | Select-Object -First 1 -ExpandProperty properties

# Attendu: altitude_mean, altitude_min, altitude_max avec valeurs réelles
```

### 4. Vérifier les vues DSM

```sql
-- Vue 2km
SELECT 
    code,
    altitude_mean,
    altitude_min,
    altitude_max,
    altitude_range
FROM atlas.v_maille_dsm_2km_flat
WHERE altitude_mean IS NOT NULL
LIMIT 10;

-- Vue 28km
SELECT 
    code_m28,
    profil_num,
    altitude_mean,
    altitude_range
FROM atlas.v_maille_dsm_28km_flat
WHERE altitude_mean IS NOT NULL
LIMIT 5;
```

---

## 📊 Schéma de la base de données

### Table DSM
```sql
atlas.dsm_cop30
├── rid (serial PRIMARY KEY)         -- Identifiant tuile
├── rast (raster)                    -- Tuile raster hauteur (m)
└── filename (text)                  -- Nom fichier source

Index: dsm_cop30_rast_st_convexhull_idx (GIST)
Contrainte: SRID = 25231
```

### Vues DSM 2km
```sql
atlas.v_maille_dsm_2km
├── id (maille)
├── code (maille)
└── stats (composite type)
    ├── count    -- Nombre de pixels
    ├── mean     -- Altitude moyenne
    ├── min      -- Altitude min
    ├── max      -- Altitude max
    └── stddev   -- Écart-type

atlas.v_maille_dsm_2km_flat (dépliée)
├── id, code
├── nb_pixels
├── altitude_mean
├── altitude_min
├── altitude_max
├── altitude_stddev
└── altitude_range (max - min)
```

### Vues DSM 28km
```sql
atlas.v_maille_dsm_28km
├── id_m28
├── code_m28
├── profil_num
└── stats (composite type)

atlas.v_maille_dsm_28km_flat (dépliée)
├── id_m28, code_m28, profil_num
├── nb_pixels
├── altitude_mean, altitude_min, altitude_max
├── altitude_stddev
└── altitude_range
```

---

## 🔌 API Endpoints

### Couches contextuelles

#### GET `/layers/geologie`
**Paramètres**: `bbox=west,south,east,north` (EPSG:4326)  
**Retour**: GeoJSON avec features géologiques

**Propriétés**:
- `id`: Identifiant unique
- `code`: Code unité géologique
- `libelle`: Nom de l'unité
- `description`: Description détaillée

#### GET `/layers/pedologie`
**Paramètres**: `bbox=west,south,east,north`  
**Retour**: GeoJSON avec features pédologiques

**Propriétés**:
- `id`, `code`, `libelle`, `description`

#### GET `/layers/risque-gonflement`
**Paramètres**: `bbox=west,south,east,north`  
**Retour**: GeoJSON avec zones de risque

**Propriétés**:
- `id`, `code`, `libelle`, `description`
- `niveau_risque`: Niveau de risque de gonflement

### DSM COP30

#### GET `/coverage/mailles-dsm`
**Paramètres**:
- `grid`: `2km` ou `28km` (défaut: `2km`)
- `bbox`: `west,south,east,north` (EPSG:4326, optionnel)

**Retour**: GeoJSON avec mailles et statistiques d'altitude

**Propriétés (2km)**:
```json
{
  "code": "TG-0750-0210-01",
  "altitude_mean": 245.3,
  "altitude_min": 180.5,
  "altitude_max": 310.8,
  "altitude_range": 130.3,
  "altitude_stddev": 25.4
}
```

**Propriétés (28km)**:
```json
{
  "code_m28": "TG-28KM-001",
  "profil_num": 1,
  "altitude_mean": 320.5,
  "altitude_min": 150.0,
  "altitude_max": 580.2,
  "altitude_range": 430.2,
  "altitude_stddev": 85.3
}
```

---

## 🧪 Tests de validation

### Test 1: Couches contextuelles
```powershell
# Géologie
$geo = curl "http://localhost:8000/layers/geologie?bbox=0,6,2,11" -s | ConvertFrom-Json
$geo.features.Count  # Attendu: 119

# Pédologie
$pedo = curl "http://localhost:8000/layers/pedologie?bbox=0,6,2,11" -s | ConvertFrom-Json
$pedo.features.Count  # Attendu: 61

# Risque
$risque = curl "http://localhost:8000/layers/risque-gonflement?bbox=0,6,2,11" -s | ConvertFrom-Json
$risque.features.Count  # Attendu: 342
```

### Test 2: DSM (après import)
```powershell
# Grille 2km
$dsm2km = curl "http://localhost:8000/coverage/mailles-dsm?grid=2km&bbox=0,6,2,11" -s | ConvertFrom-Json
$dsm2km.features[0].properties | Format-List
# Attendu: altitude_mean, altitude_min, altitude_max avec valeurs

# Grille 28km
$dsm28km = curl "http://localhost:8000/coverage/mailles-dsm?grid=28km&bbox=0,6,2,11" -s | ConvertFrom-Json
$dsm28km.features[0].properties | Format-List
```

### Test 3: Vérification SQL
```sql
-- Nombre de mailles avec données DSM
SELECT 
    COUNT(*) as mailles_avec_dsm,
    ROUND(AVG(altitude_mean), 1) as altitude_moyenne_nationale,
    ROUND(MIN(altitude_min), 1) as altitude_min_nationale,
    ROUND(MAX(altitude_max), 1) as altitude_max_nationale
FROM atlas.v_maille_dsm_2km_flat;

-- Distribution des altitudes par région
SELECT 
    m.pref_code,
    COUNT(*) as nb_mailles,
    ROUND(AVG(d.altitude_mean), 1) as altitude_moyenne,
    ROUND(MIN(d.altitude_min), 1) as altitude_min,
    ROUND(MAX(d.altitude_max), 1) as altitude_max
FROM atlas.mailles m
JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
GROUP BY m.pref_code
ORDER BY altitude_moyenne DESC;
```

---

## 🚀 Prochaines étapes

### Immédiat
1. **Lancer l'import du DSM** avec `import_dsm_cop30.ps1`
2. **Vérifier les statistiques** d'altitude par maille
3. **Tester l'endpoint** `/coverage/mailles-dsm` avec données réelles

### Court terme
4. **Intégration UI** (optionnel):
   - Ajouter indicateur "Altitude moyenne" dans les cartes thématiques
   - Créer couche raster de fond pour visualiser le relief
   - Ajouter filtre par plage d'altitude

### Moyen terme
5. **Analyses avancées**:
   - Corrélation altitude / propriétés géotechniques
   - Analyse de pente (dérivée du DSM)
   - Exposition (orientation des versants)
   - Ruissellement et zones inondables

---

## 📝 Notes techniques

### Reprojection du DSM
Le DSM COP30 original est en **EPSG:4326** (WGS84). Il a été reprojeté en **EPSG:25231** (UTM 31N) pour cohérence avec les autres données Atlas:

```powershell
gdalwarp -t_srs EPSG:25231 -r bilinear -co COMPRESS=LZW `
  ressource\DSM\rasters_COP30\output_hh.tif `
  ressource\DSM\rasters_COP30\dsm_cop30_25231.tif
```

### Tuilage automatique
Le script `import_dsm_cop30.ps1` utilise `raster2pgsql` avec l'option `-t auto` pour découper automatiquement le raster en tuiles optimales (généralement 100x100 pixels).

### Performance
- **Index spatial**: `ST_ConvexHull(rast)` pour requêtes rapides
- **Vues matérialisées** (optionnel): Pour pré-calculer les stats par maille
- **Limite API**: 5000 mailles max par requête (grille 2km)

### Contraintes SRID
Une contrainte PostgreSQL garantit que tous les rasters sont en SRID 25231:
```sql
ALTER TABLE atlas.dsm_cop30
    ADD CONSTRAINT enforce_srid_rast 
    CHECK (ST_SRID(rast) = 25231);
```

---

## ✅ Checklist de validation

- [x] Migration 090 exécutée (couches contextuelles)
- [x] Migration 091 exécutée (table DSM)
- [x] Migration 092 exécutée (mapping colonnes)
- [x] Migration 093 exécutée (vues DSM)
- [x] Extension `postgis_raster` activée
- [x] DSM reprojeté en EPSG:25231
- [x] Script `import_context_layers_v2.ps1` testé
- [x] Données contextuelles importées (120+61+342)
- [x] Routes API `/layers/*` fonctionnelles
- [x] Route API `/coverage/mailles-dsm` fonctionnelle
- [x] API recompilée et redémarrée
- [ ] DSM importé avec `import_dsm_cop30.ps1`
- [ ] Tests avec données DSM réelles
- [ ] Documentation UI (si intégration)

---

## 🐛 Résolution de problèmes

### Erreur: "type 'raster' does not exist"
**Solution**: Activer l'extension PostGIS raster
```sql
CREATE EXTENSION IF NOT EXISTS postgis_raster;
```

### Erreur: "column 'code' does not exist"
**Solution**: Exécuter la migration 092 pour mapper les colonnes GPKG
```powershell
Get-Content db/migrations/092_fix_context_layers_columns.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

### Import DSM très lent
**Solutions**:
- Vérifier l'espace disque disponible
- Utiliser un raster pré-découpé par région
- Augmenter `shared_buffers` PostgreSQL
- Désactiver temporairement les index pendant l'import

### Valeurs DSM nulles dans l'API
**Cause**: Le raster DSM n'est pas encore importé  
**Solution**: Lancer `import_dsm_cop30.ps1`

---

## 📚 Références

- **Copernicus DEM**: https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model
- **PostGIS Raster**: https://postgis.net/docs/RT_reference.html
- **GDAL/OGR**: https://gdal.org/
- **EPSG:25231**: UTM Zone 31N (Togo)

---

**Auteur**: Claude (Cascade AI)  
**Date**: 6 janvier 2026  
**Version**: 1.0
