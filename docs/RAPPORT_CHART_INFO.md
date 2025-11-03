# Rapport : Informations affichées par Chart.js dans le panneau gauche

## Date
27 octobre 2025

## Contexte
L'utilisateur souhaite comprendre quelles informations sont affichées par Chart.js dans le panneau gauche de l'interface utilisateur d'Atlas.

## Source de données

Les données proviennent de la fonction SQL `api_panel_cell(p_maille_code text)` qui retourne un objet JSONB structuré.

### Localisation
- **Fichier SQL** : `c:\PROJET_ATLAS_MASTER\atlas\sql\api_panel_cell.sql`
- **Endpoint API** : `GET /cells/:code/labs` (Rust)
- **Fichier Rust** : `c:\PROJET_ATLAS_MASTER\atlas\services\api-geo\src\cells_labs.rs`
- **Fichier UI** : `c:\PROJET_ATLAS_MASTER\atlas\ui\src\main.ts` (fonction `renderChartsFromLabs`)

## Structure des données retournées

```json
{
  "cell": {
    "code": "TG-0496-0212-01",
    "sources": {
      "real": 0,
      "spread": 1
    },
    "n_sondages": 1
  },
  "charts": {
    "vbs": [],
    "granulo": [],
    "atterberg": [],
    "depth_hist": [
      {
        "n": 3,
        "bin": 1
      }
    ]
  },
  "sondages": [
    {
      "id": "c51ed7af-3d27-4a3f-9ba3-6562fb0460b6",
      "date": "2025-10-26",
      "mode": "spread",
      "tests": 0,
      "samples": 3,
      "localite": "Davie",
      "adm3_code": "TG030805",
      "code_site": "DAVIE"
    }
  ]
}
```

## Informations affichées par Chart.js

### 1. **Informations de la maille (cell)**
- **Code de la maille** : Identifiant unique de la cellule géographique (ex: `TG-0496-0212-01`)
- **Sources** :
  - `real` : Nombre de sondages avec géolocalisation précise (mode "real")
  - `spread` : Nombre de sondages répartis dans la maille (mode "spread")
- **Nombre total de sondages** : Somme des sondages real + spread

### 2. **Graphiques (charts)**

#### a) **Histogramme de profondeur (depth_hist)**
- **Type** : Histogramme à barres
- **Données** : Distribution des échantillons par tranche de profondeur
- **Structure** :
  - `bin` : Numéro de la tranche (1 à 6)
    - Bin 1 : 0-5m
    - Bin 2 : 5-10m
    - Bin 3 : 10-15m
    - Bin 4 : 15-20m
    - Bin 5 : 20-25m
    - Bin 6 : 25-30m
  - `n` : Nombre d'échantillons dans cette tranche
- **Source SQL** : Table `echantillons`, colonne `depth_m`

#### b) **Graphique d'Atterberg (atterberg)**
- **Type** : Nuage de points (scatter plot)
- **Axes** :
  - X : Limite de liquidité (LL)
  - Y : Indice de plasticité (IP)
- **Données** : Points représentant les essais d'Atterberg
- **Structure** :
  - `ll` : Limite de liquidité
  - `ip` : Indice de plasticité
  - `depth_m` : Profondeur de l'échantillon
- **Source SQL** : Table `essais_atterberg` jointe avec `echantillons`
- **Utilité** : Classification des sols selon le diagramme de Casagrande

#### c) **Graphique VBS (vbs)**
- **Type** : Nuage de points
- **Axes** :
  - X : Profondeur (depth_m)
  - Y : Valeur au bleu de méthylène (VBS)
- **Données** : Évolution du VBS en fonction de la profondeur
- **Structure** :
  - `depth_m` : Profondeur de l'échantillon
  - `vbs` : Valeur au bleu (g/100g)
- **Source SQL** : Table `essais_vbs` jointe avec `echantillons`
- **Utilité** : Évaluation de l'argilosité du sol

#### d) **Graphique granulométrique (granulo)**
- **Type** : Courbes granulométriques
- **Données** : Courbes de distribution granulométrique
- **Structure** : (actuellement vide, non implémenté)
- **Source SQL** : Table `granulometrie_points` (non encore connectée)

### 3. **Liste des sondages (sondages)**

Pour chaque sondage dans la maille, les informations suivantes sont affichées :

- **id** : UUID du sondage
- **date** : Date de réalisation du sondage
- **mode** : Mode de géolocalisation (`real` ou `spread`)
- **tests** : Nombre d'essais de laboratoire réalisés
- **samples** : Nombre d'échantillons prélevés
- **localite** : Nom de la localité
- **adm3_code** : Code administratif niveau 3
- **code_site** : Code du site de sondage

## Requêtes SQL utilisées

### KPI de la maille
```sql
SELECT 
  p_maille_code AS code,
  COUNT(DISTINCT CASE WHEN source='real' THEN sondage_id END) AS real,
  COUNT(DISTINCT CASE WHEN source='spread' THEN sondage_id END) AS spread,
  COUNT(DISTINCT sondage_id) AS n_sondages
FROM v_maille_sondages_all
WHERE maille_code = p_maille_code
```

### Histogramme de profondeur
```sql
SELECT width_bucket(e.depth_m, 0, 30, 6) AS bin, COUNT(*) AS cnt
FROM echantillons e
WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
  AND e.depth_m IS NOT NULL
GROUP BY width_bucket(e.depth_m, 0, 30, 6)
```

### Graphique d'Atterberg
```sql
SELECT 
  a.ll,
  a.ip,
  e.depth_m
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
  AND a.ll IS NOT NULL 
  AND a.ip IS NOT NULL
ORDER BY e.depth_m
```

### Graphique VBS
```sql
SELECT 
  e.depth_m,
  v.vbs
FROM essais_vbs v
JOIN echantillons e ON e.id = v.echantillon_id
WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
  AND v.vbs IS NOT NULL
ORDER BY e.depth_m
```

### Liste des sondages
```sql
SELECT 
  s.id,
  s.date_sondage AS date,
  COALESCE(ms.source, s.loc_mode, 'spread') AS mode,
  COUNT(DISTINCT es.id) AS tests,
  COUNT(DISTINCT e.id) AS samples,
  s.meta->>'localite' AS localite,
  s.meta->>'adm3_code' AS adm3_code,
  s.meta->>'code_site' AS code_site
FROM sondages s
LEFT JOIN v_maille_sondages_all ms ON ms.sondage_id = s.id AND ms.maille_code = p_maille_code
LEFT JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais es ON es.echantillon_id = e.id
WHERE s.id IN (SELECT sondage_id FROM sids)
GROUP BY s.id, ms.source
ORDER BY s.date_sondage DESC
```

## État actuel

### Graphiques fonctionnels
✅ **Histogramme de profondeur** : Fonctionne et affiche les données
✅ **Liste des sondages** : Fonctionne et affiche les métadonnées

### Graphiques vides (données manquantes)
❌ **Atterberg** : Pas de données dans `essais_atterberg` pour les sondages actuels
❌ **VBS** : Pas de données dans `essais_vbs` pour les sondages actuels
❌ **Granulo** : Non implémenté (table `granulometrie_points` non connectée)

## Exemple de rendu visuel

Pour la maille `TG-0496-0212-01` (Davie) :

```
┌─────────────────────────────────────────┐
│ Maille: TG-0496-0212-01                 │
│ Sondages: 1 (0 real, 1 spread)          │
├─────────────────────────────────────────┤
│ 📊 Histogramme de profondeur            │
│    Bin 1 (0-5m): ███ 3 échantillons    │
├─────────────────────────────────────────┤
│ 📊 Atterberg (vide)                     │
├─────────────────────────────────────────┤
│ 📊 VBS (vide)                           │
├─────────────────────────────────────────┤
│ 📋 Sondages (1)                         │
│  • Davie (DAVIE)                        │
│    Date: 2025-10-26                     │
│    Mode: spread                         │
│    Échantillons: 3                      │
│    Tests: 0                             │
└─────────────────────────────────────────┘
```

## Recommandations

1. **Enrichir les données** : Importer des essais Atterberg et VBS pour visualiser ces graphiques
2. **Implémenter granulo** : Connecter la table `granulometrie_points` pour afficher les courbes granulométriques
3. **Améliorer l'UX** : Afficher un message explicite quand un graphique est vide au lieu de le masquer
4. **Ajouter des filtres** : Permettre de filtrer les données par profondeur, date, ou type d'essai
5. **Export des données** : Ajouter une fonctionnalité d'export CSV/Excel des données de la maille

## Conclusion

Chart.js affiche dans le panneau gauche :
- **4 types de graphiques** : Profondeur, Atterberg, VBS, Granulo
- **1 liste de sondages** avec métadonnées enrichies
- **Des KPI** : nombre de sondages par mode (real/spread)

Actuellement, seul l'histogramme de profondeur contient des données pour les mailles existantes. Les autres graphiques nécessitent des données d'essais de laboratoire qui ne sont pas encore présentes dans la base de données.
