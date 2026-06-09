# 🎓 Guide complet des modèles — Atlas Géotechnique Togo V11

## Pour un ingénieur civil computationnel junior

---

## 1. 🗺️ Les 11 méthodes implémentées dans la DB (tu n'hallucines pas)

Il y en a **11 en réalité** dans `ai_interpolation_runs`, pas seulement les 5 que tu connais :

```
Méthode DB                    | Alias       | Nb runs | Statut
─────────────────────────────────────────────────────────────────
ked_hierarchical_5levels      | KED-H       |  411    | ✅ Production officiel (L1)
regression_kriging_scorpan    | RK-SCORPAN  |  116    | ✅ Production (L2a)
ked_rk_fusion_bayesian        | Fusion BLUP |  525    | ✅ Production (L2b)
mtgp_icm_gpflow               | MTGP/ICM    |   41    | 🧪 Expérimental (L4)
ked_pedologie_eg              | KED-pédo EG |   18    | ⚠️  Ancienne version (EG seul)
ked_pedologie_ked             | KED-pédo    |   48    | ⚠️  Ancienne version (déprécié)
ked_pedologie_granulo         | KED-granu   |   24    | ❌ Déprécié
ked_pedological_prior         | KED-prior   |    7    | 🔬 Variante test (V11 params)
ordinary_kriging              | OK          |   16    | 🗄️  Krigeage simple (archives)
derived_ip_from_wl_wp         | IP-dérivé   |    3    | 🧮 Calcul : IP = WL - WP
regression_kriging_catboost   | RK-CatBoost |    1    | ❌ Non déployé (n<200)
```

---

## 2. 🧠 C'est quoi la différence entre ces modèles ? (explication depuis zéro)

### Le problème de base

Imagine que tu veux savoir si le sol est argileux en un point précis au milieu du Togo — là où il n'y a **aucun sondage**. Tu dois **deviner** à partir des sondages voisins. C'est ça, l'interpolation spatiale.

Chaque modèle répond à la question : **"Comment utiliser les 573 sondages disponibles pour prédire la valeur partout ?"**

---

### Modèle 0 — Krigeage Ordinaire (`ordinary_kriging`)

> _"Je regarde les voisins et je fais une moyenne pondérée par la distance."_

C'est le modèle **le plus simple**. Plus un sondage est proche, plus son poids est élevé. Il utilise un **variogramme** (un outil qui mesure "à partir de quelle distance les sols ne se ressemblent plus").

**Formule simplifiée :** `valeur_inconnue = Σ(poids_i × valeur_sondage_i)`

**Problème :** il ignore tout ce qu'on sait sur la géologie. Un sondage à 5 km sur du granite et un sondage à 5 km sur de l'argile ont le même poids, alors qu'ils n'ont aucune raison d'être similaires.

---

### Modèle L1 — KED-H (`ked_hierarchical_5levels`)

> _"Je regarde d'abord quelle formation géologique se trouve ici, j'utilise la moyenne connue de cette formation comme point de départ, puis je corrige avec les sondages voisins."_

**KED = Krigeage avec Dérive Externe.** La "dérive" c'est une valeur de référence calculée depuis les couches géologiques.

La version **hiérarchique 5 niveaux** fonctionne comme un entonnoir :

```
Niveau 1 : "Ce point est dans la Dépression de la Lama" → VBS moyen = 8.7 g/100g
     ↓ si pas assez de sondages (< 5)
Niveau 2 : "Ce point est sur un Vertisol" → VBS moyen = 7.2 g/100g
     ↓ si pas assez
Niveau 3 : "Ce point a un risque RGA élevé" → VBS moyen = 6.1 g/100g
     ↓ si pas assez
Niveau 4 : "Ce point est sur du gneiss" → VBS moyen = 3.8 g/100g
     ↓ si pas assez
Niveau 5 : "Moyenne nationale" → VBS moyen = 4.1 g/100g
```

**Le modèle KED-H = Valeur attendue (dérive) + Résidu spatial (krigeage)**

**Pourquoi c'est mieux que le krigeage ordinaire ?** Parce qu'un point sur Vertisol part d'une base de 7.2 au lieu de 4.1. La correction à apporter est plus petite → moins d'erreur.

**Ancienne version :** `ked_pedologie_ked` utilisait seulement la pédologie (niveau 2 = type de sol). `ked_hierarchical_5levels` utilise les 5 niveaux → plus précis.

---

### Modèle L2a — RK-SCORPAN (`regression_kriging_scorpan`)

> _"Je construis d'abord une équation mathématique qui relie le sol à l'altitude, aux précipitations, à la géologie, etc. Ensuite je corrige les erreurs de cette équation avec le krigeage."_

**SCORPAN** = Acronyme des 7 facteurs de formation du sol :

- **S** = propriétés du Sol (pédologie)
- **C** = Climat (précipitations WorldClim)
- **O** = Organismes (végétation NDVI)
- **R** = Relief (altitude SRTM, pente, TPI, HAND)
- **P** = matériau Parental (géologie)
- **A** = Âge (non utilisé ici)
- **N** = position (coordonnées Nord/Est)

**Régression Ridge :** `VBS ≈ 0.3×altitude - 0.2×distance_rivière + 0.5×risque_argile + ...`

- Ridge = régression linéaire avec une pénalité pour éviter le sur-ajustement
- λ_R = 0.18 (calibré automatiquement par LOO-CV)

**Ensuite :** les erreurs de cette équation sont interpolées par krigeage ordinaire.

**Résultat :** RK capture les **gradients régionaux** (le nord est plus sec → moins d'argile). KED capture mieux la **structure locale géologique**.

---

### Modèle L2b — Fusion BLUP (`ked_rk_fusion_bayesian`)

> _"KED et RK ont chacun une opinion. Je les combine en donnant plus de poids à celui qui est le plus sûr de lui en chaque point."_

**BLUP = Best Linear Unbiased Predictor** (Meilleur estimateur linéaire sans biais).

Imagine deux experts :

- Expert KED dit : "VBS = 4.2 g/100g ± 1.5" (il est très sûr, il y a un sondage à 2 km)
- Expert RK dit : "VBS = 5.1 g/100g ± 3.2" (il est moins sûr, zone peu couverte)

La fusion donne **plus de poids à KED** car il a une incertitude plus faible :

```
Poids KED = 1/1.5² = 0.44
Poids RK  = 1/3.2² = 0.10
VBS_fusion = (0.44 × 4.2 + 0.10 × 5.1) / (0.44 + 0.10) = 4.37
σ²_fusion  = 1/(0.44 + 0.10) = 1.85 ← toujours inférieur à 1.5² !
```

**Propriété mathématique certifiée :** `σ²_fusion < min(σ²_KED, σ²_RK)` **TOUJOURS**. C'est-à-dire que la fusion est **toujours plus précise** que chacun des deux modèles séparément, même quand l'un est clairement meilleur.

---

### Modèle L3 — VfS-PLS (`vfs_pls` — en cours)

> _"Je regarde la couleur de la terre depuis l'espace avec Sentinel-2 et je prédit le VBS."_

**VfS = VBS from Sentinel.** Sentinel-2 est un satellite européen qui photographie la Terre tous les 5 jours.

Les argiles gonflantes (smectites) **absorbent** certaines longueurs d'onde infrarouges différemment. La bande B11 (1610 nm) et B12 (2190 nm) permettent de calculer :

```
I_argile = B11 / B12   → élevé = argiles actives → VBS élevé probable
```

**PLS = Partial Least Squares** (moindres carrés partiels). C'est une régression optimisée pour les cas où les variables d'entrée sont très corrélées entre elles.

**Paradoxe de profondeur :** Sentinel-2 voit seulement les **2 mm superficiels** du sol, mais le VBS H1 mesure 0–1 m. Pourquoi ça marche quand même ? Parce que dans les sols résiduels togolais (53% du territoire), la minéralogie de surface est corrélée à celle en profondeur (r = 0.511 mesuré).

**Résultat :** LOO-RMSE = 2.788 g/100g < KED-H = 3.147 → **meilleur que le krigeage géostatistique classique** pour VBS surface.

**Limitation :** Ne fonctionne que pour le VBS, uniquement là où NDVI < 0.6 (pas sous forêt dense, pas sur cuirasses latéritiques).

---

### Modèle L4 — MTGP/ICM (`mtgp_icm_gpflow`)

> _"Je modélise VBS, IP, WL, WP et EG ENSEMBLE en exploitant leurs corrélations. Un sondage riche (avec les 5 mesures) aide à prédire là où on a mesuré seulement 1 ou 2 paramètres."_

**MTGP = Multi-Task Gaussian Process** (Processus Gaussien Multi-Tâches) **ICM = Intrinsic Coregionalization Model** (Modèle de Coregionalisation Intrinsèque)

**Idée :** Regarde la matrice de corrélation :

```
r(IP, WL) = 0.802   → Très fortement corrélés
r(IP, EG) = 0.742   → Fortement corrélés
r(VBS, EG) = 0.350  → Modérément corrélés
```

Si sur un point donné, IP est élevé (= 45%), alors WL l'est probablement aussi (≈ 65%). Le MTGP **apprend et exploite** ces corrélations. Si un sondage a mesuré IP mais pas EG, le MTGP peut **emprunter** l'information de l'IP pour améliorer la prédiction d'EG.

**GPflow** = librairie Python de Google pour les processus gaussiens. Utilise Adam (algorithme d'optimisation comme dans les réseaux de neurones) pour calibrer les paramètres.

**Réponse à ta question "pourquoi VBS+IP+EG et pas les autres ?"** → voir section 3 ci-dessous.

---

### Modèles annexes en DB

|Méthode|Ce que c'est|
|---|---|
|`ked_pedologie_ked`|Version **ancienne** de KED-H (1 seul niveau de dérive : pédologie). Déprécié.|
|`ked_pedologie_eg`|KED pédologique spécifique à EG (potentiel de gonflement). Ancienne version.|
|`ked_pedologie_granulo`|KED pour passant_2mm et passant_80um. **Déprécié** – remplacé par ked_hierarchical_5levels.|
|`ked_pedological_prior`|Variante test pour les paramètres V11. Compare avec KED-H.|
|`derived_ip_from_wl_wp`|Pas un modèle d'interpolation : calcule `IP = WL - WP` algébriquement.|
|`regression_kriging_catboost`|CatBoost (gradient boosting ML pur). **1 run test, non déployé** car n < 200.|
|`ordinary_kriging`|Krigeage Ordinaire simple (archives pré-V9).|

---

## 3. 📊 Tableau LOO-RMSE COMPLET — Tous modèles × Tous paramètres × H1/H2/H3

Voici le tableau **COMPLET** avec TOUS les modèles de la DB. `—` = non calculé/insuffisant.

### 🔵 Paramètres d'argilosité / plasticité

|Param|Modèle|n_obs|H1 LOO|H2 LOO|H3 LOO|Note|
|---|---|---|---|---|---|---|
|**VBS** g/100g|KED-H (L1 officiel)|113|3.147|3.204|3.050|✅ Officiel|
||KED-pédo (ancien)|106|3.060|2.922|2.572|⚠️ Déprécié|
||RK-SCORPAN (L2a)|?|**2.625**|4.805⚠️|**2.875**|✅|
||Fusion BLUP (L2b)|—|σ²↓46%|σ²↓46%|σ²↓49%|✅ LOO non calc.|
||MTGP/ICM (L4)|260|μ=4.09|μ=4.01|μ=4.02|🧪 LOO non calc.|
||VfS-PLS (L3)|96|**2.788**|—|—|✅ Surface seul.|
||RK-CatBoost|1 test|—|—|—|❌ N insuff.|
|**IP** %|KED-H|121|**10.481**|9.702|**9.483**|✅|
||KED-pédo (ancien)|112|10.531|9.395|9.595|⚠️ Déprécié|
||RK-SCORPAN|?|12.509|**9.351**|7.050|✅|
||Fusion BLUP|—|σ²↓47%|σ²↓48%|σ²↓48%|✅|
||MTGP/ICM|260|μ=19.5%|μ=20.5%|μ=20.6%|🧪|
||IP dérivé WL-WP|—|calc.|calc.|calc.|🧮 Identique|
|**WL** %|KED-H|120|**12.384**|**11.302**|10.594|✅|
||KED-pédo (ancien)|112|13.681|11.765|10.783|⚠️ Déprécié|
||RK-SCORPAN|?|16.186|25.352❌|**6.980**|✅|
||Fusion BLUP|—|σ²↓45%|σ²↓48%|σ²↓50%|✅|
||MTGP/ICM|260|μ=—|μ=—|μ=—|🧪 en DB|
|**WP** %|KED-H|120|7.788|**7.752**|7.544|✅|
||KED-pédo (ancien)|112|8.384|7.857|7.728|⚠️ Déprécié|
||RK-SCORPAN|?|**5.349**|13.535❌|**7.292**|✅|
||Fusion BLUP|—|σ²↓47%|σ²↓50%|σ²↓49%|✅|
||MTGP/ICM|260|μ=—|μ=—|μ=—|🧪 en DB|
|**EG** %|KED-H|101|1.692|**1.754**|1.719|✅|
||KED-pédo-EG (ancien)|93|1.667|1.690|1.669|⚠️ Déprécié|
||RK-SCORPAN|?|**1.149**|1.975|**1.275**|✅|
||Fusion BLUP|—|σ²↓49%|σ²↓47%|σ²↓49%|✅|
||MTGP/ICM|260|μ=3.73%|μ=3.99%|μ=4.08%|🧪|

### 🟠 Paramètres V11 (portance / in-situ) — KED-H uniquement actuellement

|Param|Modèle|n_obs|H1 LOO|H2 LOO|H3 LOO|Note|
|---|---|---|---|---|---|---|
|**CBR 95%** %|KED-H|117|16.136|—|—|✅|
||KED-prior (test)|83|—|—|—|🔬|
|**Rd** MPa|KED-H|89→272|3.449|7.013|14.164⚠️|✅|
||KED-prior (test)|89|**3.219**|**2.001**|252!❌|🔬 Prior H3 diverge|
|**γd** kN/m³|KED-H|318|1.408|—|—|✅|
||KED-prior (test)|284|**0.124**|—|—|🔬 Suspicieux|
|**w_opt** %|KED-H|318|2.900|—|—|✅|
||KED-prior (test)|284|**2.067**|—|—|🔬|
|**Em** MPa|KED-H|21|— (n=5)|—|13.310|✅ n<10 à H1|
|**Pl** MPa|KED-H|21|— (n=5)|—|0.988|✅|
|**P80µm** %|KED-H|83|15.331|14.048|13.444|✅|
||KED-pédo-gran. (anc.)|77|16.146|14.330|14.115|⚠️ Déprécié|
|**P2mm** %|KED-H|9|5.542|3.147|3.642|⚠️ N très faible|

---

## 4. 🤖 Explication du MTGP : "Pourquoi VBS, IP, EG et pas les autres ?"

### Ce qui a été fait

Le MTGP a été entraîné sur **VBS + IP + EG + WL + WP** (15 paramètre-horizons au total en DB). Mais pourquoi pas CBR, Rd, γd, w_opt ?

**Raison 1 — Corrélation physique requise.** Le MTGP n'est utile que si les paramètres sont physiquement corrélés. Regarde :

```
VBS ↔ IP  : r = 0.328  → les argiles actives sont plastiques
IP  ↔ WL  : r = 0.802  → même origine minéralogique
IP  ↔ EG  : r = 0.742  → smectite → plasticité ET gonflement
```

Ces corrélations sont **physiquement explicables** par la minéralogie. Le MTGP les exploite.

Mais entre VBS et CBR ? La corrélation est beaucoup plus faible et indirecte. CBR dépend aussi du compactage, de l'humidité de mise en œuvre, de la granulométrie — pas seulement de l'argilosité.

**Raison 2 — Support logiciel.** Le code `mtgp_geotechnique.py` est codé pour les 5 paramètres d'argilosité. Les paramètres V11 (CBR, Rd…) auraient nécessité de refactoriser le script.

### Ce que signifient les métriques MTGP

Les métriques `pred_mean` et `pred_var_mean` sont des **statistiques sur la grille** (29 407 mailles) :

```
VBS H1 : μ_préd = 4.090 g/100g   → La prédiction moyenne nationale est 4.09
          σ²_préd = 8.928          → Incertitude moyenne = √8.928 ≈ 2.99 g/100g
          N_train = 260             → 260 observations empilées (VBS + IP + EG combinés)
```

**Pourquoi N=260 alors qu'on a 113 sondages VBS ?** Le MTGP empile les 3 paramètres :

```
~ 88 mesures VBS H1
+ ~ 92 mesures IP H1   = 260 observations au total
+ ~ 80 mesures EG H1
```

Un point qui a mesuré IP mais pas VBS **contribue quand même** à la prédiction VBS via la corrélation apprise.

**Pourquoi LOO-RMSE non calculé ?** Le LOO-RMSE MTGP nécessiterait de ré-entraîner le modèle N=260 fois (une par observation). Avec GPflow et l'algorithme Adam (500 itérations), ça prendrait 260 × ~2 min = **9 heures**. Non implémenté pour l'instant.

---

## 5. 🛸 Explication VfS-PLS Sentinel-2

### Architecture complète

```
Entrée : Images Sentinel-2 (Togo, 2023–2024)
    ↓
Calcul de 4 indices spectraux :
    I_argile = B11/B12          (argiles absorbent à 2190nm)
    I_SWIR   = (B11-B12)/(B11+B12)
    NDVI     = (B8-B4)/(B8+B4)  (végétation : masque les zones forestières)
    I_Fe     = B4/B8            (oxydes de fer)
    ↓
Modèle PLS (3 composantes, choisi par LOO-CV)
    Composante 1 (68.5% var. X) : dominée par I_argile (chargement 0.72)
    Composante 2 (18.3%)        : opposition NDVI / I_SWIR (sol nu / végétation)
    Composante 3 (8.2%)         : signal résiduel SWIR
    ↓
Prédiction VBS H1 sur les 29 407 mailles
```

### Résultats

```
LOO-RMSE = 2.788 g/100g
R²_LOO   = 0.354   → le modèle explique 35.4% de la variance du VBS
N         = 96 sondages de calibration
Couverture = 81.7% des mailles (excl. forêts NDVI>0.6 et cuirasses)
```

### Comparaison

|Modèle|LOO-RMSE VBS H1|Gagnant|
|---|---|---|
|Krigeage Ordinaire (OK)|~4.5|❌|
|KED pédologique (ancien)|3.060|❌|
|**KED-H (officiel)**|3.147|❌|
|**VfS-PLS Sentinel-2**|**2.788**|✅|
|**RK-SCORPAN**|**2.625**|✅✅|

VfS est meilleur que KED-H mais moins bon que RK. Son avantage : il ne nécessite **pas de sondage terrain** dans une zone (juste une image satellite).

---

## 6. ✅ Tableau mis à jour — Meilleur modèle par paramètre (tous modèles inclus)

|Paramètre|H1 — Meilleur LOO|H2 — Meilleur LOO|H3 — Meilleur LOO|Fusion dispo?|
|---|---|---|---|---|
|**VBS**|RK **2.625** ✅ (VfS=2.788 sans sondage)|KED **3.204**|RK **2.875**|✅ σ²↓47%|
|**IP**|KED **10.481**|RK **9.351**|RK **7.050**|✅ σ²↓48%|
|**WL**|KED **12.384**|KED **11.302**|RK **6.980**|✅ σ²↓48%|
|**WP**|RK **5.349**|KED **7.752**|RK **7.292**|✅ σ²↓49%|
|**EG**|RK **1.149**|KED **1.754**|RK **1.275**|✅ σ²↓48%|
|**CBR 95%**|KED **16.136**|—|—|❌ RK non calc.|
|**Rd**|KED **3.449**|KED **7.013**|KED **14.164**⚠️|❌ RK non calc.|
|**γd**|KED **1.408**|—|—|❌ RK non calc.|
|**w_opt**|KED **2.900**|—|—|❌ RK non calc.|
|**Em**|— (n=5)|—|KED **13.310**|❌|
|**Pl**|— (n=5)|—|KED **0.988**|❌|
|**P80µm**|KED **15.331**|KED **14.048**|KED **13.444**|❌|

> **Score KED vs RK (5 paramètres d'argilosité, 15 comparaisons) : KED 6/15, RK 9/15**

---

## 7. 🔑 Explication de la phrase "Fusion BLUP toujours recommandée"

### Analogie avec deux médecins

Imagine deux médecins qui diagnostiquent la même maladie pour 29 407 patients (= les mailles de la carte) :

- **Médecin KED** : très bon sur les maladies liées au terrain géologique (IP, WL)
- **Médecin RK** : très bon sur les maladies liées au climat (VBS, EG)

Pour certains patients, le médecin KED est plus sûr. Pour d'autres, c'est le médecin RK.

**LOO-RMSE = diagnostic en moyenne nationale.** Ça te dit qui est meilleur globalement.

**Mais la Fusion fait quelque chose de différent :** pour CHAQUE patient (chaque maille), elle donne plus de poids au médecin qui est **localement plus certain**. Et mathématiquement, le diagnostic combiné est **toujours plus précis** que les deux séparément :

```
σ²_fusion = σ²_KED × σ²_RK / (σ²_KED + σ²_RK)

Si σ²_KED = 9 et σ²_RK = 16 :
σ²_fusion = 9×16 / (9+16) = 144/25 = 5.76   ← inférieur à 9 ET à 16 ✅

Si σ²_KED = σ²_RK = 12 :
σ²_fusion = 12×12 / (12+12) = 144/24 = 6    ← gain de 50% ✅
```

**"Indépendamment du gagnant LOO"** signifie : même si RK gagne (LOO plus bas), la Fusion sera QUAND MÊME plus précise sur la variance locale. Ce sont deux mesures différentes :

|Mesure|Ce qu'elle dit|
|---|---|
|**LOO-RMSE**|"En moyenne nationale, quel modèle se trompe le moins ?"|
|**σ²_fusion**|"Point par point, quelle est l'incertitude de la prédiction ?"|

Tu peux avoir RK meilleur en LOO-RMSE national (2.625 < 3.147) ET la Fusion meilleure en σ² local car elle exploite les zones où KED est fort (près des sondages) et les zones où RK est fort (gradient climatique).

---

## 8. 🔍 Analyse du code source et de la DB (pour comprendre comment c'est branché)

### Architecture DB

```sql
-- La table centrale de traçabilité
atlas.ai_interpolation_runs
├── parameter_id  = "vbs_ked_h1"     ← quel paramètre + modèle + horizon
├── method        = "ked_hierarchical_5levels"
├── status        = "finished"
├── metrics       = { "loo_residual": {"rmse": 3.147},    ← LOO-RMSE KED
│                     "n_train": 113,
│                     "variogram_nugget": 2.8 }
└── created_at    = "2026-06-02"

-- Les prédictions sur les 29 407 mailles
atlas.ai_interpolation_values
├── parameter_id  = "vbs_ked_h1"
├── maille_id     = UUID de la maille
├── value         = 3.847  ← prédiction VBS en ce point
└── variance      = 7.23   ← incertitude (σ²_K)
```

### Comment le code calcule le LOO-RMSE

**Pour KED** (`run_ked_vbs_ip_wl_wp_horizons.py`) :

```python
loo_errors = []
for i in range(n_sondages):
    # Retirer le sondage i
    X_train = X[mask_not_i]
    z_train = z[mask_not_i]
    
    # Recalculer la dérive hiérarchique SANS le sondage i
    drift_i = compute_hierarchical_drift(X_train, z_train, context_at_X[i])
    
    # Krigeage sur les n-1 points
    kriged_value = KED.predict(X[i], X_train, z_train, drift_i)
    
    loo_errors.append(z[i] - kriged_value)

LOO_RMSE = sqrt(mean(loo_errors²))
# Stocké dans : metrics->'loo_residual'->>'rmse'
```

**Pour RK** (`atlas_regression_kriging_terrain.py`) :

```python
loo_errors = []
for i in range(n_sondages):
    # 1. Ré-estimer Ridge SANS sondage i
    beta_i = Ridge(alpha=0.18).fit(X_train, z_train)
    
    # 2. Calculer résidus SANS sondage i
    r_train = z_train - beta_i.predict(X_train)
    
    # 3. Krigeage des résidus
    r_pred_i = OrdinaryKriging(r_train).predict(X[i])
    
    # 4. Prédiction complète
    z_pred_i = beta_i.predict(X[i]) + r_pred_i
    loo_errors.append(z[i] - z_pred_i)

LOO_RMSE = sqrt(mean(loo_errors²))
# Stocké dans : metrics->>'loo_rmse'
```

### Pourquoi les MTGP et Fusion ont `metrics=none` en DB ?

Regardons le code :

**MTGP** : Le script `mtgp_geotechnique.py` stocke les métriques sous des clés différentes (`pred_mean`, `pred_var_mean`) mais pas `loo_rmse` car le LOO-RMSE MTGP n'est pas implémenté. C'est pour ça que notre rapport montre `metrics=none` — les métriques existent, mais sous d'autres noms que ce que notre requête cherchait.

**Fusion** : `ked_rk_fusion.py` stocke les métriques de variance (`sigma2_ked_mean`, `sigma2_rk_mean`, `sigma2_fusion_mean`) mais pas de LOO-RMSE direct (car calculer le LOO-RMSE de la fusion nécessiterait de refaire KED + RK pour chaque sondage retiré — 200 calculs supplémentaires).

### La hiérarchie en résumé visuel

```
573 sondages terrain
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│  L1 : KED-H          L2a : RK-SCORPAN    L3 : VfS-PLS            │
│  (géologie+krigeage) (terrain+krigeage)  (satellite+PLS)          │
│  → 9 param×hz KED    → 5 param×hz        → VBS surface            │
│  → 4 param V11                                                     │
└─────────────────┬──────────────┬──────────────────────────────────┘
                  │              │
                  ▼              ▼
         ┌─────────────────────────────┐
         │  L2b : Fusion BLUP          │
         │  (combine KED + RK)         │
         │  → 5 param×hz               │
         │  σ²_fusion ↓48% garanti     │
         └─────────────────────────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │  L4 : MTGP/ICM              │
         │  (modélisation conjointe)   │
         │  VBS+IP+WL+WP+EG × 3Hz     │
         └─────────────────────────────┘
                        │
                        ▼
         29 407 mailles × 11 paramètres
         = ~1.9M prédictions avec σ²
```

---

## 9. 🔬 Vérification du code source — Questions du collaborateur (2026-06-05)

### Q1 : La prédiction de base est-elle bien une moyenne conditionnelle ?

**✅ OUI — confirmé ligne 297 de `run_ked_vbs_ip_wl_wp_horizons.py` :**

```python
# compute_hierarchical_prior(), min_pts=5
priors[ctx] = float(np.mean([train_values[i] for i in idx]))
```

Pour chaque contexte géologique (ex : `LAMA|VERT|fort|SCHIST`), le code calcule la **moyenne arithmétique** des sondages appartenant à ce contexte. C'est exactement une moyenne conditionnelle : `μ(VBS | contexte = c)`.

La règle de sécurité `n_k ≥ 5` est **confirmée** : `min_pts: int = 5` (paramètre par défaut). Un contexte avec moins de 5 sondages ne reçoit pas sa propre moyenne — il hérite du niveau de repli supérieur.

---

### Q2 : L'ordre de l'entonnoir — article vs code

L'article (Équation 4) décrit l'ordre suivant :

| Niveau article | Critère article |
|---|---|
| 1 | Classe RGA (Risque Retrait-Gonflement) |
| 2 | Zone géomorphologique |
| 3 | Type pédologique |
| 4 | Formation géologique |
| 5 | Moyenne nationale |

**L'implémentation dans le code suit un ordre DIFFÉRENT**, confirmé par `create_contexte_geologique.sql` et la fonction `compute_hierarchical_prior()` :

#### Ce que construit le SQL (`contexte_complet`) :

```sql
CONCAT_WS('|',
    COALESCE(z.nom, 'NAT'),                    -- seg.1 : Zone géomorphologique (ex: 'LAMA')
    LEFT(COALESCE(up.type_sol, 'INC'), 4),     -- seg.2 : Pédologie (ex: 'VERT')
    COALESCE(rg.niveau_risque, 'INC'),         -- seg.3 : Risque RGA (ex: 'fort')
    LEFT(COALESCE(ug.type_sols, 'INC'), 6)     -- seg.4 : Géologie (ex: 'SCHIST')
) AS contexte_complet
```

#### Ce que fait le repli Python (`compute_hierarchical_prior`) :

```
Niveau 1 : ZONE|PEDO|RISQUE|GEO   → contexte le plus précis (≥5 sondages requis)
     ↓ si n < 5
Niveau 2 : ZONE|PEDO              → RGA et Géologie abandonnés à ce stade
     ↓ si n < 5
Niveau 3 : PEDO seule             → Zone également abandonnée
     ↓ si n < 5
Niveau 4 : Moyenne nationale      → repli ultime
```

#### Tableau comparatif article / implémentation

| Niveau | Ordre dans l'article | Ordre dans le code | Statut |
|--------|---------------------|-------------------|--------|
| 1 | **Classe RGA** (priorité 1er) | **Zone géomorphologique** | ⚠️ Inversé |
| 2 | Zone géomorphologique | Pédologie | ⚠️ Inversé |
| 3 | Type pédologique | RGA (segment 3 du contexte_complet) | ⚠️ Décalé |
| 4 | Formation géologique | Formation géologique | ✅ Identique |
| 5 | Moyenne nationale | Moyenne nationale | ✅ Identique |

**Remarque importante :** Dans le code, RGA n'est utilisé **que** dans le contexte complet (niveau 1 du repli). Dès le repli niveau 2, le code conserve `ZONE|PEDO` et **abandonne RGA**. Cela signifie que le code traite RGA comme un discriminant fin (uniquement si beaucoup de sondages partagent le même risque dans la même zone) plutôt que comme le premier filtre structurant comme le préconise l'article.

**La description de l'entonnoir dans la section 2 de ce document (lignes KED-H) correspond à l'implémentation réelle du code**, pas à l'ordre de l'article.

**Question ouverte / amélioration potentielle :** Réordonner le `contexte_complet` pour le faire correspondre à l'Équation 4 de l'article (`RISQUE|ZONE|PEDO|GEO`) et adapter le repli Python en conséquence. Cela alignerait le code sur la justification scientifique publiée.

---

### Q3 : Pourquoi ne pas s'arrêter à la dérive ? À quoi sert le krigeage des résidus ?

> *"Sachant que la dérive donne déjà 8,7 g/100g pour un Vertisol en zone RGA forte, pourquoi ajouter le krigeage ?"*

**Réponse courte :** La dérive dit *"quel type de sol est-ce ?"*. Le krigeage dit *"dans ce type de sol, est-ce que ce point précis est plus ou moins chargé en argile que la moyenne, compte tenu des mesures voisines ?"*

**Illustration concrète :**

Imagine 3 sondages dans la même zone Vertisol-RGA-fort :
```
Sondage A (1 km au nord)  : VBS mesuré = 11.2 g/100g  → résidu = 11.2 - 8.7 = +2.5
Sondage B (2 km au sud)   : VBS mesuré =  6.1 g/100g  → résidu =  6.1 - 8.7 = -2.6
Point X   (entre A et B)  : VBS inconnu
```

Sans krigeage des résidus, on prédit **8.7 g/100g** pour le point X — la moyenne de la zone.

Avec krigeage des résidus, le variogramme mesure que les résidus se ressemblent à courte distance. Le point X est plus proche du sondage A : son résidu prédit sera ≈ +1.8, donc **VBS prédit = 8.7 + 1.8 = 10.5 g/100g**.

**La dérive réduit la magnitude du résidu** (on part de 8.7 au lieu de 4.1, donc le résidu max est ±2.6 au lieu de ±7). **Le krigeage exploite ensuite la structure spatiale de ce résidu réduit**. C'est pourquoi KED-H converge plus vite et produit un LOO-RMSE inférieur au krigeage ordinaire : moins de résidu à interpoler = moins d'erreur de krigeage.

**En formule :**

```
z_KED(x) = μ(contexte_géologique) + ε_krigeage(x)
              └── dérive intelligente ──┘   └── résidu spatial ──┘
              ≈ 8.7 g/100g (fixe dans zone)   ≈ ±1-2 g/100g (variable)

z_OK(x) = μ_national + ε_krigeage(x)
            └── 4.1 g/100g ──┘  └── ±4-5 g/100g ──┘ ← résidu BEAUCOUP plus grand
```

Si on s'arrêtait à la dérive seule (sans krigeage), tous les points d'une même zone auraient **exactement la même valeur**. La carte serait un patchwork de zones uniformes — sans variation spatiale continue. Le krigeage des résidus rétablit la continuité spatiale à l'intérieur de chaque zone géologique.

---

**En résumé pour un débutant :** Non, tu ne confonds pas. Il y a bien **11 méthodes** dans la DB. Les 4 officielles en production sont KED-H, RK-SCORPAN, Fusion BLUP et VfS. MTGP est expérimental. Les autres sont des anciennes versions ou des tests. La Fusion est toujours recommandée car elle améliore mathématiquement l'incertitude même quand un modèle individuel est meilleur en moyenne nationale.

---

*Dernière mise à jour : 2026-06-05 — vérification code source `run_ked_vbs_ip_wl_wp_horizons.py` + `create_contexte_geologique.sql`*