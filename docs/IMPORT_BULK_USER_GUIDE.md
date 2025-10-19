# Guide Utilisateur - Import Bulk de Sondages Géotechniques

**Version:** 1.0
**Date:** 19 Octobre 2025
**Auteur:** Atlas Project Team

---

## Table des Matières

1. [Introduction](#introduction)
2. [Démarrage Rapide](#démarrage-rapide)
3. [Guide Étape par Étape](#guide-étape-par-étape)
4. [Formats de Fichiers Supportés](#formats-de-fichiers-supportés)
5. [Configuration du Mapping](#configuration-du-mapping)
6. [Modes de Géolocalisation](#modes-de-géolocalisation)
7. [Validation et Prévisualisation](#validation-et-prévisualisation)
8. [Gestion des Erreurs](#gestion-des-erreurs)
9. [FAQ](#faq)
10. [Dépannage](#dépannage)

---

## Introduction

L'outil d'import bulk permet d'importer en masse des données de sondages géotechniques dans le système Atlas. Il supporte plusieurs formats de fichiers (CSV, XLSX, JSON) et offre des fonctionnalités avancées de validation, géolocalisation et transformation de données.

### Fonctionnalités Principales

- ✅ **Multi-format**: CSV, Excel (XLSX), JSON
- ✅ **Auto-mapping intelligent**: Détection automatique des colonnes
- ✅ **5 modes de géolocalisation**: Exact, Centroïde, Aléatoire, Maille, Inconnu
- ✅ **Validation en temps réel**: Détection des erreurs avant import
- ✅ **Prévisualisation cartographique**: Visualisation des sondages sur carte
- ✅ **Gestion des doublons**: Détection automatique par empreinte digitale
- ✅ **Import asynchrone**: Traitement en arrière-plan pour gros fichiers
- ✅ **Profils de mapping**: Sauvegarder et réutiliser vos configurations

---

## Démarrage Rapide

### En 5 Minutes

1. **Préparez votre fichier** au format CSV, XLSX ou JSON
2. **Ouvrez l'outil d'import** dans Atlas
3. **Glissez-déposez votre fichier** ou cliquez pour sélectionner
4. **Vérifiez le mapping automatique** des colonnes
5. **Choisissez le mode de géolocalisation**
6. **Prévisualisez** vos données
7. **Lancez l'import** !

### Exemple de Fichier CSV Minimal

```csv
name,longitude,latitude,depth
Sondage-001,1.2500,8.5000,10
Sondage-002,1.3000,8.6000,15
Sondage-003,1.3500,8.7000,12
```

---

## Guide Étape par Étape

### Étape 1: Chargement du Fichier

![Upload Step](images/upload-step.png)

#### Actions

1. Cliquez sur la zone de glisser-déposer ou utilisez le bouton "Parcourir"
2. Sélectionnez votre fichier (CSV, XLSX ou JSON)
3. Le système détecte automatiquement le format et les colonnes
4. Une prévisualisation des 10 premières lignes s'affiche

#### Formats Supportés

| Format | Extension | Encodage | Taille Max |
|--------|-----------|----------|------------|
| CSV    | `.csv`    | UTF-8, Latin-1 | 50 MB |
| Excel  | `.xlsx`   | N/A | 50 MB |
| JSON   | `.json`   | UTF-8 | 50 MB |

#### Télécharger un Modèle

Des modèles de fichiers sont disponibles pour chaque format:
- **Modèle CSV Simple**: Format minimal avec colonnes de base
- **Modèle Excel Complet**: Avec toutes les colonnes optionnelles
- **Modèle JSON**: Structure pour import JSON

---

### Étape 2: Mapping des Colonnes

![Mapping Step](images/mapping-step.png)

#### Principe

Le mapping associe les colonnes de votre fichier aux champs de la base de données Atlas.

#### Auto-Mapping Intelligent

L'outil détecte automatiquement les colonnes similaires:
- `nom`, `name`, `nom_sondage` → **name**
- `x`, `coord_x`, `longitude` → **longitude**
- `y`, `coord_y`, `latitude` → **latitude**
- `prof`, `depth`, `profondeur` → **depth**

#### Mapping Manuel

Si l'auto-mapping ne trouve pas de correspondance:

1. **Glissez-déposez** une colonne source vers un champ cible
2. Ou utilisez le **menu déroulant** pour sélectionner
3. Les champs **obligatoires** sont marqués d'un astérisque (*)

#### Catégories de Champs

##### 🆔 Identité (Obligatoire)

| Champ | Description | Exemple |
|-------|-------------|---------|
| **name*** | Nom unique du sondage | `S001`, `Sondage-Lomé-01` |
| code | Code projet/référence | `PROJ-2025-001` |
| description | Description détaillée | `Sondage de reconnaissance` |
| type_sondage | Type de sondage | `SPT`, `CPT`, `Pressiométrique` |

##### 📍 Localisation (Obligatoire)

| Champ | Description | Format | Exemple |
|-------|-------------|--------|---------|
| **longitude*** | Coordonnée X (WGS84) | Décimal | `1.2500` |
| **latitude*** | Coordonnée Y (WGS84) | Décimal | `8.5000` |
| altitude | Altitude en mètres | Décimal | `150.5` |
| commune | Commune/Ville | Texte | `Lomé` |
| quartier | Quartier/Zone | Texte | `Bè` |

##### 📊 Données Géotechniques

| Champ | Description | Format |
|-------|-------------|--------|
| depth_field | Profondeur de la mesure | Numérique (m) |
| param_field | Nom du paramètre mesuré | Texte |
| value_field | Valeur de la mesure | Numérique |

**Note**: Pour format **Long** (plusieurs lignes par sondage), spécifiez ces 3 champs.

##### 📅 Métadonnées (Optionnel)

| Champ | Description | Format | Exemple |
|-------|-------------|--------|---------|
| date | Date du sondage | ISO 8601 | `2025-01-15` |
| operateur | Entreprise/Opérateur | Texte | `GeoTech Togo` |
| projet | Nom du projet | Texte | `Route Lomé-Kara` |

#### Sauvegarder un Profil de Mapping

Pour réutiliser votre configuration:

1. Cliquez sur **"Sauvegarder le profil"**
2. Donnez un nom descriptif: `Import SPT Standard`
3. Le profil est sauvegardé et réutilisable

#### Charger un Profil Existant

1. Cliquez sur **"Charger un profil"**
2. Sélectionnez dans la liste des profils sauvegardés
3. Le mapping est automatiquement appliqué

---

### Étape 3: Configuration de la Géolocalisation

![Geolocation Step](images/geolocation-step.png)

#### 5 Modes Disponibles

##### 1. 📍 Exact

**Utilisation**: Coordonnées GPS précises connues

- Utilise les coordonnées exactes du fichier
- Aucune transformation appliquée
- **Requis**: Colonnes `longitude` et `latitude` mappées

**Exemple**:
```csv
name,longitude,latitude
S001,1.250000,8.500000
```
→ Point positionné exactement à (1.250000, 8.500000)

##### 2. 🏘️ Centroïde de Commune

**Utilisation**: Seulement le nom de commune connu

- Place le sondage au centre géométrique de la commune
- Utilise les limites administratives du Togo
- **Requis**: Colonne `commune` mappée

**Exemple**:
```csv
name,commune
S001,Lomé
S002,Kara
```
→ Positionnés aux centroïdes de Lomé et Kara

##### 3. 🎲 Géolocalisation Aléatoire (avec Jitter)

**Utilisation**: Coordonnées connues mais anonymisation requise

- Ajoute un bruit aléatoire aux coordonnées
- **Seed**: Pour reproductibilité (même seed = mêmes positions)
- **Rayon de jitter**: Distance max de déplacement en mètres

**Configuration**:
- **Seed**: `12345` (nombre entier)
- **Rayon**: `100` (mètres)

**Exemple**:
```csv
name,longitude,latitude
S001,1.250000,8.500000
```
→ Déplacé aléatoirement dans un rayon de 100m

**Cas d'usage**:
- Protection de données sensibles
- Anonymisation pour publication
- Floutage géographique

##### 4. 📐 Maille Administrative

**Utilisation**: Placer sur grille administrative régulière

- Arrondit les coordonnées à une grille de précision donnée
- Exemple: Grille 1km × 1km

**Configuration**:
- Taille de maille en mètres (défaut: 1000m)

**Exemple**:
- Point à (1.2534, 8.5678) → Arrondi à (1.25, 8.57)

##### 5. ❓ Inconnu

**Utilisation**: Aucune information géographique disponible

- Aucune géométrie créée
- Sondage importé sans position
- Peut être géolocalisé manuellement plus tard

**Note**: Les sondages sans géométrie n'apparaissent pas sur la carte.

#### Validation Automatique

Le système vérifie:
- ✅ Coordonnées dans les limites du **Togo** (lon: 0-2°, lat: 6-11.5°)
- ✅ Commune existe dans le référentiel administratif
- ✅ Seed et rayon valides pour mode aléatoire

---

### Étape 4: Prévisualisation

![Preview Step](images/preview-step.png)

#### Tableau de Données

**Filtrage**:
- **Tous**: Affiche toutes les lignes
- **OK**: Seulement les lignes valides (icône ✅)
- **Avertissements**: Lignes avec warnings (icône ⚠️)
- **Erreurs**: Lignes invalides (icône ❌)

**Pagination**:
- 20 lignes par page
- Navigation page par page

**Colonnes**:
- **Statut**: Icône visuelle du statut de validation
- **Nom**: Nom du sondage
- **Coordonnées**: Longitude, Latitude
- **Profondeur**: Si format long
- **Messages**: Erreurs ou avertissements détaillés

#### Carte Interactive

**Légende**:
- 🟢 **Vert**: Sondages valides
- 🟡 **Jaune**: Avertissements
- 🔴 **Rouge**: Erreurs

**Interactions**:
- Cliquez sur un marqueur pour voir les détails
- Zoom/Pan pour explorer
- Cluster automatique si > 100 points

#### Statistiques

Tableau de bord en temps réel:

| Statistique | Description |
|-------------|-------------|
| **Total** | Nombre total de lignes |
| **OK** | Lignes valides prêtes à l'import |
| **Avertissements** | Lignes avec warnings (importables) |
| **Erreurs** | Lignes invalides (non importées) |
| **Doublons** | Lignes dupliquées détectées |

#### Dry-Run API

La prévisualisation appelle l'API en mode **dry-run**:
- Valide toutes les données
- Génère empreintes digitales
- Détecte doublons
- **N'importe rien en base**

#### Exporter le Rapport CSV

Cliquez sur **"Exporter CSV"** pour télécharger:
- Liste complète des lignes avec statuts
- Messages d'erreur détaillés
- Utile pour correction des données sources

---

### Étape 5: Progression de l'Import

![Progress Step](images/progress-step.png)

#### Statuts d'Import

| Statut | Icône | Description |
|--------|-------|-------------|
| **En attente** | ⏳ | Job dans la queue |
| **En cours** | ⚙️ | Import en traitement |
| **Réussi** | ✅ | Import 100% réussi |
| **Partiel** | ⚠️ | Import avec quelques erreurs |
| **Échec** | ❌ | Import complètement échoué |
| **Annulé** | 🚫 | Annulé par utilisateur |

#### Barre de Progression

- Affichage en temps réel du pourcentage
- Animation pour indiquer l'activité
- Durée écoulée affichée

#### Statistiques en Direct

Mise à jour toutes les 2 secondes:
- Nombre total de lignes
- Succès
- Erreurs
- Avertissements
- Doublons détectés
- Lignes ignorées

#### Actions Disponibles

**Pendant l'import**:
- **Annuler**: Stoppe l'import immédiatement (données déjà importées restent)

**Après succès**:
- **Télécharger le rapport**: CSV avec détails de chaque ligne
- **Nouvel import**: Recommencer un import

**Après échec**:
- **Réessayer**: Relance avec mêmes paramètres
- **Nouvel import**: Recommencer depuis le début

#### Téléchargement du Rapport Final

Le rapport contient:
- Statut de chaque ligne (succès/erreur)
- Messages d'erreur détaillés
- ID des sondages créés
- Doublons détectés

Format: `import_report_{job_id}.csv`

---

## Formats de Fichiers Supportés

### 1. CSV (Comma-Separated Values)

#### Encodage

Supporté automatiquement:
- **UTF-8** (recommandé)
- **Latin-1** (ISO-8859-1) pour accents français

#### Séparateurs

Détection automatique:
- Virgule: `,`
- Point-virgule: `;`
- Tabulation: `\t`

#### Exemple Format Long

```csv
name,longitude,latitude,depth,silt,sand,clay
S001,1.2500,8.5000,0,20,40,40
S001,1.2500,8.5000,5,25,35,40
S001,1.2500,8.5000,10,30,30,40
S002,1.3000,8.6000,0,15,45,40
```

**Caractéristiques**:
- 1 ligne = 1 mesure à une profondeur donnée
- Plusieurs lignes pour un même sondage
- Colonne `depth` obligatoire

#### Exemple Format Large

```csv
name,longitude,latitude,depth_0_silt,depth_0_sand,depth_5_silt,depth_5_sand
S001,1.2500,8.5000,20,40,25,35
S002,1.3000,8.6000,15,45,20,40
```

**Caractéristiques**:
- 1 ligne = 1 sondage complet
- Colonnes nommées: `depth_{profondeur}_{paramètre}`
- Toutes les profondeurs sur la même ligne

#### Guillemets et Caractères Spéciaux

```csv
name,description,notes
"Sondage 1","Description avec, virgule","Notes: important!"
"Sondage 2","Texte avec ""guillemets""","Multi
ligne"
```

### 2. Excel (XLSX)

#### Structure

- **Feuille 1** lue par défaut
- **Ligne 1** = En-têtes de colonnes
- **Lignes 2+** = Données

#### Exemple

| name | longitude | latitude | depth | silt | sand |
|------|-----------|----------|-------|------|------|
| S001 | 1.2500 | 8.5000 | 0 | 20 | 40 |
| S001 | 1.2500 | 8.5000 | 5 | 25 | 35 |
| S002 | 1.3000 | 8.6000 | 0 | 15 | 45 |

#### Conseils

- Utilisez des **nombres** pour coordonnées et profondeurs (pas de texte)
- Évitez les **cellules fusionnées**
- Supprimez les **lignes vides**
- Nommez les colonnes clairement

### 3. JSON

#### Format Tableau

```json
[
  {
    "name": "S001",
    "longitude": 1.2500,
    "latitude": 8.5000,
    "depth": 0,
    "silt": 20,
    "sand": 40,
    "clay": 40
  },
  {
    "name": "S001",
    "longitude": 1.2500,
    "latitude": 8.5000,
    "depth": 5,
    "silt": 25,
    "sand": 35,
    "clay": 40
  }
]
```

#### Format Objet Imbriqué

```json
{
  "sondages": [
    {
      "name": "S001",
      "coords": {
        "longitude": 1.2500,
        "latitude": 8.5000
      },
      "mesures": [
        {"depth": 0, "silt": 20, "sand": 40},
        {"depth": 5, "silt": 25, "sand": 35}
      ]
    }
  ]
}
```

**Note**: Les chemins imbriqués sont aplatis automatiquement:
- `coords.longitude` → colonne `coords.longitude`
- `mesures[0].depth` → ligne par élément du tableau

---

## Configuration du Mapping

### Champs Obligatoires vs Optionnels

#### Obligatoires (*)

Pour un import minimal:

1. **name** (Identité)
2. **longitude** OU **commune** (Localisation)
3. **latitude** (si longitude fourni)

#### Recommandés

Pour un import complet:

- **code**: Traçabilité
- **type_sondage**: Classification
- **depth_field**: Données géotechniques
- **date**: Historique
- **operateur**: Suivi qualité

### Exemples de Mapping

#### Cas 1: Import Simple (Positions GPS)

**Fichier CSV**:
```csv
nom,x,y
S001,1.25,8.50
S002,1.30,8.60
```

**Mapping**:
- `nom` → **name**
- `x` → **longitude**
- `y` → **latitude**

#### Cas 2: Import avec Commune

**Fichier CSV**:
```csv
reference,ville
PROJ-001,Lomé
PROJ-002,Kara
```

**Mapping**:
- `reference` → **name**
- `ville` → **commune**

**Mode géolocalisation**: Centroïde de commune

#### Cas 3: Import Complet avec Données

**Fichier CSV**:
```csv
name,code,type,long,lat,prof,param,val,date,societe
S001,PROJ-01,SPT,1.25,8.50,0,silt,20,2025-01-15,GeoTech
S001,PROJ-01,SPT,1.25,8.50,5,silt,25,2025-01-15,GeoTech
```

**Mapping**:
- `name` → **name**
- `code` → **code**
- `type` → **type_sondage**
- `long` → **longitude**
- `lat` → **latitude**
- `prof` → **depth_field**
- `param` → **param_field**
- `val` → **value_field**
- `date` → **date**
- `societe` → **operateur**

---

## Modes de Géolocalisation

### Choisir le Bon Mode

#### Arbre de Décision

```
Avez-vous des coordonnées GPS précises ?
├─ OUI → Mode EXACT
└─ NON
   ├─ Avez-vous le nom de commune ?
   │  └─ OUI → Mode CENTROÏDE
   └─ NON
      ├─ Voulez-vous anonymiser ?
      │  └─ OUI → Mode ALÉATOIRE
      ├─ Voulez-vous une grille ?
      │  └─ OUI → Mode MAILLE
      └─ Aucune info géo ?
         └─ Mode INCONNU
```

### Tableau Comparatif

| Mode | Précision | Requis | Cas d'usage |
|------|-----------|--------|-------------|
| **Exact** | GPS précis | lon, lat | Levés topographiques |
| **Centroïde** | ~1-10 km | commune | Localisation approx. |
| **Aléatoire** | Variable | lon, lat | Anonymisation |
| **Maille** | ~100m-1km | lon, lat | Données statistiques |
| **Inconnu** | Aucune | - | Import sans position |

### Exemples Concrets

#### Exemple 1: Étude Géotechnique Précise

**Contexte**: Sondages pour fondations d'un bâtiment

**Données**: Coordonnées GPS RTK (précision cm)

**Mapping**:
```csv
name,longitude,latitude,altitude
FND-01,1.254789,8.501234,145.67
FND-02,1.254812,8.501298,145.89
```

**Configuration**:
- Mode: **Exact**
- Pas de transformation

**Résultat**: Sondages positionnés au centimètre près

---

#### Exemple 2: Inventaire Communal

**Contexte**: Recensement de sondages anciens

**Données**: Seulement le nom de ville connu

**Mapping**:
```csv
reference,commune,année
INV-1985-01,Lomé,1985
INV-1985-02,Kara,1985
INV-1990-03,Sokodé,1990
```

**Configuration**:
- Mode: **Centroïde de commune**

**Résultat**: Tous les sondages de Lomé au centre de Lomé

---

#### Exemple 3: Publication Anonymisée

**Contexte**: Données sensibles pour publication

**Données**: Coordonnées précises mais à flouter

**Mapping**:
```csv
name,longitude,latitude
ANON-01,1.254789,8.501234
ANON-02,1.256123,8.503456
```

**Configuration**:
- Mode: **Aléatoire**
- Seed: `42` (reproductible)
- Rayon: `500` (500 mètres)

**Résultat**: Positions déplacées aléatoirement dans un rayon de 500m

---

## Validation et Prévisualisation

### Règles de Validation

#### Coordonnées

**Longitude** (Togo):
- ✅ Entre `0.0°` et `2.0°` Est
- ❌ En dehors → Erreur: *"Longitude hors du Togo"*

**Latitude** (Togo):
- ✅ Entre `6.0°` et `11.5°` Nord
- ❌ En dehors → Erreur: *"Latitude hors du Togo"*

**Exemple**:
```csv
name,longitude,latitude
S001,1.25,8.50    ✅ OK
S002,5.00,8.50    ❌ Erreur: lon hors limites
S003,1.25,15.00   ❌ Erreur: lat hors limites
```

#### Communes

Liste des communes valides du Togo:
- Lomé, Kara, Sokodé, Kpalimé, Atakpamé, Dapaong, Tsévié, Aného, etc.

**Exemple**:
```csv
name,commune
S001,Lomé       ✅ OK
S002,Paris      ❌ Erreur: commune inconnue
```

#### Champs Obligatoires

- **name**: Ne peut pas être vide
- **longitude** + **latitude**: Si mode géoloc Exact
- **commune**: Si mode géoloc Centroïde

**Exemple**:
```csv
name,longitude,latitude
,1.25,8.50         ❌ Erreur: name manquant
S001,,8.50         ❌ Erreur: longitude manquante
```

#### Doublons

Détection par **empreinte digitale** (fingerprint):
- Hash SHA-256 de: `name + longitude + latitude`
- Si 2 lignes ont même hash → Doublon

**Exemple**:
```csv
name,longitude,latitude
S001,1.25,8.50
S001,1.25,8.50    ⚠️ Warning: doublon détecté
S001,1.26,8.50    ✅ OK: coordonnées différentes
```

**Action**: Ligne dupliquée ignorée (seule la 1ère est importée)

### Messages de Validation

#### Types de Messages

| Type | Icône | Gravité | Action |
|------|-------|---------|--------|
| ✅ OK | Vert | Aucune | Import |
| ⚠️ Warning | Jaune | Mineure | Import avec note |
| ❌ Error | Rouge | Bloquante | Ligne ignorée |

#### Exemples de Messages

**Erreurs**:
- *"Longitude hors du Togo (0.0 - 2.0): 5.0"*
- *"Champ obligatoire manquant: name"*
- *"Commune inconnue: Paris"*
- *"Format de date invalide: 2025-13-45"*

**Avertissements**:
- *"Doublon détecté (ligne 5 et ligne 12)"*
- *"Altitude négative: -10.5"*
- *"Valeur aberrante pour silt: 150%"*

---

## Gestion des Erreurs

### Stratégies d'Import

#### Import Partiel

Par défaut: **Continue malgré les erreurs**

- Lignes valides → Importées
- Lignes avec erreurs → Ignorées
- Résultat: Statut **Partial**

**Exemple**:
- 100 lignes total
- 80 lignes OK → Importées
- 20 lignes erreur → Ignorées
- **Résultat**: 80 sondages créés, statut "Partiel"

#### Import Strict

Option future: **Tout ou rien**

- Si 1 seule erreur → Annulation complète
- Soit 100% succès, soit 0%

### Correction des Erreurs

#### Workflow Recommandé

1. **Lancer prévisualisation** (dry-run)
2. **Exporter le rapport CSV** avec erreurs
3. **Corriger le fichier source**
4. **Recharger** et prévisualiser
5. **Importer** quand 100% OK

#### Outils d'Aide

**Filtrage**:
- Afficher seulement lignes **Erreurs**
- Identifier rapidement les problèmes

**Export CSV**:
- Colonnes: `line`, `name`, `status`, `error_message`
- Ouvrir dans Excel pour correction

### Erreurs Courantes

#### 1. Coordonnées Hors Togo

**Symptôme**:
```
❌ Longitude hors du Togo (0.0 - 2.0): 25.123
```

**Cause**: Mauvais système de coordonnées (probablement UTM au lieu de WGS84)

**Solution**: Convertir vos coordonnées en WGS84 (degrés décimaux)

---

#### 2. Commune Inconnue

**Symptôme**:
```
❌ Commune inconnue: Lome
```

**Cause**: Faute de frappe ou accent manquant

**Solution**: Vérifier orthographe → `Lomé` (avec accent)

---

#### 3. Format de Date Invalide

**Symptôme**:
```
❌ Format de date invalide: 15/01/2025
```

**Cause**: Format non ISO

**Solution**: Utiliser format ISO 8601 → `2025-01-15`

---

#### 4. Doublons Multiples

**Symptôme**:
```
⚠️ Doublon détecté à 50 reprises
```

**Cause**: Import du même fichier plusieurs fois ou données vraiment dupliquées

**Solution**:
- Vérifier si import déjà fait
- Nettoyer le fichier source
- Utiliser fonction de dédoublonnage Excel

---

## FAQ

### Questions Générales

**Q: Quelle est la taille maximale de fichier ?**
R: 50 MB par fichier. Pour fichiers plus gros, diviser en plusieurs imports.

**Q: Combien de temps prend un import ?**
R: ~1000 lignes/seconde. Exemple: 10,000 lignes ≈ 10 secondes.

**Q: Puis-je annuler un import en cours ?**
R: Oui, cliquez sur "Annuler". Les données déjà importées restent en base.

**Q: Les imports sont-ils réversibles ?**
R: Oui, chaque import a un `import_id` unique. Possible de supprimer tous les sondages d'un import.

---

### Formats et Encodage

**Q: Mon fichier CSV a des accents mal affichés**
R: Votre fichier est probablement en Latin-1. Le système détecte automatiquement, mais vous pouvez forcer UTF-8 dans votre éditeur.

**Q: Excel affiche mes coordonnées en notation scientifique**
R: Formater les colonnes en "Nombre" avec 6 décimales.

**Q: Puis-je importer plusieurs feuilles Excel ?**
R: Non, seulement la 1ère feuille. Créer un fichier par feuille si besoin.

---

### Mapping et Validation

**Q: L'auto-mapping ne détecte pas mes colonnes**
R: Utilisez des noms standards (longitude, latitude, name, etc.) ou faites le mapping manuellement.

**Q: Comment importer sans coordonnées GPS ?**
R: Utilisez le mode "Centroïde de commune" (avec colonne commune) ou "Inconnu".

**Q: Mes coordonnées sont en UTM, comment convertir ?**
R: Utilisez un outil comme QGIS ou un script Python avec pyproj. Le système n'accepte que WGS84.

**Q: Puis-je importer des sondages en dehors du Togo ?**
R: Non, validation stricte des limites du Togo. Contactez admin pour autres pays.

---

### Géolocalisation

**Q: Quelle différence entre mode Exact et Aléatoire ?**
R: Exact utilise coordonnées brutes. Aléatoire ajoute un "bruit" pour anonymiser.

**Q: Le mode Aléatoire donne toujours les mêmes positions**
R: Normal si vous utilisez le même seed. Changez le seed pour positions différentes.

**Q: Comment choisir le rayon de jitter ?**
R: Dépend du niveau d'anonymisation:
  - 50m: Anonymisation légère
  - 500m: Anonymisation moyenne
  - 5000m: Anonymisation forte

---

### Données Géotechniques

**Q: Quelle différence entre format Long et Large ?**
R:
- **Long**: 1 ligne par mesure (colonnes: depth, param, value)
- **Large**: 1 ligne par sondage (colonnes: depth_0_silt, depth_5_silt, etc.)

**Q: Comment savoir quel format utiliser ?**
R: Le système détecte automatiquement et convertit si nécessaire.

**Q: Puis-je mélanger les deux formats ?**
R: Non, un fichier doit être homogène (soit tout long, soit tout large).

---

### Performance et Limites

**Q: Combien de sondages puis-je importer en une fois ?**
R: Testé jusqu'à 100,000 lignes. Au-delà, diviser en plusieurs fichiers.

**Q: L'import est bloqué à 50%, que faire ?**
R: Import asynchrone continue en arrière-plan. Patienter ou rafraîchir la page.

**Q: Puis-je lancer plusieurs imports en parallèle ?**
R: Oui, la file d'attente gère plusieurs jobs simultanément.

---

## Dépannage

### Problème: Fichier Non Reconnu

**Symptômes**:
- Message: *"Format de fichier non supporté"*
- Fichier rejeté au chargement

**Solutions**:
1. Vérifier extension: `.csv`, `.xlsx`, `.json` uniquement
2. Ouvrir fichier dans éditeur texte → vérifier qu'il n'est pas corrompu
3. Réenregistrer depuis Excel: "Enregistrer sous" → CSV UTF-8
4. Tester avec fichier modèle fourni

---

### Problème: Colonnes Mal Détectées

**Symptômes**:
- Toutes les données dans 1 seule colonne
- Séparateur non reconnu

**Solutions**:
1. CSV: Vérifier séparateur (`,` ou `;`)
2. Ouvrir dans Excel → "Données" → "Convertir"
3. Forcer séparateur en modifiant le fichier
4. Utiliser format XLSX à la place

---

### Problème: Erreurs de Validation en Masse

**Symptômes**:
- 100% des lignes en erreur
- Message: *"Coordonnées hors du Togo"*

**Solutions**:
1. **Vérifier système de coordonnées**: WGS84 requis (degrés décimaux)
2. **Inverser colonnes**: Peut-être lon/lat inversées
3. **Vérifier signe**: Togo est dans hémisphère Nord (lat > 0) et Est (lon > 0)

**Exemple de conversion UTM → WGS84** (Python):
```python
from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:32631", "EPSG:4326")
lat, lon = transformer.transform(easting, northing)
```

---

### Problème: Import Très Lent

**Symptômes**:
- Progression bloquée
- Import prend > 10 minutes pour 1000 lignes

**Solutions**:
1. Vérifier connexion réseau
2. Réduire taille du fichier (diviser)
3. Simplifier mapping (supprimer colonnes inutiles)
4. Désactiver mode Aléatoire (calculs intensifs)
5. Contacter administrateur

---

### Problème: Doublons Non Détectés

**Symptômes**:
- Import réussi mais sondages dupliqués en base
- Pas de warning doublons

**Solutions**:
1. Vérifier que `name + lon + lat` sont identiques
2. Petites différences (ex: 1.25000 vs 1.25001) → pas détectées comme doublons
3. Arrondir coordonnées dans fichier source à 5 décimales
4. Utiliser mode Maille pour regroupement automatique

---

### Problème: Rapport CSV Vide

**Symptômes**:
- Téléchargement réussit mais fichier vide
- Aucune ligne dans le rapport

**Solutions**:
1. Attendre fin complète de l'import
2. Rafraîchir page et retélécharger
3. Vérifier que job n'est pas annulé
4. Contacter support si problème persiste

---

## Support et Contact

### Ressources

- **Documentation technique**: `/docs/CAHIER_CHARGES_IMPORT_BULK.md`
- **Décisions d'architecture**: `/docs/IMPORT_BULK_DECISIONS.md`
- **Statut d'implémentation**: `/docs/IMPORT_BULK_IMPLEMENTATION_STATUS.md`

### Assistance

Pour toute question ou problème:
1. Consultez cette documentation
2. Vérifiez les FAQ
3. Contactez l'équipe Atlas: support@atlas-togo.org

### Rapporter un Bug

Incluez dans votre rapport:
- Fichier de test (anonymisé si sensible)
- Configuration de mapping utilisée
- Capture d'écran de l'erreur
- Rapport CSV exporté

---

## Annexes

### Annexe A: Limites Géographiques du Togo

```
Longitude: 0.0° à 2.0° Est
Latitude: 6.0° à 11.5° Nord

Coins du pays:
- Sud-Ouest: (0.0°, 6.0°)
- Sud-Est: (2.0°, 6.0°)
- Nord-Ouest: (0.0°, 11.5°)
- Nord-Est: (2.0°, 11.5°)
```

### Annexe B: Liste des Communes du Togo

Principales villes (non exhaustif):
- Lomé (capitale)
- Kara
- Sokodé
- Kpalimé
- Atakpamé
- Dapaong
- Tsévié
- Aného
- Tabligbo
- Notsé
- Bassar

### Annexe C: Formats de Date Supportés

**Recommandé**: ISO 8601
```
2025-01-15
2025-01-15T14:30:00
2025-01-15T14:30:00Z
```

**Acceptés**:
```
15/01/2025  (jour/mois/année)
01-15-2025  (mois-jour-année)
2025/01/15  (année/mois/jour)
```

### Annexe D: Exemple de Fichier Complet

```csv
name,code,type_sondage,longitude,latitude,altitude,commune,quartier,depth,param,value,date,operateur,projet,description
S001,PROJ-2025-001,SPT,1.250000,8.500000,145.5,Lomé,Bè,0.0,silt,20,2025-01-15,GeoTech Togo,Route Lomé-Kara,"Sondage de reconnaissance"
S001,PROJ-2025-001,SPT,1.250000,8.500000,145.5,Lomé,Bè,2.0,silt,22,2025-01-15,GeoTech Togo,Route Lomé-Kara,"Sondage de reconnaissance"
S001,PROJ-2025-001,SPT,1.250000,8.500000,145.5,Lomé,Bè,5.0,silt,25,2025-01-15,GeoTech Togo,Route Lomé-Kara,"Sondage de reconnaissance"
S002,PROJ-2025-002,CPT,1.300000,8.600000,152.3,Kara,Centre,0.0,resistance,1.5,2025-01-16,GeoTech Togo,Route Lomé-Kara,"Essai de pénétration"
```

---

**Fin du Guide Utilisateur**

Version 1.0 - 19 Octobre 2025
© 2025 Atlas Project Team
