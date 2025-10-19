# Cahier des Charges - Import Bulk de Sondages Géotechniques

**Version:** 1.0  
**Date:** 19 octobre 2025  
**Projet:** Atlas Géotechnique v1.4.0

---

## 1. Contexte et Objectifs

### 1.1 Problématique
Les données géotechniques existantes sont souvent disponibles sous forme de fichiers CSV/Excel sans coordonnées GPS. L'import actuel nécessite des coordonnées exactes, ce qui empêche l'intégration de données historiques précieuses.

### 1.2 Objectifs
- Permettre l'import de sondages **sans coordonnées GPS**
- Détecter automatiquement le format et la structure des fichiers
- Proposer des modes de géolocalisation alternatifs (centroïde, aléatoire, maille)
- Uniformiser les formats d'import (CSV, XLSX, JSON)
- Améliorer l'UX en s'inspirant de QGIS

---

## 2. Analyse des Données Fournies

### 2.1 Données Granulométrie (AG)
```csv
"N","Localités","1","1.5","2"
"1","Adjengré (Pounpouni)","77.73","81.8","74.85"
```
**Structure détectée:**
- Colonne 1: Numéro (ignoré)
- Colonne 2: Localité (nom du sondage)
- Colonnes 3-5: Profondeurs (1m, 1.5m, 2m) avec valeurs % passant

### 2.2 Données Bleu de Méthylène (VBS)
```csv
"N","Localités","1","1.5","2","1","1.5","2"
"1","Akéi","1.75","1.73","1.71","Faible","Faible","Faible"
```
**Structure détectée:**
- Colonnes 3-5: Valeurs VBS (g/100g)
- Colonnes 6-8: Analyses qualitatives (Faible/Moyen/Forte)

### 2.3 Données Limites d'Atterberg
```csv
"N","Localité","Profondeur","WL","WP","IP","Analyse suivant WL"
"1","Adjengré (Pounpouni)","1","50.34","22.64","27.7","Elevé"
```
**Structure détectée:**
- Format "long" (une ligne par profondeur)
- Colonnes: Localité, Profondeur, WL, WP, IP, Analyse

---

## 3. Norme de Format d'Import Unifié

### 3.1 Format Standard Recommandé

#### Format A: Structure "Large" (Multi-profondeurs en colonnes)
```csv
code,localite,type_essai,prof_1,prof_1.5,prof_2,date,source,operator
SND-001,Adjengré,Granulometrie,77.73,81.8,74.85,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,BleuMethylene_VBS,1.75,1.73,1.71,2024-01-15,Lab LNBTP,LNBTP
```

#### Format B: Structure "Long" (Une ligne par mesure) ⭐ **RECOMMANDÉ**
```csv
code,localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,source,operator
SND-001,Adjengré,Granulometrie,1.0,77.73,%,,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,Granulometrie,1.5,81.8,%,,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,BleuMethylene_VBS,1.0,1.75,g/100g,Faible,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,Atterberg_WL,1.0,50.34,%,Elevé,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,Atterberg_WP,1.0,22.64,%,,2024-01-15,Lab LNBTP,LNBTP
SND-001,Adjengré,Atterberg_IP,1.0,27.7,%,,2024-01-15,Lab LNBTP,LNBTP
```

### 3.2 Champs Obligatoires et Optionnels

| Champ | Type | Obligatoire | Description | Exemple |
|-------|------|-------------|-------------|---------|
| `code` | string | ❌ | Code unique du sondage | SND-TG-001 |
| `localite` | string | ✅ | Nom de la localité | Adjengré |
| `type_essai` | enum | ✅ | Type d'essai | Granulometrie, BleuMethylene_VBS, Atterberg_WL |
| `profondeur_m` | float | ✅ | Profondeur en mètres | 1.0, 1.5, 2.0 |
| `valeur` | float | ⚠️ | Valeur numérique | 77.73 |
| `unite` | string | ❌ | Unité de mesure | %, g/100g, MPa |
| `analyse_qualitative` | string | ❌ | Résultat qualitatif | Faible, Moyen, Forte, Elevé |
| `date` | date | ❌ | Date du sondage | 2024-01-15 |
| `source` | string | ❌ | Source des données | Lab LNBTP |
| `operator` | string | ❌ | Opérateur | LNBTP |
| `lon` | float | ❌ | Longitude WGS84 | 1.2345 |
| `lat` | float | ❌ | Latitude WGS84 | 6.1234 |
| `adm1` | string | ❌ | Région (ADM1) | Centrale |
| `adm2` | string | ❌ | Préfecture (ADM2) | Tchaoudjo |
| `adm3` | string | ❌ | Commune (ADM3) | Sotouboua |

⚠️ Au moins `valeur` OU `analyse_qualitative` doit être renseigné

### 3.3 Types d'Essais Supportés

| Type | Code | Unité par défaut |
|------|------|------------------|
| Granulométrie | `Granulometrie` | % |
| Bleu de Méthylène | `BleuMethylene_VBS` | g/100g |
| Limite de liquidité | `Atterberg_WL` | % |
| Limite de plasticité | `Atterberg_WP` | % |
| Indice de plasticité | `Atterberg_IP` | % |
| Proctor γd max | `Proctor_gdmax` | t/m³ |
| Proctor wopt | `Proctor_wopt` | % |
| Potentiel de gonflement | `PotentielGonflement_eg` | % |

---

## 4. Workflow d'Import

### 4.1 Étape 1: Sélection et Détection du Fichier

**Interface:**
```
┌─────────────────────────────────────────────────┐
│  📁 Import Bulk de Sondages                     │
├─────────────────────────────────────────────────┤
│  Format de fichier:                             │
│  ○ CSV (virgule)    ○ CSV (point-virgule)       │
│  ○ Excel (.xlsx)    ○ JSON                      │
│                                                  │
│  Encodage: [UTF-8 ▼]                            │
│                                                  │
│  [📂 Choisir un fichier...]                     │
│                                                  │
│  ✅ Détecter automatiquement la structure       │
│  ✅ Première ligne = en-têtes                   │
│  ✅ Ignorer les lignes vides                    │
└─────────────────────────────────────────────────┘
```

**Détection automatique:**
1. Lire les 5 premières lignes
2. Détecter le séparateur (`,` `;` `\t`)
3. Identifier les colonnes (mapping intelligent)
4. Proposer une prévisualisation

### 4.2 Étape 2: Mapping des Colonnes

**Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Mapping des Colonnes                                    │
├─────────────────────────────────────────────────────────────┤
│  Colonne fichier          →  Champ Atlas                    │
│  ────────────────────────────────────────────────────────── │
│  "N"                      →  [Ignorer ▼]                    │
│  "Localités"              →  [localite ▼] ✅               │
│  "1"                      →  [profondeur_m (valeur: 1.0) ▼] │
│  "1.5"                    →  [profondeur_m (valeur: 1.5) ▼] │
│  "2"                      →  [profondeur_m (valeur: 2.0) ▼] │
│                                                              │
│  Type d'essai détecté: [Granulometrie ▼]                    │
│  Unité par défaut: [% ▼]                                    │
│                                                              │
│  ⚠️ Aucune coordonnée GPS détectée                          │
│  → Mode de géolocalisation requis                           │
└─────────────────────────────────────────────────────────────┘
```

**Mapping intelligent:**
- `"Localités"` → `localite`
- `"Profondeur"` → `profondeur_m`
- `"WL"` → `type_essai: Atterberg_WL`
- Colonnes numériques en en-tête → profondeurs

### 4.3 Étape 3: Mode de Géolocalisation

**Si aucune coordonnée GPS n'est détectée:**

```
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Mode de Géolocalisation                                 │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Aucune coordonnée GPS trouvée dans le fichier           │
│                                                              │
│  Choisissez un mode de géolocalisation:                     │
│                                                              │
│  ○ Centroïde ADM                                            │
│    → Placer au centre de la zone administrative             │
│    → Nécessite: colonne ADM1/ADM2/ADM3 ou sélection manuelle│
│                                                              │
│  ○ Position inconnue (unknown)                              │
│    → Sondage sans coordonnées                               │
│    → Rattaché uniquement à une zone ADM                     │
│    → Géocodage ultérieur requis                             │
│                                                              │
│  ○ Point aléatoire dans zone ADM                            │
│    → Point aléatoire déterministe dans la zone              │
│    → Nécessite: colonne ADM1/ADM2/ADM3 ou sélection manuelle│
│                                                              │
│  ○ Rattachement à une maille                                │
│    → Sélectionner une maille sur la carte                   │
│    → Point au centroïde de la maille                        │
│                                                              │
│  [Suivant →]                                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Workflow A: Centroïde ADM

**Étape 3.1 - Mapping ADM:**
```
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Centroïde ADM - Configuration                           │
├─────────────────────────────────────────────────────────────┤
│  Option 1: Colonnes ADM dans le fichier                     │
│  ☑ Utiliser les colonnes du fichier                         │
│                                                              │
│  Colonne ADM1: [Non détecté ▼]                              │
│  Colonne ADM2: [Non détecté ▼]                              │
│  Colonne ADM3: [Localités ▼] ✅                             │
│                                                              │
│  ─────────────────── OU ──────────────────────              │
│                                                              │
│  Option 2: Sélection manuelle unique                        │
│  ☐ Tous les sondages dans la même zone                      │
│                                                              │
│  Région (ADM1): [Centrale ▼]                                │
│  Préfecture (ADM2): [Tchaoudjo ▼]                           │
│  Commune (ADM3): [Sotouboua ▼]                              │
│                                                              │
│  💡 Les sondages seront placés au centroïde de chaque zone  │
│  💡 Géocodage ultérieur possible via "🗺️ Géocoder"          │
│                                                              │
│  [← Retour]  [Prévisualiser →]                              │
└─────────────────────────────────────────────────────────────┘
```

**Étape 3.2 - Prévisualisation:**
```
┌─────────────────────────────────────────────────────────────┐
│  👁️ Prévisualisation (5 premiers sondages)                  │
├─────────────────────────────────────────────────────────────┤
│  Code          Localité              ADM3        Coord       │
│  ──────────────────────────────────────────────────────────  │
│  AUTO-001      Adjengré             Sotouboua   Centroïde   │
│  AUTO-002      Agotivé              Tchaoudjo   Centroïde   │
│  AUTO-003      Anié                 Anié        Centroïde   │
│                                                              │
│  Essais détectés: 36 (12 sondages × 3 profondeurs)          │
│  Mode: centroid                                              │
│  État: Non géocodé (géocodage ultérieur possible)           │
│                                                              │
│  ⚠️ Ces sondages apparaîtront dans "🗺️ Géocoder"            │
│                                                              │
│  [← Retour]  [✅ Importer 12 sondages]                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Workflow B: Position Inconnue (Unknown)

**Étape 3.1 - Configuration:**
```
┌─────────────────────────────────────────────────────────────┐
│  ❓ Position Inconnue - Configuration                        │
├─────────────────────────────────────────────────────────────┤
│  Les sondages seront créés SANS coordonnées géographiques   │
│  Ils seront rattachés uniquement à une zone administrative   │
│                                                              │
│  Mapping ADM (obligatoire):                                  │
│  Colonne ADM1: [Non détecté ▼]                              │
│  Colonne ADM2: [Non détecté ▼]                              │
│  Colonne ADM3: [Localités ▼] ✅                             │
│                                                              │
│  ─────────────────── OU ──────────────────────              │
│                                                              │
│  Zone unique pour tous:                                      │
│  ☐ Tous les sondages dans: [Centrale > Tchaoudjo ▼]        │
│                                                              │
│  ⚠️ IMPORTANT:                                               │
│  • Les sondages n'apparaîtront PAS sur la carte             │
│  • Géocodage OBLIGATOIRE via "🗺️ Géocoder"                  │
│  • Visible uniquement dans la liste des sondages            │
│                                                              │
│  [← Retour]  [Prévisualiser →]                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Workflow C: Point Aléatoire dans Zone ADM

**Étape 3.1 - Configuration:**
```
┌─────────────────────────────────────────────────────────────┐
│  🎲 Point Aléatoire - Configuration                          │
├─────────────────────────────────────────────────────────────┤
│  Les sondages seront placés aléatoirement dans leur zone    │
│  (Position déterministe basée sur le code du sondage)        │
│                                                              │
│  Mapping ADM:                                                │
│  Colonne ADM3: [Localités ▼] ✅                             │
│                                                              │
│  Seed aléatoire: [42________] (pour reproductibilité)       │
│                                                              │
│  Rayon de jitter: [±400m ▼]                                 │
│  • ±150m : Précision élevée                                 │
│  • ±400m : Précision moyenne (recommandé)                   │
│  • ±1000m : Précision faible                                │
│                                                              │
│  💡 Les sondages auront des coordonnées approximatives      │
│  💡 Géocodage ultérieur possible pour précision exacte      │
│                                                              │
│  [← Retour]  [Prévisualiser →]                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.7 Workflow D: Rattachement à une Maille

**Étape 3.1 - Sélection Maille:**
```
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Rattachement Maille - Sélection                         │
├─────────────────────────────────────────────────────────────┤
│  Option 1: Sélection manuelle sur la carte                  │
│  ☑ Cliquez sur une maille sur la carte                      │
│                                                              │
│  Maille sélectionnée: TG-0348-0206-01                       │
│  Coordonnées centroïde: 1.2345°E, 6.1234°N                  │
│                                                              │
│  ─────────────────── OU ──────────────────────              │
│                                                              │
│  Option 2: Code maille dans le fichier                      │
│  ☐ Utiliser colonne du fichier                              │
│  Colonne code maille: [Non détecté ▼]                       │
│                                                              │
│  💡 Tous les sondages seront placés au centroïde de la maille│
│  💡 Géocodage ultérieur possible pour ajuster la position   │
│                                                              │
│  [← Retour]  [Prévisualiser →]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Gestion Post-Import

### 5.1 Liste des Sondages Non Géocodés

**Mise à jour automatique:**
- Tous les sondages importés avec mode `unknown`, `centroid`, `random` apparaissent dans la vue `sondages_non_geocodes`
- Accessible via le bouton "🗺️ Géocoder les sondages"

**Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Sondages à Géocoder (156)                               │
├─────────────────────────────────────────────────────────────┤
│  Filtres:                                                    │
│  Mode: [Tous ▼]  ADM: [Tous ▼]  Date: [Tous ▼]             │
│                                                              │
│  Code          Localité        Mode      ADM3      Essais   │
│  ──────────────────────────────────────────────────────────  │
│  AUTO-001      Adjengré        centroid  Sotouboua  3       │
│  AUTO-002      Agotivé         centroid  Tchaoudjo  3       │
│  AUTO-003      Anié            unknown   Anié       3       │
│                                                              │
│  [🗺️ Géocoder sélection]  [📍 Géocoder tout]               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Workflow de Géocodage Ultérieur

**Pour chaque sondage:**
1. Clic sur "🗺️ Géocoder"
2. Choix du mode:
   - **Coordonnées exactes (GPS)** → Saisir lon/lat
   - **Centroïde ADM** → Choisir ADM1/2/3
   - **Point aléatoire** → Générer dans zone ADM
   - **Maille** → Sélectionner sur carte

3. Validation → Sondage mis à jour et retiré de la liste

---

## 6. Spécifications Techniques

### 6.1 Architecture Backend

**Nouvel endpoint API:**
```rust
POST /api/v1/surveys/bulk-import
Content-Type: multipart/form-data

{
  "file": <binary>,
  "format": "csv" | "xlsx" | "json",
  "encoding": "utf-8",
  "mapping": {
    "localite": "Localités",
    "profondeur_cols": ["1", "1.5", "2"],
    "type_essai": "Granulometrie"
  },
  "geolocation": {
    "mode": "centroid" | "unknown" | "random" | "maille",
    "adm_mapping": {
      "adm3_col": "Localités"
    }
  }
}
```

**Réponse:**
```json
{
  "success": true,
  "imported": 12,
  "errors": [],
  "warnings": [
    "Sondage AUTO-003: ADM3 'Anié' non trouvé, utilisé 'unknown'"
  ],
  "summary": {
    "sondages": 12,
    "essais": 36,
    "mode": "centroid",
    "non_geocodes": 12
  }
}
```

### 6.2 Parsers de Fichiers

**CSV Parser:**
- Détection automatique du séparateur (`,` `;` `\t`)
- Support UTF-8, ISO-8859-1, Windows-1252
- Gestion des guillemets doubles
- Ignore les lignes vides

**Excel Parser:**
- Support `.xlsx` (OpenXML)
- Lecture de la première feuille par défaut
- Détection automatique des en-têtes

**JSON Parser:**
- Format array d'objets
- Validation du schéma

### 6.3 Transformation des Données

**Format "Large" → "Long":**
```python
# Input
{"localite": "Adjengré", "1": 77.73, "1.5": 81.8, "2": 74.85}

# Output
[
  {"localite": "Adjengré", "profondeur_m": 1.0, "valeur": 77.73},
  {"localite": "Adjengré", "profondeur_m": 1.5, "valeur": 81.8},
  {"localite": "Adjengré", "profondeur_m": 2.0, "valeur": 74.85}
]
```

### 6.4 Génération des Codes Sondages

**Si pas de colonne `code`:**
```
AUTO-{ADM3_PCODE}-{UUID_SHORT}
Exemple: AUTO-TG040106-a3f2b1c4
```

### 6.5 Matching ADM3 par Nom de Localité

**Algorithme:**
1. Recherche exacte (case-insensitive)
2. Recherche avec normalisation (accents, espaces)
3. Recherche fuzzy (Levenshtein distance < 3)
4. Si échec → Mode `unknown` + warning

```sql
SELECT id, name, adm3_pcode
FROM adm3
WHERE unaccent(lower(name)) = unaccent(lower($1))
   OR similarity(name, $1) > 0.8
LIMIT 1
```

---

## 7. Validation et Contrôles

### 7.1 Validation des Données

**Avant import:**
- ✅ Au moins une colonne localité/code
- ✅ Au moins une colonne de valeur
- ✅ Profondeurs > 0
- ✅ Types d'essais valides
- ⚠️ Valeurs dans les plages attendues

**Plages de valeurs:**
| Essai | Min | Max | Unité |
|-------|-----|-----|-------|
| Granulometrie | 0 | 100 | % |
| BleuMethylene_VBS | 0 | 15 | g/100g |
| Atterberg_WL | 0 | 100 | % |
| Atterberg_WP | 0 | 100 | % |
| Atterberg_IP | 0 | 100 | % |

### 7.2 Gestion des Erreurs

**Erreurs bloquantes:**
- Format de fichier invalide
- Aucune colonne mappable
- Type d'essai inconnu

**Warnings (import partiel):**
- Localité ADM3 non trouvée → Mode `unknown`
- Valeur hors plage → Import avec flag
- Profondeur manquante → Ligne ignorée

---

## 8. Interface Utilisateur (UX)

### 8.1 Inspiration QGIS

**Éléments à reprendre:**
- ✅ Détection automatique du format
- ✅ Prévisualisation des données
- ✅ Mapping interactif des colonnes
- ✅ Options de géométrie (point, centroïde)
- ✅ Validation en temps réel

**Améliorations Atlas:**
- 🎨 Design moderne (dark mode)
- 🗺️ Prévisualisation sur carte
- 📊 Statistiques en temps réel
- 🔄 Import incrémental (ajout à l'existant)

### 8.2 Wireframes

**Écran 1: Upload**
```
┌─────────────────────────────────────────────────┐
│  📁 Import Bulk                                 │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Glissez-déposez votre fichier ici       │  │
│  │  ou cliquez pour parcourir               │  │
│  │                                           │  │
│  │  Formats: CSV, XLSX, JSON                │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  Exemples: [📄 Granulo.csv] [📄 VBS.csv]       │
└─────────────────────────────────────────────────┘
```

**Écran 2: Mapping**
```
┌─────────────────────────────────────────────────┐
│  📊 Configuration Import                        │
│  ┌─────────────────────────────────────────┐   │
│  │ Prévisualisation (5 lignes)             │   │
│  │ N  | Localités         | 1    | 1.5    │   │
│  │ 1  | Adjengré         | 77.73| 81.8   │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  Mapping:                                        │
│  Localités → [localite ▼]                       │
│  1, 1.5, 2 → [Profondeurs ▼]                    │
│                                                  │
│  Type essai: [Granulometrie ▼]                  │
│  Mode géoloc: [Centroïde ADM ▼]                 │
└─────────────────────────────────────────────────┘
```

**Écran 3: Résultat**
```
┌─────────────────────────────────────────────────┐
│  ✅ Import Terminé                              │
│                                                  │
│  📊 Résumé:                                      │
│  • 12 sondages importés                         │
│  • 36 essais créés                              │
│  • Mode: Centroïde ADM                          │
│                                                  │
│  ⚠️ 12 sondages ajoutés à "🗺️ Géocoder"         │
│                                                  │
│  [📋 Voir les sondages]  [🗺️ Géocoder maintenant]│
└─────────────────────────────────────────────────┘
```

---

## 9. Exemples de Fichiers d'Import

### 9.1 Exemple CSV - Granulométrie (Format Long)
```csv
code,localite,type_essai,profondeur_m,valeur,unite,date,source,operator,adm3
,Adjengré,Granulometrie,1.0,77.73,%,2024-01-15,Lab LNBTP,LNBTP,Sotouboua
,Adjengré,Granulometrie,1.5,81.8,%,2024-01-15,Lab LNBTP,LNBTP,Sotouboua
,Adjengré,Granulometrie,2.0,74.85,%,2024-01-15,Lab LNBTP,LNBTP,Sotouboua
,Agotivé,Granulometrie,1.0,60.61,%,2024-01-16,Lab LNBTP,LNBTP,Tchaoudjo
,Agotivé,Granulometrie,1.5,52.23,%,2024-01-16,Lab LNBTP,LNBTP,Tchaoudjo
```

### 9.2 Exemple CSV - VBS avec Analyses (Format Long)
```csv
code,localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,adm3
,Akéi,BleuMethylene_VBS,1.0,1.75,g/100g,Faible,2024-02-10,Bassar
,Akéi,BleuMethylene_VBS,1.5,1.73,g/100g,Faible,2024-02-10,Bassar
,Akéi,BleuMethylene_VBS,2.0,1.71,g/100g,Faible,2024-02-10,Bassar
,Alibi,BleuMethylene_VBS,1.0,4.23,g/100g,Moyen,2024-02-11,Bassar
```

### 9.3 Exemple CSV - Atterberg (Format Long)
```csv
code,localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,adm3
,Adjengré,Atterberg_WL,1.0,50.34,%,Elevé,2024-03-01,Sotouboua
,Adjengré,Atterberg_WP,1.0,22.64,%,,2024-03-01,Sotouboua
,Adjengré,Atterberg_IP,1.0,27.7,%,,2024-03-01,Sotouboua
,Adjengré,Atterberg_WL,1.5,65.68,%,Elevé,2024-03-01,Sotouboua
,Adjengré,Atterberg_WP,1.5,36.64,%,,2024-03-01,Sotouboua
,Adjengré,Atterberg_IP,1.5,29.04,%,,2024-03-01,Sotouboua
```

### 9.4 Exemple JSON
```json
[
  {
    "localite": "Adjengré",
    "type_essai": "Granulometrie",
    "profondeur_m": 1.0,
    "valeur": 77.73,
    "unite": "%",
    "date": "2024-01-15",
    "source": "Lab LNBTP",
    "operator": "LNBTP",
    "adm3": "Sotouboua"
  },
  {
    "localite": "Adjengré",
    "type_essai": "Granulometrie",
    "profondeur_m": 1.5,
    "valeur": 81.8,
    "unite": "%",
    "date": "2024-01-15",
    "source": "Lab LNBTP",
    "operator": "LNBTP",
    "adm3": "Sotouboua"
  }
]
```

---

## 10. Cas d'Usage Réels

### 10.1 Cas 1: Import Granulométrie sans Coordonnées

**Données:**
- 12 localités
- 3 profondeurs (1m, 1.5m, 2m)
- Pas de coordonnées GPS
- Colonne "Localités" = noms ADM3

**Workflow:**
1. Upload fichier CSV
2. Détection automatique: Format "Large"
3. Mapping: Localités → ADM3
4. Mode: Centroïde ADM
5. Import → 12 sondages créés
6. Géocodage ultérieur possible

### 10.2 Cas 2: Import VBS avec Analyses Qualitatives

**Données:**
- Valeurs VBS + Analyses (Faible/Moyen/Forte)
- Format "Large" (colonnes 1, 1.5, 2 pour valeurs ET analyses)

**Workflow:**
1. Upload CSV
2. Détection: 2 groupes de colonnes (valeurs + analyses)
3. Transformation automatique en format "Long"
4. Import avec `valeur` ET `analyse_qualitative`

### 10.3 Cas 3: Import Atterberg Multi-Essais

**Données:**
- WL, WP, IP dans le même fichier
- Format "Long" (une ligne par essai)

**Workflow:**
1. Upload CSV
2. Détection: Colonne "type_essai" varie (WL/WP/IP)
3. Groupement automatique par sondage/profondeur
4. Import direct

---

## 11. Contraintes et Limitations

### 11.1 Limitations Techniques

**Taille de fichier:**
- Maximum: 10 MB
- Lignes: 50 000 max
- Sondages: 10 000 max par import

**Formats:**
- CSV: UTF-8, ISO-8859-1, Windows-1252
- Excel: .xlsx uniquement (pas .xls)
- JSON: Array d'objets uniquement

### 11.2 Contraintes Métier

**Données obligatoires:**
- Au moins une localité ou code
- Au moins un essai avec valeur
- Profondeur > 0

**Géolocalisation:**
- Si mode `unknown`: ADM obligatoire
- Si mode `centroid`/`random`: ADM3 minimum
- Si mode `maille`: Code maille valide

---

## 12. Tests et Validation

### 12.1 Scénarios de Test

**Test 1: Import Granulo Standard**
- Fichier: 12 sondages, 3 profondeurs
- Mode: Centroïde ADM
- Résultat attendu: 12 sondages, 36 essais

**Test 2: Import VBS avec Analyses**
- Fichier: Format "Large" avec valeurs + analyses
- Transformation: Large → Long
- Résultat: Valeurs numériques + qualitatives

**Test 3: Import Atterberg Multi-Essais**
- Fichier: WL, WP, IP mélangés
- Groupement: Par sondage/profondeur
- Résultat: 3 essais par profondeur

**Test 4: Localités Non Trouvées**
- Fichier: Localités inexistantes
- Matching: Fuzzy search
- Résultat: Warnings + mode `unknown`

**Test 5: Import Incrémental**
- Import 1: 12 sondages
- Import 2: 8 sondages supplémentaires
- Résultat: 20 sondages total (pas de doublons)

### 12.2 Validation des Données

**Validation automatique:**
```python
def validate_import(data):
    errors = []
    warnings = []
    
    # Vérifier localités
    for row in data:
        if not row.get('localite') and not row.get('code'):
            errors.append(f"Ligne {row.n}: Localité ou code requis")
        
        # Vérifier profondeur
        if row.get('profondeur_m', 0) <= 0:
            errors.append(f"Ligne {row.n}: Profondeur invalide")
        
        # Vérifier valeur
        if not row.get('valeur') and not row.get('analyse_qualitative'):
            warnings.append(f"Ligne {row.n}: Aucune valeur")
        
        # Vérifier plages
        if row.get('type_essai') == 'Granulometrie':
            if not (0 <= row.get('valeur', 0) <= 100):
                warnings.append(f"Ligne {row.n}: Granulo hors plage [0-100]")
    
    return errors, warnings
```

---

## 13. Roadmap et Priorisation

### 13.1 Phase 1: MVP (Minimum Viable Product)

**Priorité HAUTE - Sprint 1 (2 semaines):**
- ✅ Parser CSV basique (format "Long")
- ✅ Détection automatique séparateur
- ✅ Mapping manuel des colonnes
- ✅ Mode géolocalisation: Centroïde ADM
- ✅ Import simple (1 type d'essai à la fois)
- ✅ Validation basique

**Livrables:**
- Endpoint `/api/v1/surveys/bulk-import`
- Interface upload + mapping
- Import Granulométrie fonctionnel

### 13.2 Phase 2: Enrichissement

**Priorité MOYENNE - Sprint 2 (2 semaines):**
- ✅ Support format "Large" → "Long"
- ✅ Support analyses qualitatives
- ✅ Mode `unknown` et `random`
- ✅ Matching ADM3 par nom (fuzzy)
- ✅ Prévisualisation avancée

**Livrables:**
- Import VBS avec analyses
- Import Atterberg multi-essais
- Matching intelligent localités

### 13.3 Phase 3: Optimisation

**Priorité BASSE - Sprint 3 (1 semaine):**
- ✅ Support Excel (.xlsx)
- ✅ Support JSON
- ✅ Import incrémental
- ✅ Détection automatique type d'essai
- ✅ Export template CSV

**Livrables:**
- Multi-formats
- Templates téléchargeables
- Documentation utilisateur

### 13.4 Phase 4: Avancé (Futur)

**Nice-to-have:**
- Import batch (plusieurs fichiers)
- Validation avancée (règles métier)
- Import asynchrone (gros fichiers)
- Historique des imports
- Rollback d'import

---

## 14. Documentation Utilisateur

### 14.1 Guide Rapide

**Comment importer des sondages sans coordonnées GPS ?**

1. **Préparez votre fichier CSV:**
   ```csv
   localite,type_essai,profondeur_m,valeur,unite,adm3
   Adjengré,Granulometrie,1.0,77.73,%,Sotouboua
   ```

2. **Cliquez sur "📁 Import Bulk"**

3. **Uploadez votre fichier**

4. **Vérifiez le mapping automatique**

5. **Choisissez le mode de géolocalisation:**
   - Centroïde ADM (recommandé)
   - Position inconnue
   - Point aléatoire

6. **Validez l'import**

7. **Géocodez ultérieurement si nécessaire**

### 14.2 FAQ

**Q: Puis-je importer sans coordonnées GPS ?**  
R: Oui ! Utilisez le mode "Centroïde ADM" ou "Position inconnue".

**Q: Comment gérer les analyses qualitatives ?**  
R: Ajoutez une colonne `analyse_qualitative` avec les valeurs (Faible, Moyen, Forte, etc.).

**Q: Mes localités ne sont pas trouvées ?**  
R: Le système utilise un matching fuzzy. Vérifiez l'orthographe ou utilisez le mode "Position inconnue".

**Q: Puis-je importer plusieurs types d'essais à la fois ?**  
R: Oui, en format "Long" avec une colonne `type_essai`.

**Q: Comment géocoder après import ?**  
R: Cliquez sur "🗺️ Géocoder les sondages" et sélectionnez le sondage.

---

## 15. Annexes

### 15.1 Glossaire

| Terme | Définition |
|-------|------------|
| **Format Large** | Profondeurs en colonnes (ex: col "1", "1.5", "2") |
| **Format Long** | Une ligne par mesure (profondeur en valeur) |
| **Centroïde ADM** | Point central d'une zone administrative |
| **Fuzzy matching** | Recherche approximative (tolérance fautes) |
| **Mapping** | Association colonnes fichier ↔ champs base |
| **Seed** | Valeur pour reproductibilité aléatoire |

### 15.2 Références

- **QGIS Import Manager:** Inspiration UX
- **PostGIS:** Fonctions géospatiales
- **RFC 4180:** Standard CSV
- **OpenXML:** Format Excel .xlsx

### 15.3 Contacts

**Équipe Projet:**
- Chef de projet: [Nom]
- Développeur Backend: [Nom]
- Développeur Frontend: [Nom]
- Expert Géotechnique: [Nom]

---

**FIN DU CAHIER DES CHARGES**

**Version:** 1.0  
**Date:** 19 octobre 2025  
**Statut:** ✅ Validé pour implémentation
