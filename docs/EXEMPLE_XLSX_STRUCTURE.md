# 📋 Structure XLSX - Guide Complet

Ce document décrit la structure exacte attendue pour chaque feuille du classeur XLSX d'import.

---

## 📊 Vue d'Ensemble

Un classeur XLSX d'import Atlas peut contenir jusqu'à **10 feuilles** :

1. **sondages** - Informations sur les sites de sondage
2. **echantillons** - Échantillons prélevés
3. **atterberg** - Limites d'Atterberg
4. **vbs** - Valeur au Bleu de Méthylène
5. **proctor** - Essais Proctor
6. **granulo_tamisage_large** - Granulométrie par tamisage (format wide)
7. **granulo_sedimento_large** - Granulométrie par sédimentométrie (format wide)
8. **densite** - 🆕 Densité apparente et absolue
9. **teneur_eau** - 🆕 Teneur en eau naturelle
10. **classification** - 🆕 Classifications géotechniques

---

## 1️⃣ Feuille "sondages"

### Colonnes

| Colonne | Type | Obligatoire | Unité | Description | Exemple |
|---------|------|-------------|-------|-------------|---------|
| `code` | string | ✅ | - | Code unique du sondage | S001 |
| `localite` | string | ✅ | - | Nom du site | Site A |
| `date` | date | ✅ | - | Date du sondage | 2024-01-15 |
| `source` | string | ❌ | - | Source/campagne | Campagne 2024 |
| `lat` | float | ✅ | ° | Latitude (WGS84) | 8.5234 |
| `lon` | float | ✅ | ° | Longitude (WGS84) | 0.8456 |
| `adm1` | string | ❌ | - | Région administrative | Lomé |
| `adm2` | string | ❌ | - | Préfecture | Golfe |
| `adm3` | string | ❌ | - | Commune | Agoè |

### Exemple

```
code | localite | date       | source        | lat    | lon   | adm1 | adm2  | adm3
-----|----------|------------|---------------|--------|-------|------|-------|------
S001 | Site A   | 2024-01-15 | Campagne 2024 | 8.5234 | 0.845 | Lomé | Golfe | Agoè
S002 | Site B   | 2024-01-16 | Campagne 2024 | 8.6123 | 0.912 | Lomé | Golfe | Agoè
```

---

## 2️⃣ Feuille "echantillons"

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `date` | date | ❌ | - | - | Date de prélèvement |
| `laboratory` | string | ❌ | - | - | Laboratoire |
| `rho_s_gcm3` | float | ❌ | g/cm³ | 1-4 | Densité des grains solides |
| `water_content_w` | float | ❌ | % | 0-100 | Teneur en eau |
| `is_index` | boolean | ❌ | - | - | Échantillon index ? |

### Exemple

```
code | depth_m | date       | laboratory | rho_s_gcm3 | water_content_w | is_index
-----|---------|------------|------------|------------|-----------------|----------
S001 | 2.5     | 2024-01-15 | Lab A      | 2.65       | 15.2            | true
S001 | 5.0     | 2024-01-15 | Lab A      | 2.68       | 18.7            | false
S002 | 3.0     | 2024-01-16 | Lab A      | 2.63       | 12.5            | true
```

---

## 3️⃣ Feuille "atterberg"

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `wl` | float | ✅ | % | 0-100 | Limite de liquidité |
| `wp` | float | ✅ | % | 0-100 | Limite de plasticité |

### Exemple

```
code | depth_m | wl   | wp
-----|---------|------|-----
S001 | 2.5     | 45.2 | 22.1
S001 | 5.0     | 52.8 | 25.4
S002 | 3.0     | 38.5 | 19.2
```

---

## 4️⃣ Feuille "vbs"

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `vbs` | float | ✅ | g/100g | ≥ 0 | Valeur au bleu |
| `commentaire` | string | ❌ | - | - | Remarques |

### Exemple

```
code | depth_m | vbs  | commentaire
-----|---------|------|-------------
S001 | 2.5     | 1.5  | RAS
S001 | 5.0     | 2.8  | Argile
S002 | 3.0     | 0.8  |
```

---

## 5️⃣ Feuille "proctor"

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `rho_d_max` | float | ✅ | g/cm³ | 0-3 | Densité sèche max |
| `w_opt` | float | ✅ | % | 0-100 | Teneur en eau optimale |
| `proctor_type` | string | ❌ | - | normal/modifie | Type de Proctor |

### Exemple

```
code | depth_m | rho_d_max | w_opt | proctor_type
-----|---------|-----------|-------|-------------
S001 | 2.5     | 1.85      | 12.5  | normal
S001 | 5.0     | 1.92      | 11.8  | modifie
S002 | 3.0     | 1.78      | 14.2  | normal
```

---

## 6️⃣ Feuille "granulo_tamisage_large" (Format Wide)

### Structure

Format "wide" : une colonne par série d'échantillon.

| Colonne | Type | Description |
|---------|------|-------------|
| `sieve_mm` | float | Diamètre du tamis en mm |
| `S001@2.5` | float | % passant pour S001 à 2.5m |
| `S001@5.0` | float | % passant pour S001 à 5.0m |
| `S002@3.0` | float | % passant pour S002 à 3.0m |

### Exemple

```
sieve_mm | S001@2.5 | S001@5.0 | S002@3.0
---------|----------|----------|----------
80       | 100      | 100      | 100
40       | 98.5     | 99.2     | 97.8
20       | 85.3     | 88.7     | 82.1
10       | 72.1     | 75.4     | 68.9
5        | 58.7     | 62.3     | 55.2
2        | 45.2     | 48.9     | 42.1
1        | 35.8     | 38.5     | 33.2
0.5      | 28.3     | 30.7     | 26.5
0.25     | 22.1     | 24.2     | 20.8
0.125    | 15.7     | 17.5     | 14.9
0.063    | 10.2     | 11.8     | 9.5
```

---

## 7️⃣ Feuille "granulo_sedimento_large" (Format Wide)

Même structure que `granulo_tamisage_large` mais pour les particules fines (< 0.063 mm).

### Exemple

```
sieve_mm | S001@2.5 | S001@5.0 | S002@3.0
---------|----------|----------|----------
0.050    | 8.5      | 10.2     | 7.8
0.020    | 6.2      | 7.8      | 5.9
0.010    | 4.5      | 5.9      | 4.2
0.005    | 3.1      | 4.2      | 2.9
0.002    | 1.8      | 2.5      | 1.6
```

---

## 8️⃣ Feuille "densite" 🆕

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `rho_d_app` | float | ✅ | g/cm³ | 0-3 | Densité apparente sèche |
| `rho_s_abs` | float | ✅ | g/cm³ | 1-4 | Densité absolue des grains |
| `note` | string | ❌ | - | - | Remarques |

### Exemple

```
code | depth_m | rho_d_app | rho_s_abs | note
-----|---------|-----------|-----------|------
S001 | 2.5     | 1.85      | 2.65      | RAS
S001 | 5.0     | 1.92      | 2.68      |
S002 | 3.0     | 1.78      | 2.63      | Sol compact
```

---

## 9️⃣ Feuille "teneur_eau" 🆕

### Colonnes

| Colonne | Type | Obligatoire | Unité | Contraintes | Description |
|---------|------|-------------|-------|-------------|-------------|
| `code` | string | ✅ | - | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 | Profondeur |
| `w` | float | ✅ | % | 0-100 | Teneur en eau naturelle |
| `wi` | float | ❌ | % | 0-100 | Indice de plasticité |
| `note` | string | ❌ | - | - | Remarques |

### Exemple

```
code | depth_m | w    | wi   | note
-----|---------|------|------|--------
S001 | 2.5     | 15.2 | 12.5 |
S001 | 5.0     | 18.7 | 14.2 | Humide
S002 | 3.0     | 12.8 | 10.3 |
```

---

## 🔟 Feuille "classification" 🆕

### Colonnes

| Colonne | Type | Obligatoire | Unité | Description |
|---------|------|-------------|-------|-------------|
| `code` | string | ✅ | - | Code du sondage |
| `depth_m` | float | ✅ | m | Profondeur |
| `hrb` | string | ❌ | - | Classification HRB/AASHTO |
| `unified` | string | ❌ | - | Classification USCS |
| `bm` | string | ❌ | - | Classification Bleu de Méthylène |
| `note` | string | ❌ | - | Remarques |

### Exemple

```
code | depth_m | hrb   | unified | bm | note
-----|---------|-------|---------|-------|--------
S001 | 2.5     | A-2-4 | SM      | A2    |
S001 | 5.0     | A-7-6 | CH      | A4    | Argile
S002 | 3.0     | A-4   | ML      | A1    | Limon
```

---

## 📝 Règles Générales

### Noms de Colonnes
- **Flexibles** : Le wizard détecte automatiquement les variantes
- **Exemples** : `code` = `code_site` = `localite`
- **Insensible à la casse** : `Code` = `CODE` = `code`
- **Accents** : Normalisés automatiquement

### Noms de Feuilles
- **Détection automatique** : Basée sur des mots-clés
- **Exemples** :
  - `densite` = `densité` = `density` = `rho`
  - `teneur_eau` = `water_content` = `w_naturel`
  - `classification` = `classement` = `hrb` = `uscs`

### Formats de Données
- **Dates** : `YYYY-MM-DD`, `DD/MM/YYYY`, ou format Excel
- **Nombres** : Point ou virgule comme séparateur décimal
- **Booléens** : `true`/`false`, `1`/`0`, `oui`/`non`

### Feuilles Optionnelles
- **Toutes les feuilles sont optionnelles**
- **Minimum** : `sondages` + au moins un essai
- **Recommandé** : `sondages` + `echantillons` + essais

---

## 🎯 Checklist Qualité

### Avant Import
- [ ] Toutes les colonnes obligatoires sont présentes
- [ ] Les codes de sondage sont cohérents entre feuilles
- [ ] Les profondeurs sont en mètres (≥ 0)
- [ ] Les valeurs sont dans les bornes attendues
- [ ] Pas de cellules fusionnées
- [ ] Pas de lignes vides au milieu des données
- [ ] Les en-têtes sont en ligne 1

### Validation Automatique
Le wizard vérifie automatiquement :
- ✅ Présence des colonnes obligatoires
- ✅ Types de données
- ✅ Contraintes numériques
- ✅ Cohérence des codes entre feuilles

---

## 💡 Conseils

### Performance
- **Limite** : ~10 000 lignes par feuille (recommandé)
- **Taille** : < 10 MB (recommandé)

### Organisation
- **Un classeur par campagne** : Plus facile à gérer
- **Noms explicites** : `Campagne_2024_Site_A.xlsx`
- **Backup** : Toujours garder une copie de l'original

### Erreurs Courantes
1. **Codes incohérents** : S001 vs S-001 vs S_001
2. **Unités** : Profondeur en cm au lieu de m
3. **Dates** : Format texte au lieu de date Excel
4. **Cellules fusionnées** : Causent des erreurs de parsing

---

**Version** : 1.0  
**Date** : 24 octobre 2025  
**Statut** : ✅ Complet avec nouveaux essais
