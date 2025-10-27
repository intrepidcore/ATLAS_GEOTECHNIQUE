# 📖 Guide Académique - Saisie des Données Géotechniques Atlas

**Document de référence pour la saisie manuelle des données dans le fichier Excel d'import**

Ce guide décrit en détail **tous les champs de toutes les feuilles** du classeur Excel d'import géotechnique Atlas V3.

---

## 📚 Table des Matières

1. [Introduction](#introduction)
2. [Structure Générale](#structure-générale)
3. [Feuille 1 : sondages](#feuille-1--sondages)
4. [Feuille 2 : echantillons](#feuille-2--echantillons)
5. [Feuille 3 : atterberg](#feuille-3--atterberg)
6. [Feuille 4 : vbs](#feuille-4--vbs)
7. [Feuille 5 : proctor](#feuille-5--proctor)
8. [Feuille 6 : granulo_tamisage_large](#feuille-6--granulo_tamisage_large)
9. [Feuille 7 : granulo_sedimento_large](#feuille-7--granulo_sedimento_large)
10. [Feuille 8 : densite](#feuille-8--densite)
11. [Feuille 9 : teneur_eau](#feuille-9--teneur_eau)
12. [Feuille 10 : classification](#feuille-10--classification)
13. [Exemples Pratiques](#exemples-pratiques)
14. [Erreurs Courantes](#erreurs-courantes)
15. [Glossaire](#glossaire)

---

## Introduction

### Objectif du Guide

Ce guide vous aidera à :
- **Comprendre** la signification de chaque champ
- **Saisir** correctement les valeurs dans le fichier Excel
- **Valider** vos données avant l'import
- **Éviter** les erreurs courantes

### Conventions de Notation

| Symbole           | Signification                   |
| ----------------- | ------------------------------- |
| **[OBLIGATOIRE]** | Champ qui doit être rempli      |
| **[OPTIONNEL]**   | Champ facultatif                |
| **[CALCULÉ]**     | Valeur calculée automatiquement |
| 🔢                | Valeur numérique                |
| 📝                | Texte libre                     |
| 📅                | Date                            |
| 🔗                | Référence à une autre feuille   |

---

## Structure Générale

### Hiérarchie des Données

```
┌─────────────────┐
│   SONDAGES      │  (Site géographique)
│   (code_site)   │
└────────┬────────┘
         │
         ├─────────────────┐
         │  ÉCHANTILLONS   │  (Prélèvement à une profondeur)
         │  (depth_m)      │
         └────────┬────────┘
                  │
                  ├──► ATTERBERG (WL, WP, IP)
                  ├──► VBS (Valeur au bleu)
                  ├──► PROCTOR (Compactage)
                  ├──► GRANULO (Courbe granulométrique)
                  ├──► DENSITE (ρd, ρs)
                  ├──► TENEUR_EAU (W, Wi)
                  └──► CLASSIFICATION (HRB, USCS, BM)
```

### Clés de Liaison

Toutes les feuilles sont liées par les **clés** suivantes :

| Clé | Description | Exemple |
|-----|-------------|---------|
| `code_site` | Identifiant unique du sondage | `KEVE-S1`, `ASSA-S1` |
| `depth_m` | Profondeur de prélèvement (mètres) | `1.0`, `1.5`, `2.0` |

**Important** : Pour qu'un essai soit lié à un échantillon, les valeurs de `code_site` et `depth_m` doivent **correspondre exactement** à celles de la feuille `echantillons`.

---

## Feuille 1 : sondages

### Description

Cette feuille contient les **sites de sondage** (localités où les prélèvements ont été effectués).

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 📝

**Type** : Texte (chaîne de caractères)

**Description** : Identifiant unique du site de sondage.

**Règles** :
- Doit être **unique** dans toute la feuille
- Pas de doublons autorisés
- Recommandation : Format `LOCALITE-S1`, `LOCALITE-S2`, etc.

**Exemples valides** :
```
KEVE-S1
ASSAHOUN-S1
BADJA-S1
LOME-GOLFE-S01
SOKODE-CENTRE-S1
```

**Erreurs à éviter** :
❌ Vide ou NULL
❌ Caractères spéciaux (`/`, `\`, `*`)
❌ Espaces multiples

---

#### 2. `localite` **[OPTIONNEL]** 📝

**Type** : Texte

**Description** : Nom lisible de la localité (village, quartier, commune).

**Exemples** :
```
Kévé
Assahoun
Badja
Lomé - Golfe
Sokodé Centre
```

---

#### 3. `date` **[OPTIONNEL]** 📅

**Type** : Date (format ISO 8601)

**Description** : Date du sondage ou de la campagne.

**Format attendu** : `YYYY-MM-DD`

**Exemples valides** :
```
2025-10-24
2024-03-15
2023-11-01
```

**Erreurs à éviter** :
❌ `24/10/2025` (format français non supporté)
❌ `10-24-2025` (format US non supporté)
❌ `2025/10/24` (slashes au lieu de tirets)

---

#### 4. `adm3` **[OPTIONNEL]** 📝

**Type** : Texte

**Description** : Nom de la commune (division administrative niveau 3).

**Exemples** :
```
Mandouri
Kpendjal
Lomé 1er
Tchaoudjo
```

---

#### 5. `adm2` **[OPTIONNEL]** 📝

**Type** : Texte

**Description** : Nom de la préfecture (division administrative niveau 2).

**Exemples** :
```
Kpendjal
Golfe
Tchaoudjo
Sotouboua
```

---

#### 6. `lat` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal (degrés décimaux)

**Description** : Latitude GPS du site (système WGS84).

**Plage valide (Togo)** : `6.0` à `11.5`

**Exemples** :
```
10.8573
9.5421
6.1298
```

**Format** :
- Utiliser le **point** comme séparateur décimal (pas la virgule)
- 4 à 6 chiffres après la virgule recommandés

**Erreurs à éviter** :
❌ `10,8573` (virgule au lieu de point)
❌ `-5.2` (hors plage Togo)
❌ `105.23` (valeur aberrante)

---

#### 7. `lon` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal (degrés décimaux)

**Description** : Longitude GPS du site (système WGS84).

**Plage valide (Togo)** : `-1.0` à `2.0`

**Exemples** :
```
1.2345
0.7821
-0.3456
```

---

#### 8. `source` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Source des données ou nom de la campagne.

**Exemples** :
```
Campagne 2024 - LNBTP
Mission géotechnique Octobre 2025
Étude de sol pour projet routier
Données laboratoire Atlas
```

---

### Exemple de Lignes Complètes

```
code_site   | localite  | date       | adm3      | adm2     | lat     | lon     | source
------------|-----------|------------|-----------|----------|---------|---------|---------------------------
KEVE-S1     | Kévé      | 2025-10-20 | Mandouri  | Kpendjal | 10.8573 | 0.5421  | Campagne géotech 2025
ASSA-S1     | Assahoun  | 2025-10-21 | Kpendjal  | Kpendjal | 10.7821 | 0.6234  | Mission LNBTP Octobre
BADJA-S1    | Badja     | 2025-10-22 |           |          |         |         | Étude laboratoire privé
```

---

## Feuille 2 : echantillons

### Description

Cette feuille contient les **échantillons** prélevés à différentes profondeurs sur chaque site.

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site (doit exister dans la feuille `sondages`).

**Règle** : Doit correspondre exactement à un `code_site` de la feuille `sondages`.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal positif

**Description** : Profondeur de prélèvement de l'échantillon (en mètres).

**Unité** : Mètres (m)

**Règles** :
- Doit être **strictement positif** (> 0)
- Utiliser le **point** comme séparateur décimal

**Exemples valides** :
```
0.5
1.0
1.5
2.0
3.25
5.8
```

**Erreurs à éviter** :
❌ `0` ou valeurs négatives
❌ `1,5` (virgule au lieu de point)
❌ `150` (confusion cm/m)

---

#### 3. `date` **[OPTIONNEL]** 📅

**Type** : Date (ISO 8601)

**Description** : Date de prélèvement de l'échantillon.

**Format** : `YYYY-MM-DD`

---

#### 4. `laboratory` **[OPTIONNEL]** 📝

**Type** : Texte

**Description** : Nom du laboratoire qui a réalisé les essais.

**Exemples** :
```
Labo Atlas
LNBTP
Laboratoire National du Bâtiment
SGS Togo
Bureau Veritas
```

---

#### 5. `rho_s_gcm3` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Densité absolue des solides** (ou densité des grains).

**Unité** : g/cm³

**Plage valide** : `2.0` à `3.5` g/cm³

**Valeurs typiques** :
- Sables siliceux : `2.65` g/cm³
- Argiles : `2.70` - `2.75` g/cm³
- Sols latéritiques : `2.60` - `2.80` g/cm³

**Exemples** :
```
2.65
2.72
2.58
```

**Erreurs à éviter** :
❌ `26.5` (confusion avec kg/m³)
❌ `1.5` (trop faible, probablement densité apparente)
❌ `4.0` (trop élevée)

---

#### 6. `water_content_w` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Teneur en eau naturelle** de l'échantillon.

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `100` %

**Valeurs typiques** :
- Sables secs : `5` - `10` %
- Argiles : `15` - `30` %
- Sols saturés : `30` - `60` %

**Exemples** :
```
12.5
28.4
45.2
```

**Erreurs à éviter** :
❌ `125` (confusion avec rapport pondéral)
❌ Valeurs négatives
❌ Valeurs > 100%

---

#### 7. `is_index` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Indice de gonflement** (Is).

**Plage valide** : `0` à `1`

**Interprétation** :
- `Is < 0.1` : Gonflement nul
- `0.1 ≤ Is < 0.3` : Gonflement faible
- `0.3 ≤ Is < 0.5` : Gonflement moyen
- `Is ≥ 0.5` : Gonflement fort

**Exemples** :
```
0.08
0.25
0.42
0.67
```

---

#### 8. `commentaire` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Commentaire libre sur l'échantillon.

**Exemples** :
```
Échantillon intact
Sol remanié
Présence de graviers
Odeur organique
```

---

### Contrainte d'Unicité

**Important** : Un échantillon est identifié de manière unique par la combinaison :

```
(code_site, depth_m, date)
```

Vous ne pouvez pas avoir deux échantillons avec le même `code_site`, la même `depth_m` et la même `date`.

---

### Exemple de Lignes Complètes

```
code_site | depth_m | date       | laboratory | rho_s_gcm3 | water_content_w | is_index | commentaire
----------|---------|------------|------------|------------|-----------------|----------|------------------
KEVE-S1   | 1.0     | 2025-10-20 | Labo Atlas | 2.49       | 14.61           | 0.28     | Sol intact
KEVE-S1   | 1.5     | 2025-10-20 | Labo Atlas | 2.45       | 11.29           | 0.23     |
KEVE-S1   | 2.0     | 2025-10-20 | Labo Atlas | 2.58       | 4.40            | 0.08     | Gonflement nul
```

---

## Feuille 3 : atterberg

### Description

Cette feuille contient les résultats des **essais de limites d'Atterberg** (plasticité des sols fins).

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site (lien vers `sondages`).

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon (lien vers `echantillons`).

**Règle** : La paire `(code_site, depth_m)` doit exister dans la feuille `echantillons`.

---

#### 3. `wl` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Limite de liquidité** (WL).

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `200` %

**Définition** : Teneur en eau au-delà de laquelle le sol passe de l'état plastique à l'état liquide.

**Valeurs typiques** :
- Sables : Non applicable (NP)
- Limons : `20` - `50` %
- Argiles peu plastiques : `30` - `50` %
- Argiles plastiques : `50` - `90` %
- Argiles très plastiques : `> 90` %

**Exemples** :
```
24.5
41.2
53.7
```

---

#### 4. `wp` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Limite de plasticité** (WP).

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `200` %

**Définition** : Teneur en eau au-delà de laquelle le sol passe de l'état solide à l'état plastique.

**Valeurs typiques** :
- Limons : `15` - `25` %
- Argiles peu plastiques : `15` - `25` %
- Argiles plastiques : `20` - `35` %

**Exemples** :
```
12.3
19.4
23.5
```

---

#### 5. `ip` **[CALCULÉ]** 🔢

**Type** : Nombre décimal (calculé automatiquement)

**Description** : **Indice de plasticité** (IP = WL - WP).

**⚠️ Important** : Ce champ est **calculé automatiquement** par la base de données. **Ne pas le remplir** dans le fichier Excel.

**Formule** :
```
IP = WL - WP
```

**Interprétation** :
- `IP < 5` : Sol non plastique
- `5 ≤ IP < 15` : Sol peu plastique
- `15 ≤ IP < 40` : Sol plastique
- `IP ≥ 40` : Sol très plastique

---

### Contraintes Importantes

#### Règle de Cohérence

**WL doit être ≥ WP**

Si vous saisissez des valeurs où `WL < WP`, l'import échouera avec une erreur.

**Exemple d'erreur** :
```
❌ WL = 15, WP = 20  (ERREUR : WL < WP)
✅ WL = 53, WP = 23  (OK)
```

---

### Contrainte d'Unicité

**Un seul essai Atterberg par échantillon**.

La clé unique est : `echantillon_id` (résolu via `code_site` + `depth_m`).

---

### Exemple de Lignes Complètes

```
code_site | depth_m | wl   | wp
----------|---------|------|------
KEVE-S1   | 1.0     | 53   | 23
KEVE-S1   | 1.5     | 48   | 21
KEVE-S1   | 2.0     | 51   | 22
ASSA-S1   | 1.0     | 24   | 12
ASSA-S1   | 1.5     | 41   | 19
```

**Résultat après import** :
```sql
-- IP calculé automatiquement
KEVE-S1@1.0  : WL=53, WP=23, IP=30
KEVE-S1@1.5  : WL=48, WP=21, IP=27
KEVE-S1@2.0  : WL=51, WP=22, IP=29
```

---

## Feuille 4 : vbs

### Description

Cette feuille contient les résultats des **essais au bleu de méthylène** (VBS), qui caractérisent l'argilosité des sols.

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon.

---

#### 3. `vbs` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Valeur au bleu de méthylène** (VBS).

**Unité** : g de bleu / 100g de sol

**Plage valide** : `0` à `20`

**Définition** : Quantité de bleu de méthylène adsorbée par 100g de fraction 0/50mm du sol. Mesure de l'activité de la fraction argileuse.

**Classification GTR (Guide des Terrassements Routiers)** :

| Plage VBS | Classification | Description |
|-----------|----------------|-------------|
| `VBS < 0.1` | Sol insensible à l'eau | Sables propres |
| `0.1 ≤ VBS < 1.5` | Sol limoneux | Limons peu plastiques |
| `1.5 ≤ VBS < 2.5` | Sol limoneux plastique | Limons argileux |
| `2.5 ≤ VBS < 6` | Sol argileux | Argiles |
| `VBS ≥ 6` | Sol très argileux | Argiles plastiques |

**Exemples** :
```
0.5   → Sol limoneux
1.83  → Sol limoneux plastique
4.02  → Sol argileux
8.5   → Sol très argileux
```

---

#### 4. `commentaire` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Classification textuelle ou remarque.

**Exemples** :
```
Sol limoneux
Sol limoneux argileux
Sol argileux peu plastique
Argile plastique
```

---

### Contrainte d'Unicité

**Un seul essai VBS par échantillon**.

---

### Exemple de Lignes Complètes

```
code_site | depth_m | vbs  | commentaire
----------|---------|------|---------------------------
KEVE-S1   | 1.0     | 4.02 | Sol limoneux argileux
KEVE-S1   | 1.5     | 3.61 | Sol limoneux argileux
KEVE-S1   | 2.0     | 1.22 | Sol limoneux
ASSA-S1   | 1.0     | 1.83 | Sol limoneux argileux
BADJA-S1  | 1.0     | 4.60 | Sol limoneux argileux
```

---

## Feuille 5 : proctor

### Description

Cette feuille contient les résultats des **essais Proctor** (compactage).

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon.

---

#### 3. `proctor_type` **[OBLIGATOIRE]** 📝

**Type** : Texte (énumération)

**Description** : Type d'essai Proctor.

**Valeurs autorisées** :
- `normal` (Proctor normal)
- `modifie` (Proctor modifié)

**⚠️ Important** : Les valeurs doivent être **exactement** `normal` ou `modifie` (en minuscules, sans accent sur le 'e').

**Erreurs à éviter** :
❌ `Normal` (majuscule)
❌ `modifié` (avec accent)
❌ `NORMAL` (majuscules)
❌ `Proctor modifié` (texte complet)

---

#### 4. `gamma_d_max` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Densité sèche maximale** (γd max).

**Unité** : kN/m³

**Plage valide** : `10` à `30` kN/m³

**Valeurs typiques** :
- Sables : `17` - `21` kN/m³
- Limons : `16` - `19` kN/m³
- Argiles : `14` - `18` kN/m³
- Latérites : `19` - `22` kN/m³

**Exemples** :
```
17.5
19.2
21.8
```

**⚠️ Attention** : L'unité est **kN/m³**, pas g/cm³.

**Conversion** :
```
γd (kN/m³) = ρd (g/cm³) × 9.81
```

---

#### 5. `w_opt` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Teneur en eau optimale** (wopt).

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `50` %

**Définition** : Teneur en eau correspondant à la densité sèche maximale.

**Valeurs typiques** :
- Sables : `8` - `12` %
- Limons : `10` - `16` %
- Argiles : `15` - `25` %

**Exemples** :
```
10.5
14.3
18.7
```

---

### Contrainte d'Unicité

**Deux essais maximum par échantillon** : 1 normal + 1 modifié.

La clé unique est : `(echantillon_id, proctor_type)`.

---

### Exemple de Lignes Complètes

```
code_site | depth_m | proctor_type | gamma_d_max | w_opt
----------|---------|--------------|-------------|-------
KEVE-S1   | 1.0     | normal       | 17.5        | 12.3
KEVE-S1   | 1.0     | modifie      | 19.8        | 10.5
ASSA-S1   | 1.5     | normal       | 16.2        | 14.8
```

---

## Feuille 6 : granulo_tamisage_large

### Description

Cette feuille contient les résultats de **granulométrie par tamisage** (fraction > 80µm).

**Format** : **WIDE** (matriciel)

### Structure Spéciale : Format WIDE

Contrairement aux autres feuilles, celle-ci utilise un format **matriciel** :

- **Colonne A** : Diamètre des tamis (en mm)
- **Colonnes B, C, D...** : Pourcentages passants pour chaque échantillon

### En-tête de Colonnes

#### Colonne A : `sieve_mm`

**Type** : Nombre décimal

**Description** : Diamètre des tamis (ouverture en millimètres).

**Tamis courants (série AFNOR)** :
```
25.0, 20.0, 16.0, 12.5, 10.0, 8.0, 6.3, 5.0, 4.0, 3.15, 2.5, 2.0, 1.6,
1.25, 1.0, 0.8, 0.63, 0.5, 0.4, 0.315, 0.25, 0.2, 0.16, 0.125, 0.1, 0.08
```

---

#### Colonnes B, C, D... : `<code_site>@<depth_m>`

**Format** : Texte avec pattern spécifique

**Description** : Chaque colonne représente un échantillon identifié par le pattern :

```
<code_site>@<depth_m>
```

**Exemples de noms de colonnes** :
```
KEVE-S1@1
KEVE-S1@1.5
KEVE-S1@2
ASSA-S1@1
BADJA-S1@1.5
```

**⚠️ Important** :
- Utiliser le **point** comme séparateur décimal pour la profondeur
- Le séparateur est le symbole **`@`** (arobase)
- Pas d'espaces

**Erreurs à éviter** :
❌ `KEVE-S1_1` (underscore au lieu de @)
❌ `KEVE-S1 @ 1` (espaces)
❌ `KEVE-S1@1,5` (virgule au lieu de point)

---

### Valeurs dans les Cellules

**Type** : Nombre décimal

**Description** : **Pourcentage de passants cumulés** à travers le tamis.

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `100` %

**Définition** : Pourcentage (en masse) de particules de diamètre inférieur à l'ouverture du tamis.

**Propriété de monotonicité** : Les passants doivent être **croissants** quand le diamètre du tamis diminue.

**Exemple** :
```
Tamis 25mm  : 100.00%  (tout passe)
Tamis 20mm  : 100.00%
Tamis 10mm  :  98.50%
Tamis 5mm   :  92.30%
...
Tamis 0.08mm:  43.50%  (fines)
```

---

### Exemple de Feuille Complète

```
sieve_mm | KEVE-S1@1 | KEVE-S1@1.5 | ASSA-S1@1 | BADJA-S1@1
---------|-----------|-------------|-----------|------------
25.0     | 100.00    | 100.00      | 100.00    | 100.00
20.0     | 100.00    | 100.00      | 100.00    | 100.00
10.0     | 99.79     | 98.45       | 99.92     | 100.00
5.0      | 98.67     | 88.40       | 98.99     | 99.19
2.0      | 96.06     | 77.45       | 96.08     | 95.98
1.0      | 91.90     | 72.43       | 88.57     | 88.23
0.5      | 83.14     | 67.62       | 73.84     | 75.68
0.25     | 74.40     | 62.25       | 56.74     | 65.04
0.08     | 65.30     | 57.32       | 43.30     | 48.54
```

**Interprétation** :
- `KEVE-S1@1`, tamis 0.08mm : **65.30%** de particules < 80µm (argiles + limons)
- `ASSA-S1@1`, tamis 2.0mm : **96.08%** de particules < 2mm (argiles + limons + sables)

---

### Seuils Clés

| Tamis | Seuil | Signification |
|-------|-------|---------------|
| **0.08 mm** (80µm) | % fines | Argiles + limons |
| **2 mm** | % sables+fines | Fraction fine (< 2mm) |
| **20 mm** | % graviers | Fraction grossière |

---

## Feuille 7 : granulo_sedimento_large

### Description

Cette feuille contient les résultats de **granulométrie par sédimentométrie** (fraction fine < 80µm).

**Format** : **WIDE** (identique à `granulo_tamisage_large`)

### Structure

Identique à la feuille précédente, mais avec :

- **Colonne A** : `sieve_mm` (diamètres équivalents, généralement < 0.08 mm)
- **Colonnes B, C, D...** : Pourcentages passants au format `<code_site>@<depth_m>`

### Diamètres Équivalents Typiques

**Sédimentométrie** (loi de Stokes) :

```
0.0702, 0.05, 0.0356, 0.0229, 0.0134, 0.0078, 0.0048, 0.0028, 0.0014
```

**Granulométrie laser** (diamètres variables selon l'appareil) :

```
0.0696, 0.0595, 0.0494, 0.0428, 0.0351, 0.0309, 0.0224, 0.0199, 0.0130, ...
```

---

### Exemple de Feuille

```
sieve_mm | KEVE-S1@1 | ASSA-S1@1 | BADJA-S1@1
---------|-----------|-----------|------------
0.0714   |           | 39.80     | 43.63
0.0506   |           | 36.19     | 38.94
0.0364   |           | 27.41     | 31.70
0.0231   |           | 23.17     | 30.59
0.0115   |           | 15.49     | 26.71
0.0058   |           | 13.51     | 22.81
0.0034   |           | 13.00     | 21.10
0.0702   | 61.20     |           |
0.0500   | 54.50     |           |
0.0356   | 48.20     |           |
0.0078   | 19.02     |           |
0.0014   | 5.74      |           |
```

**Interprétation** :
- `KEVE-S1@1` : **5.74%** de particules < 1.4µm (argiles fines)
- `ASSA-S1@1` : **13.00%** de particules < 3.4µm

---

## Feuille 8 : densite

### Description

Cette feuille contient les résultats des **essais de densité**.

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon.

---

#### 3. `rho_d_app` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Densité apparente sèche** (ρd).

**Unité** : g/cm³

**Plage typique** : `1.0` à `2.2` g/cm³

**Définition** : Masse volumique sèche du sol en place (avec ses vides).

**Valeurs typiques** :
- Sables lâches : `1.4` - `1.6` g/cm³
- Sables denses : `1.7` - `2.0` g/cm³
- Argiles molles : `1.2` - `1.5` g/cm³
- Argiles raides : `1.6` - `1.9` g/cm³
- Latérites compactes : `1.8` - `2.1` g/cm³

**Exemples** :
```
1.28
1.52
1.87
```

---

#### 4. `rho_s_abs` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Densité absolue des solides** (ρs).

**Unité** : g/cm³

**Plage valide** : `2.0` à `3.5` g/cm³

*(Même définition que `rho_s_gcm3` de la feuille `echantillons`)*

---

#### 5. `note` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Commentaire ou remarque.

---

### Exemple de Lignes Complètes

```
code_site | depth_m | rho_d_app | rho_s_abs | note
----------|---------|-----------|-----------|------------------
KEVE-S1   | 1.0     | 1.28      | 2.49      |
KEVE-S1   | 1.5     | 1.16      | 2.45      | Sol peu compact
ASSA-S1   | 1.0     | 1.31      | 2.44      |
BADJA-S1  | 2.0     | 1.50      | 2.31      |
```

---

## Feuille 9 : teneur_eau

### Description

Cette feuille contient les mesures de **teneur en eau naturelle** et **indices de gonflement**.

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon.

---

#### 3. `w` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Teneur en eau naturelle** (W).

**Unité** : Pourcentage (%)

**Plage valide** : `0` à `100` %

*(Même définition que `water_content_w` de la feuille `echantillons`)*

---

#### 4. `wi` **[OPTIONNEL]** 🔢

**Type** : Nombre décimal

**Description** : **Indice de gonflement** (Wi = W / WL).

**Plage valide** : `0` à `1`

**Formule** :
```
Wi = W / WL
```

**Interprétation** :
- `Wi < 0.25` : Gonflement nul à faible
- `0.25 ≤ Wi < 0.5` : Gonflement moyen
- `Wi ≥ 0.5` : Gonflement élevé

**Exemples** :
```
0.08  → Gonflement nul
0.28  → Gonflement moyen
0.69  → Gonflement élevé
```

---

#### 5. `note` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Classification du gonflement.

**Exemples** :
```
Gonflement nul
Gonflement faible
Gonflement moyen
Gonflement élevé
```

---

### Exemple de Lignes Complètes

```
code_site | depth_m | w     | wi   | note
----------|---------|-------|------|-------------------
KEVE-S1   | 1.0     | 14.61 | 0.28 | Gonflement faible
KEVE-S1   | 2.0     | 4.40  | 0.08 | Gonflement nul
ASSA-S1   | 1.5     | 28.37 | 0.69 | Gonflement élevé
BADJA-S1  | 1.0     | 9.29  | 0.19 | Gonflement faible
```

---

## Feuille 10 : classification

### Description

Cette feuille contient les **classifications géotechniques** des sols selon différents systèmes.

### Colonnes

#### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site.

---

#### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon.

---

#### 3. `hrb` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : **Classification HRB** (Highway Research Board) ou **AASHTO**.

**Système** : Classification routière américaine (A-1 à A-7).

**Exemples** :
```
A-2-4 (Sable limoneux)
A-6 (Sol argileux)
A-7-6 (Argile plastique)
Sol argileux
Gravier et sable limoneux ou argileux
```

**Classes principales** :
- **A-1** : Graves et sables (excellents)
- **A-2** : Sables limoneux ou argileux (bons)
- **A-3** : Sables fins (moyens à médiocres)
- **A-4** : Limons peu plastiques (médiocres)
- **A-5** : Limons élastiques (médiocres)
- **A-6** : Argiles peu plastiques (médiocres à mauvais)
- **A-7** : Argiles plastiques (mauvais)

---

#### 4. `unified` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : **Classification USCS** (Unified Soil Classification System).

**Système** : Classification internationale (symboles à 2 lettres).

**Exemples** :
```
GW (Gravel Well-graded - Grave bien graduée)
SW (Sand Well-graded - Sable bien gradué)
CL (Clay Low plasticity - Argile peu plastique)
CH (Clay High plasticity - Argile plastique)
SM (Sand with silt - Sable limoneux)
sol fin
sol genu (sol grenu)
```

**Lettres principales** :
- **G** : Gravel (grave)
- **S** : Sand (sable)
- **M** : Silt (limon)
- **C** : Clay (argile)
- **O** : Organic (organique)
- **W** : Well-graded (bien gradué)
- **P** : Poorly-graded (mal gradué)
- **L** : Low plasticity (faible plasticité)
- **H** : High plasticity (haute plasticité)

---

#### 5. `bm` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : **Classification d'après le bleu de méthylène** (GTR).

**Exemples** :
```
Sol insensible à l'eau
Sol limoneux
Sol limoneux plastique
Sol limoneux argileux
Sol argileux
Sol très argileux
```

*(Correspond aux classes VBS)*

---

#### 6. `note` **[OPTIONNEL]** 📝

**Type** : Texte libre

**Description** : Remarque ou complément de classification.

---

### Exemple de Lignes Complètes

```
code_site | depth_m | hrb                                      | unified  | bm                       | note
----------|---------|------------------------------------------|----------|--------------------------|-----
KEVE-S1   | 1.0     | Sol argileux                             | sol fin  | Sol limoneux argileux    |
KEVE-S1   | 2.0     | Sol argileux                             | sol genu | Sol limoneux             |
ASSA-S1   | 1.0     | Sol argileux                             | sol genu | Sol limoneux             |
ASSA-S1   | 1.5     | Gravier et sable limoneux ou argileux    | sol genu | Sol limoneux argileux    |
BADJA-S1  | 1.0     | Sol argileux                             | sol genu | Sol limoneux argileux    |
```

---

## Exemples Pratiques

### Exemple Complet : Site KEVE-S1

#### 1. Feuille `sondages`

```
code_site | localite | date       | adm3     | adm2     | lat     | lon     | source
----------|----------|------------|----------|----------|---------|---------|------------------
KEVE-S1   | Kévé     | 2025-10-20 | Mandouri | Kpendjal | 10.8573 | 0.5421  | Campagne 2025
```

#### 2. Feuille `echantillons`

```
code_site | depth_m | date       | laboratory | rho_s_gcm3 | water_content_w | is_index | commentaire
----------|---------|------------|------------|------------|-----------------|----------|-------------
KEVE-S1   | 1.0     | 2025-10-20 | Labo Atlas | 2.49       | 14.61           | 0.28     |
KEVE-S1   | 1.5     | 2025-10-20 | Labo Atlas | 2.45       | 11.29           | 0.23     |
KEVE-S1   | 2.0     | 2025-10-20 | Labo Atlas | 2.58       | 4.40            | 0.08     |
```

#### 3. Feuille `atterberg`

```
code_site | depth_m | wl | wp
----------|---------|----|----|
KEVE-S1   | 1.0     | 53 | 23
KEVE-S1   | 1.5     | 48 | 21
KEVE-S1   | 2.0     | 51 | 22
```

#### 4. Feuille `vbs`

```
code_site | depth_m | vbs  | commentaire
----------|---------|------|---------------------------
KEVE-S1   | 1.0     | 4.02 | Sol limoneux argileux
KEVE-S1   | 1.5     | 3.61 | Sol limoneux argileux
KEVE-S1   | 2.0     | 1.22 | Sol limoneux
```

#### 5. Feuille `granulo_tamisage_large`

```
sieve_mm | KEVE-S1@1 | KEVE-S1@1.5 | KEVE-S1@2
---------|-----------|-------------|----------
25.0     | 100.00    | 100.00      | 100.00
10.0     | 99.79     | 98.45       | 95.05
2.0      | 96.06     | 77.45       | 56.15
0.08     | 65.30     | 57.32       | 36.66
```

---

## Erreurs Courantes

### 1. Erreurs de Référence

#### ❌ Échantillon orphelin

```
echantillons:
  code_site: SITE-INCONNU  ← N'existe pas dans 'sondages'
```

**Solution** : Créer d'abord le sondage dans la feuille `sondages`.

---

#### ❌ Essai sans échantillon

```
atterberg:
  code_site: KEVE-S1
  depth_m: 3.0  ← Profondeur inexistante dans 'echantillons'
```

**Solution** : Créer l'échantillon `KEVE-S1@3.0` dans la feuille `echantillons`.

---

### 2. Erreurs de Format

#### ❌ Séparateur décimal

```
depth_m: 1,5  ← Virgule au lieu de point
```

**Solution** : Utiliser le **point** : `1.5`

---

#### ❌ Pattern granulo incorrect

```
Colonne: KEVE-S1_1  ← Underscore
Colonne: KEVE-S1 @ 1  ← Espaces
```

**Solution** : Utiliser `KEVE-S1@1` (arobase, pas d'espaces)

---

### 3. Erreurs de Valeurs

#### ❌ WL < WP

```
atterberg:
  wl: 18
  wp: 25  ← Erreur : WP > WL
```

**Solution** : Vérifier les valeurs, inverser si nécessaire.

---

#### ❌ Pourcentage > 100

```
granulo_tamisage_large:
  tamis 0.315mm: 422.43  ← Aberrant
```

**Solution** : Corriger (probablement `42.43`)

---

#### ❌ Profondeur négative ou nulle

```
echantillons:
  depth_m: 0  ← Interdit
```

**Solution** : Profondeur > 0 (ex: `0.5`, `1.0`)

---

### 4. Erreurs de Type Proctor

#### ❌ Mauvaise casse

```
proctor:
  proctor_type: Normal  ← Majuscule
```

**Solution** : Utiliser `normal` (minuscule)

---

#### ❌ Accent

```
proctor:
  proctor_type: modifié  ← Avec accent
```

**Solution** : Utiliser `modifie` (sans accent)

---

## Glossaire

### Termes Géotechniques

| Terme | Définition |
|-------|------------|
| **Atterberg (Limites d')** | Teneurs en eau caractéristiques du comportement plastique des sols fins |
| **Densité absolue** | Masse volumique des grains solides (sans les vides) |
| **Densité apparente** | Masse volumique du sol en place (avec les vides) |
| **Granulométrie** | Distribution des tailles de particules dans un sol |
| **Indice de plasticité (IP)** | Différence entre WL et WP, mesure de la plasticité |
| **Limite de liquidité (WL)** | Teneur en eau à la frontière état plastique/liquide |
| **Limite de plasticité (WP)** | Teneur en eau à la frontière état solide/plastique |
| **Passant** | Pourcentage de particules traversant un tamis |
| **Proctor** | Essai de compactage normalisé |
| **Sédimentométrie** | Analyse granulométrique des particules fines par sédimentation |
| **Tamisage** | Analyse granulométrique par passage à travers des tamis |
| **Teneur en eau (W)** | Rapport masse d'eau / masse de solides (%) |
| **VBS** | Valeur au bleu de méthylène, mesure de l'argilosité |

### Abréviations

| Abréviation | Signification |
|-------------|---------------|
| **ADM** | Administration (division territoriale) |
| **AASHTO** | American Association of State Highway and Transportation Officials |
| **BM** | Bleu de Méthylène |
| **GTR** | Guide des Terrassements Routiers |
| **HRB** | Highway Research Board |
| **IP** | Indice de Plasticité |
| **LNBTP** | Laboratoire National du Bâtiment et des Travaux Publics |
| **NP** | Non Plastique |
| **USCS** | Unified Soil Classification System |
| **VBS** | Valeur au Bleu de méthylène du Sol |
| **Wi** | Indice de gonflement (Wnat / WL) |
| **WL** | Limite de Liquidité (Water Limit - Liquid) |
| **WP** | Limite de Plasticité (Water Limit - Plastic) |

---

## Validation Avant Import

### Checklist de Vérification

Avant d'importer votre fichier, vérifiez :

#### Structure

- [ ] Le fichier contient les 10 feuilles (noms exacts)
- [ ] La feuille `sondages` a au moins 1 ligne
- [ ] La feuille `echantillons` a au moins 1 ligne

#### Références

- [ ] Tous les `code_site` de `echantillons` existent dans `sondages`
- [ ] Tous les `code_site` des essais existent dans `echantillons`
- [ ] Toutes les `depth_m` des essais correspondent à des échantillons

#### Valeurs

- [ ] Toutes les `depth_m` sont > 0
- [ ] Tous les `proctor_type` sont `normal` ou `modifie`
- [ ] Tous les WL ≥ WP (Atterberg)
- [ ] Tous les pourcentages granulo dans [0, 100]
- [ ] Tous les VBS dans [0, 20]

#### Format Granulo

- [ ] Header `sieve_mm` en colonne A
- [ ] Pattern `site@depth` pour les colonnes séries
- [ ] Séparateur décimal = point (pas virgule)

---

## Contact & Support

Pour toute question sur la saisie des données :

1. **Documentation technique** : `SPECIFICATION_XLSX_IMPORT_COMPLET.md`
2. **Exemples** : `atlas_import_example.xlsx`
3. **Validation** : `python verify_atlas_xlsx.py`

---

**Document Version** : 1.0
**Date** : 24 octobre 2025
**Auteur** : Équipe Atlas
**Public** : Techniciens géotechniciens, ingénieurs géotechnique, saisie de données
**Statut** : ✅ Finalisé
