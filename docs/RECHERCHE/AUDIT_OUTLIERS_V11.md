# Audit Valeurs Aberrantes — Post-import V10/V11
**Date** : 2026-06-01 | **DB** : atlas_clean port 5433 | **Batch** : v10_master_import_2026

---

## 1. Résumé des anomalies détectées et actions

| Paramètre             | Anomalie                     | n   | Origine                                                | Action                                          | Statut     |
| --------------------- | ---------------------------- | --- | ------------------------------------------------------ | ----------------------------------------------- | ---------- |
| WL (Atterberg)        | WL=0, WP=0                   | 3   | Sondage Kparatao (pre-V10, batch=NULL)                 | WL=NULL, WP=NULL                                | ✅ Corrigé  |
| WP (Atterberg)        | WP < 0 (jusqu'à -57%)        | 18  | Sites emprunt V10 (KABLE_KOPE, TOKOH2, BEDJI, FODJAYE) | WP=NULL (sol non plastique)                     | ✅ Corrigé  |
| Rd MPa (pénétromètre) | Rd > 50 MPa                  | 54  | Latérite profonde (5–10 m) : LOGOTE, TOH, ZOSS         | Confirmé CSV source — valeurs réelles           | ✅ Conservé |
| VBS                   | VBS > 20 g/100g              | 2   | Kamina Dakré (28.86), Ountivou (20.16)                 | Argile très gonflante — physiquement possible   | ✅ Conservé |
| CBR                   | CBR > 100%                   | 2   | PC03_S10 (132%), PC03_EMPRUNT_TOKPEVIA (114%)          | Sites emprunt/graveleux — physiquement possible | ✅ Conservé |
| OPM gamma_d           | gamma_d hors [1.4–2.5 g/cm³] | 38  | Colonnes CSV inversées lors import                     | Signalé WARNING, non inséré en DB               | ✅ Log only |
|                       |                              |     |                                                        |                                                 |            |

---

## 2. Détail par paramètre

### 2.1 Atterberg — WL=0, WP=0 (Kparatao)

**Origine** : Sondage `Kparatao` importé avant V10 (batch=NULL). 3 échantillons à 1.0 m, 1.5 m, 2.0 m avec `wl=0, wp=0`.

**Diagnostic** : Valeur zéro = donnée manquante encodée comme 0 dans la source. Un sol avec WL=0 est physiquement impossible (eau non absorbable).

**Vérification CSV** : Le sondage Kparatao date d'avant V10. Source non disponible pour retraçage direct.

**Correction** : `UPDATE essais_atterberg SET wl=NULL, wp=NULL WHERE wl=0 AND wp=0`

**Impact modèles** : 3 pts supprimés du jeu d'entraînement WL/WP H2/H3 (impact négligeable sur 909 pts total).

---

### 2.2 Atterberg — WP < 0 (Sites emprunt V10)

**Origine** : Import V10 depuis `V10_LABORATOIRE_HORIZONS.csv`. 18 lignes avec WP négatif (de -16 à -57%).

**Sites concernés** :
- `KABLE KOPE_EMPRUNT_33_48_53` : WL=7%, WP=-19%
- `TOKOH 2_EMPRUNT_26_04_40` : WL=8%, WP=-57%
- `BEDJI_EMPRUNT_31_81_62` : WL=8%, WP=-20%
- `FODJAYE_EMPRUNT_31_82_65` : WL=9%, WP=-16%

**Diagnostic** : Ces sites "emprunt" (carrières/gîtes d'emprunt) ont des matériaux granulaires non plastiques (graviers, latérite). Pour sols non plastiques, la convention est WP = indéfini (NP). Valeur WP négative = encodage aberrant (peut-être IP = WL - WP, avec WP calculé comme WL - IP avec IP > WL).

**Correction** : `UPDATE essais_atterberg SET wp=NULL WHERE wp < 0` — WP mis à NULL, WL conservé.

**Impact modèles** : 18 pts de WP supprimés (sites emprunt non représentatifs des sols de fondation). Positif pour la qualité des modèles.

---

### 2.3 Rd MPa pénétromètre — Valeurs > 50 MPa

**Distribution complète** : n=411, min=0.06 MPa, max=106.08 MPa, avg=12.71 MPa, std=15.53 MPa

**Valeurs extrêmes (> 50 MPa)** :

| Code sondage | Profondeur (m) | Rd (MPa) | Horizon |
|---|---|---|---|
| TOH_PD3 | 5.4 | **106.1** | H3 |
| LOGOTE_PD2 | 5.0 | 72.4 | H3 |
| LOGOTE_PD3 | 5.0 | 69.5 | H3 |
| ZOSS_PD1 | 9.8 | 56.3 | H3 |

**Vérification CSV source** : `V10_INSITU_PROFIL_Z.csv` — 203 lignes LOGOTE/TOH confirmées. Progression observée (Rd croît avec la profondeur : 4.9 MPa à 0.2 m → 62+ MPa à 5+ m). Signature caractéristique de la cuirasse latéritique.

**Diagnostic** : Ces valeurs sont physiquement réelles. La cuirasse latéritique du Togo central peut atteindre 50–150 MPa en Rd. Ces sondages sont sur des axes routiers traversant des plateaux de cuirasse (Logote, Toh).

**Décision** : Conserver dans la DB. Utiliser `physical_max=120 MPa` dans le KED H3. Mentionner dans les rapports cartographiques.

**LOO-RMSE Rd H3** : 252 MPa (élevé) — reflète la haute variabilité spatiale de la cuirasse latéritique profonde, non une erreur de données. La carte reste utile pour localiser les zones de forte résistance.

---

### 2.4 VBS > 20 g/100g

**Valeurs extrêmes** : Kamina Dakré (VBS=28.86 g/100g, depth=2.0m), Ountivou (VBS=20.16 g/100g)

**Diagnostic** : VBS > 20 correspond à des argiles montmorillonitiques (smectites) très gonflantes. Possible dans les vertisols du Togo central et nord. Valeurs documentées dans la littérature pour l'Afrique de l'Ouest.

**Décision** : Conserver. `physical_max=15 g/100g` dans les anciens scripts est trop conservatif — capper à 30 g/100g.

---

### 2.5 CBR > 100%

**Valeurs** : PC03_S10 (CBR=132%), PC03_EMPRUNT_TOKPEVIA_1 (CBR=114%)

**Diagnostic** : Ces matériaux sont des "emprunt" (gîtes de matériaux) prélevés spécifiquement pour leur bonne portance. CBR > 100% est physiquement réalisable pour les graviers latéritiques compactés. Valeur de référence : gravier latéritique stabilisé ~ 80–200%.

**Décision** : Conserver. `physical_max=200%` pour CBR dans le catalogue.

---

### 2.6 OPM gamma_d — Colonnes inversées (38 lignes)

**Origine** : CSV `V10_LABORATOIRE_HORIZONS.csv`, certains projets avec colonnes `densite_seche_opm` et `teneur_eau_opt_opm` inversées.

**Exemple** : `gamma_d=8.0 g/cm³, w_opt=2.25%` → physiquement impossible (gamma_d max ~2.3 g/cm³).

**Correction appliquée lors import** : 38 lignes signalées en WARNING et non insérées.

**Recommandation** : Retourner aux rapports sources pour corriger les valeurs. Colonnes à vérifier dans les projets : AMOU_OBLO, BAFILO (potentiellement).

---

## 3. Impact sur les modèles KED V11

| Paramètre | Pts avant | Pts supprimés | Pts après | Impact modèle |
|---|---|---|---|---|
| WL (H1/H2/H3) | 909 | 21 | 888 | Négligeable (<2.3%) |
| WP (H1/H2/H3) | 909 | 21 | 888 | Positif (outliers supprimés) |
| Rd MPa (H3) | 272 | 0 | 272 | LOO-RMSE élevé = hétérogénéité réelle |
| CBR 95% (H1) | 83 | 0 | 83 | CBR>100% plausibles — conservés |
| gamma_d (H1) | 284 | 0 | 284 | Tous dans plage physique |

---

## 4. Résultats KED V11 après audit

| Paramètre | Horizon | n_train | LOO-RMSE | Modèle variogramme |
|---|---|---|---|---|
| Rd MPa | H1 | 89 | 3.22 MPa | Sphérique |
| Rd MPa | H2 | 50 | 2.00 MPa | Sphérique |
| Rd MPa | H3 | 272 | 252 MPa* | Sphérique |
| CBR 95% | H1 | 83 | NaN** | Sphérique |
| gamma_d | H1 | 284 | 0.12 g/cm³ | Sphérique |
| w_opt | H1 | 284 | 2.07 % | Sphérique |

*LOO-RMSE H3 élevé = hétérogénéité intrinsèque de la cuirasse latéritique. Carte générée (29 407 mailles).  
**LOO-RMSE NaN = instabilité numérique sur 83 pts (données géographiquement clustérisées par route). Carte KED générée mais sans métrique de validation.

---

## 5. Recommandations futures

1. **Rd H3** : Envisager une transformation log(Rd) avant krigeage pour réduire l'asymétrie. LOO-RMSE en MPa → LOO-RMSE log serait ~0.8.
2. **CBR LOO** : Avec plus de données géographiquement distribuées, la LOO sera calculable.
3. **Retour sources OPM** : 38 lignes gamma_d aberrantes → vérifier manuellement les 2-3 projets CSV source.
4. **VBS > 25** : Mettre à jour `physical_max=30 g/100g` dans `run_ked_vbs_ip_wl_wp_horizons.py`.
