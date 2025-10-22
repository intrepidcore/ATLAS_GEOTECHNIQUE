# 🗺️ Cartes Thématiques - Métriques Géotechniques Avancées

**Date** : 2025-10-19  
**Version** : 1.5.0  
**Focus** : Granulométrie, Atterberg, Bleu de Méthylène, Proctor, Gonflement

---

## 📋 Table des Matières

1. [Vue d'ensemble des métriques](#vue-densemble-des-métriques)
2. [Granulométrie](#1-granulométrie)
3. [Limites d'Atterberg](#2-limites-datterberg)
4. [Bleu de Méthylène (VBS)](#3-bleu-de-méthylène-vbs)
5. [Proctor](#4-proctor)
6. [Potentiel de gonflement](#5-potentiel-de-gonflement)
7. [Architecture technique](#architecture-technique)
8. [Visualisations](#visualisations)
9. [Plan d'implémentation](#plan-dimplémentation)

---

## 📊 Vue d'ensemble des Métriques

### Contexte

Les cartes thématiques doivent permettre de visualiser les propriétés géotechniques des sols selon différentes métriques normalisées. Ces métriques sont essentielles pour :
- **Classification des sols** (GTR, USCS, LCPC)
- **Dimensionnement des ouvrages** (fondations, remblais)
- **Contrôle qualité** (compactage, traitement)
- **Évaluation des risques** (gonflement, tassement)

### Métriques Disponibles

| Catégorie | Paramètres | Unités | Usage |
|-----------|------------|--------|-------|
| **Granulométrie** | % passant à 80µm, 2mm, 20mm | % | Classification, drainage |
| **Atterberg** | WL, WP, IP | % | Plasticité, gonflement |
| **Bleu de Méthylène** | VBS | g/100g | Argilosité |
| **Proctor** | γd max, wopt | kN/m³, % | Compactage |
| **Gonflement** | eg | % | Risque gonflement |

---

## 1. Granulométrie

### Description

La granulométrie caractérise la distribution des tailles de grains dans un sol. Elle est déterminée par tamisage (particules > 80µm) et sédimentométrie (particules < 80µm).

### Paramètres Clés

#### 1.1 Pourcentage Passant à 80µm (Tamisat)

**Définition** : Fraction de particules fines (< 80µm = silts + argiles)

**Classes** :
- `< 12%` : Sol grenus propre (GW, GP, SW, SP)
- `12-50%` : Sol grenus avec fines (GW-GM, SW-SM)
- `> 50%` : Sol fin (ML, CL, MH, CH)

**Seuils de visualisation** :
```
Classe 1: 0-12%    → Vert foncé (gravier/sable propre)
Classe 2: 12-35%   → Vert clair (fines modérées)
Classe 3: 35-50%   → Jaune (fines importantes)
Classe 4: 50-70%   → Orange (sol fin)
Classe 5: > 70%    → Rouge (argile/limon)
```

**Carte thématique** :
- Type : Choroplèthe
- Palette : `Greens` inversé (vert = propre, rouge = argileux)
- Classification : Seuils personnalisés [12, 35, 50, 70]

#### 1.2 Pourcentage Passant à 2mm (Sable)

**Définition** : Fraction de particules < 2mm (sables + fines)

**Classes** :
- `< 50%` : Gravier dominant
- `50-85%` : Sable dominant
- `> 85%` : Fines dominantes

**Carte thématique** :
- Type : Choroplèthe
- Palette : `RdYlGn`
- Classification : Seuils [50, 85]

#### 1.3 Pourcentage Passant à 20mm

**Définition** : Fraction de particules < 20mm (tout sauf gros cailloux)

**Usage** : Évaluation de la présence de blocs/cailloux

**Carte thématique** :
- Type : Choroplèthe
- Palette : `Blues`
- Classification : Quantiles (5 classes)

### Visualisations Avancées

#### Histogrammes par Profondeur

**Description** : Distribution du % passant à 80µm selon la profondeur

**Implémentation** :
```typescript
interface GranulometryDepthData {
  depth_range: string  // "0-5m", "5-10m", "10-20m"
  passant_80um_avg: number
  passant_80um_stddev: number
  n_samples: number
}

// Affichage : Graphique en barres avec écart-type
```

**Carte associée** :
- Choroplèthe du % passant moyen
- Symboles proportionnels pour l'écart-type (variabilité)

#### Diagramme Ternaire (Sable-Limon-Argile)

**Description** : Classification USCS sur diagramme triangulaire

**Données requises** :
- % Sable (2mm - 80µm)
- % Limon (80µm - 2µm)
- % Argile (< 2µm)

**Implémentation** :
- Bibliothèque : D3.js ou Chart.js avec plugin ternaire
- Couleur par classe USCS

---

## 2. Limites d'Atterberg

### Description

Les limites d'Atterberg caractérisent la plasticité des sols fins. Elles définissent les transitions entre états (solide, plastique, liquide).

### Paramètres

#### 2.1 Limite de Liquidité (WL)

**Définition** : Teneur en eau (%) à la transition plastique → liquide

**Classes** :
- `< 35%` : Faible plasticité (ML, CL)
- `35-50%` : Plasticité moyenne (CL, ML)
- `50-90%` : Plasticité élevée (CH, MH)
- `> 90%` : Très haute plasticité (CH, OH)

**Carte thématique** :
```
Classe 1: < 35%    → Vert (faible)
Classe 2: 35-50%   → Jaune (moyenne)
Classe 3: 50-90%   → Orange (élevée)
Classe 4: > 90%    → Rouge (très élevée)
```

#### 2.2 Limite de Plasticité (WP)

**Définition** : Teneur en eau (%) à la transition solide → plastique

**Usage** : Calcul de l'indice de plasticité

**Carte thématique** :
- Type : Choroplèthe
- Palette : `Blues`
- Classification : Quantiles (5 classes)

#### 2.3 Indice de Plasticité (IP = WL - WP)

**Définition** : Plage de teneur en eau où le sol est plastique

**Classes (Classification GTR)** :
- `IP < 12` : Sol peu plastique (A1, A2)
- `12 ≤ IP < 25` : Sol moyennement plastique (A2, A3)
- `25 ≤ IP < 40` : Sol plastique (A3, A4)
- `IP ≥ 40` : Sol très plastique (A4)

**Carte thématique principale** :
```
Classe 1: IP < 12     → Vert foncé (peu plastique)
Classe 2: 12-25       → Vert clair (moyen)
Classe 3: 25-40       → Orange (plastique)
Classe 4: IP ≥ 40     → Rouge (très plastique)
```

**Importance** : Paramètre clé pour :
- Risque de gonflement/retrait
- Traficabilité des engins
- Traitement à la chaux/ciment

### Visualisations Avancées

#### Diagramme de Casagrande (WL vs IP)

**Description** : Classification USCS basée sur plasticité

**Axes** :
- X : Limite de liquidité (WL)
- Y : Indice de plasticité (IP)

**Ligne A** : IP = 0.73(WL - 20)

**Classes** :
- Au-dessus ligne A : Argiles (CL, CH)
- En-dessous ligne A : Limons (ML, MH)
- WL < 50 : Faible compressibilité (L)
- WL > 50 : Haute compressibilité (H)

**Implémentation** :
```typescript
interface AtterbergPoint {
  maille_code: string
  wl: number
  ip: number
  classification: 'CL' | 'CH' | 'ML' | 'MH' | 'CL-ML'
}

// Affichage : Scatter plot avec ligne A et zones colorées
```

#### Histogrammes IP par Région

**Description** : Distribution de l'IP par région administrative

**Implémentation** :
```sql
SELECT 
  adm1_name,
  AVG(ip) as ip_avg,
  STDDEV(ip) as ip_stddev,
  COUNT(*) as n_samples,
  -- Classes
  COUNT(CASE WHEN ip < 12 THEN 1 END) as n_faible,
  COUNT(CASE WHEN ip BETWEEN 12 AND 25 THEN 1 END) as n_moyen,
  COUNT(CASE WHEN ip BETWEEN 25 AND 40 THEN 1 END) as n_plastique,
  COUNT(CASE WHEN ip >= 40 THEN 1 END) as n_tres_plastique
FROM essais_atterberg
GROUP BY adm1_name;
```

---

## 3. Bleu de Méthylène (VBS)

### Description

La Valeur de Bleu de Méthylène (VBS) mesure la surface spécifique et l'activité des argiles. Elle quantifie l'argilosité d'un sol.

**Principe** : Adsorption de bleu de méthylène par les particules argileuses

### Paramètres

#### 3.1 VBS (Valeur de Bleu du Sol)

**Unité** : g de bleu / 100g de sol sec

**Classes (Norme NF P94-068)** :
- `VBS < 0.1` : Sol insensible à l'eau (sable, gravier propre)
- `0.1 ≤ VBS < 1.5` : Sol peu sensible (sable argileux)
- `1.5 ≤ VBS < 2.5` : Sol sensible (limon peu argileux)
- `2.5 ≤ VBS < 6` : Sol moyennement argileux
- `6 ≤ VBS < 8` : Sol argileux
- `VBS ≥ 8` : Sol très argileux

**Carte thématique** :
```
Classe 1: < 0.1      → Bleu très clair (insensible)
Classe 2: 0.1-1.5    → Bleu clair (peu sensible)
Classe 3: 1.5-2.5    → Bleu moyen (sensible)
Classe 4: 2.5-6      → Bleu foncé (moyen argileux)
Classe 5: 6-8        → Bleu très foncé (argileux)
Classe 6: ≥ 8        → Violet (très argileux)
```

**Palette personnalisée** :
```rust
pub fn vbs_palette() -> Vec<String> {
    vec![
        "#e0f3ff", // < 0.1
        "#b3d9ff", // 0.1-1.5
        "#66b3ff", // 1.5-2.5
        "#3399ff", // 2.5-6
        "#0066cc", // 6-8
        "#003d7a", // ≥ 8
    ].iter().map(|s| s.to_string()).collect()
}
```

### Corrélations

#### VBS vs IP

**Relation empirique** : IP ≈ 1.5 × VBS (pour argiles actives)

**Carte comparative** :
- Split-screen : VBS (gauche) vs IP (droite)
- Synchronisation zoom/pan
- Identification des anomalies (IP/VBS hors corrélation)

#### VBS vs % Passant 80µm

**Relation** : VBS augmente avec la fraction argileuse

**Scatter plot** :
- X : % Passant 80µm
- Y : VBS
- Couleur : Région (ADM1)
- Taille : Nombre d'essais

---

## 4. Proctor

### Description

L'essai Proctor détermine les caractéristiques de compactage optimales d'un sol : densité sèche maximale (γd max) et teneur en eau optimale (wopt).

**Types d'essai** :
- **Proctor Normal** : Énergie 0.6 MJ/m³
- **Proctor Modifié** : Énergie 2.7 MJ/m³ (plus représentatif du compactage routier)

### Paramètres

#### 4.1 Densité Sèche Maximale (γd max)

**Unité** : kN/m³ ou t/m³

**Classes (valeurs typiques)** :
- `< 16 kN/m³` : Sol très compressible (tourbe, argile molle)
- `16-18 kN/m³` : Sol compressible (limon, argile)
- `18-20 kN/m³` : Sol moyennement dense (sable limoneux)
- `20-22 kN/m³` : Sol dense (sable, gravier)
- `> 22 kN/m³` : Sol très dense (gravier, tout-venant)

**Carte thématique** :
```
Classe 1: < 16       → Rouge (faible)
Classe 2: 16-18      → Orange (moyen)
Classe 3: 18-20      → Jaune (bon)
Classe 4: 20-22      → Vert clair (très bon)
Classe 5: > 22       → Vert foncé (excellent)
```

**Palette** : `RdYlGn` (rouge = faible densité, vert = haute densité)

#### 4.2 Teneur en Eau Optimale (wopt)

**Unité** : %

**Classes** :
- `< 8%` : Sol grenus, peu sensible à l'eau
- `8-12%` : Sol sablo-limoneux
- `12-18%` : Sol limoneux
- `18-25%` : Sol argileux
- `> 25%` : Sol très argileux, sensible

**Carte thématique** :
- Type : Choroplèthe
- Palette : `Blues` (bleu clair = faible wopt, bleu foncé = wopt élevé)
- Classification : Seuils [8, 12, 18, 25]

### Visualisations Avancées

#### Courbes Proctor par Région

**Description** : Courbes γd = f(w) pour chaque région

**Implémentation** :
```typescript
interface ProctorCurve {
  adm1_name: string
  points: Array<{w: number, gamma_d: number}>
  gamma_d_max: number
  w_opt: number
}

// Affichage : Graphique multi-courbes avec points optimaux
```

#### Contrôle Qualité Compactage

**Description** : Carte de conformité au compactage

**Critère** : γd terrain ≥ 95% γd max Proctor

**Classes** :
- `< 90%` : Non conforme (rouge)
- `90-95%` : Limite (orange)
- `95-98%` : Conforme (vert clair)
- `> 98%` : Excellent (vert foncé)

**Données requises** :
```sql
CREATE TABLE controle_compactage (
  id UUID PRIMARY KEY,
  sondage_id UUID REFERENCES sondages(id),
  depth_m NUMERIC,
  gamma_d_terrain NUMERIC,  -- Densité mesurée
  gamma_d_proctor NUMERIC,  -- Densité Proctor de référence
  conformite_pct NUMERIC GENERATED ALWAYS AS 
    (gamma_d_terrain / gamma_d_proctor * 100) STORED
);
```

---

## 5. Potentiel de Gonflement

### Description

Le potentiel de gonflement (eg) caractérise l'aptitude d'un sol argileux à augmenter de volume en présence d'eau. C'est un paramètre critique pour les fondations.

**Essai** : Gonflement à l'œdomètre sous charge de 10 kPa

### Paramètres

#### 5.1 Indice de Gonflement (eg)

**Unité** : % (variation de hauteur)

**Classes (Classification LCPC)** :
- `eg < 0.5%` : Gonflement négligeable
- `0.5% ≤ eg < 2%` : Gonflement faible
- `2% ≤ eg < 5%` : Gonflement moyen
- `5% ≤ eg < 10%` : Gonflement fort
- `eg ≥ 10%` : Gonflement très fort

**Carte thématique** :
```
Classe 1: < 0.5%     → Vert foncé (négligeable)
Classe 2: 0.5-2%     → Vert clair (faible)
Classe 3: 2-5%       → Jaune (moyen)
Classe 4: 5-10%      → Orange (fort)
Classe 5: ≥ 10%      → Rouge (très fort)
```

**Palette** : `RdYlGn` inversé (vert = pas de risque, rouge = risque élevé)

### Corrélations et Prédictions

#### Corrélation eg vs IP

**Relation empirique** :
- IP < 12 → eg négligeable
- 12 < IP < 25 → eg faible à moyen
- IP > 40 → eg fort à très fort

**Formule approximative** : eg (%) ≈ 0.2 × IP - 2

**Carte prédictive** :
- Calculer eg estimé à partir de l'IP (si eg non mesuré)
- Afficher avec transparence réduite (données estimées)
- Légende : "Valeurs estimées à partir de l'IP"

#### Corrélation eg vs VBS

**Relation** : VBS > 6 → risque de gonflement élevé

**Carte de risque combinée** :
```
Risque faible:  VBS < 2.5 ET IP < 25
Risque moyen:   VBS 2.5-6 OU IP 25-40
Risque élevé:   VBS > 6 ET IP > 40
```

### Carte de Zonage du Risque Gonflement

**Description** : Carte réglementaire pour urbanisme

**Classes** :
- **Zone verte** : Risque négligeable (eg < 0.5%)
- **Zone jaune** : Risque faible à moyen (0.5% < eg < 5%)
- **Zone orange** : Risque fort (5% < eg < 10%)
- **Zone rouge** : Risque très fort (eg > 10%)

**Réglementation** :
- Zone rouge : Études géotechniques obligatoires (G2 AVP)
- Zone orange : Précautions constructives
- Zone jaune : Surveillance recommandée

**Export** :
- Format : GeoJSON + Shapefile
- Métadonnées : Norme, date, auteur
- Usage : PLU, PPR (Plan de Prévention des Risques)

---

## 🛠️ Architecture Technique

### Base de Données

#### Nouvelle Table : `essais_geotechniques`

```sql
CREATE TABLE essais_geotechniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id UUID REFERENCES sondages(id) ON DELETE CASCADE,
  depth_m NUMERIC NOT NULL,
  
  -- Granulométrie
  passant_80um NUMERIC,   -- %
  passant_2mm NUMERIC,    -- %
  passant_20mm NUMERIC,   -- %
  
  -- Atterberg
  wl NUMERIC,             -- Limite de liquidité (%)
  wp NUMERIC,             -- Limite de plasticité (%)
  ip NUMERIC GENERATED ALWAYS AS (wl - wp) STORED,  -- Indice de plasticité
  
  -- Bleu de Méthylène
  vbs NUMERIC,            -- g/100g
  
  -- Proctor
  gamma_d_max NUMERIC,    -- kN/m³
  w_opt NUMERIC,          -- %
  proctor_type TEXT CHECK (proctor_type IN ('normal', 'modifie')),
  
  -- Gonflement
  eg NUMERIC,             -- %
  
  -- Métadonnées
  test_date DATE,
  laboratory TEXT,
  norm TEXT,              -- Ex: "NF P94-051", "ASTM D4318"
  meta JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_essais_geo_sondage ON essais_geotechniques (sondage_id);
CREATE INDEX idx_essais_geo_depth ON essais_geotechniques (depth_m);
CREATE INDEX idx_essais_geo_ip ON essais_geotechniques (ip) WHERE ip IS NOT NULL;
CREATE INDEX idx_essais_geo_vbs ON essais_geotechniques (vbs) WHERE vbs IS NOT NULL;
```

#### Vue Matérialisée : `mailles_geotechnique_stats`

```sql
CREATE MATERIALIZED VIEW mailles_geotechnique_stats AS
SELECT
  m.id,
  m.code,
  m.geom,
  
  -- Granulométrie (moyennes)
  AVG(eg.passant_80um) as passant_80um_avg,
  STDDEV(eg.passant_80um) as passant_80um_stddev,
  
  -- Atterberg (moyennes)
  AVG(eg.wl) as wl_avg,
  AVG(eg.wp) as wp_avg,
  AVG(eg.ip) as ip_avg,
  STDDEV(eg.ip) as ip_stddev,
  
  -- Classification IP
  COUNT(CASE WHEN eg.ip < 12 THEN 1 END) as n_ip_faible,
  COUNT(CASE WHEN eg.ip BETWEEN 12 AND 25 THEN 1 END) as n_ip_moyen,
  COUNT(CASE WHEN eg.ip BETWEEN 25 AND 40 THEN 1 END) as n_ip_plastique,
  COUNT(CASE WHEN eg.ip >= 40 THEN 1 END) as n_ip_tres_plastique,
  
  -- VBS (moyennes)
  AVG(eg.vbs) as vbs_avg,
  STDDEV(eg.vbs) as vbs_stddev,
  
  -- Classification VBS
  COUNT(CASE WHEN eg.vbs < 0.1 THEN 1 END) as n_vbs_insensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 0.1 AND 1.5 THEN 1 END) as n_vbs_peu_sensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 1.5 AND 2.5 THEN 1 END) as n_vbs_sensible,
  COUNT(CASE WHEN eg.vbs BETWEEN 2.5 AND 6 THEN 1 END) as n_vbs_moyen_argileux,
  COUNT(CASE WHEN eg.vbs BETWEEN 6 AND 8 THEN 1 END) as n_vbs_argileux,
  COUNT(CASE WHEN eg.vbs >= 8 THEN 1 END) as n_vbs_tres_argileux,
  
  -- Proctor (moyennes)
  AVG(eg.gamma_d_max) as gamma_d_max_avg,
  AVG(eg.w_opt) as w_opt_avg,
  
  -- Gonflement (moyennes)
  AVG(eg.eg) as eg_avg,
  MAX(eg.eg) as eg_max,
  
  -- Classification gonflement
  COUNT(CASE WHEN eg.eg < 0.5 THEN 1 END) as n_eg_negligeable,
  COUNT(CASE WHEN eg.eg BETWEEN 0.5 AND 2 THEN 1 END) as n_eg_faible,
  COUNT(CASE WHEN eg.eg BETWEEN 2 AND 5 THEN 1 END) as n_eg_moyen,
  COUNT(CASE WHEN eg.eg BETWEEN 5 AND 10 THEN 1 END) as n_eg_fort,
  COUNT(CASE WHEN eg.eg >= 10 THEN 1 END) as n_eg_tres_fort,
  
  -- Comptages
  COUNT(DISTINCT s.id) as n_sondages,
  COUNT(eg.id) as n_essais_geo
  
FROM mailles m
LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
GROUP BY m.id, m.code, m.geom;

CREATE UNIQUE INDEX idx_mailles_geo_stats_id ON mailles_geotechnique_stats (id);
CREATE INDEX idx_mailles_geo_stats_geom ON mailles_geotechnique_stats USING GIST (geom);
CREATE INDEX idx_mailles_geo_stats_ip ON mailles_geotechnique_stats (ip_avg) WHERE ip_avg IS NOT NULL;
CREATE INDEX idx_mailles_geo_stats_vbs ON mailles_geotechnique_stats (vbs_avg) WHERE vbs_avg IS NOT NULL;
```

---

*Suite dans le document final avec implémentation complète...*
[[CARTES_THEMATIQUES_RESUME]]
[[CARTES_THEMATIQUES_COMPLET]]