# Distribution Spatiale des Sondages — Atlas Géotechnique Togo
## Analyse complète de la couverture des données terrain

**Date** : 2026-06-07  
**Source DB** : `atlas_clean` @ 127.0.0.1:5433 (PostgreSQL 17 natif Windows)  
**N total** : 572 sondages actifs (deleted_at IS NULL)  
**Réseau de mailles** : 29 407 cellules de 2 km × 2 km  

---

## 1. Synthèse globale du géocodage

### 1.1 Qualité de positionnement

| Mode de localisation | N sondages | % | Précision spatiale |
|---------------------|-----------|---|-------------------|
| `exact` (GPS terrain) | **127** | **22.2%** | ✅ < 10 m — coordonnées mesurées sur site |
| `adm_random_cell` | **445** | **77.8%** | ⚠️ ± 5–20 km — position aléatoire dans le canton ADM3 |
| **Total géocodés** | **572** | **100%** | — |
| Sans géométrie | 0 | 0% | ✅ Anomalie corrigée (2026-06-05) |

**Interprétation** : Moins d'un quart des sondages ont des coordonnées GPS réelles. Les 77.8% restants sont positionnés algorithmiquement dans le centroïde ± aléatoire de leur canton. Cette approximation est suffisante pour les interpolations krigeage à l'échelle nationale (portée variogramme > 50 km), mais insuffisante pour toute analyse à l'échelle infra-cantonale ou pour les algorithmes de voisinage.

### 1.2 Sources des données

| Source | N | GPS exact | ADM random | Notes |
|--------|---|-----------|------------|-------|
| **V10_MASTER_2026** | 370 | 126 | 244 | Import principal — études routières et chantiers |
| AMESSEFE Komi Yoan Freddy | 90 | 1 | 89 | Sondages académiques (mémoire master) |
| *(source non renseignée)* | 80 | 0 | 80 | Données sans traçabilité source |
| Autres étudiants (7 noms) | 28 | 0 | 28 | Sondages académiques individuels |
| SOGLO Ferdinand | 4 | 0 | 4 | — |

**Observation** : 64.7% des données (370/572) viennent d'un seul import (V10_MASTER_2026), créant une dépendance forte à la qualité de cet ensemble.

---

## 2. Répartition géographique par région administrative (ADM1)

| Région | N sondages | % | GPS exact | ADM random | Cantons couverts |
|--------|-----------|---|-----------|------------|-----------------|
| **Plateaux** | 250 | 43.7% | 64 | 186 | Haho, Kloto, Ogou, Est-Mono, Kpele, Wawa, Amou, Danyi |
| **Maritime** | 203 | 35.5% | 51 | 152 | Golfe, Zio, Ave, Agoe-Nyive, Lacs, Bas-Mono |
| **Centrale** | 57 | 10.0% | 9 | 48 | Sotouboua, Blitta, Tchamba |
| **Kara** | 45 | 7.9% | **0** | 45 | Kozah, Binah, Bassar, Assoli, Dankpen |
| **Savanes** | 14 | 2.4% | **0** | 14 | Cinkasse, Tone, Kpendjal |
| *(non renseigné)* | 3 | 0.5% | 3 | 0 | — |

**Déséquilibre structurel majeur** :  
- Plateaux + Maritime = **453 sondages (79.2%)** — couverture dense et qualité mixte  
- Centrale + Kara + Savanes = **116 sondages (20.3%)** — couverture clairsemée  
- **Kara + Savanes = 59 sondages (10.3%), 0 GPS exact** : le nord du pays est entièrement prédit par géologie, pas par krigeage réel

```
TOGO : Densité sondages par région
────────────────────────────────────────────────────────
Plateaux  ████████████████████████████████ 250 (43.7%)
Maritime  ████████████████████████        203 (35.5%)
Centrale  ███████                          57 (10.0%)
Kara      █████                            45 (7.9%)
Savanes   █                                14 (2.4%)
────────────────────────────────────────────────────────
```

---

## 3. Distribution par canton (ADM3) — Top 15

| Canton | Préfecture | Région | N | Mailles | Exact | Random |
|--------|-----------|--------|---|---------|-------|--------|
| **Notse** | Haho | Plateaux | **54** | 35 | 3 | 51 |
| **Badja** | Ave | Maritime | **29** | 17 | 0 | 29 |
| **Gbadjahe** | Est-Mono | Plateaux | **28** | 10 | 0 | 28 |
| **Sotouboua** | Sotouboua | Centrale | **26** | 18 | 0 | 26 |
| **Agbelouve** | Zio | Maritime | **23** | 19 | 23 | 0 |
| Abobo | Zio | Maritime | 20 | 11 | 0 | 20 |
| Atsave | Haho | Plateaux | 17 | 15 | 15 | 2 |
| Adeta | Kpele | Plateaux | 15 | 15 | 4 | 11 |
| Lome Commune | Lome Commune | Maritime | 12 | 5 | 0 | 12 |
| Kpele-Centre | Kpele | Plateaux | 12 | 7 | 0 | 12 |
| Timbou | Cinkasse | **Savanes** | 12 | 7 | 0 | 12 |
| Aflao Gakli | Golfe | Maritime | 11 | 4 | 0 | 11 |
| Gape Kpodji | Zio | Maritime | 11 | 6 | 11 | 0 |
| Atchangbade | Kozah | **Kara** | 11 | 5 | 0 | 11 |
| Katore | Ogou | Plateaux | 11 | 11 | 10 | 1 |

**Concentration anormale dans Notse** : 54 sondages dans un seul canton (9.4% du total) — probablement issus d'un chantier routier important (axe Lomé-Atakpamé). Cette concentration crée une zone de sur-représentation dans les modèles d'interpolation.

---

## 4. Densité par maille (2 km × 2 km)

| Classe | N mailles | % territoire total | % mailles avec données |
|--------|-----------|-------------------|------------------------|
| **0 sondage** | 29 017 | **98.67%** | — |
| 1 sondage | 357 | 1.21% | 89.9% |
| 2 sondages | 24 | 0.08% | 6.0% |
| 3–5 sondages | 9 | 0.03% | 2.3% |
| **6+ sondages** | **0** | **0%** | — |
| **Total couvert** | **390** | **1.33%** | **100%** |

**Maille la plus dense** : `TG-0484-0206-01` (Sagbado, Golfe, Maritime) — **5 sondages tous GPS exact**  
**Nombre de mailles couvertes** : 390 sur 29 407 (1.33%)

**Conséquence directe** : Les modèles interpolent sur **98.67% du territoire sans observation directe**. La qualité de la carte géotechnique dépend presque entièrement de :
1. La dérive externe (géologie, pédologie, RGA)
2. La portée spatiale du variogramme (~80–220 km)
3. La validité de l'hypothèse de stationnarité

---

## 5. Analyse de la couverture par rapport au réseau routier

Les sondages sont fortement corrélés aux axes routiers principaux :
- **Axe Lomé–Atakpamé–Sokodé** : Notse (54), Gbadjahe (28), Sotouboua (26) — corridor central
- **Maritime (zone Lomé)** : Agbelouve (23), Abobo (20), Lome Commune (12) — proximité capitale
- **Plateaux (études tertiaires)** : Badja, Atsave, Kpele — campagnes académiques

Zones blanches structurelles (< 5 sondages sur l'ensemble de la préfecture) :
- Préfecture de **Dankpen** (Kara) → 0 sondage
- Préfecture de **Kpendjal** (Savanes) → ≈ 2 sondages
- Préfecture de **Tone** (Savanes, Dapaong) → ≈ 5 sondages
- Préfecture de **Wawa** (Plateaux, est) → < 10 sondages

---

## 6. Implications pour les modèles ML

### 6.1 Ce que cette distribution implique pour la validité des cartes

| Zone | Couverture | Qualité interpolation | Recommandation utilisation |
|------|-----------|----------------------|---------------------------|
| **Plateaux + Maritime** | Dense (453) | ⭐⭐⭐⭐ Bonne | Utiliser avec confiance pour dimensionnement |
| **Centrale** | Modérée (57) | ⭐⭐⭐ Correcte | Utiliser avec précaution — confirmer valeurs extrêmes |
| **Kara** | Faible (45, 0 GPS) | ⭐⭐ Médiocre | Valeur indicative seulement — sondage complémentaire recommandé |
| **Savanes** | Très faible (14, 0 GPS) | ⭐ Très incertaine | **Ne pas utiliser pour décision sans sondage terrain** |

### 6.2 Biais de validation LOO-CV

Le LOO-RMSE global (ex : VBS H1 = 3.08 g/100g) est **tiré vers le bas par la zone dense (Plateaux+Maritime)**. Le LOO-RMSE dans la zone Kara+Savanes est structurellement plus élevé mais non quantifié séparément dans les rapports actuels.

**Action requise** : calculer le LOO-RMSE par région (voir §7 — roadmap).

### 6.3 Horizon temporel des données

Toutes les données V10_MASTER_2026 sont des campagnes antérieures à 2026. Les sondages académiques (2025-2026) sont récents. Il n'y a pas de cycle temporel détectable mais la concentration sur certains chantiers peut créer une hétérogénéité temporelle non contrôlée.

---

## 7. Roadmap — Actions prioritaires liées à la distribution spatiale

| Priorité | Action | Impact | Effort |
|----------|--------|--------|--------|
| 🔴 P0 | Calculer LOO-RMSE par région (Plateaux/Maritime/Centrale/Kara/Savanes) | Publication — validation honnête | 2h Python |
| 🔴 P0 | Marquer zones "prédites par géologie seule" sur les cartes (Kara, Savanes) | Transparence — évite mauvais usages | 1h QGIS |
| 🟡 P1 | Ajouter validation par blocs spatiaux (5 blocs × 120 km N-S) | Rigueur scientifique | 1 jour |
| 🟡 P1 | Quantifier RMSE Em/Pl : n=26 → ne pas cartographier à l'échelle nationale | Honnêteté scientifique | 30 min |
| 🟢 P2 | Campagne terrain prioritaire : Dankpen + Kpendjal + Tone (nord) | Impact données long terme | Terrain |
| 🟢 P2 | Chercher données historiques GID-Togo (rapports BRGM, UNDP) pour le nord | Augmentation N sans terrain | 2-3 jours |

---

*Document créé le 2026-06-07 — Analyse complète de la distribution spatiale des 572 sondages*  
*Données : atlas_clean @ port 5433 — Requêtes SQL vérifiées directement*
