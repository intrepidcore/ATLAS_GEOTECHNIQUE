# 📖 GUIDE ACADÉMIQUE - Saisie des Données Géotechniques Atlas V3

**Version 1.5.3** - Document de référence pour la saisie manuelle des données dans le fichier Excel d'import

Ce guide décrit en détail **tous les champs des 13 feuilles** du classeur Excel d'import géotechnique Atlas V3.

---

## 📚 Table des Matières

1. [Nouveautés Version 1.5.3](#nouveautés-version-153)
2. [Structure Générale](#structure-générale)
3. [Feuilles Standard (1-10)](#feuilles-standard-1-10)
4. [Feuilles RAW (11-13) - NOUVEAU](#feuilles-raw-11-13)
5. [Exemples Pratiques](#exemples-pratiques)
6. [Erreurs Courantes](#erreurs-courantes)

---

## Nouveautés Version 1.5.3

### 🆕 Feuilles RAW Ajoutées

La version 1.5.3 ajoute **3 nouvelles feuilles** pour conserver les **données brutes de laboratoire** :

| Feuille | Description | Format |
|---------|-------------|--------|
| **11. agt_raw_long** | Données brutes de tamisage | Format LONG |
| **12. ags_raw_long** | Données brutes de sédimentométrie | Format LONG |
| **13. atterberg_raw** | Mesures détaillées Atterberg | Format LONG |

### Pourquoi les Feuilles RAW ?

Les feuilles standard (1-10) contiennent les **résultats finaux** (ex: WL=53%, WP=23%).

Les feuilles RAW conservent les **données brutes intermédiaires** :
- Masses de refus cumulés (g)
- Numéros de tares
- Poids humides/secs
- Nombre de coups (Atterberg)

**Avantages** :
- ✅ Traçabilité complète
- ✅ Recalcul possible
- ✅ Contrôle qualité
- ✅ Audit des mesures

---

## Structure Générale

### Classeur Excel Complet (13 Feuilles)

```
atlas_import_example.xlsx
├── FEUILLES STANDARD (Import principal)
│   ├── 1. sondages ✅ (OBLIGATOIRE)
│   ├── 2. echantillons ✅ (OBLIGATOIRE)
│   ├── 3. atterberg ✅
│   ├── 4. vbs ✅
│   ├── 5. proctor 🔲 (vide)
│   ├── 6. granulo_tamisage_large ✅ (format WIDE)
│   ├── 7. granulo_sedimento_large ✅ (format WIDE)
│   ├── 8. densite ✅
│   ├── 9. teneur_eau ✅
│   └── 10. classification ✅
│
└── FEUILLES RAW v1.5.3 (Données brutes)
    ├── 11. agt_raw_long 🆕 (format LONG)
    ├── 12. ags_raw_long 🆕 (format LONG)
    └── 13. atterberg_raw 🆕 (format LONG)
```

### Hiérarchie des Données

```
Sondage (code_site)
  └── Échantillon (depth_m)
        ├── Essai Atterberg (WL, WP → IP calculé)
        │   └── atterberg_raw (mesures détaillées par tare) 🆕
        ├── Essai VBS (valeur au bleu)
        ├── Essai Proctor (compactage)
        └── Points Granulo (courbe)
              ├── Tamisage (> 80µm)
              │   └── agt_raw_long (masses, refus%) 🆕
              └── Sédimentométrie (< 80µm)
                  └── ags_raw_long (passants bruts) 🆕
```

---

## Feuilles Standard (1-10)

> **Note** : Les spécifications des feuilles 1 à 10 restent inchangées par rapport à la version précédente.
>
> Consultez les sections détaillées pour chaque feuille standard :
> - [Feuille 1: sondages](#feuille-1-sondages)
> - [Feuille 2: echantillons](#feuille-2-echantillons)
> - [Feuille 3: atterberg](#feuille-3-atterberg)
> - [Feuille 4: vbs](#feuille-4-vbs)
> - [Feuille 5: proctor](#feuille-5-proctor)
> - [Feuilles 6-7: granulo (WIDE)](#feuilles-6-7-granulo)
> - [Feuille 8: densite](#feuille-8-densite)
> - [Feuille 9: teneur_eau](#feuille-9-teneur_eau)
> - [Feuille 10: classification](#feuille-10-classification)

*(Voir GUIDE_ACADEMIQUE_SAISIE_DONNEES.md pour le détail complet des feuilles 1-10)*

---

## Feuilles RAW (11-13)

### Feuille 11: agt_raw_long 🆕

**Description** : Données brutes de **granulométrie par tamisage** (AGT - Analyse Granulométrique par Tamisage)

**Format** : LONG (une ligne par mesure de tamis)

**Utilité** : Conserve les masses de refus et les calculs intermédiaires du laboratoire

---

#### Colonnes

##### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site (lien vers `sondages`)

**Exemples** :
```
KEVE-S1
ASSA-S1
BADJA-S1
```

---

##### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon en mètres

**Exemples** :
```
1.0
1.5
2.0
```

---

##### 3. `sieve_mm` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : Ouverture du tamis en millimètres

**Unité** : mm

**Tamis courants** :
```
25, 20, 16, 12.5, 10, 8, 6.3, 5, 4, 3.15, 2.5, 2, 1.6, 1.25,
1, 0.8, 0.63, 0.5, 0.4, 0.315, 0.25, 0.2, 0.16, 0.125, 0.1, 0.08
```

**Exemples** :
```
25.0
12.5
0.08
```

---

##### 4. `mass_refus_cum_g` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Masse de refus cumulé** retenue sur le tamis et tous les tamis supérieurs

**Unité** : grammes (g)

**Définition** : Somme des masses de sol retenues depuis le tamis le plus gros jusqu'au tamis actuel

**Calcul** :
```
mass_refus_cum(tamis_n) = Σ(masses retenues sur tamis ≥ tamis_n)
```

**Plage typique** : `0` à `3000` g (dépend de la masse initiale)

**Exemples** :
```
0        (tamis 25mm - tout passe)
11.1     (tamis 12.5mm)
312.1    (tamis 5mm)
1544.2   (tamis 0.08mm)
```

**Propriété** : Les valeurs sont **croissantes** quand on descend dans les tamis

---

##### 5. `refus_cum_pct` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Pourcentage de refus cumulé**

**Unité** : Pourcentage (%)

**Formule** :
```
refus_cum_pct = (mass_refus_cum_g / masse_totale_séche) × 100
```

**Plage valide** : `0` à `100` %

**Exemples** :
```
0.00     (rien ne reste)
0.41
15.21
56.96    (56.96% restent sur les tamis)
```

**Relation** : `refus_cum_pct + passants_pct = 100`

---

##### 6. `passants_pct` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Pourcentage de passants cumulés** à travers le tamis

**Unité** : Pourcentage (%)

**Formule** :
```
passants_pct = 100 - refus_cum_pct
```

**Plage valide** : `0` à `100` %

**Exemples** :
```
100.00   (tout passe à travers 25mm)
99.59
84.78
43.04    (43.04% passent à travers 0.08mm = fines)
```

**Propriété** : Les valeurs sont **décroissantes** quand on descend dans les tamis

---

#### Exemple de Lignes Complètes

```
code_site | depth_m | sieve_mm | mass_refus_cum_g | refus_cum_pct | passants_pct
----------|---------|----------|------------------|---------------|-------------
KEVE-S1   | 1.5     | 16       | 0                | 0.00          | 100.00
KEVE-S1   | 1.5     | 12.5     | 11.1             | 0.41          | 99.59
KEVE-S1   | 1.5     | 10       | 41.7             | 1.55          | 98.45
KEVE-S1   | 1.5     | 5        | 312.1            | 11.54         | 88.46
KEVE-S1   | 1.5     | 2        | 605.5            | 22.46         | 77.54
KEVE-S1   | 1.5     | 0.08     | 1150.5           | 42.68         | 57.32
```

#### Interprétation

**Exemple** : `KEVE-S1@1.5m, tamis 0.08mm`
- **Masse de refus cumulé** : 1150.5 g (masse totale retenue sur tous les tamis ≥ 0.08mm)
- **Refus cumulé** : 42.68% (42.68% du sol total reste sur les tamis)
- **Passants** : 57.32% (57.32% passe à travers 0.08mm = fines : argiles + limons)

#### Validation

**Cohérence** : Les 3 colonnes doivent vérifier :
```
refus_cum_pct + passants_pct = 100 (à 0.01% près)
refus_cum_pct = (mass_refus_cum_g / masse_totale) × 100
```

**Monotonicité** :
- `mass_refus_cum_g` : **croissant** (tamis 25mm → 0.08mm)
- `refus_cum_pct` : **croissant**
- `passants_pct` : **décroissant**

---

### Feuille 12: ags_raw_long 🆕

**Description** : Données brutes de **granulométrie par sédimentométrie** (AGS - Analyse Granulométrique par Sédimentométrie)

**Format** : LONG (une ligne par diamètre équivalent mesuré)

**Utilité** : Conserve les mesures brutes de sédimentométrie (loi de Stokes) ou granulométrie laser

**Méthode** :
- **Sédimentométrie classique** : Mesure de la vitesse de chute des particules dans l'eau
- **Granulométrie laser** : Diffraction laser

---

#### Colonnes

##### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site

---

##### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon en mètres

---

##### 3. `sieve_mm` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Diamètre équivalent** des particules en millimètres

**Unité** : mm

**Plage typique** : `0.0013` à `0.08` mm (1.3 µm à 80 µm)

**Diamètres courants (sédimentométrie)** :
```
0.0714, 0.0506, 0.0364, 0.0231, 0.0163, 0.0115, 0.0082, 0.0058, 0.0034, 0.0014
```

**Diamètres courants (granulo laser)** :
```
Variable selon l'appareil
Exemples : 0.0702, 0.0499, 0.0356, 0.0229, ...
```

**Exemples** :
```
0.0714   (71.4 µm - limite argiles/limons)
0.0034   (3.4 µm - argiles fines)
0.0014   (1.4 µm - argiles très fines)
```

---

##### 4. `passants_pct` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Pourcentage de passants** pour ce diamètre équivalent

**Unité** : Pourcentage (%)

**Formule** : Calculé à partir de la loi de Stokes ou de la diffraction laser

**Plage valide** : `0` à `100` %

**Exemples** :
```
61.20    (61.20% des particules ont un diamètre < 70.2 µm)
28.74    (28.74% < 13.4 µm)
5.74     (5.74% < 1.4 µm - argiles très fines)
```

**Propriété** : Les valeurs sont **décroissantes** quand le diamètre diminue

---

#### Exemple de Lignes Complètes

```
code_site | depth_m | sieve_mm | passants_pct
----------|---------|----------|-------------
KEVE-S1   | 1.0     | 0.0702   | 61.20
KEVE-S1   | 1.0     | 0.0500   | 54.50
KEVE-S1   | 1.0     | 0.0229   | 41.50
KEVE-S1   | 1.0     | 0.0078   | 19.02
KEVE-S1   | 1.0     | 0.0028   | 10.95
KEVE-S1   | 1.0     | 0.0014   | 5.74
```

#### Interprétation

**Exemple** : `KEVE-S1@1.0m`
- **61.20%** des particules ont un diamètre < 70.2 µm (argiles + limons)
- **41.50%** < 22.9 µm (argiles + limons fins)
- **5.74%** < 1.4 µm (argiles très fines)

**Classification granulométrique** :
- **Argiles** : < 2 µm (0.002 mm)
- **Limons fins** : 2 - 20 µm
- **Limons grossiers** : 20 - 80 µm

---

#### Validation

**Cohérence avec AGT** : Le dernier point d'AGT (tamis 0.08mm) doit être proche du premier point d'AGS

**Exemple** :
```
AGT : tamis 0.08mm → 57.32% passants
AGS : diamètre 0.0703mm → 57.42% passants
```

**Écart acceptable** : ± 5%

**Monotonicité** : Les `passants_pct` doivent être **décroissants** quand `sieve_mm` diminue

---

### Feuille 13: atterberg_raw 🆕

**Description** : Mesures détaillées des **essais de limites d'Atterberg**

**Format** : LONG (une ligne par mesure sur une tare)

**Utilité** : Conserve toutes les pesées intermédiaires permettant de recalculer WL et WP

**Contexte** : Les limites d'Atterberg sont déterminées par plusieurs mesures à différentes teneurs en eau

---

#### Colonnes

##### 1. `code_site` **[OBLIGATOIRE]** 🔗📝

**Type** : Texte

**Description** : Identifiant du site

---

##### 2. `depth_m` **[OBLIGATOIRE]** 🔗🔢

**Type** : Nombre décimal

**Description** : Profondeur de l'échantillon en mètres

---

##### 3. `test_type` **[OBLIGATOIRE]** 📝

**Type** : Texte (énumération)

**Description** : Type de test d'Atterberg

**Valeurs autorisées** :
- `"WL"` : Limite de liquidité (Liquid Limit)
- `"WP"` : Limite de plasticité (Plastic Limit)

**Exemples** :
```
WL
WP
```

---

##### 4. `tare_no` **[OPTIONNEL]** 📝

**Type** : Texte ou Nombre

**Description** : Numéro de la tare utilisée pour la pesée

**Exemples** :
```
1
2
T-01
Tare A
```

**Utilité** : Traçabilité et identification du matériel de laboratoire

---

##### 5. `nb_coups` **[OPTIONNEL]** 🔢

**Type** : Nombre entier

**Description** : **Nombre de coups** appliqués (pour WL uniquement)

**Unité** : Coups

**Contexte** : L'essai de limite de liquidité utilise la coupelle de Casagrande. On mesure le nombre de coups nécessaires pour fermer la rainure.

**Plage typique** : `10` à `30` coups

**Exemples** :
```
12     (12 coups)
15
20
25
```

**Règle** : Pour WL, on réalise généralement 4 mesures avec des nombres de coups différents. La WL correspond à la teneur en eau à **25 coups** (obtenue par interpolation).

**Pour WP** : Cette colonne est vide (non applicable)

---

##### 6. `poids_total_humide_g` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Poids total humide** (tare + sol humide)

**Unité** : grammes (g)

**Exemples** :
```
60.82    (tare + sol humide)
13.74
55.04
```

---

##### 7. `poids_total_sec_g` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Poids total sec** (tare + sol sec après étuvage à 105°C)

**Unité** : grammes (g)

**Exemples** :
```
55.67    (tare + sol sec)
13.22
48.55
```

**Règle** : `poids_total_sec_g` < `poids_total_humide_g` (perte d'eau)

---

##### 8. `poids_tare_g` **[OBLIGATOIRE]** 🔢

**Type** : Nombre décimal

**Description** : **Poids de la tare vide**

**Unité** : grammes (g)

**Exemples** :
```
43.84
10.85
33.90
```

---

##### 9. `poids_eau_g` **[CALCULÉ]** 🔢

**Type** : Nombre décimal

**Description** : **Poids de l'eau** évaporée

**Unité** : grammes (g)

**Formule** :
```
poids_eau_g = poids_total_humide_g - poids_total_sec_g
```

**Exemples** :
```
5.15     (masse d'eau perdue)
0.52
6.49
```

---

##### 10. `poids_sol_sec_g` **[CALCULÉ]** 🔢

**Type** : Nombre décimal

**Description** : **Poids du sol sec**

**Unité** : grammes (g)

**Formule** :
```
poids_sol_sec_g = poids_total_sec_g - poids_tare_g
```

**Exemples** :
```
11.83    (masse de sol sec)
2.37
14.65
```

---

##### 11. `teneur_eau_pct` **[CALCULÉ]** 🔢

**Type** : Nombre décimal

**Description** : **Teneur en eau** de cette mesure

**Unité** : Pourcentage (%)

**Formule** :
```
teneur_eau_pct = (poids_eau_g / poids_sol_sec_g) × 100
```

**Exemples** :
```
43.53    (teneur en eau de 43.53%)
21.94
44.30
```

---

#### Exemple de Lignes Complètes

**Limite de Liquidité (WL) - KEVE-S1@1.0m**

```
code_site | depth_m | test_type | tare_no | nb_coups | poids_total_humide_g | poids_total_sec_g | poids_tare_g | poids_eau_g | poids_sol_sec_g | teneur_eau_pct
----------|---------|-----------|---------|----------|----------------------|-------------------|--------------|-------------|-----------------|----------------
KEVE-S1   | 1.0     | WL        | 1       | 12       | 55.04                | 48.55             | 33.90        | 6.49        | 14.65           | 44.30
KEVE-S1   | 1.0     | WL        | 2       | 15       | 64.12                | 56.19             | 40.33        | 7.93        | 15.86           | 50.00
KEVE-S1   | 1.0     | WL        | 3       | 18       | 59.71                | 50.95             | 34.41        | 8.76        | 16.54           | 52.96
KEVE-S1   | 1.0     | WL        | 4       | 20       | 60.84                | 50.68             | 33.24        | 10.16       | 17.44           | 58.26
```

**Limite de Plasticité (WP) - KEVE-S1@1.0m**

```
code_site | depth_m | test_type | tare_no | nb_coups | poids_total_humide_g | poids_total_sec_g | poids_tare_g | poids_eau_g | poids_sol_sec_g | teneur_eau_pct
----------|---------|-----------|---------|----------|----------------------|-------------------|--------------|-------------|-----------------|----------------
KEVE-S1   | 1.0     | WP        | 1       | NULL     | 13.28                | 12.83             | 10.85        | 0.45        | 1.98            | 22.73
KEVE-S1   | 1.0     | WP        | 2       | NULL     | 12.98                | 12.55             | 10.70        | 0.43        | 1.85            | 23.24
```

---

#### Interprétation

**Détermination de WL** :

1. On réalise 4 mesures à différents nb_coups (ex: 12, 15, 18, 20)
2. On trace la droite : `teneur_eau` vs `log(nb_coups)`
3. On lit la teneur en eau à **25 coups** → **WL**

**Exemple** :
```
12 coups → 44.30%
15 coups → 50.00%
18 coups → 52.96%
20 coups → 58.26%

Par interpolation : WL à 25 coups ≈ 53%
```

**Détermination de WP** :

1. On réalise 2-3 mesures (rouleau de 3mm de diamètre qui se fissure)
2. On fait la moyenne : `WP = moyenne(teneur_eau)`

**Exemple** :
```
Mesure 1 : 22.73%
Mesure 2 : 23.24%

WP ≈ 23%
```

**Résultat final** :
```
WL = 53%
WP = 23%
IP = WL - WP = 30%
```

---

#### Validation

**Cohérence des poids** :
```
poids_eau_g = poids_total_humide_g - poids_total_sec_g  (± 0.1g)
poids_sol_sec_g = poids_total_sec_g - poids_tare_g  (± 0.1g)
teneur_eau_pct = (poids_eau_g / poids_sol_sec_g) × 100  (± 0.5%)
```

**Cohérence avec résultat final** :
```
WL calculée depuis atterberg_raw ≈ WL dans feuille "atterberg"  (± 2%)
WP calculée depuis atterberg_raw ≈ WP dans feuille "atterberg"  (± 2%)
```

---

## Exemples Pratiques

### Exemple Complet : Site KEVE-S1 @ 1.5m

#### 1. Feuilles Standard

**sondages**
```
code_site | localite | date       | adm3  | adm2
----------|----------|------------|-------|------
KEVE-S1   | Kévé     | 2025-10-24 | Keve  | Ave
```

**echantillons**
```
code_site | depth_m | rho_s_gcm3 | water_content_w
----------|---------|------------|----------------
KEVE-S1   | 1.5     | 2.45       | 11.29
```

**atterberg**
```
code_site | depth_m | wl | wp
----------|---------|----|----|
KEVE-S1   | 1.5     | 48 | 21
```

**granulo_tamisage_large** (FORMAT WIDE)
```
sieve_mm | KEVE-S1@1.5
---------|-------------
25       | 100.00
10       | 98.45
0.08     | 57.32
```

---

#### 2. Feuilles RAW (NOUVEAU v1.5.3)

**agt_raw_long** (extrait)
```
code_site | depth_m | sieve_mm | mass_refus_cum_g | refus_cum_pct | passants_pct
----------|---------|----------|------------------|---------------|-------------
KEVE-S1   | 1.5     | 16       | 0                | 0.00          | 100.00
KEVE-S1   | 1.5     | 12.5     | 11.1             | 0.41          | 99.59
KEVE-S1   | 1.5     | 10       | 41.7             | 1.55          | 98.45
KEVE-S1   | 1.5     | 5        | 312.1            | 11.54         | 88.46
KEVE-S1   | 1.5     | 0.08     | 1150.5           | 42.68         | 57.32
```

**ags_raw_long**
```
code_site | depth_m | sieve_mm | passants_pct
----------|---------|----------|-------------
KEVE-S1   | 1.5     | 0.0703   | 57.42
KEVE-S1   | 1.5     | 0.0499   | 57.32
KEVE-S1   | 1.5     | 0.0354   | 53.31
KEVE-S1   | 1.5     | 0.0033   | 24.08
```

**atterberg_raw**
```
code_site | depth_m | test_type | tare_no | nb_coups | teneur_eau_pct
----------|---------|-----------|---------|----------|----------------
KEVE-S1   | 1.5     | WL        | 1       | 13       | 43.53
KEVE-S1   | 1.5     | WL        | 2       | 16       | 55.37
KEVE-S1   | 1.5     | WL        | 3       | 18       | 52.08
KEVE-S1   | 1.5     | WL        | 4       | 20       | 56.11
KEVE-S1   | 1.5     | WP        | 1       | NULL     | 22.99
KEVE-S1   | 1.5     | WP        | 2       | NULL     | 21.15
```

---

### Cohérence Entre Feuilles

#### 1. Granulo : WIDE vs RAW

**granulo_tamisage_large** (WIDE) :
```
sieve_mm | KEVE-S1@1.5
---------|-------------
0.08     | 57.32
```

**agt_raw_long** (RAW) :
```
code_site | depth_m | sieve_mm | passants_pct
----------|---------|----------|-------------
KEVE-S1   | 1.5     | 0.08     | 57.32
```

✅ **Les valeurs doivent correspondre exactement**

---

#### 2. Atterberg : Synthèse vs Détail

**atterberg** (synthèse) :
```
code_site | depth_m | wl | wp
----------|---------|----|----|
KEVE-S1   | 1.5     | 48 | 21
```

**atterberg_raw** (détail) :
```
Mesures WL : 43.53, 55.37, 52.08, 56.11 → Interpolation à 25 coups → WL ≈ 48
Mesures WP : 22.99, 21.15 → Moyenne → WP ≈ 22 (arrondi à 21)
```

✅ **Les valeurs doivent être cohérentes (± 2%)**

---

## Erreurs Courantes

### 1. Incohérence Feuilles Standard ↔ RAW

#### ❌ Valeurs différentes

**Problème** :
```
granulo_tamisage_large : KEVE-S1@1.5, tamis 0.08mm → 57.32%
agt_raw_long : KEVE-S1@1.5, sieve 0.08mm → 45.00%  (DIFFÉRENT)
```

**Solution** : Les valeurs doivent **correspondre exactement**. Vérifier la source et corriger.

---

### 2. Calculs Erronés (Feuilles RAW)

#### ❌ teneur_eau_pct incorrecte

**Problème** :
```
poids_eau_g = 5.15 g
poids_sol_sec_g = 11.83 g
teneur_eau_pct = 60.00%  (ERREUR)

Calcul correct : (5.15 / 11.83) × 100 = 43.53%
```

**Solution** : Vérifier les formules Excel :
```excel
=((C2-D2)/E2)*100
```

---

### 3. Monotonicité Non Respectée

#### ❌ Passants non décroissants (AGT RAW)

**Problème** :
```
sieve_mm | passants_pct
---------|-------------
10       | 98.45
5        | 88.46
2        | 90.00  (ERREUR : augmentation)
0.08     | 57.32
```

**Solution** : Les passants doivent être **décroissants**. Corriger `90.00` → `85.00` (ou valeur cohérente)

---

### 4. Nombre de Coups Manquant (WL)

#### ❌ nb_coups vide pour WL

**Problème** :
```
test_type | nb_coups
----------|----------
WL        | NULL     (ERREUR)
```

**Solution** : Renseigner le nombre de coups pour toutes les mesures WL (ex: 12, 15, 18, 20)

---

### 5. Masses Incohérentes

#### ❌ Poids total sec > poids total humide

**Problème** :
```
poids_total_humide_g = 50.00
poids_total_sec_g = 55.00  (ERREUR : impossible)
```

**Solution** : Vérifier les pesées. Le poids sec doit être **inférieur** au poids humide.

---

## Glossaire des Feuilles RAW

| Terme | Définition |
|-------|------------|
| **AGT** | Analyse Granulométrique par Tamisage |
| **AGS** | Analyse Granulométrique par Sédimentométrie |
| **Masse de refus cumulé** | Masse totale retenue sur un tamis et tous les tamis supérieurs |
| **Refus cumulé** | Pourcentage de masse retenue (par rapport à la masse totale) |
| **Passants** | Pourcentage de masse passant à travers le tamis |
| **Diamètre équivalent** | Diamètre d'une sphère ayant la même vitesse de chute (loi de Stokes) |
| **Nombre de coups** | Nombre de chocs appliqués à la coupelle de Casagrande (essai WL) |
| **Tare** | Récipient de pesée |
| **Poids humide** | Poids avant étuvage (avec eau) |
| **Poids sec** | Poids après étuvage à 105°C (sans eau) |
| **Teneur en eau** | Rapport masse d'eau / masse de sol sec (%) |

---

## Workflow Complet avec Feuilles RAW

### Étape 1 : Saisir les Données Brutes RAW

```
1. Saisir agt_raw_long (masses, refus, passants)
2. Saisir ags_raw_long (passants fines)
3. Saisir atterberg_raw (pesées détaillées)
```

---

### Étape 2 : Calculer les Synthèses

```
4. Calculer WL et WP depuis atterberg_raw
   → Remplir feuille "atterberg"

5. Extraire les passants depuis agt_raw_long
   → Remplir feuille "granulo_tamisage_large" (WIDE)

6. Extraire les passants depuis ags_raw_long
   → Remplir feuille "granulo_sedimento_large" (WIDE)
```

---

### Étape 3 : Vérifier la Cohérence

```
7. Comparer passants : WIDE ↔ RAW
8. Comparer WL/WP : atterberg ↔ atterberg_raw
9. Vérifier monotonicité des courbes
```

---

### Étape 4 : Importer dans Atlas

```
10. Vérifier avec verify_atlas_xlsx.py
11. Importer via Wizard Atlas
12. Les feuilles RAW sont stockées pour traçabilité
```

---

## Validation Avant Import

### Checklist RAW (Nouveau v1.5.3)

- [ ] **agt_raw_long** : Monotonicité des masses et refus ✓
- [ ] **agt_raw_long** : Formule `refus + passants = 100` vérifiée ✓
- [ ] **ags_raw_long** : Passants décroissants ✓
- [ ] **ags_raw_long** : Cohérence avec dernier point AGT (± 5%) ✓
- [ ] **atterberg_raw** : Calculs teneur_eau corrects ✓
- [ ] **atterberg_raw** : WL/WP cohérents avec feuille "atterberg" (± 2%) ✓
- [ ] **Cohérence WIDE ↔ RAW** : Valeurs identiques ✓

---

## Résumé Version 1.5.3

### Nouvelles Feuilles

| Feuille | Lignes | Description |
|---------|--------|-------------|
| **agt_raw_long** | ~230 | Données brutes tamisage (masses, refus, passants) |
| **ags_raw_long** | ~80 | Données brutes sédimentométrie (passants fines) |
| **atterberg_raw** | ~50 | Mesures détaillées Atterberg (pesées par tare) |

### Total Fichier

**13 feuilles** / **~600 lignes de données**

### Avantages

✅ **Traçabilité complète** des mesures laboratoire
✅ **Recalcul possible** des valeurs synthétiques
✅ **Contrôle qualité** amélioré
✅ **Audit** des essais facilité

---

## Contact & Support

### Documentation

- **Guide complet** : GUIDE_ACADEMIQUE_SAISIE_DONNEES_V2.md (ce document)
- **Spécifications techniques** : SPECIFICATION_XLSX_IMPORT_COMPLET.md
- **Script de génération** : generate_atlas_import.py (v1.5.3)

### Validation

```bash
python verify_atlas_xlsx.py atlas_import_example.xlsx
```

---

**Document Version** : 2.0 (basé sur script v1.5.3)
**Date** : 24 octobre 2025
**Auteur** : Équipe Atlas
**Public** : Techniciens géotechniciens, ingénieurs, saisie de données
**Statut** : ✅ À jour avec les 3 nouvelles feuilles RAW
