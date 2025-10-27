# 📊 Guide d'Import Géotechnique - Atlas

Guide complet pour l'import de données géotechniques au format XLSX multi-feuilles.

## 🎯 Vue d'ensemble

Le système d'import géotechnique permet d'importer en une seule opération :
- **Sondages** (sites de prélèvement)
- **Échantillons** (par profondeur)
- **Essais Atterberg** (WL, WP, IP)
- **Essais VBS** (Valeur de Bleu)
- **Essais Proctor** (normal/modifié)
- **Courbes granulométriques complètes** (tamisage + sédimentométrie)

## 📁 Format du fichier

### Structure générale

Un fichier Excel (`.xlsx`) avec plusieurs feuilles thématiques :

```
atlas_import.xlsx
├── sondages              (requis)
├── echantillons          (requis)
├── atterberg             (optionnel)
├── vbs                   (optionnel)
├── proctor               (optionnel)
├── granulo_tamisage_large    (optionnel)
└── granulo_sedimento_large   (optionnel)
```

---

## 📋 Feuille 1 : `sondages`

**Colonnes :**

| Colonne | Type | Requis | Description | Exemple |
|---------|------|--------|-------------|---------|
| `code_site` | Texte | ✅ | Code unique du site | `Sanfatoute` |
| `localite` | Texte | ❌ | Nom de la localité | `Sanfatoute` |
| `date` | Date | ❌ | Date du sondage | `2025-10-20` |
| `lat` | Nombre | ❌ | Latitude WGS84 | `10.1234` |
| `lon` | Nombre | ❌ | Longitude WGS84 | `1.5678` |
| `adm1` | Texte | ❌ | Région administrative | `Savanes` |
| `adm2` | Texte | ❌ | Préfecture | `Kpendjal` |
| `adm3` | Texte | ❌ | Commune | `Mandouri` |
| `source` | Texte | ❌ | Source des données | `Campagne 2025` |

**Exemple :**

```
code_site    | localite    | date       | lat  | lon  | adm1 | adm2 | adm3 | source
-------------|-------------|------------|------|------|------|------|------|---------------
Sanfatoute   | Sanfatoute  | 2025-10-20 |      |      |      |      |      | Campagne 2025
Korbongou    | Korbongou   | 2025-10-20 |      |      |      |      |      | Campagne 2025
```

---

## 📋 Feuille 2 : `echantillons`

**Colonnes :**

| Colonne | Type | Requis | Description | Exemple |
|---------|------|--------|-------------|---------|
| `code_site` | Texte | ✅ | Code du site (doit exister dans `sondages`) | `Sanfatoute` |
| `depth_m` | Nombre | ✅ | Profondeur en mètres | `1.5` |
| `date` | Date | ❌ | Date de prélèvement | `2025-10-20` |
| `laboratory` | Texte | ❌ | Laboratoire | `Labo Atlas` |
| `norm` | Texte | ❌ | Norme utilisée | `NF P94-051` |
| `rho_s_gcm3` | Nombre | ❌ | Densité des solides (g/cm³) | `2.47` |
| `water_content_w` | Nombre | ❌ | Teneur en eau (%) | `9.82` |
| `is_index` | Nombre | ❌ | Indice de gonflement Is | `0.171` |
| `eg` | Nombre | ❌ | Gonflement œdométrique (%) | `2.5` |
| `commentaire` | Texte | ❌ | Commentaire libre | |

**Exemple :**

```
code_site  | depth_m | date       | laboratory  | rho_s_gcm3 | water_content_w | is_index
-----------|---------|------------|-------------|------------|-----------------|----------
Sanfatoute | 1.0     | 2025-10-20 | Labo Atlas  | 2.47       | 9.82            | 0.171
Sanfatoute | 1.5     | 2025-10-20 | Labo Atlas  | 2.39       | 10.35           | 0.241
Sanfatoute | 2.0     | 2025-10-20 | Labo Atlas  | 2.63       | 8.02            | 0.247
```

---

## 📋 Feuille 3 : `atterberg`

**Colonnes :**

| Colonne | Type | Requis | Description | Exemple |
|---------|------|--------|-------------|---------|
| `code_site` | Texte | ✅ | Code du site | `Sanfatoute` |
| `depth_m` | Nombre | ✅ | Profondeur (m) | `1.0` |
| `wl` | Nombre | ❌ | Limite de liquidité (%) | `57.57` |
| `wp` | Nombre | ❌ | Limite de plasticité (%) | `25.06` |

> **Note :** L'indice de plasticité `IP = WL - WP` est calculé automatiquement.

**Exemple :**

```
code_site  | depth_m | wl    | wp
-----------|---------|-------|-------
Sanfatoute | 1.0     | 57.57 | 25.06
Sanfatoute | 1.5     | 42.95 | 29.96
Korbongou  | 1.0     | 39.60 | 16.66
```

---

## 📋 Feuille 4 : `vbs`

**Colonnes :**

| Colonne | Type | Requis | Description | Exemple |
|---------|------|--------|-------------|---------|
| `code_site` | Texte | ✅ | Code du site | `Sanfatoute` |
| `depth_m` | Nombre | ✅ | Profondeur (m) | `1.0` |
| `vbs` | Nombre | ✅ | Valeur de Bleu (g/100g) | `7.31` |
| `commentaire` | Texte | ❌ | Classification | `Sol argileux` |

**Exemple :**

```
code_site  | depth_m | vbs  | commentaire
-----------|---------|------|--------------------------------
Sanfatoute | 1.0     | 7.31 | Sol argileux
Sanfatoute | 1.5     | 6.28 | Sol argileux
Korbongou  | 1.0     | 4.40 | Sol limoneux plast. moyenne
```

---

## 📋 Feuille 5 : `proctor`

**Colonnes :**

| Colonne | Type | Requis | Description | Exemple |
|---------|------|--------|-------------|---------|
| `code_site` | Texte | ✅ | Code du site | `Sanfatoute` |
| `depth_m` | Nombre | ✅ | Profondeur (m) | `1.0` |
| `proctor_type` | Texte | ✅ | Type : `normal` ou `modifie` | `normal` |
| `gamma_d_max` | Nombre | ✅ | Densité sèche max (kN/m³) | `18.5` |
| `w_opt` | Nombre | ✅ | Teneur en eau optimale (%) | `12.3` |

**Exemple :**

```
code_site  | depth_m | proctor_type | gamma_d_max | w_opt
-----------|---------|--------------|-------------|-------
Sanfatoute | 1.0     | normal       | 18.5        | 12.3
Korbongou  | 1.0     | modifie      | 20.2        | 10.8
```

---

## 📋 Feuille 6 : `granulo_tamisage_large`

**Format "large" :** Les profondeurs sont en colonnes, les tamis en lignes.

**Structure :**

| sieve_mm | Sanfatoute@1 | Sanfatoute@1.5 | Sanfatoute@2 | Korbongou@1 |
|----------|--------------|----------------|--------------|-------------|
| 25.0     | 100.00       | 100.00         | 100.00       |             |
| 20.0     | 100.00       | 100.00         | 100.00       |             |
| 16.0     | 100.00       | 100.00         | 100.00       | 100.00      |
| 12.5     | 99.75        | 100.00         | 99.47        | 99.63       |
| ...      | ...          | ...            | ...          | ...         |
| 0.08     | 82.81        | 77.50          | 68.75        | 66.74       |

**Règles :**
- **Première colonne** : `sieve_mm` = diamètre du tamis en **millimètres**
  - `0.08` = 80 µm
  - `2.0` = 2 mm
  - `20.0` = 20 mm
- **Colonnes suivantes** : format `<code_site>@<profondeur>`
  - Exemple : `Sanfatoute@1.5` = site Sanfatoute, profondeur 1.5 m
  - Accepte virgule ou point : `Sanfatoute@1,5` ou `Sanfatoute@1.5`
- **Valeurs** : pourcentage de passant cumulé (0-100)
- **Cellules vides** : ignorées (pas de mesure)

---

## 📋 Feuille 7 : `granulo_sedimento_large`

Même format que `granulo_tamisage_large`, mais pour les tamis fins (sédimentométrie).

**Exemple :**

| sieve_mm | Sanfatoute@1 | Korbongou@1 |
|----------|--------------|-------------|
| 0.0696   | 82.38        |             |
| 0.0595   |              | 64.51       |
| 0.0494   | 79.33        |             |
| ...      | ...          | ...         |
| 0.0013   |              | 31.18       |

---

## 🚀 Procédure d'import

### 1. Préparer le fichier

```bash
# Générer un exemple
cd atlas
python make_atlas_example_xlsx.py
# → Crée atlas_import_example.xlsx
```

### 2. Remplir les données

- Ouvrir `atlas_import_example.xlsx` dans Excel
- Remplir les feuilles selon vos données
- Sauvegarder

### 3. Lancer l'import

#### Via l'interface web

1. Aller dans **Import** → **Géotechnique**
2. Glisser-déposer le fichier `.xlsx`
3. Choisir le mode de géolocalisation :
   - **Centroïde ADM** : positionne au centre de la commune (recommandé)
   - **Aléatoire dans ADM** : point aléatoire dans la commune
   - **Coordonnées exactes** : utilise lat/lon du fichier
   - **Position inconnue** : pas de géolocalisation
4. Cliquer sur **Lancer l'import**

#### Via l'API

```bash
curl -X POST http://localhost:3000/api/v1/surveys/bulk-import/geotechnical \
  -F "file=@atlas_import.xlsx" \
  -F "geolocation_mode=centroid"
```

**Réponse :**

```json
{
  "success": true,
  "stats": {
    "sondages_created": 2,
    "sondages_updated": 0,
    "echantillons_created": 6,
    "atterberg_created": 6,
    "vbs_created": 6,
    "proctor_created": 0,
    "granulo_points_created": 120,
    "errors": [],
    "warnings": []
  },
  "message": "Import réussi: 2 sondages, 6 échantillons, 12 essais"
}
```

---

## 🔍 Validation et erreurs

### Validations automatiques

- **Sondages** : `code_site` unique
- **Échantillons** : `code_site` doit exister, `depth_m > 0`
- **Atterberg** : `0 ≤ WL, WP ≤ 200`, `WL ≥ WP`
- **VBS** : `0 ≤ VBS ≤ 20`
- **Proctor** : `10 ≤ gamma_d_max ≤ 30`, `0 ≤ w_opt ≤ 50`
- **Granulo** : `0 ≤ passing_pct ≤ 100`, `sieve_mm > 0`

### Messages d'erreur courants

| Erreur | Cause | Solution |
|--------|-------|----------|
| `code_site manquant` | Colonne vide | Remplir le code du site |
| `depth_m manquant` | Profondeur non renseignée | Ajouter la profondeur |
| `Échantillon introuvable` | Pas d'échantillon correspondant | Créer l'échantillon dans la feuille `echantillons` |
| `Sondage introuvable` | Code site inexistant | Ajouter le site dans la feuille `sondages` |
| `WL < WP` | Limites incohérentes | Vérifier les valeurs Atterberg |

---

## 📊 Après l'import

### Vérification

Les données sont automatiquement :
1. **Insérées** dans les tables détaillées (`echantillons`, `granulo_points`, etc.)
2. **Synchronisées** vers `essais_geotechniques` (pour compatibilité)
3. **Agrégées** dans la vue matérialisée `mailles_geotechnique_stats`

### Visualisation

Les cartes thématiques sont mises à jour automatiquement :
- Densité de sondages
- Indice de plasticité (IP)
- Valeur de Bleu (VBS)
- Potentiel de gonflement
- Granulométrie (% fines)

### Requêtes SQL

```sql
-- Voir tous les échantillons avec essais
SELECT * FROM v_echantillons_complets;

-- Courbe granulo d'un échantillon
SELECT sieve_mm, passing_pct, method
FROM granulo_points
WHERE echantillon_id = '<uuid>'
ORDER BY sieve_mm DESC;

-- Statistiques par maille
SELECT code, n_sondages, ip_avg, vbs_avg, eg_avg
FROM mailles_geotechnique_stats
WHERE n_sondages > 0;
```

---

## 🛠️ Maintenance

### Refresh manuel de la vue matérialisée

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;
```

### Supprimer un import

```sql
-- Supprimer tous les échantillons d'un sondage
DELETE FROM echantillons WHERE sondage_id = '<uuid>';

-- Supprimer un sondage (cascade sur échantillons et essais)
DELETE FROM sondages WHERE code = 'Sanfatoute';
```

---

## 💡 Conseils

### Performance

- **Grouper les imports** : importer plusieurs sites en une fois
- **Éviter les doublons** : vérifier les codes sites avant import
- **Format large** : plus rapide pour les courbes granulo complètes

### Qualité des données

- **Vérifier les unités** : mm pour les tamis, % pour les passants
- **Cohérence** : WL ≥ WP, passants décroissants avec tamis croissants
- **Métadonnées** : renseigner laboratoire, norme, date

### Géolocalisation

- **Mode recommandé** : Centroïde ADM (si pas de GPS)
- **Coordonnées exactes** : si disponibles dans le fichier
- **Aléatoire** : pour visualisation sans position précise

---

## 📞 Support

- **Documentation API** : `/api/v1/docs`
- **Exemple complet** : `atlas_import_example.xlsx`
- **Script générateur** : `make_atlas_example_xlsx.py`

---

## 🔄 Versions

- **v1.0** (2025-10-22) : Import XLSX multi-feuilles initial
  - Sondages, échantillons, Atterberg, VBS, Proctor
  - Granulométrie format "large" (profondeurs en colonnes)
  - Synchronisation automatique vers `essais_geotechniques`
