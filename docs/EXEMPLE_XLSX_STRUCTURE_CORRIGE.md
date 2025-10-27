# 📋 Structure XLSX - Spécification Corrigée (Conforme au Code)

Ce document décrit la structure **réellement implémentée** pour chaque feuille du classeur XLSX d'import géotechnique Atlas.

**IMPORTANT** : Ce document reflète la réalité du parser [xlsx_parser.rs](xlsx_parser.rs). Les feuilles `densite`, `teneur_eau`, et `classification` sont des **placeholders non implémentés**.

---

## 📊 Vue d'Ensemble

Un classeur XLSX d'import Atlas peut contenir jusqu'à **10 feuilles**, dont **7 sont implémentées** :

### ✅ Feuilles Implémentées (Fonctionnelles)

1. **sondages** - Informations sur les sites de sondage (OBLIGATOIRE)
2. **echantillons** - Échantillons prélevés (OBLIGATOIRE)
3. **atterberg** - Limites d'Atterberg (optionnel)
4. **vbs** - Valeur au Bleu de Méthylène (optionnel)
5. **proctor** - Essais Proctor (optionnel)
6. **granulo_tamisage_large** - Granulométrie par tamisage, format wide (optionnel)
7. **granulo_sedimento_large** - Granulométrie par sédimentométrie, format wide (optionnel)

### ⚠️ Feuilles Placeholder (NON Implémentées)

8. **densite** - 🚧 NON IMPLÉMENTÉ (utiliser `echantillons.rho_s_gcm3`)
9. **teneur_eau** - 🚧 NON IMPLÉMENTÉ (utiliser `echantillons.water_content_w`)
10. **classification** - 🚧 NON IMPLÉMENTÉ (classifications dérivées automatiquement)

---

## 1️⃣ Feuille "sondages" ✅

**Nom exact** : `sondages` (snake_case, insensible à la casse)

**Rôle** : Définir les sites de prélèvement avec géolocalisation

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code_site` | string | ✅ | - | Unique, non vide | Code unique du sondage |
| `localite` | string | ❌ | - | - | Nom du site/localité |
| `date` | date/string | ❌ | - | Format `YYYY-MM-DD` | Date du sondage |
| `lat` | float | ❌* | ° | 6.0 ≤ lat ≤ 11.5 | Latitude WGS84 (Togo) |
| `lon` | float | ❌* | ° | -1.0 ≤ lon ≤ 2.0 | Longitude WGS84 (Togo) |
| `adm1` | string | ❌ | - | - | Région administrative |
| `adm2` | string | ❌ | - | - | Préfecture/département |
| `adm3` | string | ❌ | - | - | Commune/canton |
| `source` | string | ❌ | - | - | Source/campagne |

**\*** Obligatoire si `geolocation_mode = "exact"` lors de l'import.

### Exemple

```
code_site | localite   | date       | lat  | lon  | adm1    | adm2      | adm3     | source
----------|------------|------------|------|------|---------|-----------|----------|---------------
Sanfatoute| Sanfatoute | 2025-10-20 |      |      |         |           |          | Campagne 2025
Korbongou | Korbongou  | 2025-10-20 |      |      |         |           |          | Campagne 2025
SiteA     | Village A  | 2024-01-15 | 8.52 | 0.85 | Lomé    | Golfe     | Agoè     | Campagne 2024
```

---

## 2️⃣ Feuille "echantillons" ✅

**Nom exact** : `echantillons`

**Rôle** : Définir les échantillons prélevés à différentes profondeurs

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code_site` | string | ✅ | - | Doit exister dans `sondages` | Code du sondage |
| `depth_m` | float | ✅ | m | > 0 | Profondeur de prélèvement |
| `date` | date/string | ❌ | - | `YYYY-MM-DD` | Date de prélèvement |
| `laboratory` | string | ❌ | - | - | Nom du laboratoire |
| `norm` | string | ❌ | - | - | Norme utilisée (ex: NF P94-051) |
| `rho_s_gcm3` | float | ❌ | g/cm³ | 2.0 ≤ ρs ≤ 3.5 | Densité absolue des solides |
| `water_content_w` | float | ❌ | % | 0 ≤ w ≤ 100 | Teneur en eau naturelle |
| `is_index` | float | ❌ | - | 0 ≤ Is ≤ 1 | Indice de gonflement Is |
| `eg` | float | ❌ | % | 0 ≤ eg ≤ 50 | Gonflement œdométrique |
| `commentaire` | string | ❌ | - | - | Commentaire libre |

**Clé unique** : `(code_site, depth_m, date)`

### Exemple

```
code_site  | depth_m | date       | laboratory | rho_s_gcm3 | water_content_w | is_index | eg   | commentaire
-----------|---------|------------|------------|------------|-----------------|----------|------|-------------
Sanfatoute | 1.0     | 2025-10-20 | Labo Atlas | 2.47       | 9.82            | 0.171    |      |
Sanfatoute | 1.5     | 2025-10-20 | Labo Atlas | 2.39       | 10.35           | 0.241    |      |
Sanfatoute | 2.0     | 2025-10-20 | Labo Atlas | 2.63       | 8.02            | 0.247    |      |
```

---

## 3️⃣ Feuille "atterberg" ✅

**Nom exact** : `atterberg`

**Rôle** : Limites d'Atterberg (plasticité des sols fins)

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code_site` | string | ✅ | - | Doit exister dans `echantillons` | Code du sondage |
| `depth_m` | float | ✅ | m | Échantillon correspondant requis | Profondeur |
| `wl` | float | ❌* | % | 0 ≤ WL ≤ 200 | Limite de liquidité |
| `wp` | float | ❌* | % | 0 ≤ WP ≤ 200 | Limite de plasticité |

**\*** Au moins `wl` ou `wp` doit être renseigné. Si les deux sont renseignés, vérifier `WL ≥ WP`.

**Calcul automatique** : `IP = WL - WP` (colonne générée SQL `ip_generated`)

### Exemple

```
code_site  | depth_m | wl    | wp
-----------|---------|-------|------
Sanfatoute | 1.0     | 57.57 | 25.06
Sanfatoute | 1.5     | 42.95 | 29.96
Korbongou  | 1.0     | 39.60 | 16.66
```

---

## 4️⃣ Feuille "vbs" ✅

**Nom exact** : `vbs`

**Rôle** : Essai au Bleu de Méthylène (argilosité)

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code_site` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | - | Profondeur |
| `vbs` | float | ✅ | g/100g | 0 ≤ VBS ≤ 20 | Valeur au bleu |
| `commentaire` | string | ❌ | - | - | Classification/remarques |

**Classification automatique GTR** :
- VBS < 0.1 : Sol insensible à l'eau
- 0.1 ≤ VBS < 1.5 : Sol limoneux
- 1.5 ≤ VBS < 2.5 : Sol limoneux plastique
- 2.5 ≤ VBS < 6 : Sol argileux
- VBS ≥ 6 : Sol très argileux

### Exemple

```
code_site  | depth_m | vbs  | commentaire
-----------|---------|------|----------------------------------
Sanfatoute | 1.0     | 7.31 | Sol argileux
Sanfatoute | 1.5     | 6.28 | Sol argileux
Korbongou  | 1.0     | 4.40 | Sol limoneux de plasticité moyenne
```

---

## 5️⃣ Feuille "proctor" ✅

**Nom exact** : `proctor`

**Rôle** : Essais Proctor (compactage optimal)

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code_site` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | - | Profondeur |
| `proctor_type` | string | ✅ | - | `"normal"` ou `"modifie"` | Type de Proctor |
| `gamma_d_max` | float | ✅ | kN/m³ | 10 ≤ γd ≤ 30 | Densité sèche maximale |
| `w_opt` | float | ✅ | % | 0 ≤ wopt ≤ 50 | Teneur en eau optimale |

**⚠️ ATTENTION** :
- `gamma_d_max` est en **kN/m³** (pas g/cm³ comme dans l'ancien doc)
- `proctor_type` doit être exactement `"normal"` ou `"modifie"` (minuscule, sensible à la casse après normalisation)

**Clé unique** : `(code_site, depth_m, proctor_type)` - permet 2 essais par échantillon (normal + modifié)

### Exemple

```
code_site  | depth_m | proctor_type | gamma_d_max | w_opt
-----------|---------|--------------|-------------|-------
Sanfatoute | 1.0     | normal       | 18.5        | 12.3
Korbongou  | 1.0     | modifie      | 20.2        | 10.8
```

---

## 6️⃣ Feuille "granulo_tamisage_large" ✅

**Nom exact** : `granulo_tamisage_large`

**Rôle** : Courbes granulométriques par tamisage (particules > 80µm)

### Format "Wide"

**Structure matricielle** : Tamis en lignes, échantillons en colonnes

#### Ligne d'en-tête (row 1)

| Colonne 0 | Colonne 1 | Colonne 2 | ... | Colonne N |
|-----------|-----------|-----------|-----|-----------|
| `sieve_mm` | `code_site@depth_m` | `code_site@depth_m` | ... | `code_site@depth_m` |

**Pattern colonnes** : `<code_site>@<depth_m>`
- Séparateur : `@`
- Exemples : `Sanfatoute@1`, `Korbongou@1.5`, `SiteA@2.0`
- Accepte virgule ou point pour depth : `Site@1,5` = `Site@1.5`

#### Lignes de données (row 2+)

| sieve_mm | Sanfatoute@1 | Sanfatoute@1.5 | Korbongou@1 |
|----------|--------------|----------------|-------------|
| 25.0     | 100.00       | 100.00         | 100.00      |
| 20.0     | 100.00       | 100.00         |             |
| 16.0     | 100.00       | 100.00         | 100.00      |
| 12.5     | 99.75        | 100.00         | 99.63       |
| ...      | ...          | ...            | ...         |
| 0.08     | 82.81        | 77.50          | 66.74       |

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes |
|---------|------|-------------|-------|-------------|
| `sieve_mm` | float | ✅ | mm | > 0, diamètre tamis |
| `<code_site>@<depth_m>` | float | ❌ | % | 0 ≤ passant ≤ 100 |

**Transformation automatique** : Format wide → format long (lignes) via `transform_large_to_long()`

Chaque cellule devient :
```rust
GranuloPointRow {
    code_site: "Sanfatoute",
    depth_m: 1.0,
    method: "tamisage",
    sieve_mm: 0.08,
    passing_pct: 82.81
}
```

### Tamis courants (tamisage)

**Séries AFNOR** : 25, 20, 16, 12.5, 10, 8, 6.3, 5, 4, 3.15, 2.5, 2, 1.6, 1.25, 1, 0.8, 0.63, 0.5, 0.4, 0.315, 0.25, 0.2, 0.16, 0.125, 0.1, **0.08** (mm)

**Seuils clés** :
- **0.08 mm** (80 µm) : limite fines/sables
- **2 mm** : limite sables/graviers
- **20 mm** : limite graviers/cailloux

---

## 7️⃣ Feuille "granulo_sedimento_large" ✅

**Nom exact** : `granulo_sedimento_large`

**Rôle** : Granulométrie par sédimentométrie (fraction fine < 80µm)

### Structure

**Identique à `granulo_tamisage_large`** sauf :
- `method` fixé à `"sedimento"`
- Tamis typiques : diamètres équivalents < 0.08 mm

### Diamètres équivalents courants (sédimento)

0.0696, 0.0595, 0.0494, 0.0428, 0.0351, 0.0309, 0.0224, 0.0199, 0.0130, 0.0118, 0.0076, 0.0070, 0.0047, 0.0044, 0.0033, 0.0031, 0.0027, 0.0026, 0.0024, 0.0022, 0.0019, 0.0018, 0.0014, 0.0013 (mm)

### Exemple

```
sieve_mm | Sanfatoute@1 | Korbongou@1
---------|--------------|-------------
0.0696   | 82.38        |
0.0595   |              | 64.51
0.0494   | 79.33        |
0.0428   |              | 61.48
...      | ...          | ...
0.0013   |              | 31.18
```

---

## 8️⃣ Feuille "densite" 🚧 NON IMPLÉMENTÉE

**Statut** : Placeholder uniquement, **non parsé par xlsx_parser.rs**

**Alternative** : Utiliser `echantillons.rho_s_gcm3` pour la densité absolue des solides.

### Colonnes (hypothétiques)

| Colonne | Type | Description |
|---------|------|-------------|
| `code_site` | string | Code du sondage |
| `depth_m` | float | Profondeur |
| `rho_d_app` | float | Densité apparente sèche (g/cm³) |
| `rho_s_abs` | float | Densité absolue des grains (g/cm³) |
| `note` | string | Commentaire |

---

## 9️⃣ Feuille "teneur_eau" 🚧 NON IMPLÉMENTÉE

**Statut** : Placeholder uniquement, **non parsé par xlsx_parser.rs**

**Alternative** : Utiliser `echantillons.water_content_w` pour la teneur en eau naturelle.

### Colonnes (hypothétiques)

| Colonne | Type | Description |
|---------|------|-------------|
| `code_site` | string | Code du sondage |
| `depth_m` | float | Profondeur |
| `w` | float | Teneur en eau naturelle (%) |
| `wi` | float | Indice de plasticité |
| `note` | string | Commentaire |

---

## 🔟 Feuille "classification" 🚧 NON IMPLÉMENTÉE

**Statut** : Placeholder uniquement, **non parsé par xlsx_parser.rs**

**Alternative** : Les classifications sont **dérivées automatiquement** depuis les essais :
- **GTR (Bleu de Méthylène)** : calculé depuis VBS
- **USCS** : calculé depuis granulo + Atterberg
- **HRB/AASHTO** : calculé depuis granulo + IP

### Colonnes (hypothétiques)

| Colonne | Type | Description |
|---------|------|-------------|
| `code_site` | string | Code du sondage |
| `depth_m` | float | Profondeur |
| `hrb` | string | Classification HRB/AASHTO (ex: A-2-4, A-7-6) |
| `unified` | string | Classification USCS (ex: SM, CH, ML) |
| `bm` | string | Classification GTR (ex: A1, A2, A4) |
| `note` | string | Commentaire |

---

## 📝 Règles Générales

### Noms de Colonnes
- **Normalisation** : Conversion en minuscules lors du parsing (`header.to_lowercase()`)
- **Insensible à la casse** : `Code_Site` = `code_site` = `CODE_SITE`
- **Clés canoniques** : Utiliser les noms exacts documentés ci-dessus pour éviter ambiguïté

### Noms de Feuilles
- **Matching exact (insensible à la casse)** :
  - `"sondages"`, `"echantillons"`, `"atterberg"`, `"vbs"`, `"proctor"`
  - `"granulo_tamisage_large"`, `"granulo_sedimento_large"`
- **Pas d'alias** : Les noms doivent correspondre exactement (après `to_lowercase()`)

### Formats de Données
- **Dates** : Format ISO 8601 `YYYY-MM-DD` (ex: `2025-10-20`)
- **Nombres** : Point **ou** virgule comme séparateur décimal (normalisé automatiquement)
- **Séparateur décimal** : `.replace(',', '.')` lors du parsing
- **Cellules vides** : Interprétées comme `None`/`NULL`

### Feuilles Obligatoires vs Optionnelles
- **Minimum absolu** : `sondages` + `echantillons`
- **Recommandé** : + au moins un type d'essai (`atterberg`, `vbs`, etc.)
- **Feuilles optionnelles** : Toutes sauf `sondages` et `echantillons`

---

## 🎯 Checklist Qualité

### Avant Import
- [ ] `code_site` cohérent entre toutes les feuilles
- [ ] Tous les `code_site` des essais existent dans `sondages`
- [ ] Tous les couples `(code_site, depth_m)` des essais existent dans `echantillons`
- [ ] Profondeurs `depth_m > 0`
- [ ] Valeurs dans les bornes contraintes (voir tableaux ci-dessus)
- [ ] `WL ≥ WP` (Atterberg)
- [ ] `proctor_type` exactement `"normal"` ou `"modifie"`
- [ ] Pas de cellules fusionnées
- [ ] En-têtes en ligne 1
- [ ] Pas de lignes vides au milieu des données

### Validation Automatique
Le système vérifie automatiquement :
- ✅ Présence des colonnes obligatoires
- ✅ Types de données (float, string, date)
- ✅ Contraintes CHECK SQL
- ✅ Intégrité référentielle (foreign keys)
- ✅ Cohérence physique (WL ≥ WP, passants dans [0,100])

---

## 💡 Conseils

### Performance
- **Limite recommandée** : ~10 000 lignes par feuille
- **Taille fichier** : < 10 MB recommandé

### Organisation
- **Un classeur par campagne** : Plus facile à gérer
- **Noms explicites** : `Campagne_2024_Site_A.xlsx`
- **Backup** : Toujours garder une copie de l'original

### Erreurs Courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `code_site manquant ligne X` | Cellule vide | Remplir le code du site |
| `depth_m manquant ligne X` | Profondeur non renseignée | Ajouter la profondeur en mètres |
| `Échantillon X@Y: sondage introuvable` | `code_site` absent de `sondages` | Ajouter le sondage dans feuille `sondages` |
| `WL < WP` | Limites incohérentes | Vérifier valeurs Atterberg (WL doit être ≥ WP) |
| `proctor_type invalide` | Valeur incorrecte | Utiliser exactement `"normal"` ou `"modifie"` |
| `gamma_d_max hors limites` | Unité incorrecte | Vérifier unité : kN/m³ (pas g/cm³) |
| `Longitude hors du Togo` | Coordonnée invalide | Vérifier lon ∈ [-1, 2] |

---

## 🔗 Références Code Source

- **Parser XLSX** : [xlsx_parser.rs:96-529](xlsx_parser.rs)
- **Types** : [types.rs](atlas/services/api-geo/src/import_bulk/types.rs)
- **Importer** : [geotechnical_importer.rs](geotechnical_importer.rs)
- **Migration SQL** : [011_geotechnical_detailed_import.sql](011_geotechnical_detailed_import.sql)
- **Guide utilisateur** : [GUIDE_IMPORT_GEOTECHNIQUE.md](GUIDE_IMPORT_GEOTECHNIQUE.md)

---

## 📌 Différences avec l'Ancien Document

| Ancien | Nouveau (Corrigé) | Raison |
|--------|-------------------|--------|
| `code` | `code_site` | Clé canonique réelle dans le code |
| `rho_d_max` (g/cm³) | `gamma_d_max` (kN/m³) | Nom et unité corrects |
| Feuilles `densite`, `teneur_eau`, `classification` fonctionnelles | NON IMPLÉMENTÉES | Pas de parser dans xlsx_parser.rs |
| `is_index` boolean | `is_index` float (0-1) | Type SQL réel |
| `localite` obligatoire | `code_site` obligatoire | Seul `code_site` est requis |

---

**Version** : 2.0 (Corrigée)
**Date** : 24 octobre 2025
**Statut** : ✅ Conforme au code source (commit actuel)
**Mainteneur** : Projet Atlas
