# Protocole de Tests End-to-End - DSM COP30 & Couches Contextuelles

**Date**: 6 janvier 2026  
**Version**: 1.0  
**Statut**: ✅ Backend complet - UI prête pour tests

---

## 📋 Vue d'ensemble

Ce protocole décrit les tests à effectuer pour valider l'intégration complète du DSM COP30 et des couches contextuelles dans Atlas Géotechnique.

---

## 🎯 Objectifs des tests

1. **Valider les couches contextuelles** (géologie, pédologie, risque)
2. **Valider l'indicateur DSM** dans les cartes thématiques
3. **Vérifier la cohérence des données** affichées
4. **Tester les performances** avec différents niveaux de zoom
5. **Valider l'export** des données DSM

---

## ✅ Prérequis

### Environnement
```powershell
# Vérifier que Docker est démarré
docker ps | Select-String atlas

# Vérifier que l'API est opérationnelle
curl http://localhost:8000/healthz

# Vérifier la base de données
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM atlas.dsm_cop30;"
# Attendu: 2926 tuiles
```

### Données importées
- ✅ DSM COP30: 2,926 tuiles (SRID 25231)
- ✅ Mailles avec DSM: 567 (2km), 13 (28km)
- ✅ Géologie: 120 features
- ✅ Pédologie: 61 features
- ✅ Risque: 342 features

---

## 🧪 Tests Backend (API)

### Test 1: Couches contextuelles

#### 1.1 Géologie
```powershell
curl "http://localhost:8000/layers/geologie?bbox=0,6,2,11" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object

# ✅ Attendu: Count = 119
# ✅ Vérifier: properties.code, properties.libelle, properties.description
```

#### 1.2 Pédologie
```powershell
curl "http://localhost:8000/layers/pedologie?bbox=0,6,2,11" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object

# ✅ Attendu: Count = 61
```

#### 1.3 Risque de gonflement
```powershell
curl "http://localhost:8000/layers/risque-gonflement?bbox=0,6,2,11" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object

# ✅ Attendu: Count = 342
```

### Test 2: Endpoint DSM direct

#### 2.1 Grille 2km
```powershell
curl "http://localhost:8000/coverage/mailles-dsm?grid=2km&bbox=0,6,2,11" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Select-Object -First 3 | ForEach-Object { $_.properties }

# ✅ Attendu: 
# - altitude_mean: valeur entre 71 et 808
# - altitude_min, altitude_max: valeurs cohérentes
# - altitude_range: max - min
# - altitude_stddev: écart-type
```

#### 2.2 Grille 28km
```powershell
curl "http://localhost:8000/coverage/mailles-dsm?grid=28km" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object

# ✅ Attendu: Count <= 13
```

### Test 3: Endpoint thématique

```powershell
curl "http://localhost:8000/thematic/data?parameter=altitude_mean&include_geometry=true&zoom=8" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Select-Object -First 1

# ✅ Attendu:
# - geometry: type Polygon
# - properties.value: altitude en mètres
# - properties.code: code maille (TG-XXXX-XXXX-XX)
```

---

## 🖥️ Tests Frontend (UI)

### Test 4: Couches de contexte (Panneau latéral)

**Procédure**:
1. Ouvrir Atlas Géotechnique dans le navigateur
2. Ouvrir le panneau "Couches de contexte"
3. Activer **Géologie**
   - ✅ Polygones colorés s'affichent
   - ✅ Clic sur un polygone → popup avec libellé et description
4. Activer **Pédologie**
   - ✅ Polygones s'affichent par-dessus la géologie
5. Activer **Risque de gonflement**
   - ✅ Polygones colorés selon le niveau de risque

**Critères de succès**:
- Les couches se superposent correctement
- Les popups affichent les bonnes informations
- Pas d'erreur dans la console navigateur

### Test 5: Indicateur DSM dans cartes thématiques

**Procédure**:
1. Ouvrir le panneau "Cartes thématiques"
2. Sélectionner l'objectif **"Contexte géographique"** 🗺️
3. Vérifier que le paramètre **"Altitude moyenne (DSM COP30)"** est disponible
4. Cliquer sur **"Appliquer"**

**Critères de succès**:
- ✅ La grille 2km change de couleur selon l'altitude
- ✅ Palette de couleurs: bleu (basse altitude) → vert → marron (haute altitude)
- ✅ Légende affichée avec les classes d'altitude
- ✅ Clic sur une maille → popup avec altitude moyenne

**Valeurs attendues**:
- Altitude min: ~71 m
- Altitude max: ~808 m
- Palette: Terrain (ou équivalent)

### Test 6: Combinaison couches + thématique

**Procédure**:
1. Activer l'indicateur **Altitude moyenne (DSM COP30)**
2. Activer en parallèle la couche **Géologie**
3. Zoomer sur une zone spécifique

**Critères de succès**:
- ✅ Les deux couches sont visibles simultanément
- ✅ Pas de conflit visuel
- ✅ Performance fluide (pas de lag)

---

## 📊 Tests de cohérence des données

### Test 7: Vérification SQL

```sql
-- Statistiques globales DSM
SELECT 
    COUNT(*) as nb_mailles,
    ROUND(AVG(altitude_mean), 1) as altitude_moyenne_nationale,
    ROUND(MIN(altitude_min), 1) as altitude_min_nationale,
    ROUND(MAX(altitude_max), 1) as altitude_max_nationale
FROM atlas.v_maille_dsm_2km_flat;

-- ✅ Attendu:
-- nb_mailles: 567
-- altitude_moyenne_nationale: ~200-300m
-- altitude_min_nationale: ~71m
-- altitude_max_nationale: ~808m
```

```sql
-- Distribution par région
SELECT 
    m.adm2_name,
    COUNT(*) as nb_mailles,
    ROUND(AVG(d.altitude_mean), 1) as altitude_moyenne,
    ROUND(MIN(d.altitude_min), 1) as altitude_min,
    ROUND(MAX(d.altitude_max), 1) as altitude_max
FROM atlas.mailles m
JOIN atlas.v_maille_dsm_2km_flat d ON d.code = m.code
WHERE m.adm2_name IS NOT NULL
GROUP BY m.adm2_name
ORDER BY altitude_moyenne DESC
LIMIT 10;

-- ✅ Vérifier: cohérence géographique (montagnes vs plaines)
```

### Test 8: Validation croisée

```sql
-- Comparer avec les données géotechniques
SELECT 
    m.code,
    d.altitude_mean as altitude_dsm,
    m.n_sondages,
    m.ip_avg
FROM atlas.mailles m
JOIN atlas.v_maille_dsm_2km_flat d ON d.code = m.code
WHERE m.n_sondages > 0
LIMIT 10;

-- ✅ Vérifier: pas de corrélation aberrante
```

---

## ⚡ Tests de performance

### Test 9: Temps de réponse API

```powershell
# Mesurer le temps de réponse
Measure-Command { 
    curl "http://localhost:8000/coverage/mailles-dsm?grid=2km&bbox=0,6,2,11" -s | Out-Null 
}

# ✅ Attendu: < 2 secondes
```

### Test 10: Charge avec bbox large

```powershell
# Tester avec une grande zone
curl "http://localhost:8000/coverage/mailles-dsm?grid=2km&bbox=-1,5,3,12" -s | ConvertFrom-Json | Select-Object -ExpandProperty features | Measure-Object

# ✅ Vérifier: 
# - Pas de timeout
# - Nombre de features cohérent
# - Temps de réponse acceptable
```

---

## 📤 Tests d'export

### Test 11: Export thématique avec DSM

**Procédure**:
1. Afficher la carte thématique **Altitude moyenne (DSM COP30)**
2. Ouvrir le panneau d'export
3. Sélectionner une région (ex: Maritime)
4. Exporter en **Excel** ou **GeoJSON**

**Critères de succès**:
- ✅ Fichier généré contient les colonnes altitude_mean, altitude_min, altitude_max
- ✅ Valeurs cohérentes avec l'affichage
- ✅ Géométries correctes (si GeoJSON)

---

## 🐛 Tests de robustesse

### Test 12: Gestion des erreurs

#### 12.1 Paramètre invalide
```powershell
curl "http://localhost:8000/thematic/data?parameter=invalid_param" -v

# ✅ Attendu: HTTP 400 Bad Request
```

#### 12.2 Bbox invalide
```powershell
curl "http://localhost:8000/coverage/mailles-dsm?bbox=invalid" -v

# ✅ Attendu: Erreur gérée proprement
```

#### 12.3 Maille sans DSM
```sql
-- Vérifier que les mailles sans DSM ne cassent pas l'API
SELECT COUNT(*) FROM atlas.mailles m
LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.code = m.code
WHERE d.altitude_mean IS NULL;

-- ✅ Ces mailles doivent être ignorées, pas d'erreur
```

---

## 📝 Checklist finale

### Backend
- [x] Migration 091 exécutée (table dsm_cop30)
- [x] Migration 092 exécutée (colonnes contextuelles)
- [x] Migration 093 exécutée (vues DSM)
- [x] Migration 094 exécutée (filtrage NoData)
- [x] Extension postgis_raster activée
- [x] DSM importé (2,926 tuiles)
- [x] Couches contextuelles importées (523 features)
- [x] Routes API fonctionnelles
- [x] Enum ThematicParameter mis à jour

### Frontend
- [x] Objectif 'contexte' ajouté
- [x] Paramètre altitude_mean configuré
- [x] Catégorie 'contexte' dans types
- [ ] Tests UI manuels effectués
- [ ] Export validé

### Documentation
- [x] IMPLEMENTATION_DSM_COP30.md
- [x] PROTOCOLE_TESTS_DSM.md
- [x] Scripts PowerShell documentés
- [x] Migrations SQL commentées

---

## 🎯 Résultats attendus

### Données
- **DSM**: 567 mailles 2km avec altitude valide (71-808m)
- **Couches**: 120 géo + 61 pédo + 342 risque
- **Performance**: < 2s pour requêtes API

### Visuel
- **Palette**: Dégradé terrain (bleu → vert → marron)
- **Légende**: Classes d'altitude claires
- **Superposition**: Couches contextuelles + grille DSM

### Fonctionnel
- **Aucune erreur** dans les logs API
- **Aucune erreur** dans la console navigateur
- **Export** fonctionnel avec données DSM

---

## 🚨 Problèmes connus et solutions

### Problème 1: Valeurs NoData dans le DSM
**Symptôme**: Valeurs extrêmes négatives (-3.4e38)  
**Solution**: Migration 094 filtre ces valeurs  
**Vérification**: `WHERE altitude_mean > -100 AND altitude_mean < 1000`

### Problème 2: Colonnes ADM manquantes
**Symptôme**: Erreur SQL "column m.adm1_name does not exist"  
**Solution**: Utiliser `NULL::text` pour adm1_name et adm3_name  
**Statut**: ✅ Corrigé dans thematic/routes.rs

### Problème 3: Performance avec bbox large
**Symptôme**: Timeout sur grandes zones  
**Solution**: Tuilage 256x256 + index spatial  
**Statut**: ✅ Optimisé

---

## 📞 Support

En cas de problème:
1. Vérifier les logs API: `docker logs atlas-api-geo --tail 50`
2. Vérifier la console navigateur (F12)
3. Consulter `IMPLEMENTATION_DSM_COP30.md` section "Résolution de problèmes"
4. Vérifier l'état de la base: `scripts/check_28km.py`

---

**Auteur**: Claude (Cascade AI)  
**Date**: 6 janvier 2026  
**Version**: 1.0
