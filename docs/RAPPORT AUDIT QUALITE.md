# 📊 RAPPORT D'AUDIT QUALITÉ - Export Atlas Géotechnique

**Fichier analysé :** `atlas_geotechnique_2025-12-22 (4)`  
**Date d'export :** 22/12/2025 à 11:07:17 UTC  
**Version Atlas :** 3.4.0

---

## 📁 1. STRUCTURE GÉNÉRALE DE L'EXPORT

| Élément | Contenu | Taille |
|---------|---------|--------|
| **Total fichiers** | 72 fichiers | **521.66 Mo** |
| [adm1/](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1:0:0-0:0) | 30 cartes PNG (6 thématiques × 5 régions) | 466.93 Mo |
| [graphes/](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/graphes:0:0-0:0) | 21 graphes statistiques | ~0.3 Mo |
| [donnees_analyse/](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse:0:0-0:0) | 19 fichiers (GeoJSON, CSV) | ~27 Mo |
| [donnees_analyse.zip](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse.zip:0:0-0:0) | Archive des données | 27.07 Mo |
| [index.json](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/index.json:0:0-0:0) | Métadonnées export | 6.7 Ko |

### ✅ Points positifs
- Structure bien organisée en dossiers thématiques
- Fichier [index.json](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/index.json:0:0-0:0) présent avec métadonnées complètes
- Double format : données décompressées + archive ZIP

### ⚠️ Points d'attention
- **Taille totale élevée** (521 Mo) - principalement due aux images PNG haute résolution

---

## 🗺️ 2. CARTES THÉMATIQUES (adm1/)

### Statistiques d'export

| Métrique | Valeur |
|----------|--------|
| **Total demandé** | 40 exports |
| **Réussis** | 30 (75%) |
| **Échoués** | 10 (25%) |

### Thématiques exportées avec succès (6/8)

| Thématique | Centrale | Kara | Maritime | Plateaux | Savanes |
|------------|:--------:|:----:|:--------:|:--------:|:-------:|
| [n_sondages](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/n_sondages:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [vbs_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/vbs_avg:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [ip_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/ip_avg:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [eg_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/eg_avg:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [passant_80um_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/passant_80um_avg:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [passant_2mm_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/passant_2mm_avg:0:0-0:0) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gamma_d_max_avg` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `w_opt_avg` | ❌ | ❌ | ❌ | ❌ | ❌ |

### 🔴 Échecs systématiques : Proctor (gamma_d_max, w_opt)

**Cause identifiée :** Aucune donnée Proctor dans la base
- Fichier [essais_proctor.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_proctor.csv:0:0-0:0) : **uniquement l'en-tête** (66 octets)
- Fichier [grid_gamma_d_max_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_gamma_d_max_avg.geojson:0:0-0:0) : **features: []** (vide)
- Fichier [grid_w_opt_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_w_opt_avg.geojson:0:0-0:0) : **features: []** (vide)

**Recommandation :** Ces thématiques ne devraient pas être proposées à l'export si aucune donnée n'existe.

### Qualité des images PNG

| Caractéristique | Valeur | Évaluation |
|-----------------|--------|------------|
| **Résolution** | 7440 × 10524 px | ✅ Excellente (format A4 HD) |
| **DPI métadonnées** | 96 DPI | ⚠️ Devrait être 300 DPI |
| **Taille moyenne** | ~15.5 Mo/image | ⚠️ Très lourd |
| **Format** | PNG non compressé | ⚠️ Pourrait être optimisé |

**Analyse :** Les images ont une excellente résolution (équivalent 300 DPI pour impression A4), mais les métadonnées DPI indiquent 96 au lieu de 300. Cela n'affecte pas la qualité réelle mais peut poser problème pour l'impression automatique.

---

## 📈 3. GRAPHES STATISTIQUES (graphes/)

### Graphes générés par thématique

| Thématique | Graphes | Types |
|------------|:-------:|-------|
| [n_sondages](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/n_sondages:0:0-0:0) | 4 | histogram, pie, bar, boxplot |
| [vbs_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/vbs_avg:0:0-0:0) | 4 | histogram, boxplot, scatter×2 |
| [ip_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/ip_avg:0:0-0:0) | 4 | histogram, boxplot, casagrande, scatter |
| [eg_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/eg_avg:0:0-0:0) | 4 | histogram, boxplot, scatter×2 |
| [passant_80um_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/passant_80um_avg:0:0-0:0) | 3 | histogram, boxplot, scatter |
| [passant_2mm_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/adm1/passant_2mm_avg:0:0-0:0) | 2 | histogram, boxplot |

### Qualité des graphes

| Caractéristique | Valeur | Évaluation |
|-----------------|--------|------------|
| **Résolution** | 800 × 600 px | ✅ Standard web |
| **Taille moyenne** | ~25-45 Ko | ✅ Légère |
| **Lisibilité** | Bonne | ✅ |

### ⚠️ Graphes manquants

- **gamma_d_max_avg** : Aucun graphe (pas de données)
- **w_opt_avg** : Aucun graphe (pas de données)

---

## 📊 4. DONNÉES POUR ANALYSE (donnees_analyse/)

### Référentiels géographiques

| Fichier | Taille | Évaluation |
|---------|--------|------------|
| [grille_nationale.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/referentiels/grille_nationale.geojson:0:0-0:0) | 25.4 Mo | ✅ Complet (29 407 mailles) |
| [adm1.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/referentiels/adm1.geojson:0:0-0:0) | 283 Ko | ✅ OK |
| [adm2.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/referentiels/adm2.geojson:0:0-0:0) | 899 Ko | ✅ OK |

### Données agrégées par maille

| Fichier | Taille | Features | Évaluation |
|---------|--------|----------|------------|
| [grid_n_sondages.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_n_sondages.geojson:0:0-0:0) | 98 Ko | ~101 | ✅ |
| [grid_vbs_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_vbs_avg.geojson:0:0-0:0) | 84 Ko | ~85 | ✅ |
| [grid_ip_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_ip_avg.geojson:0:0-0:0) | 82 Ko | ~83 | ✅ |
| [grid_eg_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_eg_avg.geojson:0:0-0:0) | 60 Ko | ~60 | ✅ |
| [grid_passant_80um_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_passant_80um_avg.geojson:0:0-0:0) | 63 Ko | ~63 | ✅ |
| [grid_passant_2mm_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_passant_2mm_avg.geojson:0:0-0:0) | 14 Ko | ~14 | ✅ |
| [grid_gamma_d_max_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_gamma_d_max_avg.geojson:0:0-0:0) | 358 octets | **0** | 🔴 Vide |
| [grid_w_opt_avg.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_agregees/grid_w_opt_avg.geojson:0:0-0:0) | 346 octets | **0** | 🔴 Vide |

### Données brutes

| Fichier | Taille | Lignes | Évaluation |
|---------|--------|--------|------------|
| [sondages.geojson](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/sondages.geojson:0:0-0:0) | 68 Ko | 125 | ✅ |
| [sondages.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/sondages.csv:0:0-0:0) | 12 Ko | 126 | ⚠️ Données incomplètes |
| [essais_atterberg.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_atterberg.csv:0:0-0:0) | 4.5 Ko | 84 | ✅ |
| [essais_vbs.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_vbs.csv:0:0-0:0) | 3.6 Ko | ~70 | ✅ |
| [essais_granulo.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_granulo.csv:0:0-0:0) | 2.8 Ko | ~50 | ✅ |
| [essais_proctor.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_proctor.csv:0:0-0:0) | 66 octets | **0** | 🔴 Vide (en-tête seul) |

### 🔴 Problèmes identifiés dans les données brutes

**1. Sondages CSV - Données incomplètes :**
```csv
sondage_id,code,x,y,cell_id,adm1,adm2,adm3,profondeur_max,...
1d05de81...,DAVIE,,,,,,,,,,NICABOU...,0,0
```
- **Coordonnées x,y manquantes** pour la plupart des sondages
- **ADM1/ADM2/ADM3 vides**
- **profondeur_max, type_sondage, date** non renseignés

**2. Essais Atterberg - Données partielles :**
```csv
essai_id,sondage_id,cell_id,adm1,adm2,profondeur,wl,wp,ip,ic
E000001,,TG-0485-0209-01,,,,24.13,,24.13,
```
- **sondage_id vide** (pas de liaison avec les sondages)
- **wl et wp manquants** (seul IP est renseigné)
- **adm1/adm2 vides**

---

## 📋 5. MÉTADONNÉES

### index.json ✅

```json
{
  "generated": "2025-12-22T11:07:17.028Z",
  "version": "3.4.0",
  "total": 40,
  "successful": 30,
  "failed": 10,
  "includesDataExport": true,
  "includesCharts": true
}
```
**Évaluation :** Complet et bien structuré.

### metadata.json ⚠️

```json
{
  "stats": {
    "totalMailles": 29407,
    "maillesAvecDonnees": 101,
    "totalSondages": 125,
    "totalEssais": 232
  },
  "legends": {
    "n_sondages": { "classes": [] },  // ← Vide !
    ...
  }
}
```
**Problème :** Les légendes (classes de couleurs) sont vides pour tous les paramètres.

### README.md ⚠️

Le README est bien structuré mais les tableaux de légendes sont vides :
```markdown
### n_sondages ()
| Classe | Min | Max | Couleur |
|--------|-----|-----|---------|
(vide)
```

---

## 🎯 6. SYNTHÈSE ET RECOMMANDATIONS

### Score global : **72/100** ⭐⭐⭐☆☆

| Critère | Score | Commentaire |
|---------|:-----:|-------------|
| **Structure** | 95% | Excellente organisation |
| **Cartes PNG** | 75% | Qualité HD mais 25% d'échecs |
| **Graphes** | 85% | Bonne couverture, manque Proctor |
| **Données GeoJSON** | 80% | Complet sauf Proctor |
| **Données CSV** | 50% | Beaucoup de champs vides |
| **Métadonnées** | 60% | Légendes manquantes |

### 🔴 Problèmes critiques à corriger

1. **Exports Proctor échouent systématiquement** → Vérifier pourquoi aucune donnée Proctor n'est disponible ou désactiver ces thématiques si pas de données

2. **Légendes vides dans metadata.json** → Le code d'export ne récupère pas les classes de couleurs

3. **DPI métadonnées PNG = 96 au lieu de 300** → Corriger l'écriture des métadonnées DPI dans le PNG

### ⚠️ Améliorations recommandées

1. **Optimiser la taille des PNG** (~15 Mo/image est excessif)
   - Utiliser une compression PNG optimisée
   - Ou proposer un format JPEG pour réduire la taille

2. **Enrichir les données CSV des sondages**
   - Remplir les coordonnées x,y
   - Remplir les champs ADM1/ADM2/ADM3

3. **Lier les essais aux sondages**
   - Renseigner le `sondage_id` dans les fichiers d'essais

4. **Ajouter les unités dans les légendes**
   - VBS : g/100g
   - IP, WL, WP : %
   - Eg : %
   - γd,max : t/m³

### ✅ Points forts

- Structure d'export professionnelle et bien organisée
- Graphes statistiques variés et pertinents
- Double format (décompressé + ZIP) pratique
- README avec instructions QGIS et Python
- Résolution des cartes excellente pour impression

---

**Conclusion :** L'export est globalement de bonne qualité avec une structure professionnelle. Les principaux axes d'amélioration concernent la complétude des données (Proctor, légendes, métadonnées des sondages) et l'optimisation de la taille des fichiers PNG.