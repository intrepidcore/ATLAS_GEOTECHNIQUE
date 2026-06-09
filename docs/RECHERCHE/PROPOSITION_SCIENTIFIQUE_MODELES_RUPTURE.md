# Proposition Scientifique — Modèles de Rupture pour l'Atlas Géotechnique Togo
## Intégration des Zones Géologiques, Fusion KED-RK, et Géotechnique Sans Laboratoire

**Auteur :** Serge TABE DJATO — Intrepid Core Engineering  
**Date :** 30 mai 2026  
**Statut :** Proposition de recherche pour le mémoire de master + feuille de route R&D  
**Destinataire :** Comité de recherche Atlas / Encadrant académique

---

## Préambule — Pourquoi ces propositions sont nécessaires

L'état actuel du système (KED L1 + RK L2) atteint ses limites pour trois raisons structurelles :

1. **Limite de densité** : N sondages pour 56 600 km². Même un krigeage parfait ne peut pas extraire ce qui n'est pas dans les données. Cette limite reculera à chaque nouvel import de données terrain.
2. **Limite d'indépendance** : Les 5 paramètres (VBS, IP, WL, WP, EG) sont modélisés séparément alors qu'ils sont fortement corrélés (r(IP,WL)=0.80). On laisse de l'information sur la table.
3. **Limite géographique** : KED et RK traitent le Togo comme un espace homogène. Or les zones géologiques spéciales représentent des régimes distincts de formation des sols.

Les propositions ci-dessous cherchent à briser chacune de ces trois limites.

---

## Partie I — Comprendre les Zones Géologiques Spéciales

### 1.1 Que représentent ces zones scientifiquement ?

Les 5 zones identifiées (`zones_etude`) ne sont pas de simples délimitations administratives — elles correspondent à des **processus géologiques distincts** ayant produit des régimes pédologiques et géotechniques différents :

| Zone | Formation géologique | Processus dominant | Comportement attendu |
|---|---|---|---|
| **Dépression de la Lama** | Sédimentation argileuse lacustre quaternaire | Illite + smectite gonflantes | VBS élevé, fort EG, IP élevé |
| **Dépression du Bado** | Alluvions anciennes + altérites granitoïdes | Kaolinite dominante | VBS modéré, EG faible |
| **Plaine du Mono** | Alluvions récentes Quaternaire | Sols hydromorphes, matière organique | WL élevé, comportement plastique |
| **Plaine de l'Oti** | Séries du Voltaïen (grès, quartzites) | Sols ferrugineux lessivés | VBS faible, IP bas |
| **Fosse aux Lions** | Formation de l'Atacorien (métamorphique) | Sols peu évolués lithiques | Comportement sableux, WP bas |

**Ce que montrent nos données terrain (vérification directe DB) :**
- Dépression de la Lama : VBS=4.11 (moy.), std=3.61 — **forte variabilité** → hétérogénéité interne
- Dépression du Bado : VBS=2.93 — **22% sous la moyenne nationale** → kaolinite confirme
- Zones Oti/Mono/Lions : **0 sondage** dans la DB actuelle → zones "vides" scientifiquement

**Conclusion scientifique :** Les zones sont des hypothèses géologiques qui ne sont confirmées que partiellement (Lama + Bado). Les 3 autres zones constituent une opportunité de campagne terrain prioritaire.

### 1.2 Les couches géologiques couvrant l'intégralité du territoire togolais

Contrairement aux 5 zones spéciales (14.5% du territoire), les couches suivantes offrent une **couverture nationale complète (100%)** et sont disponibles dans la base de données. Elles constituent l'ossature géologique du modèle hiérarchique proposé.

#### Couche 1 — `atlas.unites_geologiques` (120 polygones)

Carte géologique nationale du Togo. 15 grandes formations géologiques identifiées, couvrant la totalité des 29 407 mailles. Distribution sur les mailles (vérifiée en DB) :

| Formation géologique | Groupe | N mailles | % territoire |
|---|---|---|---|
| Gneiss de la Plaine Benino-Togolaise | Socle cristallin | 6 203 | 21.1% |
| Orthogneiss de Kara | Socle cristallin | 4 127 | 14.0% |
| Alluvionnaires Mésozoïque-Cénozoïque | Sédimentaire récent | 3 267 | 11.1% |
| Complexe Kabyè-Sotouboua-Agou | Chaîne Dahomeyides | 3 250 | 11.1% |
| Micaschistes de Atacora | Chaîne Dahomeyides | 2 614 | 8.9% |
| Shales de Mango (Bassin des Volta) | Sédimentaire ancien | 2 526 | 8.6% |
| Cuirasses Mésozoïque-Cénozoïque | Latéritisation | 2 464 | 8.4% |
| Quartzites de l'Atacora | Chaîne Dahomeyides | 2 436 | 8.3% |
| Schistes de Kanté | Chaîne Dahomeyides | 2 386 | 8.1% |
| Autres formations | — | ~9 141 | — |

**Pertinence géotechnique :** La géologie du substrat contrôle la minéralogie des argiles héritées. Les gneiss et micaschistes produisent des kaolinites (VBS modéré), les shales et argiles sédimentaires produisent des illites/smectites (VBS élevé). C'est la variable d'information la plus profonde disponible.

#### Couche 2 — `atlas.unites_pedologiques` (61 polygones, 13 types)

Actuellement utilisée dans KED comme **variable de dérive**. Table `pedological_drift_priors` : les moyennes par type de sol sont pré-calculées et stockées à chaque run KED (ex : WL moyen des Sols ferralitiques = 36.6 %). Types clés :
- *Vertisols* → argiles 2:1 gonflantes (smectite) → VBS élevé, EG fort
- *Sols ferralitiques non indurés* → argiles 1:1 (kaolinite) → VBS modéré
- *Sols ferrugineux tropicaux* → activité argileuse faible → VBS bas
- *Sols hydromorphes* → engorgement → WL élevé, comportement plastique

#### Couche 3 — `atlas.risque_gonflement` (342 entrées, 5 niveaux)

Carte de risque RGA Chassagneux 1996. Encode des connaissances expertes sur le gonflement par zone géographique. Non utilisée dans les calculs actuels — seulement en affichage. Niveaux : Très Faible → Faible → Moyen → Élevé → Très Élevé.

#### Couche 4 — `atlas.hydrogeologie` (14 polygones)

Carte hydrogéologique nationale. Encode la profondeur de la nappe et la perméabilité des formations. Pertinente car la présence d'eau est le premier facteur de gonflement des argiles gonflantes.

#### Couche 5 — `atlas.zones_etude` (5 zones spéciales, 14.5% du territoire)

Zones à comportement géotechnique identifié comme distinct (Lama, Bado, Mono, Oti, Lions). À confirmer par des sondages supplémentaires dans Oti, Mono et Lions.

**Proposition :** Ces cinq couches doivent être intégrées en une **variable de contexte géologique hiérarchique multi-échelle** (voir Partie III), du plus spécifique (zone spéciale) au plus général (formation géologique).

---

## Partie II — Combiner KED et RK : La Fusion Cascade

### 2.1 Pourquoi la fusion est scientifiquement justifiée

KED et RK capturent des structures différentes et **complémentaires** :

```
KED capture :
  → Structure spatiale locale des résidus (variogramme empirique)
  → Contraste entre types de sols pédologiques
  → Corrélation à courte portée (< 200 km pour VBS)

RK capture :
  → Tendance déterministe longue portée (DSM, climat)
  → Relation sol-terrain par la topographie
  → Gradient altitudinal nord-sud
  → Saisonnalité climatique (prec_dry, prec_wet)
```

**Problème** : Les deux modèles sont utilisés séparément. Chacun laisse de l'information non capturée par l'autre.

### 2.2 Méthode proposée : KED-RK Cascade avec Fusion Bayésienne

**Référence scientifique proche :** Hengl et al. (2007) — "About regression-kriging: From equations to case studies", Computers & Geosciences.

Mais la méthode exacte proposée ici (cascade avec fusion bayésienne locale) est une **adaptation originale** non publiée sous cette forme.

#### Algorithme KED-RK Cascade

```
ÉTAPE 1 — Calculer le KED national (état actuel)
  Z_KED*(s) = dérive pédologique + krigeage résidus
  σ²_KED(s) = variance krigeage KED (incertitude locale)

ÉTAPE 2 — Calculer les résidus KED aux points d'entraînement
  r_i = Z_obs(s_i) - Z_KED*(s_i)    [i = 1..N sondages]

ÉTAPE 3 — Appliquer la Régression SCORPAN sur les résidus
  r*(s) = Ridge(covariables_SCORPAN) + krigeage_ordinaire(résidus_Ridge)
  σ²_RK(s) = variance de la prédiction RK

ÉTAPE 4 — Fusion Bayésienne par incertitude locale
  w_KED(s) = 1/σ²_KED(s)   [poids inversement proportionnel à l'incertitude]
  w_RK(s)  = 1/σ²_RK(s)

  Z_FUSION*(s) = [w_KED × Z_KED*(s) + w_RK × r*(s)] / [w_KED + w_RK]

RÉSULTAT :
  - Là où KED est certain → le KED domine
  - Là où le RK est plus précis → le RK corrige
  - Transition douce, spatialement adaptative
```

#### Formulation mathématique

Pour un point non échantillonné s₀ :

```
Z_FUSION*(s₀) = Z_KED*(s₀) + β(s₀) × r*(s₀)

où β(s₀) = σ²_KED(s₀) / [σ²_KED(s₀) + σ²_RK(s₀)]  ∈ [0, 1]

Interprétation :
  β → 0  quand KED est très précis (faible incertitude) → correction RK faible
  β → 1  quand KED est très incertain → le RK prend le relais
```

Cette formule est exactement le **Best Linear Unbiased Predictor (BLUP)** d'une combinaison de deux estimateurs non-corrélés. C'est mathématiquement optimal.

#### Implémentation proposée

```python
# scripts/ked_rk_fusion.py

def fusion_cascade(
    z_ked: np.ndarray,      # prédictions KED (29407,)
    sigma2_ked: np.ndarray, # variance krigeage KED (29407,)
    z_rk: np.ndarray,       # prédictions RK (29407,)
    sigma2_rk: np.ndarray,  # variance krigeage RK (29407,)
) -> tuple[np.ndarray, np.ndarray]:
    """
    Fusion Bayésienne KED-RK par incertitude locale.
    
    Retourne : (z_fusion, sigma2_fusion)
    
    Référence :
      Chilès & Delfiner (2012) Geostatistics, 2nd ed., ch.3.4
      Hengl et al. (2007) Computers & Geosciences
    """
    # Poids inversement proportionnels à l'incertitude
    w_ked = 1.0 / np.maximum(sigma2_ked, 1e-10)
    w_rk  = 1.0 / np.maximum(sigma2_rk,  1e-10)
    w_sum = w_ked + w_rk
    
    # Fusion
    z_fusion = (w_ked * z_ked + w_rk * z_rk) / w_sum
    
    # Variance combinée (toujours < min des deux variances)
    sigma2_fusion = 1.0 / w_sum
    
    return z_fusion, sigma2_fusion
```

**Métriques de validation** : Comparer LOO-RMSE de KED seul, RK seul, et Fusion → si fusion < min(KED, RK), la méthode est validée.

---

## Partie III — Modèle Hiérarchique Zone-Pédologie-Risque

### 3.1 Principe : variable de contexte géologique multi-échelle

Actuellement, le KED utilise uniquement le type pédologique (13 classes). La proposition est d'intégrer **trois niveaux de connaissance géologique** en une variable unique hiérarchique :

```
Niveau 1 — Zone géologique spéciale (5 zones, 14.5% du territoire)
   ↓ si non applicable ↓
Niveau 2 — Type pédologique (13 types, couverture nationale 100%)
   ↓ combiné avec ↓
Niveau 3 — Classe de risque RGA (5 niveaux Chassagneux)
```

### 3.2 Algorithme d'attribution du contexte — 5 niveaux

La hiérarchie complète intègre les cinq couches disponibles, du plus spécifique au plus général :

```
Niveau 1 — Zone spéciale (5 zones, 14.5% territoire)  ← le plus informatif
Niveau 2 — Type pédologique (61 unités, 13 types, 100%)
Niveau 3 — Risque RGA Chassagneux (342 unités, 5 niveaux, 100%)
Niveau 4 — Formation géologique (120 unités, 15 formations, 100%)
Niveau 5 — Hydrogéologie (14 polygones)                ← contexte eau
```

```sql
-- Vue de contexte géologique multi-niveaux
-- À créer via migration scripts/sql/create_contexte_geologique.sql
CREATE MATERIALIZED VIEW atlas.v_contexte_geologique AS
SELECT
    m.code                                    AS maille_code,
    -- Niveau 1 : zone spéciale (null si hors zone)
    z.id                                      AS zone_speciale_id,
    COALESCE(z.nom, 'NATIONAL')               AS zone_speciale,
    -- Niveau 2 : pédologie (dérive actuelle du KED)
    COALESCE(up.type_sol, 'INCONNU')          AS type_pedologique,
    -- Niveau 3 : risque Chassagneux
    COALESCE(rg.niveau_risque, 'INCONNU')     AS risque_rga,
    -- Niveau 4 : géologie du substrat
    COALESCE(ug.type_sols, 'INCONNU')         AS formation_geologique,
    -- Niveau 5 : hydrogéologie
    COALESCE(hg.libelle, 'INCONNU')           AS hydrogeo_classe,
    -- Identifiant composite (hiérarchie complète pour repli)
    CONCAT_WS('|',
        COALESCE(z.nom, 'NAT'),
        LEFT(COALESCE(up.type_sol, 'INC'), 4),
        COALESCE(rg.niveau_risque, 'INC'),
        LEFT(COALESCE(ug.type_sols, 'INC'), 6)
    )                                          AS contexte_complet
FROM atlas.mailles m
LEFT JOIN atlas.zones_etude z
    ON ST_Intersects(ST_Centroid(m.geom), z.geom)
LEFT JOIN atlas.unites_pedologiques up
    ON ST_Contains(up.geom, ST_Centroid(m.geom))
LEFT JOIN atlas.risque_gonflement rg
    ON ST_Intersects(ST_Centroid(m.geom), rg.geom)
LEFT JOIN atlas.unites_geologiques ug
    ON ST_Intersects(ST_Centroid(m.geom), ug.geom)
LEFT JOIN atlas.hydrogeologie hg
    ON ST_Intersects(ST_Centroid(m.geom), hg.geom)
WHERE m.code IS NOT NULL;

-- Index pour jointures rapides
CREATE UNIQUE INDEX ON atlas.v_contexte_geologique (maille_code);
```

### 3.3 Utilisation dans le KED amélioré

La dérive devient **stratifiée sur le contexte composite** plutôt que sur le simple type pédologique :

```python
# Au lieu de : prior[type_sol] = mean(valeurs[type_sol])
# Nouveau    : prior[contexte_composite] = mean(valeurs[contexte_composite])

# Exemple de contexte :
# 'NAT_SFE_FORT'  → National + Sols Ferralitiques + Risque Fort
# 'LAMA_VER_TRF'  → Zone Lama + Vertisols + Très Fort

# La hiérarchie permet le repli :
# 1. Si contexte_composite a >= 5 points → utiliser sa moyenne
# 2. Sinon → repli sur type_pédologique seul
# 3. Sinon → repli sur la moyenne nationale
```

**Avantage clé** : Cette approche encode les connaissances de Chassagneux 1996 et des unités pédologiques dans la structure du modèle, sans les imposer comme contraintes dures.

### 3.4 Implémentation de la dérive zone-adaptative

```python
def compute_hierarchical_prior(
    train_values: np.ndarray,
    train_contexts: list[str],   # ex: ['LAMA_VER_TRF', 'NAT_SFE_MOY', ...]
    grid_contexts: list[str],
    min_pts: int = 5,
    fallback_depth: int = 3      # niveaux de repli
) -> dict[str, float]:
    """
    Calcule les moyennes a priori par contexte géologique hiérarchique.
    Repli automatique si pas assez de points dans une catégorie.
    """
    priors = {}
    global_mean = float(np.mean(train_values))
    
    # 1er niveau : contexte complet
    for ctx in set(train_contexts):
        mask = [c == ctx for c in train_contexts]
        pts = train_values[mask]
        if len(pts) >= min_pts:
            priors[ctx] = float(np.mean(pts))
    
    # Repli niveau 2 : zone + pédologie (ignorer risque)
    for ctx in set(train_contexts):
        if ctx not in priors:
            parent = '_'.join(ctx.split('_')[:2])  # 'LAMA_VER'
            mask = [c.startswith(parent) for c in train_contexts]
            pts = train_values[mask]
            if len(pts) >= min_pts:
                priors[ctx] = float(np.mean(pts))
    
    # Repli niveau 3 : pédologie seule
    for ctx in set(grid_contexts + train_contexts):
        if ctx not in priors:
            ped = ctx.split('_')[1]  # ex: 'VER'
            mask = [c.split('_')[1] == ped for c in train_contexts]
            pts = train_values[mask]
            if len(pts) >= min_pts:
                priors[ctx] = float(np.mean(pts))
    
    # Repli niveau 4 : hydrogéologie (NEW — filet de sécurité hydrique)
    # Nécessite hydro_lookup : dict[maille_code → libelle_hydro]
    for ctx in set(grid_contexts + train_contexts):
        if ctx not in priors:
            hydro = hydro_lookup.get(ctx, 'INCONNU')
            mask = [hydro_lookup.get(c, 'X') == hydro for c in train_contexts]
            pts = train_values[mask]
            if len(pts) >= min_pts:
                priors[ctx] = float(np.mean(pts))
            else:
                priors[ctx] = global_mean  # repli ultime : moyenne nationale
    
    return priors
```

---

### 3.5 Intégration de l'Hydrogéologie comme Niveau 4 — Proposition Détaillée

*Rédigé en juin 2026 — Extension de la proposition initiale de mai 2026*

#### 3.5.1 Justification scientifique : la mécanique de la poudre et de l'étincelle

La géotechnique des argiles gonflantes obéit à une loi fondamentale à deux facteurs :

> **Un sol gonfle si et seulement si deux conditions sont simultanément réunies :**  
> **(1) la minéralogie est favorable** — présence d'argiles 2:1 (smectite, illite), et  
> **(2) l'état hydrique initial permet l'absorption d'eau** — nappe accessible ou sol non desséché.

En reprenant l'image du chercheur en incendie : la minéralogie est la **poudre** (combustible), l'eau souterraine est **l'étincelle** (l'initiateur). Sans la poudre (argile gonflante), il n'y a aucun gonflement quelque soit la nappe. Sans l'étincelle (eau), la poudre ne brûle pas.

Cette analogie justifie la position du niveau hydrogéologique **après** les niveaux minéralogiques dans la hiérarchie de repli :

```
Niveau 1 : ZONE | PEDO | RGA | GEO | HYDRO  ← Contexte absolu (5 couches)
           "Lama + Vertisol + Risque Fort + Gneiss + Nappe affleurante"
           → Précision maximale : capture la conjonction minéral-eau localement

Niveau 2 : ZONE | PEDO                       ← Repli fort empirique
           "Je suis dans la Lama sur un Vertisol"
           → La pédologie et la zone géomorphologique seules suffisent
             pour structurer 80% de la variance géotechnique (confirmé LOO-CV)

Niveau 3 : PEDO seule                        ← Minéralogie pure
           "Je suis sur un Vertisol (smectite 2:1)"
           → La minéralogie dicte le potentiel absolu de gonflement
             (Skempton 1953 : IP = Activité × teneur_argile)

Niveau 4 : HYDRO seule             🆕        ← Filet de sécurité hydrique
           "Zone à nappe affleurante (CSIF-H)"
           → Avant de tomber sur la moyenne nationale,
             on regarde : est-ce qu'on est dans une zone
             hydrogéologiquement distincte ?
             Si oui, les sondages de ce grand bassin
             ont un comportement hydrique cohérent.

Niveau 5 : Moyenne nationale                 ← Ignorance totale du contexte
```

**Pourquoi HYDRO est au niveau 4 et non plus haut ?**

| Critère | PEDO (Niv. 3) | HYDRO (Niv. 4) | RGA (Niv. 3 imbriqué) |
|---------|--------------|----------------|----------------------|
| Nb de polygones | 61 | **14** | 342 |
| Couverture territoire | 100% | 100% | 100% |
| Résolution spatiale | Fine (préfecture) | **Grossière** (régionale) | Fine |
| Facteur contrôlé | Minéralogie héritée | État hydrique | Gonflement expert |
| Pertinence pour IP/VBS | Directe | Indirecte | Directe |
| Pertinence pour EG/WL | Directe | Forte (gonflement = f(eau)) | Directe |

**La résolution grossière de l'hydrogéologie (14 polygones pour 56 600 km²) est sa principale limite** : un polygone couvre en moyenne 4 043 km² ≈ 1 000 mailles 2km×2km. Il serait statistiquement imprudent de lui accorder une priorité sur la pédologie (61 polygones, résolution 5× supérieure) ou le risque RGA (342 polygones).

Cependant, sa pertinence physique est réelle : **une zone à nappe affleurante (type CSIF-H : "Complexe de Socle Imperméable Fissuré — Humide") aura systématiquement des valeurs de WL et EG supérieures aux zones à nappe profonde**, toutes minéralogies égales. Ce signal, faible mais cohérent à l'échelle régionale, mérite d'être capturé avant de tomber sur la moyenne nationale aveugle.

#### 3.5.2 Les 4 classes hydrogéologiques togolaises

La table `atlas.hydrogeologie` (14 polygones, 4 types distincts) encode :

| Code | Libellé | Interprétation géotechnique | N mailles typiques |
|------|---------|---------------------------|-------------------|
| `CSIF-H` | Complexe de Socle Imperméable Fissuré — Humide | Nappe perchée + zones d'altération → EG potentiellement élevé | ~8 000 |
| `B-L` | Bassin sédimentaire — Libre | Nappe libre peu profonde → WL élevé, gonflement possible | ~4 000 |
| `n/a` | Non classifié / manque de données | Pas d'information hydrogéologique — repli national | ~5 000 |
| *(4ᵉ type)* | *(à vérifier en DB)* | — | ~12 000 |

**Note sur les données** : La table actuelle ne dispose pas de champ `description` renseigné. Pour une intégration complète, il faudra obtenir la légende officielle de la carte hydrogéologique du Togo (DGIH — Direction Générale de l'Inventaire Hydrogéologique) auprès des services togolais.

#### 3.5.3 Implémentation Python : mise à jour de `compute_hierarchical_prior`

La modification porte sur la signature de la fonction et l'ajout d'un dictionnaire de correspondance maille → classe hydrogéologique :

```python
def compute_hierarchical_prior(
    train_values: np.ndarray,
    train_contexts: list[str],        # contexte_complet 4-part : ZONE|PEDO|RGA|GEO
    grid_contexts: list[str],
    hydro_lookup: dict[str, str],     # NEW : {maille_code → libelle_hydro}
    train_maille_codes: list[str],    # NEW : codes des mailles d'entraînement
    min_pts: int = 5,
) -> dict[str, float]:
    """
    Dérive hiérarchique avec 5 niveaux de repli.
    
    NOUVEAUTÉ v2 : le niveau 4 utilise la classe hydrogéologique
    comme filet de sécurité avant la moyenne nationale.
    
    Paramètres
    ----------
    hydro_lookup : {maille_code → libelle_hydrogéologique}
        Obtenu via :
        SELECT m.code, COALESCE(hg.libelle, 'INCONNU') AS hydro_class
        FROM atlas.mailles m
        LEFT JOIN atlas.hydrogeologie hg
            ON ST_Intersects(ST_Centroid(m.geom), hg.geom)
        
    train_maille_codes : list[str]
        Codes maille des sondages d'entraînement (même longueur que train_values).
    
    Références
    ----------
    Seed et al. (1962) "The swelling and shrinkage of clays", Géotechnique 12(4).
    Chassagneux & Chaussier (1996) — Cartes géotechniques des dépôts meubles.
    """
    priors = {}
    global_mean = float(np.nanmean(train_values))
    
    # Pré-calcul : classe hydro de chaque sondage d'entraînement
    train_hydro = [hydro_lookup.get(code, 'INCONNU') for code in train_maille_codes]
    
    # ── Niveau 1 : contexte complet ZONE|PEDO|RGA|GEO|HYDRO ──────────────────
    # On enrichit le contexte avec la classe hydro pour ce niveau
    train_ctx_hydro = [
        f"{ctx}|{hydro}"
        for ctx, hydro in zip(train_contexts, train_hydro)
    ]
    for ctx_h in set(train_ctx_hydro):
        mask = np.array([c == ctx_h for c in train_ctx_hydro])
        pts = train_values[mask]
        if np.sum(mask) >= min_pts:
            priors[ctx_h] = float(np.nanmean(pts))
    
    # ── Niveau 2 : ZONE | PEDO (sans RGA, GEO, HYDRO) ───────────────────────
    for ctx in set(train_contexts):
        parent = '|'.join(ctx.split('|')[:2])   # 'ZONE|PEDO'
        key_l2 = f"{ctx}|L2"                    # marqueur de repli
        if key_l2 not in priors:
            mask = np.array([c.startswith(parent) for c in train_contexts])
            pts = train_values[mask]
            if np.sum(mask) >= min_pts:
                priors[key_l2] = float(np.nanmean(pts))
    
    # ── Niveau 3 : PEDO seule ────────────────────────────────────────────────
    all_ctxs = set(grid_contexts + train_contexts)
    for ctx in all_ctxs:
        key_l3 = f"{ctx}|L3"
        if key_l3 not in priors:
            ped = ctx.split('|')[1] if '|' in ctx else ctx
            mask = np.array([c.split('|')[1] == ped for c in train_contexts if '|' in c])
            pts = train_values[mask]
            if np.sum(mask) >= min_pts:
                priors[key_l3] = float(np.nanmean(pts))
    
    # ── Niveau 4 : HYDRO seule (NEW) ─────────────────────────────────────────
    for ctx in all_ctxs:
        key_l4 = f"{ctx}|L4"
        if key_l4 not in priors:
            # Récupérer la classe hydro pour ce contexte
            # (heuristique : on cherche parmi les sondages d'entraînement
            #  qui ont ce préfixe de contexte, et on prend leur classe hydro)
            hydro = None
            for tc, th in zip(train_contexts, train_hydro):
                if tc == ctx:
                    hydro = th
                    break
            
            if hydro is None or hydro == 'INCONNU':
                priors[key_l4] = global_mean
                continue
            
            mask = np.array([h == hydro for h in train_hydro])
            pts = train_values[mask]
            if np.sum(mask) >= min_pts:
                priors[key_l4] = float(np.nanmean(pts))
            else:
                priors[key_l4] = global_mean   # ── Niveau 5 : national ──
    
    return priors


def get_prior_for_maille(
    maille_ctx: str,
    maille_code: str,
    priors: dict[str, float],
    hydro_lookup: dict[str, str],
    global_mean: float,
) -> tuple[float, int]:
    """
    Sélectionne le prior le plus précis disponible pour une maille.
    Retourne (valeur_prior, niveau_utilisé).
    
    Cette fonction encapsule la logique de repli pour la prédiction.
    """
    hydro = hydro_lookup.get(maille_code, 'INCONNU')
    
    # Tentative niveau 1 (contexte complet + hydro)
    k1 = f"{maille_ctx}|{hydro}"
    if k1 in priors:
        return priors[k1], 1
    
    # Tentative niveau 2 (ZONE|PEDO)
    k2 = f"{maille_ctx}|L2"
    if k2 in priors:
        return priors[k2], 2
    
    # Tentative niveau 3 (PEDO)
    k3 = f"{maille_ctx}|L3"
    if k3 in priors:
        return priors[k3], 3
    
    # Tentative niveau 4 (HYDRO)
    k4 = f"{maille_ctx}|L4"
    if k4 in priors:
        return priors[k4], 4
    
    # Niveau 5 : moyenne nationale
    return global_mean, 5
```

#### 3.5.4 Requête SQL pour charger le lookup hydrogéologique

```python
# À ajouter dans run_ked_vbs_ip_wl_wp_horizons.py, section "chargement des données"

def load_hydro_lookup(conn) -> dict[str, str]:
    """
    Charge la correspondance maille_code → classe hydrogéologique.
    
    Utilise ST_Intersects sur le centroïde de chaque maille.
    Temps estimé : ~3s pour 29 407 mailles (index spatial requis).
    """
    query = """
    SELECT 
        m.code                                    AS maille_code,
        COALESCE(hg.libelle, 'INCONNU')           AS hydro_class
    FROM atlas.mailles m
    LEFT JOIN atlas.hydrogeologie hg
        ON ST_Intersects(ST_Centroid(m.geom), hg.geom)
    WHERE m.code IS NOT NULL;
    """
    df = pd.read_sql(query, conn)
    return dict(zip(df['maille_code'], df['hydro_class']))
```

**Optimisation** : ce lookup peut être mis en cache dans `atlas.v_contexte_geologique` (vue matérialisée SQL — section 3.2) pour éviter le ST_Intersects à chaque run KED. Le coût est un refresh de la vue (une fois après modification des polygones hydrogéologiques, ce qui est exceptionnel).

#### 3.5.5 Impact attendu et protocole de validation

**Paramètre le plus impacté** : `EG` (équivalent granulométrique = gonflement libre) car :
```
EG = f(minéralogie gonflante × état_hydrique_initial)
   → HYDRO capte directement le second facteur
   → Zones CSIF-H : nappe haute → matrice argileuse hydratée → EG élevé
   → Zones B-L    : nappe libre → comportement hydrique différent
```

**Protocole de validation LOO-CV proposé** :

```python
# Comparer les RMSE LOO des deux versions de compute_hierarchical_prior :

metrics = {}
for version, func in [('KED-4niveaux', prior_4levels), 
                       ('KED-5niveaux+hydro', prior_5levels)]:
    for param in ['vbs', 'ip', 'wl', 'wp', 'eg']:
        for horizon in ['h1', 'h2', 'h3']:
            loo_rmse = run_loo_cv(func, param, horizon)
            metrics[(version, param, horizon)] = loo_rmse

# Critère de succès :
# RMSE_KED-5niveaux(EG) < RMSE_KED-4niveaux(EG)  → contribution validée
# Si aucun gain → l'hydrogéologie n'apporte rien à ce niveau de données (N=572)
# Publier les deux résultats honnêtement.
```

**Hypothèse de recherche (falsifiable)** :

> *H₀ : La classe hydrogéologique n'améliore pas significativement le LOO-RMSE du KED-H pour EG et WL (α=0.05, test de Wilcoxon sur les erreurs LOO).*  
> *H₁ : L'ajout de HYDRO comme niveau 4 réduit le LOO-RMSE d'EG de plus de 5%.*

Si H₀ est rejetée, la contribution est publiable comme amélioration méthodologique du KED-H dans le contexte du Togo.

#### 3.5.6 Honnêteté scientifique — Ce que l'hydrogéologie NE peut pas apporter

| Limite | Raison |
|--------|--------|
| 14 polygones seulement | Résolution trop grossière pour capturer la variabilité locale (rayon de corrélation KED ≈ 80-120 km >> 200 km par polygone hydro) |
| Descriptions non renseignées en DB | La table `atlas.hydrogeologie` n'a pas de champ `description` rempli — les libellés seuls (`CSIF-H`, `B-L`) ne permettent pas de reconstruire les paramètres hydrodynamiques |
| N=572 sondages | Avec seulement 14 classes hydro, certaines classes auront < 5 sondages → repli national automatique → contribution nulle pour ces zones |
| Saisonnalité non capturée | L'hydrogéologie donne un état moyen annuel, pas la variabilité saisonnière (nappe haute en avril, basse en novembre) |

**Recommandation** : si H₀ n'est pas rejetée, utiliser l'hydrogéologie uniquement comme **feature Ridge dans RK SCORPAN** (où son signal peut s'exprimer continûment, pas en classes discrètes), et non dans la dérive hiérarchique KED.

---

## Partie IV — Innovation de Rupture : Géotechnique Sans Laboratoire

### 4.1 Le problème fondamental que résout cette innovation

Aujourd'hui, la chaîne est :
```
Terrain (forage) → Transport échantillon → Laboratoire (2-6 semaines) → VBS, IP, WL…
```

Coût : 300–1200 € par sondage complet. Au Togo, inaccessibilité de nombreuses zones.

**L'innovation Intrepid Core** : remplacer le laboratoire par des signatures spectrales et physiques mesurables à distance ou in-situ instantanément.

### 4.2 Fondements scientifiques : Pedotransfer Functions (PTF)

Les relations entre minéralogie argileuse et propriétés géotechniques sont **connues depuis les années 1950** :

**Relations établies :**
```
VBS = f(teneur_argile, activité_argile)
    Référence : Letourneur & Michel (1971), "Mécanique des sols appliquée"

IP ≈ 0.73 × (WL - 20)   [droite de Casagrande]
    Référence : Casagrande (1948), Proceedings ASCE

WL ≈ f(teneur_argile × activité_minérale)
    Activité = IP / %_argile_< 2µm
    Référence : Skempton (1953), "The Colloidal Activity of Clays"

EG ≈ f(VBS, teneur_smectite)
    Référence : Chassagneux & Chaussier (1996)
```

**Relations modernes entre spectroscopie et minéralogie :**
```
Teneur en argile → absorptions à 2200nm (Al-OH), 2300nm (Mg-OH)
Smectite        → absorption caractéristique à 1400nm, 1900nm (eau)
Kaolinite       → doublet à 2160nm / 2200nm
Goethite        → absorption à 480nm (couleur rouge latérites)
    
Références :
  Viscarra Rossel et al. (2006), "Using data mining to model and interpret soil
  diffuse reflectance spectra", Geoderma
  
  Ben-Dor & Banin (1995), "Near-infrared analysis as a rapid method to simultaneously
  evaluate several soil properties", Soil Sci. Soc. Am. J.
```

### 4.3 Point de vigilance 1 — Le paradoxe de la profondeur

**Critique légitime :** Sentinel-2 ne voit que les 2 premiers millimètres de sol (optique) ou 30 cm maximum (SAR). Or la géotechnique s'intéresse aux horizons à 1m, 1.5m, 2m.

**Réponse empirique (vérifiée dans notre DB) :**

> Sur les **101 sondages** avec profils complets H1(1m) + H3(2m) disponibles dans Atlas :
> - Corrélation VBS_H1 / VBS_H3 = **r = 0.511** (p < 0.001)
> - Différence moyenne H1-H3 = **1.95 g/100g** (sur plage 0-20)
>
> Ce r = 0.51 confirme une **cohérence verticale partielle**. Dans les sols résiduels d'altération in-situ (gneiss, micaschistes, orthogneiss = 53% du territoire togolais), la minéralogie argileuse de surface est génétiquement liée à celle de la profondeur — le signal spectral de surface est donc un prédicteur **partiel mais réel** de la géotechnique en profondeur.

**Limitation honnête et solution :**

```
Zones problématiques (signal surface ≠ géotechnique profonde) :
  → Cuirasses latéritiques : atlas.unites_geologiques.type_sols LIKE '%Cuirasse%'
    = 2 464 mailles (8.4%) → MASQUER ou SIGNALER incertitude haute
  → Alluvions récentes : formations alluvionnaires
    = 3 267 mailles (11.1%) → profil vertical discontinu

Zones favorables (cohérence verticale attendue) :
  → Sols résiduels sur gneiss/orthogneiss/micaschistes = 53%
  → Sols ferrugineux profonds = 22%

Stratégie : deux modèles VfS séparés selon atlas.unites_geologiques
  - Modèle A : sols résiduels (N ≈ 80 sondages)  ← performant
  - Modèle B : zones alluviales/cuirasses (N ≈ 23) ← incertitude haute
```

**Formulation pour la soutenance :** *"Le modèle VfS est appliqué avec un masque géologique : les formations résiduelles (53% du territoire, r_vertical = 0.51) bénéficient d'une prédiction avec incertitude quantifiée. Les zones alluvionnaires et les cuirasses sont marquées comme 'prédiction à confirmer par sondage'."*

### 4.4 Point de vigilance 2 — Malédiction dimensionnelle : PLS, pas Random Forest

**Critique légitime :** Avec N ≈ 100-120 sondages et 20+ indices spectraux potentiels, Random Forest mémorisera le bruit (overfitting).

**Solution : Régression PLS (Partial Least Squares)**

La PLS est la **norme absolue** en spectroscopie des sols depuis Viscarra Rossel et al. (2006). Elle est conçue précisément pour N petit avec de nombreuses features correlées (spectres).

```python
# scikit-learn : sklearn.cross_decomposition.PLSRegression

from sklearn.cross_decomposition import PLSRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import r2_score, mean_squared_error

# Modèle PLS avec 3-5 composantes latentes
# (chaque composante = direction de variance spectrale corrélée à VBS)
pls = PLSRegression(n_components=3)  # à optimiser par CV

# Validation LOO rigoureuse
loo = LeaveOneOut()
preds = []
for train_idx, test_idx in loo.split(X_spectral):
    pls.fit(X_spectral[train_idx], y_VBS[train_idx])
    preds.append(pls.predict(X_spectral[test_idx])[0])

loo_rmse = np.sqrt(mean_squared_error(y_VBS, preds))
# → Comparer à LOO-RMSE KED (3.06) → si PLS_RMSE < 3.06, c'est une contribution
```

**Quand utiliser Random Forest :**
- Seulement si N > 200 sondages ET avec ACP préalable (3-5 composantes)
- Avec validation spatiale bloc-CV (pas LOO — trop optimiste pour données spatiales)

**Features à retenir :** 3-6 indices maximum (plus interprétables, moins d'overfitting) :
- `Clay_Index = B11/B12` ← le plus informé sur la minéralogie argileuse
- `SWIR_ratio = (B11-B12)/(B11+B12)` ← saisonnalité argile/eau
- `Iron_Oxide = B04/B02` ← proxy goethite/latérite (anticorrélé à VBS)
- `NDVI` ← végétation = proxy humidité/MO → affecter WL

### 4.5 Architecture VfS — Google Earth Engine (pipeline recommandé)

**Rejet de l'approche par téléchargement direct.** Pourquoi : Togo zone tropicale = couverture nuageuse > 60% sur la plupart des images individuelles. Sentinel-2 nécessite une correction atmosphérique et un masquage nuage rigoureux. Gérer ces pré-traitements en local est coûteux (>100 GB par scène).

**Solution recommandée : Google Earth Engine (GEE)**

```python
# scripts/vfs_extract_spectral.py
# Extraction automatique des indices spectraux via GEE API
# Déclenchée à chaque nouveau sondage importé

import ee
import geemap
import pandas as pd

ee.Initialize()  # nécessite compte GEE (gratuit recherche)

def extract_spectral_indices_for_sondages(sondages: list[dict]) -> pd.DataFrame:
    """
    Pour chaque sondage {id, lon, lat}, extrait les indices spectraux
    depuis un composite Sentinel-2 sans nuage (GEE, médiane annuelle).
    
    Évite tout téléchargement de scène brute.
    Actualise automatiquement à chaque import de sondage.
    """
    # 1. Composite Sentinel-2 annuel sans nuage (médiane sur 12 mois)
    s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterDate('2023-01-01', '2024-12-31')
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            .filterBounds(ee.Geometry.Rectangle([
                -0.2, 6.0, 1.9, 11.2  # bbox Togo
            ]))
            .median()
            .select(['B4','B8','B11','B12'])  # Rouge, NIR, SWIR1, SWIR2
    )
    
    # 2. Calculer les indices
    clay_index  = s2.select('B11').divide(s2.select('B12')).rename('clay_index')
    swir_ratio  = s2.normalizedDifference(['B11','B12']).rename('swir_ratio')
    ndvi        = s2.normalizedDifference(['B8','B4']).rename('ndvi')
    iron_oxide  = s2.select('B4').divide(s2.select('B8')).rename('iron_oxide')
    
    image = ee.Image.cat([clay_index, swir_ratio, ndvi, iron_oxide])
    
    # 3. Extraire aux coordonnées des sondages
    points = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point([s['lon'], s['lat']]),
                   {'sondage_id': s['id']})
        for s in sondages
    ])
    
    result = image.sampleRegions(
        collection=points,
        scale=20,       # résolution Sentinel-2 SWIR = 20m
        geometries=True
    )
    
    return geemap.ee_to_df(result)
```

**Intégration dans le pipeline auto-amélioration :**
```
Nouveau sondage importé
    ↓
trigger trg_enqueue_ai_jobs_after_sondage
    ↓
ai_job_queue → job_type='extract_spectral_gee'
    ↓
worker Python → vfs_extract_spectral.py (GEE, < 30 secondes)
    ↓
Stockage dans atlas.sondage_spectral_features (nouvelle table)
    ↓
Recalibration PLS si N_nouveaux > seuil → vfs_calibrate_pls.py
    ↓
Mise à jour VBS_VfS prédit comme feature SCORPAN dans v_scorpan_features
```

### 4.6 Intégration des couches géologiques dans les calculs — Réponse explicite

> **Question :** Est-ce que pédologie + risque + géologie + hydrogéologie seront utilisées pour les **calculs scientifiques** ?

**Oui, voici comment chacune sera utilisée :**

| Couche | Utilisation dans les calculs |
|---|---|
| `unites_pedologiques` | ✅ **Déjà active** : dérive du KED (`pedological_drift_priors`) |
| `unites_geologiques` | ✅ **Proposée** : (1) niveau 4 de la dérive hiérarchique KED, (2) masque géologique VfS (sols résiduels vs cuirasses), (3) feature catégorielle dans Ridge SCORPAN |
| `risque_gonflement` | ✅ **Proposée** : (1) niveau 3 de la dérive hiérarchique, (2) variable cible de calibration pour VfS → corréler Clay_Index à classe RGA directement |
| `hydrogeologie` | ✅ **Proposée** : (1) feature dans Ridge SCORPAN (profondeur nappe → saturation → gonflement), (2) niveau 5 dérive hiérarchique. Particulièrement critique pour EG (essai gonflement = fonction de la teneur en eau) |

**Justification scientifique de l'hydrogéologie dans EG :**
```
EG (potentiel gonflement) = f(argile gonflante, teneur en eau initiale)
                          = f(minéralogie) × f(état hydrique)

L'hydrogéologie encode l'état hydrique probable du sol → premier facteur
de variance de EG après la minéralogie.
Référence : Seed et al. (1962) "The swelling and shrinkage of clays",
Géotechnique 12(4), 329-342.
```

### 4.7 Point de vigilance 3 — Scalabilité MTGP : clarification

**Clarification critique :** Le bottleneck O(N³) d'un GP s'applique à N = **données d'entraînement**, pas aux données de prédiction.

```
Situation réelle dans Atlas :
  N_entraînement = ~300-600 points (sondages × 5 paramètres)
  N_prédiction   = 29 407 mailles

  Inversion de la matrice de Gram :
  - 600×600 matrice → triviale (< 1s)
  - O(600³) = 2.16 × 10⁸ ops → pas un problème

  Prédiction :
  - O(N_pred × N_train) = O(29407 × 600) = 17.6M ops → < 1s avec NumPy
```

**Le vrai risque :** mauvais conditionnement de la matrice de covariance conjointe quand les corrélations inter-paramètres approchent 1.0. Solution : `gpflow.config.set_default_jitter(1e-4)` + décomposition de Cholesky avec régularisation.

**SVGP recommandé pour** : si N_train dépasse 2000 (après ~300 nouveaux sondages). Avec M=50 inducing points, `GPflow.models.SVGP` réduit à O(NM²) = O(2000×50²) = trivial.
```

---

## Partie V — Multi-Task Gaussian Process (MTGP)

### 5.1 Motivation : les paramètres ne sont pas indépendants

Les corrélations mesurées (vérifiées dans la DB) :
```
r(IP, WL)  = 0.802  ← très forte
r(IP, EG)  = 0.742  ← forte
r(WL, EG)  = 0.741  ← forte
r(VBS, EG) = 0.350  ← modérée
r(VBS, IP) = 0.328  ← modérée
```

**Ce que cela signifie :** quand on prédit IP à un endroit, on sait déjà quelque chose sur WL et EG à cet endroit. Modéliser indépendamment est **sous-optimal**.

### 5.2 Le Modèle de Coregionalisation Linéaire (LCM)

Référence fondamentale : Journel & Huijbregts (1978), "Mining Geostatistics". Wackernagel (2003), "Multivariate Geostatistics".

```
Principe : chaque paramètre géotechnique est modélisé comme
une combinaison linéaire de processus gaussiens latents

[VBS(s)]   [a11  0    0  ] [G1(s)]
[IP (s)] = [a21  a22  0  ] [G2(s)]
[WL (s)]   [a31  a32  a33] [G3(s)]
[WP (s)]   [a41  a42  a43] [...]
[EG (s)]   [a51  a52  a53]

où G1, G2, G3 sont des Processus Gaussiens indépendants
   aij sont les coefficients de coregionalisation (matrice A)
   A = décomposition de Cholesky de la matrice de covariance co-krigeage
```

**Avantage pratique :**
- Si VBS a 204 mesures H1 et EG n'en a que 101 → VBS aide à prédire EG
- Réduit le LOO-RMSE de EG en "empruntant" la structure spatiale de VBS/IP
- Cohérence physique : les cartes VBS et IP ne peuvent pas se "contredire"

### 5.3 Implémentation minimale avec GPflow / scikit-gstat

```python
# pip install gpflow tensorflow scikit-gstat

import gpflow
import numpy as np

class MultitaskGPGeotechnique:
    """
    Co-krigeage des paramètres géotechniques corrélés.
    
    Basé sur : Intrinsic Coregionalization Model (ICM)
    Références :
      - Álvarez et al. (2012) "Kernels for Vector-Valued Functions", 
        Foundations & Trends in ML
      - Goovaerts (1997) "Geostatistics for Natural Resources Evaluation"
    """
    def __init__(self, n_outputs: int = 5, rank: int = 2):
        # rank = nombre de processus latents (< n_outputs)
        # rank=2 car les corrélations suggèrent 2 dimensions principales
        # (axe activité argileuse VBS/IP/EG + axe plasticité WL/WP)
        self.n_outputs = n_outputs
        self.rank = rank
    
    def build_model(self, X_train, Y_train):
        """
        X_train : (N, 3) → [lon, lat, depth]
        Y_train : (N, 5) → [VBS, IP, WL, WP, EG] avec NaN là où non mesuré
        """
        # Noyau de base : Matérn 3/2 (adapté aux discontinuités géologiques)
        kernel_base = gpflow.kernels.Matern32(active_dims=[0, 1])
        
        # Coregionalization matrix
        coreg = gpflow.kernels.Coregion(
            output_dim=self.n_outputs,
            rank=self.rank,
            active_dims=[2]  # dimension "output index"
        )
        
        kernel = kernel_base * coreg
        
        # Gestion des NaN : masquer dans la vraisemblance
        model = gpflow.models.VGP(
            (X_train, Y_train),
            kernel=kernel,
            likelihood=gpflow.likelihoods.SwitchedLikelihood([
                gpflow.likelihoods.Gaussian() for _ in range(self.n_outputs)
            ])
        )
        return model
```

---

## Partie VI — Synthèse des Propositions et Priorisation

### 6.1 Tableau de priorisation R&D

| # | Innovation | Type | Effort | Impact LOO-RMSE | Risque scientifique |
|---|---|---|---|---|---|
| 1 | **Fusion KED-RK Cascade** | Fusion modèles | 3 jours | Élevé (-20 à -40%) | Faible (bases solides) |
| 2 | **Dérive hiérarchique zones+pédo+risque** | Extension KED | 2 jours | Moyen (-10 à -20%) | Faible |
| 3 | **Multi-Task Gaussian Process** | Nouveau modèle | 1 semaine | Moyen-Élevé (EG/WP) | Moyen |
| 4 | **VBS/IP depuis Sentinel-2 (VfS)** | Deep innovation | 2-3 semaines | ??? (évaluation) | Élevé (exploratoire) |

### 6.2 Architecture cible intégrée

```
                    DONNÉES TERRAIN          DONNÉES SATELLITAIRES
                    (123 sondages)           (Sentinel-2, SAR)
                         │                        │
                         ▼                        ▼
              ┌──────────────────┐    ┌────────────────────┐
              │   L1 — KED       │    │  L4 — VfS (RUPTURE)│
              │ Dérive hiérar-   │    │  Clay Index         │
              │ chique 3 niveaux │    │  SWIR ratio         │
              │ (zones + pédo    │    │  SAR texture        │
              │  + RGA)          │    │                    │
              └────────┬─────────┘    └──────────┬─────────┘
                       │                         │
                       ▼                         ▼
              ┌──────────────────┐    ┌────────────────────┐
              │   L2 — RK SCORPAN│    │  L4 comme covariable│
              │ + VfS comme      │◄───│  supplémentaire RK  │
              │ feature SCORPAN  │    └────────────────────┘
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────────────────────────────┐
              │   FUSION KED-RK Cascade (Bayésienne)     │
              │   Z*(s) = w_KED×Z_KED + w_RK×Z_RK        │
              │   w = 1/σ² (incertitude locale)           │
              └────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────────────────────────────┐
              │   MTGP (co-krigeage multi-paramètres)    │
              │   Cohérence physique VBS-IP-WL-WP-EG     │
              └────────────────────────────────────────────┘
                       │
                       ▼
             29 407 mailles × 5 paramètres × 3 horizons
             = 441 105 valeurs avec intervalles de confiance
```

### 6.3 Plan d'implémentation — Innovations de rupture

```
BLOC A — Données et contexte géologique (prérequis pour tout le reste)
  □ Créer atlas.v_contexte_geologique (SQL ci-dessus, section 3.2)
    → Intègre zones_etude + unites_pedologiques + risque_gonflement
       + unites_geologiques + hydrogeologie
  □ Implémenter la dérive hiérarchique 5 niveaux dans run_ked_*.py
    → Remplace la dérive pédologique simple actuelle
    → Métriques : LOO-RMSE KED_actuel vs KED_hiérarchique (H1/H2/H3)
  □ Documenter résultats → mémoire section "Amélioration du KED"

BLOC B — Fusion KED-RK Cascade Bayésienne
  □ Créer scripts/ked_rk_fusion.py (algorithme section 2.2)
  □ Récupérer σ²_KED depuis PyKrige (ok.sigma2 après execute)
  □ Récupérer σ²_RK depuis PyKrige sur les résidus RK
  □ Appliquer la fusion bayésienne par incertitude locale
  □ Métriques : LOO-RMSE fusion vs KED seul vs RK seul
  □ Documenter → mémoire section "Fusion optimale KED-RK"

BLOC C — Géotechnique par télédétection (DeepTech innovation)
  □ Télécharger Sentinel-2 sur le Togo (ESA Copernicus Hub, gratuit)
    API : https://scihub.copernicus.eu/ ou Google Earth Engine
  □ Calculer Clay_Index = B11/B12, SWIR_ratio, NDVI pour chaque sondage
  □ Entraîner Random Forest : Clay_Index → VBS (LOO-CV sur sondages)
  □ Si r² > 0.4 → ajouter comme feature supplémentaire dans RK
  □ Documenter → mémoire section "Vers la géotechnique sans laboratoire"

BLOC D — Multi-Task Gaussian Process (co-krigeage)
  □ Installer GPflow : pip install gpflow tensorflow
  □ Modéliser VBS + IP + EG conjointement (ICM rank=2)
  □ Exploiter corrélations r(IP,EG)=0.74, r(VBS,EG)=0.35
  □ Métriques : LOO-RMSE EG avec MTGP vs EG seul (gain attendu)
  □ Documenter → mémoire section "Co-krigeage multi-paramètres"
```

### 6.4 Roadmap plateforme (recommandations techniques complémentaires)

Ces items ne sont pas des innovations scientifiques mais des améliorations critiques de la plateforme qui **conditionnent la capacité du système à s'auto-améliorer** lorsque de nouvelles données sont importées.

```
BLOC E — Auto-amélioration sur import (prérequis opérationnel)
  □ Trigger pg_notify → worker Python → recalcul KED+RK automatique
    → Sans ce bloc, chaque import de nouveaux sondages nécessite
      une intervention manuelle pour recalculer les modèles
    → Implémenter dans scripts/pipeline_worker.py
    → Câbler run_ked_vbs_ip_wl_wp_horizons.py + compute_loo_cv_rk.py
      dans le match job_type.as_str() de services/api-geo/src/ai_jobs.rs

BLOC F — Qualité et CI/CD scientifique
  □ Tests de régression LOO-RMSE sur git push (CI/CD L1/L2)
    → Empêche une migration de dégrader silencieusement la précision
    → Seuils : LOO-RMSE VBS H1 < 4.0, IP H1 < 12.0, EG H1 < 2.5

BLOC G — Performance API (experience utilisateur)
  □ Index ou matview dédié sur v_thematic_ai_geotech
    → Temps de réponse RK actuel : ~30s → cible < 5s
  □ LOO-CV analytique PyKrige (formule O(N²)) pour remplacer
    les N itérations O(N³) actuelles

BLOC H — Complétion du pipeline existant
  □ Recalculer LOO-CV des 3 horizons EG avec prec_dry/prec_wet
    (le modèle SCORPAN complet — fait pour H1 mais pas encore
    mis à jour pour H2/H3 avec le nouveau v_scorpan_features)
  □ Câbler microservices api-infer et api-opti dans main.rs
```

**Interdépendances critiques :**
```
BLOC A (contexte géologique) → alimente BLOC B et BLOC D
BLOC C (Sentinel-2) → alimente BLOC B comme feature SCORPAN
BLOC E (trigger auto) → permet à BLOC A/B/C/D de s'exécuter automatiquement
                         après chaque import de nouveaux sondages
```

---

## Partie VII — Position dans la littérature scientifique

### Ce qui existe déjà

| Méthode | Références | État |
|---|---|---|
| KED pédologique | Odeh et al. (1994) — Geoderma | Classique, notre L1 |
| Regression Kriging | Hengl et al. (2007) | Classique, notre L2 |
| Co-krigeage (LCM) | Journel & Huijbregts (1978) | Classique, proposé L5 |
| RF + krigeage résidus | Hengl et al. (2018) — PLOS ONE | Récent, similaire L2 |
| VIS-NIR → propriétés sol | Viscarra Rossel (2006) | Bien établi en pédologie |
| Sentinel-2 → teneur argile | Castaldi et al. (2019) — RSE | Récent, jamais en géotechnique Afrique |

### Ce qui est NOUVEAU dans nos propositions

1. **Fusion KED-RK par incertitude bayésienne locale** : Aucun article publié en géotechnique tropicale n'utilise cette combinaison spécifique. L'adaptation aux sols du Togo avec les variables SCORPAN et les zones pédologiques locales est **originale**.

2. **Sentinel-2 → VBS au Togo** : À notre connaissance, **aucune étude publiée** ne relie les indices spectraux Sentinel-2 à la Valeur au Bleu de Méthylène pour des sols tropicaux togolais. C'est une première.

3. **Dérive géologique hiérarchique 3 niveaux** : L'intégration simultanée zones géomorphologiques + unités pédologiques + risque Chassagneux comme variable de dérive structurée n'est pas documentée en Afrique de l'Ouest.

### Mention dans le mémoire

Ces travaux peuvent être présentés comme :

> *"Cette étude propose trois innovations méthodologiques pour améliorer la cartographie géotechnique nationale en contexte de données rares : (1) une fusion bayésienne KED-RK adaptative par incertitude locale, (2) une dérive géologique hiérarchique multi-couches, et (3) une approche exploratoire de prédiction géotechnique par télédetection satellitaire. Ces méthodes, appliquées au Togo pour la première fois, contribuent à la littérature sur la cartographie géotechnique des sols tropicaux à faible densité d'échantillonnage."*

---

## Références scientifiques clés

- **Casagrande, A. (1948)**. "Classification and identification of soils." *Transactions ASCE*, 113, 901-930.
- **Chassagneux, D. & Chaussier, J.B. (1996)**. Carte géotechnique des risques de gonflement — Méthodologie. *BRGM*.
- **Chilès, J.P. & Delfiner, P. (2012)**. *Geostatistics: Modeling Spatial Uncertainty*, 2nd ed. Wiley.
- **Goovaerts, P. (1997)**. *Geostatistics for Natural Resources Evaluation*. Oxford University Press.
- **Hengl, T. et al. (2007)**. "About regression-kriging: From equations to case studies." *Computers & Geosciences*, 33(10), 1301-1315.
- **Hengl, T. et al. (2018)**. "Random forest as a generic framework for predictive modeling of spatial and spatio-temporal variables." *PLOS ONE*, 13(10).
- **Journel, A.G. & Huijbregts, C.J. (1978)**. *Mining Geostatistics*. Academic Press.
- **McBratney, A.B. et al. (2003)**. "On digital soil mapping." *Geoderma*, 117, 3-52.
- **Skempton, A.W. (1953)**. "The Colloidal Activity of Clays." *3rd Int. Conf. SMFE*, London.
- **Viscarra Rossel, R.A. et al. (2006)**. "Using data mining to model and interpret soil diffuse reflectance spectra." *Geoderma*, 128, 312-330.
- **Wackernagel, H. (2003)**. *Multivariate Geostatistics*, 3rd ed. Springer.
- **Castaldi, F. et al. (2019)**. "Evaluating the capability of the Sentinel 2 data for soil organic carbon prediction in croplands." *Remote Sensing of Environment*, 223, 234-243.
