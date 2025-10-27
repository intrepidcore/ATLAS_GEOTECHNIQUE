# Atlas Géotechnique – Guide des cartes thématiques (v1.5)

## 1. Introduction

### Objectif des cartes thématiques

Les cartes thématiques de l'Atlas Géotechnique permettent une **lecture rapide des tendances spatiales** des paramètres géotechniques sur le territoire togolais. Elles constituent un **support décisionnel** pour :
- Identifier les zones à risques géotechniques
- Optimiser le positionnement des futures campagnes de reconnaissance
- Communiquer visuellement les résultats d'analyses géotechniques aux décideurs
- Produire des rapports d'analyse territoriale

### Différence Vue générale vs Vue thématique

L'interface de l'Atlas propose deux modes de visualisation distincts :

**Vue générale**
- Mode de travail principal pour la gestion quotidienne des données
- Permet de gérer les sondages individuellement (ajout, modification, suppression)
- Affiche les listes tabulaires de sondages avec tri et filtrage
- Permet l'import/export de données, le géocodage
- Navigation interactive avec diagnostics ponctuels sur clic
- Vue d'ensemble permettant d'accéder aux fiches détaillées des sondages

**Vue thématique**
- Mode spécialisé pour la **publication** de cartes analytiques
- Présentation agrégée par maille H3 (hexagones)
- Un paramètre géotechnique par carte (IP moyen, VBS moyen, densité de sondages, etc.)
- Classification des valeurs en classes colorées
- Génération de légendes automatiques avec statistiques
- Export de cartes finalisées pour rapports et présentations
- Analyse macro-territoriale (zonage, identification de tendances régionales)

> **Règle d'usage** : Utilisez la vue générale pour explorer et gérer vos données. Basculez en vue thématique lorsque vous souhaitez créer une carte d'analyse thématique pour une communication ou un rapport.

---

## 2. Concepts clés de cartographie thématique

### 2.1 Modes de représentation cartographique

#### Choroplèthe (aplats de couleur)

**Définition** : Représentation où chaque maille hexagonale est colorée uniformément selon la valeur du paramètre affiché.

**Implémentation dans Atlas** :
- Chaque maille H3 reçoit une couleur déterminée par la classe dans laquelle sa valeur se situe
- La couleur est uniforme sur toute la surface de la maille
- Rendu via `L.geoJSON` avec fonction de style personnalisée
- Interaction au survol (hover) avec affichage de l'info-bulle (tooltip)

**Idéal pour** :
- Pourcentages et moyennes (IP moyen, VBS moyen, passant 80µm)
- Scores de qualité des données
- Profondeur moyenne des sondages
- Tout paramètre exprimant une **intensité spatiale**

**Exemple** : Carte de l'indice de plasticité moyen (IP) par maille, avec palette de couleurs du vert (faible plasticité) au rouge (forte plasticité).

#### Symboles proportionnels

**Définition** : Représentation où des symboles (cercles) sont positionnés au centre des mailles, leur **taille** étant proportionnelle à une valeur (et leur **couleur** pouvant porter une seconde variable).

**Implémentation dans Atlas** :
- Cercles centrés sur chaque maille via `L.circleMarker`
- Rayon calculé dynamiquement : `rayon = 5 + (n_sondages / 20) × 25` pixels
- Taille min = 5 px, taille max ≈ 30 px
- Couleur basée sur la classification du paramètre sélectionné
- Interaction au survol avec info-bulle

**Idéal pour** :
- Montrer la **densité de sondages** (taille du cercle = nombre de sondages)
- Représenter simultanément deux variables (ex : taille = densité, couleur = qualité des données)
- Mettre en évidence les disparités de couverture spatiale

**Exemple** : Carte avec cercles dont la taille représente le nombre de sondages par maille et la couleur représente la variabilité de l'IP (écart-type).

#### Comparative (en développement)

**Statut** : Fonctionnalité conçue mais **pas encore pleinement implémentée** dans la version actuelle.

**Vision** : Permettre la comparaison visuelle de deux paramètres côte-à-côte (grille 2×2 ou mode split/swipe).

---

### 2.2 Méthodes de classification

La classification consiste à **découper l'échelle de valeurs continues en classes discrètes** pour assigner une couleur à chaque classe.

#### Quantiles

**Principe** : Chaque classe contient le **même nombre de mailles**.

**Implémentation** :
- Fonction `classify_quantiles()` dans [classifier.rs:5](../services/api-geo/src/thematic/classifier.rs#L5)
- Utilise la bibliothèque `statrs` pour calculer les quantiles exacts
- Exemple : 5 classes → 20% des mailles dans chaque classe

**Avantages** :
- Met en valeur les **rangs relatifs** (où se situe une maille par rapport aux autres)
- Aucune classe vide
- Bon équilibre visuel (chaque couleur est également représentée)

**Inconvénients** :
- **Peut écraser les contrastes** si les valeurs sont très concentrées
- Ne respecte pas l'amplitude réelle des écarts entre valeurs
- Exemple : des mailles avec IP = 25% et IP = 25.5% peuvent être dans des classes différentes si elles sont à la limite d'un quantile

**Quand l'utiliser** :
- Pour une première exploration d'un paramètre inconnu
- Quand on veut mettre en évidence le **classement** des mailles
- Quand les valeurs sont uniformément réparties

#### Intervalles égaux

**Principe** : Divise la plage min-max en classes d'**amplitude identique**.

**Implémentation** :
- Fonction `classify_equal_interval()` dans [classifier.rs:25](../services/api-geo/src/thematic/classifier.rs#L25)
- Calcul simple : `interval = (max - min) / n_classes`
- Exemple : min=0, max=100, 5 classes → [0-20], [20-40], [40-60], [60-80], [80-100]

**Avantages** :
- **Lisible et intuitif** : on comprend immédiatement l'échelle
- Respecte l'amplitude réelle des valeurs
- Facile à communiquer

**Inconvénients** :
- **Sensible aux valeurs extrêmes (outliers)** : une seule maille à 500 peut créer une échelle [0-100-200-300-400-500] où 99% des mailles sont dans la première classe
- Peut créer des classes vides ou très peu peuplées

**Quand l'utiliser** :
- Pour des variables bornées ou connues (pourcentages de 0 à 100%)
- Quand l'échelle est importante à communiquer
- Si les valeurs sont bien réparties sans outliers importants

#### Jenks (seuils naturels)

**Principe** : Algorithme de **Fisher-Jenks** qui optimise la séparation des groupes en **minimisant la variance intra-classe** et en **maximisant la variance inter-classes**.

**Implémentation** :
- Fonction `classify_jenks()` dans [classifier.rs:44](../services/api-geo/src/thematic/classifier.rs#L44)
- Programmation dynamique pour trouver les breaks optimaux
- **Fallback automatique vers quantiles si > 1000 valeurs** (pour des raisons de performance)
- Message de log : `⚠️  Jenks: {n} valeurs > 1000, fallback vers quantiles`

**Avantages** :
- Produit souvent le **meilleur rendu "naturel"**
- Identifie les ruptures naturelles dans les données
- Maximise la différenciation visuelle entre classes
- Excellent pour mettre en évidence des **groupes homogènes**

**Inconvénients** :
- Calcul plus coûteux (O(n² × k) où k = nombre de classes)
- Résultats moins prévisibles que les intervalles égaux
- Peut être contre-intuitif si on ne comprend pas la méthode

**Quand l'utiliser** :
- **Par défaut**, quand les quantiles écrasent les contrastes
- Pour identifier des **zones géotechniques homogènes**
- Quand l'objectif est une carte visuellement optimale
- Pour des analyses où la détection de groupes naturels est prioritaire

**Limitation technique** : Si vous avez plus de 1000 mailles avec des valeurs non-nulles, l'algorithme bascule automatiquement en mode quantiles pour maintenir des performances acceptables.

#### Personnalisé (Custom)

**Principe** : L'utilisateur définit **manuellement les seuils** de classe en fonction de sa connaissance métier.

**Implémentation** :
- Paramètre `custom_breaks` dans la configuration de classification
- Les breaks sont appliqués directement sans calcul
- Validation : les breaks doivent être en ordre croissant

**Avantages** :
- Respecte les **normes et référentiels métiers**
- Permet des comparaisons entre cartes avec des échelles identiques
- Cohérence avec les seuils réglementaires ou scientifiques

**Exemples de seuils métiers** :
- **VBS** (argilosité) : `[0.1, 1.5, 2.5, 6, 8]`
  - < 0.1 : sol insensible à l'eau
  - 0.1-1.5 : sable limoneux
  - 1.5-2.5 : limon peu argileux
  - 2.5-6 : limon ou sol argileux
  - 6-8 : sol argileux
  - > 8 : sol très argileux

- **IP** (plasticité) : `[12, 25, 40]`
  - < 12 : peu plastique
  - 12-25 : moyennement plastique
  - 25-40 : plastique
  - > 40 : très plastique

- **Potentiel de gonflement (eg)** : `[0.5, 2, 5, 10]`
  - < 0.5% : négligeable
  - 0.5-2% : faible
  - 2-5% : moyen
  - 5-10% : fort
  - > 10% : très fort

**Quand l'utiliser** :
- Pour appliquer des **référentiels normatifs** (GTR, normes NF, etc.)
- Pour comparer des cartes entre différentes périodes avec la même échelle
- Quand vous connaissez les seuils critiques de votre domaine

---

### 2.3 Nombre de classes

**Recommandation** : **5 à 7 classes** pour un équilibre optimal entre précision et lisibilité.

**Implémentation** : Paramètre `n_classes` dans la configuration de classification.

**Règles pratiques** :
- **3-4 classes** : vision très simplifiée, pour communication grand public
- **5 classes** : valeur sûre, lisibilité optimale
- **6-7 classes** : précision accrue, pour analyse technique
- **8+ classes** : difficile à lire, trop de nuances de couleurs

**Attention** : Au-delà de 7 classes, la carte devient illisible :
- Difficulté à distinguer les couleurs voisines
- Légende surchargée
- Perte d'efficacité dans la communication visuelle

---

### 2.4 Gestion des valeurs manquantes (no-data)

**Concept** : Certaines mailles peuvent ne pas avoir de valeur pour le paramètre sélectionné (pas de sondage, ou pas d'essai du type concerné).

**Implémentation dans Atlas** :
- Les mailles sans valeur (`null` ou absence de données) sont **automatiquement masquées** (non affichées sur la carte)
- Elles ne sont pas incluses dans les calculs de classification
- Elles n'apparaissent pas dans la légende

**Bonnes pratiques** :
- **Ne jamais colorer les no-data en rouge ou dans une couleur de la palette** : cela fausserait l'interprétation
- Si vous souhaitez visualiser les zones de couverture, utilisez plutôt une carte de densité (`n_sondages`) en mode symboles proportionnels
- Le paramètre `min_sondages` permet de filtrer les mailles avec trop peu de données (voir §3.4)

**Pourquoi certaines mailles sont-elles vides ?**
- Absence de sondages dans la zone
- Sondages présents mais sans essais du type concerné (ex : pas d'essai VBS dans cette maille)
- Filtrage actif (`min_sondages` élevé élimine les mailles peu documentées)

---

### 2.5 Palettes de couleurs

**Implémentation** : Palettes ColorBrewer définies dans [colors.rs](../services/api-geo/src/thematic/colors.rs).

Les palettes disponibles dans Atlas sont :

#### Palettes séquentielles (pour valeurs croissantes)

- **Blues** (Bleus) : intensité croissante du clair au foncé
  - **Usage** : limite de liquidité (WL), teneur en eau optimale (wopt), VBS
  - Connotation : "froid", stable, professionnel

- **Greens** (Verts) : du jaune-vert au vert foncé
  - **Usage** : granulométrie, passants, végétation
  - Connotation : naturel, positif

- **Reds** (Rouges) : du rose au rouge foncé
  - **Usage** : écarts-types, variabilité, zones à risque
  - Connotation : alerte, attention requise

- **Viridis** : palette perceptuellement uniforme (jaune-vert-bleu-violet)
  - **Usage** : tout type de variable continue
  - Avantage : accessible aux daltoniens, pas de biais perceptuel

#### Palettes divergentes (pour écart à une référence)

- **RdYlGn** (Rouge-Jaune-Vert) : du rouge (négatif) au vert (positif) avec jaune central
  - **Usage** : IP (écart à un seuil), γd (densité par rapport à une référence)
  - Connotation : feu tricolore (mauvais → moyen → bon)

- **RdBu** (Rouge-Bleu) : du rouge au bleu avec blanc central
  - **Usage** : anomalies, comparaisons, différences
  - Connotation : chaud/froid, opposition

**Comment choisir une palette ?**
1. **Séquentielle** : pour une variable à sens croissant clair (densité, moyenne, cumul)
2. **Divergente** : pour une variable avec une valeur de référence centrale (écart à une norme, comparaison avant/après)
3. **Qualitative** : non disponible dans Atlas v1.5 (réservé aux catégories non ordonnées)

**Accessibilité** : La palette **Viridis** est optimisée pour les personnes daltoniennes. Privilégiez-la pour les publications destinées à un large public.

---

### 2.6 Opacité et style

**Opacité** : Paramètre `opacity` dans la configuration de style (valeur entre 0 et 1).

**Utilité** :
- Permet de voir le **fond de carte** sous les mailles colorées (contexte géographique)
- Opacité recommandée : **0.7 à 0.8** pour un bon compromis entre visibilité de la couche thématique et du fond de carte
- Opacité trop faible (< 0.5) : les couleurs sont délavées, perte d'impact visuel
- Opacité = 1 : masque complètement le fond de carte

**Autres paramètres de style** :
- `stroke_width` : épaisseur du contour des mailles (défaut : 1 px)
- `stroke_color` : couleur du contour (défaut : blanc ou gris clair)

**Astuce** : Réduire légèrement l'opacité (0.75) permet de mieux distinguer les limites administratives du fond de carte, utile pour le contexte géographique.

---

## 3. Mode d'emploi pas-à-pas

### 3.1 Ouvrir le panneau Cartes thématiques

1. Dans l'interface principale de l'Atlas, cliquez sur l'onglet ou le bouton **"Cartes thématiques"**
2. Le panneau de contrôle s'ouvre sur la droite de la carte
3. La carte passe en mode hexagonal (mailles H3)

### 3.2 Choisir Catégorie et Paramètre

**Étape 1 : Sélectionner une catégorie**

Les paramètres sont organisés en 6 catégories :

- **Densité & Couverture** : `n_sondages`, `n_essais_geo`
- **Granulométrie** : `passant_80um_avg`, `passant_2mm_avg`, `passant_20mm_avg`
- **Limites d'Atterberg** : `wl_avg`, `wp_avg`, `ip_avg`, `ip_stddev`, `ip_min`, `ip_max`
- **Bleu de Méthylène (VBS)** : `vbs_avg`, `vbs_stddev`, `vbs_min`, `vbs_max`
- **Proctor** : `gamma_d_max_avg`, `gamma_d_max_stddev`, `w_opt_avg`, `w_opt_stddev`
- **Gonflement** : `eg_avg`, `eg_stddev`, `eg_min`, `eg_max`

**Étape 2 : Sélectionner un paramètre**

Exemple : pour visualiser l'indice de plasticité moyen, sélectionnez :
- Catégorie : **Limites d'Atterberg**
- Paramètre : **Indice de plasticité IP (moyen)**

**Info affichée** : L'interface affiche l'unité du paramètre (%, g/100g, kN/m³) et une brève description.

### 3.3 (Option) Appliquer des filtres administratifs

**Filtres disponibles** :

1. **Région (ADM1)** : Maritime, Plateaux, Centrale, Kara, Savanes
2. **Préfecture (ADM2)** : liste dynamique en fonction de la région sélectionnée
3. **Commune (ADM3)** : liste dynamique en fonction de la préfecture

**Implémentation** : Filtres définis dans [thematic-types.ts:230-235](../ui/src/thematic/thematic-types.ts#L230-L235) et appliqués côté serveur dans les requêtes SQL.

**Utilisation** :
- Laissez vide pour afficher tout le territoire national
- Sélectionnez une région pour zoomer sur une zone spécifique
- Plus le filtre est précis (jusqu'à la commune), plus la carte est lisible

**Exemple** : Pour une carte de la région des Plateaux :
1. Sélectionnez ADM1 = **Plateaux**
2. Laissez ADM2 et ADM3 vides (ou spécifiez une préfecture/commune)
3. La carte se recalcule automatiquement avec uniquement les mailles de cette région

### 3.4 (Option) Définir le seuil minimum de sondages

**Paramètre** : `min_sondages` (nombre entier)

**Objectif** : Filtrer les mailles avec trop peu de données pour assurer la **qualité statistique** des agrégats.

**Valeurs recommandées** :
- **1** (défaut) : affiche toutes les mailles avec au moins un sondage
- **3** : recommandé pour des moyennes fiables
- **5** : pour des analyses de haute confiance
- **10+** : uniquement les zones très bien documentées

**Effet** :
- Les mailles avec moins de sondages que le seuil sont **masquées**
- Cela réduit le bruit visuel dans les zones peu couvertes
- Attention : un seuil trop élevé peut éliminer beaucoup de mailles

**Exemple** :
- Sans filtre (`min_sondages = 1`) : 1500 mailles affichées, dont certaines avec 1 seul sondage
- Avec `min_sondages = 3` : 800 mailles affichées, données plus robustes

**Conseil** : Testez d'abord sans filtre, puis augmentez progressivement le seuil si vous constatez trop de variabilité spatiale aléatoire.

### 3.5 Choisir le type de carte

**Options disponibles** :

1. **Choroplèthe** (défaut)
   - Aplats de couleur sur les mailles
   - Idéal pour visualiser une intensité spatiale

2. **Symboles proportionnels**
   - Cercles dont la taille représente `n_sondages`
   - Couleur représente le paramètre sélectionné
   - Idéal pour montrer la densité de couverture + une variable

3. **Comparative** (non disponible dans v1.5)

**Comment choisir ?**
- **Choroplèthe** : pour 95% des cas d'usage
- **Symboles proportionnels** : si vous voulez montrer à la fois la densité de sondages ET une variable géotechnique

### 3.6 Configurer la classification

**Étape 1 : Méthode de classification**

Sélectionnez dans le menu déroulant :
- **Quantiles** : égalité du nombre de mailles par classe
- **Intervalles égaux** : égalité des amplitudes
- **Jenks** : seuils naturels optimisés (recommandé)
- **Personnalisé** : saisie manuelle des seuils

**Étape 2 : Nombre de classes**

- Curseur ou champ numérique : de 3 à 9 classes
- **Recommandation : 5 classes**

**Étape 3 : (si Personnalisé) Saisir les breaks**

Exemple pour VBS :
- Saisir : `0.1, 1.5, 2.5, 6, 8`
- Cela créera 6 classes : `< 0.1`, `0.1-1.5`, `1.5-2.5`, `2.5-6`, `6-8`, `> 8`

**Étape 4 : Choisir une palette**

Sélectionnez parmi :
- Blues, Greens, Reds (séquentielles)
- RdYlGn, RdBu (divergentes)
- Viridis (séquentielle, accessible daltoniens)

**Conseil** : Utilisez la palette par défaut du paramètre (définie dans `THEMATIC_PARAMETERS`), sauf besoin spécifique.

### 3.7 Appliquer la configuration

Cliquez sur le bouton **"Appliquer"** ou **"Générer la carte"**.

**Actions déclenchées** :
1. Requête API vers `/thematic/data` avec les filtres
2. Chargement des données géographiques (GeoJSON)
3. Calcul de la classification côté serveur
4. Rendu de la carte avec les couleurs
5. Affichage de la légende

**Temps de chargement** :
- National complet : 1-3 secondes
- Région filtrée : < 1 seconde
- Utilisation du cache si la même requête a été faite récemment (TTL 60 secondes)

### 3.8 Lire la légende

La légende s'affiche en bas à droite de la carte (Leaflet Control).

**Éléments affichés** :
- **Classes** : intervalles de valeurs avec leur couleur respective
- **Min / Max** : valeurs extrêmes du paramètre dans la zone affichée
- **Médiane** : valeur centrale (50% des mailles sont au-dessus, 50% en-dessous)
- **Nombre de mailles** : total de mailles avec des valeurs non-nulles

**Lecture** :
- Les couleurs vont généralement du clair (valeurs faibles) au foncé (valeurs fortes)
- Les palettes divergentes ont une couleur neutre au centre (jaune, blanc)

**Interactions** :
- Cliquez sur un élément de la légende pour isoler visuellement cette classe (fonctionnalité à vérifier selon implémentation)
- Survol d'un élément : peut mettre en surbrillance les mailles de cette classe

### 3.9 Export de la carte

**Formats disponibles** :

1. **GeoJSON** (implémenté)
   - Bouton **"Exporter GeoJSON"** dans le panneau
   - Fonction `exportAsGeoJSON()` dans [thematic-maps.ts](../ui/src/thematic/thematic-maps.ts)
   - Contient : géométries + valeurs + métadonnées de classification
   - Fichier : `thematic_map_{parameter}_{timestamp}.geojson`
   - **Usage** : import dans QGIS, ArcGIS, ou autre SIG

2. **GeoPackage** (implémenté, via API)
   - Endpoint : `GET /exports/geopackage?bbox=...&adm1=...`
   - Export de 3 couches : mailles (polygones), sondages (points), essais (attributs)
   - Format standardisé OGC, compatible tous SIG

3. **PNG** (interface présente, rendu non implémenté)
   - Bouton présent dans l'UI
   - Nécessiterait un rendu serveur (Puppeteer/Headless Chrome)
   - **Statut v1.5** : non fonctionnel

4. **PDF** (non implémenté)
   - Spécifié dans la conception mais pas codé
   - Formats A4/A3 prévus
   - **Statut v1.5** : non disponible

**Procédure d'export GeoJSON** :
1. Générez votre carte thématique
2. Cliquez sur **"Exporter GeoJSON"**
3. Le fichier se télécharge automatiquement
4. Ouvrez-le dans votre logiciel SIG favori

**Métadonnées incluses dans l'export** :
- Configuration de la carte (paramètre, méthode, nombre de classes)
- Breaks de classification et couleurs
- Statistiques (min, max, médiane, écart-type)
- Date et heure d'export
- Filtres appliqués

---

## 4. Quand utiliser quelle vue ?

### Tableau récapitulatif

| Tâche | Vue recommandée | Raison |
|-------|----------------|--------|
| Ajouter de nouveaux sondages | **Vue générale** | Formulaire d'import, géocodage, validation |
| Consulter la fiche détaillée d'un sondage | **Vue générale** | Accès direct aux données tabulaires et métadonnées |
| Corriger des erreurs de saisie | **Vue générale** | Édition unitaire des fiches sondages |
| Filtrer les sondages par critères multiples | **Vue générale** | Filtres tabulaires avancés |
| Identifier les zones avec forte plasticité | **Vue thématique** | Carte IP moyen avec Jenks, palette RdYlGn |
| Comparer la couverture entre régions | **Vue thématique** | Carte n_sondages en symboles proportionnels |
| Produire une carte pour un rapport | **Vue thématique** | Export PNG/PDF avec légende et échelle |
| Analyser la variabilité spatiale de VBS | **Vue thématique** | Carte VBS moyen, choroplèthe, Jenks |
| Vérifier la qualité des données d'une campagne | **Vue générale** | Diagnostic individuel, logs de validation |
| Présenter des résultats en réunion | **Vue thématique** | Visualisation macro, impact visuel fort |

### Workflow type

**Phase 1 : Acquisition et consolidation**
- Utilisez la **vue générale** pour importer, géocoder, valider les données
- Corrigez les erreurs, complétez les métadonnées
- Vérifiez la couverture spatiale avec la carte de localisation

**Phase 2 : Analyse et interprétation**
- Basculez en **vue thématique**
- Créez plusieurs cartes par paramètre clé (IP, VBS, eg, profondeur)
- Testez différentes méthodes de classification pour identifier les tendances
- Affinez les filtres (région, min_sondages) pour cibler les zones d'intérêt

**Phase 3 : Communication et rapport**
- Exportez les cartes finalisées (GeoJSON pour SIG, PNG/PDF pour rapports)
- Revenez à la **vue générale** pour extraire les données tabulaires associées
- Combinez cartes thématiques + tableaux statistiques dans vos livrables

---

## 5. Bonnes pratiques cartographiques

### 5.1 Limiter l'étendue spatiale

**Problème** : Une carte nationale avec 2000 mailles peut être difficile à lire, surtout si les valeurs sont très variables.

**Solution** : Utilisez les **filtres administratifs** (ADM1, ADM2) ou une **bounding box** pour restreindre la zone d'intérêt.

**Exemple** :
- Carte nationale → difficulté à distinguer les détails d'une préfecture
- Carte filtrée sur **Préfecture de Yoto** → zoom approprié, lecture aisée

**Implémentation** :
- Filtres ADM : sélection dans le panneau
- Bbox : définir manuellement `[lon_min, lat_min, lon_max, lat_max]` dans la requête API (usage avancé)

### 5.2 Masquer les no-data

**Règle d'or** : **Ne jamais colorer les mailles sans données** avec une couleur de la palette.

**Dans Atlas** : Les mailles sans valeur sont automatiquement masquées (non affichées). Vous n'avez rien à faire.

**Mauvaise pratique** : Afficher les no-data en rouge ou en gris avec une classe "Pas de données" dans la légende.
- Cela fausse l'interprétation visuelle
- Le lecteur peut confondre "pas de données" avec "valeur extrême"

**Bonne pratique** :
- Masquer les no-data (comportement par défaut d'Atlas)
- Si vous souhaitez montrer la couverture spatiale, créez une carte séparée avec le paramètre `n_sondages`

### 5.3 Tester Jenks si quantiles écrasent les contrastes

**Symptôme** : Vous avez appliqué la méthode Quantiles, et toutes les mailles semblent avoir des couleurs similaires, malgré des écarts de valeurs importants.

**Cause** : Les quantiles découpent par nombre de mailles, pas par amplitude de valeurs. Si 80% des mailles ont IP entre 15 et 20%, et 20% ont IP entre 20 et 50%, les quantiles créeront 5 classes dont 4 seront dans [15-20%].

**Solution** : Basculez vers la méthode **Jenks** :
1. Ouvrez la configuration de classification
2. Sélectionnez **"Jenks (seuils naturels)"**
3. Cliquez sur **"Appliquer"**
4. Observez la différence : les breaks s'ajustent aux ruptures naturelles dans les données

**Résultat** : Meilleure différenciation visuelle, les classes correspondent à des groupes réellement distincts.

### 5.4 Règle des 5 classes + palette séquentielle

**Configuration "valeur sûre"** pour une première carte :
- **Nombre de classes** : 5
- **Méthode** : Jenks
- **Palette** : Blues, Greens, ou Viridis (séquentielle)
- **Opacité** : 0.75

**Pourquoi 5 classes ?**
- Suffisamment de détails pour voir les nuances
- Pas trop pour rester lisible
- Correspond à des catégories sémantiques simples : très faible / faible / moyen / fort / très fort

**Exemple appliqué** :
- Paramètre : IP moyen
- 5 classes Jenks : [< 10%, 10-18%, 18-28%, 28-40%, > 40%]
- Palette Viridis : jaune (faible) → bleu (moyen) → violet (fort)

### 5.5 Symboles : adapter taille min/max

**Pour les cartes en symboles proportionnels** :

**Paramètres de taille** (implémentation actuelle) :
- Rayon min : 5 px
- Rayon max : ~30 px (pour n_sondages élevés)
- Formule : `rayon = 5 + (n_sondages / 20) × 25`

**Problème potentiel** : Si le nombre de sondages varie énormément (ex : de 1 à 500), les petits cercles peuvent être invisibles.

**Ajustements possibles** (nécessite modification du code) :
- Adapter le diviseur : `/ 50` au lieu de `/ 20` pour réduire la taille max
- Utiliser une échelle logarithmique : `rayon = 5 + Math.log10(n_sondages) × 10`

**Couleur** : Choisissez une palette douce (Blues, Greens) pour ne pas surcharger visuellement, car la taille porte déjà une information.

### 5.6 Annotations et éléments de contexte

**Annotations** (non implémentées dans v1.5, mais bonnes pratiques) :
- Ajouter des étiquettes textuelles pour les 5 mailles avec les valeurs les plus élevées/faibles
- Exemple : "IP max = 52% (Lomé Commune 1)"
- Cela aide le lecteur à identifier immédiatement les cas extrêmes

**Barre d'échelle** :
- Toujours présente sur les fonds de carte OpenStreetMap
- Vérifiez qu'elle soit visible et lisible (pas masquée par la légende)

**Sources et métadonnées** :
- Lors de l'export, incluez toujours :
  - Titre de la carte
  - Paramètre affiché et unité
  - Méthode de classification
  - Source des données ("Atlas Géotechnique du Togo, MERF")
  - Date de génération
  - Auteur/organisme
  - Filtres appliqués (région, min_sondages)

**Astuce pour l'impression** : Si vous exportez en PDF (quand implémenté), privilégiez l'orientation **paysage** (A4/A3) pour maximiser l'espace cartographique.

---

## 6. Exemples guidés

### Exemple 1 : IP moyen en Région des Plateaux

**Objectif** : Créer une carte de l'indice de plasticité moyen pour identifier les zones argileuses dans la région des Plateaux.

**Étapes** :

1. **Ouvrir la vue thématique**
   - Cliquez sur l'onglet "Cartes thématiques"

2. **Sélectionner le paramètre**
   - Catégorie : **Limites d'Atterberg**
   - Paramètre : **Indice de plasticité IP (moyen)**

3. **Appliquer les filtres**
   - ADM1 : **Plateaux**
   - Min sondages : **3** (pour des moyennes fiables)

4. **Configurer la classification**
   - Type de carte : **Choroplèthe**
   - Méthode : **Jenks**
   - Nombre de classes : **5**
   - Palette : **Greens** (ou RdYlGn pour une vision "risque")

5. **Appliquer et analyser**
   - Cliquez sur "Appliquer"
   - Observez la légende : breaks adaptés aux données locales
   - Exemple de résultat : [< 8%, 8-15%, 15-25%, 25-38%, > 38%]

6. **Interprétation**
   - Zones vertes foncées (IP > 38%) : sols très argileux, risque de gonflement, précautions géotechniques nécessaires
   - Zones vertes claires (IP < 15%) : sols peu plastiques, meilleure portance

7. **Export**
   - Exporter en GeoJSON pour analyse dans QGIS
   - Créer une couche de zonage réglementaire basée sur ces résultats

### Exemple 2 : VBS moyen national avec seuils personnalisés

**Objectif** : Cartographier l'argilosité (VBS) sur tout le territoire avec des seuils normatifs.

**Étapes** :

1. **Sélectionner le paramètre**
   - Catégorie : **Bleu de Méthylène (VBS)**
   - Paramètre : **Valeur de Bleu VBS (moyenne)**

2. **Pas de filtre ADM** (carte nationale)
   - Laisser ADM1, ADM2, ADM3 vides
   - Min sondages : **2**

3. **Classification personnalisée**
   - Type de carte : **Choroplèthe**
   - Méthode : **Personnalisé**
   - Saisir les breaks : `0.1, 1.5, 2.5, 6, 8`
   - Palette : **Blues**

4. **Résultat**
   - 6 classes normatives :
     - < 0.1 : Sol insensible à l'eau
     - 0.1-1.5 : Sable limoneux
     - 1.5-2.5 : Limon peu argileux
     - 2.5-6 : Sol argileux
     - 6-8 : Sol très argileux
     - > 8 : Sol extrêmement argileux

5. **Interprétation**
   - Zones bleues foncées (VBS > 8) : argiles gonflantes probables, études complémentaires requises
   - Zones bleues claires (VBS < 2.5) : sols sableux ou limoneux, bonne stabilité

6. **Communication**
   - Cette carte avec seuils normatifs peut être intégrée directement dans un rapport sans explication supplémentaire (référentiel connu)

### Exemple 3 : Densité de sondages avec symboles proportionnels

**Objectif** : Visualiser la couverture spatiale des sondages et identifier les zones sous-documentées.

**Étapes** :

1. **Sélectionner le paramètre**
   - Catégorie : **Densité & Couverture**
   - Paramètre : **Nombre de sondages**

2. **Pas de filtre** (vue d'ensemble nationale)
   - Min sondages : **1** (on veut tout voir)

3. **Type de carte symboles**
   - Type de carte : **Symboles proportionnels**
   - Méthode : **Quantiles** (peu importe, on s'intéresse surtout à la taille)
   - Nombre de classes : **5**
   - Palette : **Blues**

4. **Résultat**
   - Grands cercles : mailles avec 20+ sondages (zones bien documentées)
   - Petits cercles : mailles avec 1-3 sondages (couverture faible)
   - Couleur : bleu clair (peu de sondages) → bleu foncé (beaucoup de sondages)

5. **Analyse**
   - Identifier visuellement les "trous" dans la couverture (zones sans cercles ou avec très petits cercles)
   - Prioriser les futures campagnes de reconnaissance dans ces zones

6. **Variante avancée**
   - Taille = n_sondages
   - Couleur = data_quality_score (score de qualité des données)
   - Permet d'identifier les zones avec beaucoup de sondages mais de faible qualité

### Exemple 4 : Comparaison multi-paramètres (workflow manuel)

**Objectif** : Comparer IP moyen et VBS moyen sur la même zone pour identifier une corrélation.

**Étapes** :

1. **Créer la première carte (IP)**
   - Paramètre : IP moyen
   - Filtre : ADM1 = Maritime
   - Méthode : Jenks, 5 classes
   - Exporter en GeoJSON

2. **Créer la seconde carte (VBS)**
   - Paramètre : VBS moyen
   - Même filtre : ADM1 = Maritime
   - Méthode : Jenks, 5 classes
   - Exporter en GeoJSON

3. **Analyse dans QGIS**
   - Importer les deux GeoJSON
   - Effectuer une jointure spatiale sur les identifiants de mailles (H3 index)
   - Créer un graphique de corrélation IP vs VBS
   - Identifier les mailles avec IP élevé ET VBS élevé (argiles problématiques)

4. **Alternative dans Atlas (future v2.0)**
   - Mode **Comparative** : affichage côte-à-côte ou en split
   - Sélection interactive des mailles pour comparaison directe

---

## 7. Export et impression

### 7.1 Formats d'export disponibles

#### GeoJSON (opérationnel)

**Déclenchement** : Bouton "Exporter GeoJSON" dans le panneau thématique

**Contenu du fichier** :
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "h3_index": "8843d5b7fffffff",
        "n_sondages": 12,
        "ip_avg": 24.5,
        "class_index": 2,
        "class_label": "18.0 - 28.0",
        "color": "#78c679"
      }
    },
    ...
  ],
  "metadata": {
    "parameter": "ip_avg",
    "parameter_label": "Indice de plasticité IP (moyen)",
    "unit": "%",
    "classification": {
      "method": "jenks",
      "n_classes": 5,
      "breaks": [10, 18, 28, 40],
      "colors": ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"]
    },
    "statistics": {
      "min": 2.3,
      "max": 52.1,
      "mean": 22.8,
      "median": 21.5
    },
    "export_timestamp": "2025-01-15T14:32:10Z"
  }
}
```

**Usage** :
- Import dans QGIS : Couche → Ajouter une couche vecteur → GeoJSON
- Stylisation automatique possible avec les propriétés `color` et `class_label`
- Analyse spatiale : croisements, buffers, agrégation

#### GeoPackage (opérationnel)

**Déclenchement** : Requête API `GET /exports/geopackage`

**Contenu** : 3 couches distinctes
1. **mailles_stats** (polygones H3) : géométrie + agrégats par maille
2. **sondages** (points) : localisation + métadonnées des sondages
3. **essais** (table attributaire) : résultats d'essais liés aux sondages

**Filtres applicables** :
- `?bbox=-1.2,6.1,1.8,11.1` : bounding box
- `?adm1=Maritime` : région
- `?adm2=Golfe` : préfecture
- `?adm3=Lomé` : commune

**Usage** :
- Import complet dans un SIG pour analyse avancée
- Base de données spatiale portable (un seul fichier .gpkg)
- Compatible ArcGIS, QGIS, Python (GeoPandas)

#### PNG (non fonctionnel en v1.5)

**État** : Interface présente (bouton "Exporter PNG"), mais **rendu non implémenté**.

**Nécessite** (développement futur) :
- Capture de la carte Leaflet via `html2canvas` ou `leaflet-image`
- Ou rendu côté serveur avec Puppeteer/Headless Chrome
- Inclusion de la légende, titre, échelle, crédits

**Usage prévu** :
- Intégration directe dans des documents Word/PowerPoint
- Partage rapide par email
- Rapport illustré

**Formats prévus** :
- Résolution : 300 DPI (impression) ou 150 DPI (web)
- Dimensions : adaptées à la résolution de l'écran

#### PDF (non implémenté)

**État** : Spécifié dans la conception, **pas de code**.

**Fonctionnalités prévues** :
- Gabarits A4 / A3, orientation portrait ou paysage
- Composeur d'impression avec champs :
  - Titre de la carte
  - Sous-titre (ex : "Région Maritime, 2025")
  - Auteur / Organisme
  - Date de génération
  - Échelle graphique
  - Légende compacte (sur le côté ou en bas)
  - Crédits et sources
- Export multi-pages si plusieurs paramètres sélectionnés

**Bibliothèques envisagées** :
- Frontend : jsPDF + canvas
- Backend : ReportLab (Python), ou génération LaTeX

**Usage prévu** :
- Rapports officiels imprimés
- Annexes cartographiques normalisées
- Distribution par voie postale

### 7.2 Composeur d'impression (fonctionnalité future)

**Concept** : Interface graphique pour composer une mise en page cartographique professionnelle avant export.

**Éléments configurables** :
- **Titre** : champ texte libre (ex : "Indice de plasticité moyen - Région des Plateaux")
- **Sous-titre** : date, campagne, contexte
- **Auteur** : nom de l'ingénieur ou de l'organisme
- **Logo** : upload d'un logo institutionnel (coin supérieur)
- **Légende** : position (droite, bas, flottante), taille, police
- **Échelle** : graphique ou numérique (ex : 1:500000)
- **Orientation** : Nord géographique (flèche)
- **Crédits** : "Fond de carte © OpenStreetMap, Données © Atlas Géotechnique Togo"
- **Format de page** : A4, A3, custom
- **Orientation** : paysage (recommandé) ou portrait

**Workflow prévu** :
1. Générer la carte thématique
2. Cliquer sur "Composer pour impression"
3. Remplir les champs du composeur
4. Prévisualisation en temps réel
5. Exporter en PDF ou PNG haute résolution

**État v1.5** : Non implémenté. Export direct GeoJSON uniquement.

### 7.3 Astuces pour améliorer la lisibilité à l'export

#### Problème : Zones avec faible couverture

**Symptôme** : La carte exportée montre beaucoup de "trous" (mailles non colorées) dans certaines régions.

**Solutions** :
1. **Augmenter la transparence du fond** : permet de voir le contexte géographique même sans données
2. **Ajouter une couche de fond "densité de sondages"** en semi-transparence sous la couche thématique
3. **Appliquer un filtre ADM** pour zoomer sur les zones bien documentées
4. **Augmenter le niveau de zoom** : à zoom élevé (>12), les mailles H3 sont plus petites, donc moins de trous visibles

#### Problème : Couleurs trop vives ou trop pâles

**Solutions** :
- **Trop vives** : réduire l'opacité à 0.6-0.7
- **Trop pâles** : augmenter l'opacité à 0.85-0.95, ou choisir une palette plus contrastée (Viridis au lieu de Blues)

#### Problème : Légende trop grande

**Solutions** :
- Réduire le nombre de classes (5 au lieu de 7)
- Ajuster la précision des labels (1 décimale au lieu de 2)
- Positionner la légende en mode "compact" (icônes sans texte, texte en info-bulle)

#### Problème : Échelle illisible

**Solutions** :
- Zoomer sur la zone d'intérêt avant export (échelle adaptée automatiquement)
- Vérifier que la barre d'échelle n'est pas masquée par la légende ou d'autres contrôles
- En mode composeur (futur), positionner manuellement l'échelle

#### Astuce pour impression papier

**Recommandations** :
- **Format** : A3 paysage (meilleure lisibilité que A4)
- **Résolution** : 300 DPI minimum
- **Palette** : éviter les couleurs trop claires (jaune pâle) qui disparaissent à l'impression
- **Test d'impression** : imprimer en niveau de gris pour vérifier que les contrastes restent visibles (accessibilité)

---

## 8. Dépannage

### Problème 1 : "Aucune valeur à classifier"

**Message d'erreur** : "Impossible de générer la carte : aucune valeur disponible pour ce paramètre."

**Causes possibles** :
1. **Paramètre inexistant dans la zone** : vous avez sélectionné un paramètre (ex : VBS) qui n'a pas été mesuré dans la zone filtrée
2. **Filtres trop restrictifs** : combinaison de `adm3` + `min_sondages = 10` élimine toutes les mailles
3. **Erreur de requête** : problème de connexion à la base de données

**Solutions** :
1. **Changer de paramètre** : sélectionnez un paramètre plus courant (ex : `n_sondages` ou `ip_avg`)
2. **Élargir la zone** : retirez le filtre ADM3, ou passez de région à national
3. **Baisser `min_sondages`** : passez de 10 à 3 ou 1
4. **Vérifier la console** : ouvrir les DevTools (F12) et consulter les erreurs réseau

**Vérification** :
- Dans la vue générale, vérifiez combien de sondages existent dans la zone filtrée
- Consultez les statistiques de la base de données (nombre d'essais par type)

### Problème 2 : Couleurs uniformes malgré des valeurs variées

**Symptôme** : Toutes les mailles ont la même couleur ou des couleurs très proches, alors que les valeurs varient de 10 à 50.

**Causes possibles** :
1. **Méthode Quantiles avec données concentrées** : si 90% des valeurs sont entre 10 et 15, les quantiles créeront 4 classes dans [10-15] et 1 classe pour [15-50]
2. **Palette inadaptée** : palette divergente utilisée sur des données séquentielles
3. **Problème d'échelle** : plage très étendue avec des outliers extrêmes

**Solutions** :
1. **Passer en Jenks** : cette méthode identifie les ruptures naturelles et crée des classes mieux réparties visuellement
2. **Passer en Intervalles égaux** : si vous voulez respecter l'amplitude réelle des valeurs
3. **Vérifier l'étendue** : consultez la légende (min, max, médiane). Si max = 500 et médiane = 12, vous avez des outliers qui écrasent l'échelle → envisager un filtre ou une transformation log
4. **Augmenter le nombre de classes** : passez de 5 à 7 classes pour plus de nuances

**Vérification** :
- Cliquez sur plusieurs mailles pour voir les valeurs exactes dans l'info-bulle
- Exportez en GeoJSON et ouvrez dans Excel pour analyser la distribution statistique

### Problème 3 : Trop de bruit visuel / carte illisible

**Symptôme** : La carte ressemble à un patchwork chaotique, impossible d'identifier des tendances.

**Causes possibles** :
1. **Trop de classes** : 9 classes avec des couleurs proches
2. **No-data mal gérés** : mailles vides intercalées avec mailles pleines
3. **Variabilité spatiale réelle très élevée** : le territoire est hétérogène
4. **Couverture faible** : min_sondages = 1, donc des mailles avec 1 seul sondage créent du bruit

**Solutions** :
1. **Masquer les no-data** : comportement par défaut, vérifier qu'aucune configuration n'a réactivé leur affichage
2. **Augmenter `min_sondages`** : passez à 3 ou 5 pour ne garder que les mailles bien documentées
3. **Baisser le nombre de classes** : passez à 4 ou 5 classes
4. **Appliquer un filtre spatial** : restreindre à une région ou préfecture homogène
5. **Lisser les données** (développement futur) : appliquer un filtre spatial (moyenne mobile sur les mailles voisines)

**Astuce** : Comparez avec une carte de densité de sondages. Si le bruit correspond aux zones de faible couverture, c'est un artefact de données, pas une variabilité réelle.

### Problème 4 : Export GeoJSON vide ou corrompu

**Symptôme** : Le fichier GeoJSON téléchargé ne contient pas de données, ou génère une erreur à l'ouverture dans QGIS.

**Causes possibles** :
1. **Carte non générée avant export** : vous avez cliqué sur "Exporter" sans avoir cliqué sur "Appliquer" d'abord
2. **Erreur de sérialisation** : caractères spéciaux dans les métadonnées
3. **Timeout** : requête trop longue (carte nationale avec 3000 mailles)

**Solutions** :
1. **Générer la carte d'abord** : assurez-vous que la carte est affichée à l'écran avant d'exporter
2. **Vérifier le fichier** : ouvrez-le dans un éditeur de texte (VS Code, Notepad++) pour voir s'il contient du JSON valide
3. **Réduire l'étendue** : filtrez sur une région pour réduire la taille du fichier
4. **Consulter la console** : erreurs JavaScript dans les DevTools

**Vérification** :
- Taille du fichier : un GeoJSON de carte nationale pèse typiquement 500 KB - 5 MB
- Structure JSON : doit commencer par `{"type": "FeatureCollection", "features": [...]}`

### Problème 5 : Performance lente / Carte met longtemps à charger

**Symptôme** : Après avoir cliqué sur "Appliquer", la carte met 10-15 secondes à se générer.

**Causes possibles** :
1. **Carte nationale sans filtre** : 2000+ mailles à classifier et afficher
2. **Méthode Jenks avec >1000 valeurs** : calcul intensif (bien que l'algorithme fasse automatiquement un fallback vers quantiles)
3. **Connexion lente** : transfert de gros volumes de GeoJSON depuis le serveur
4. **Cache désactivé** : requêtes répétées sans utiliser le cache

**Solutions** :
1. **Activer le cache** : vérifié automatiquement, TTL de 60 secondes (implémentation dans [cache.rs](../services/api-geo/src/thematic/cache.rs))
2. **Appliquer des filtres ADM** : réduire le nombre de mailles à traiter
3. **Utiliser Quantiles au lieu de Jenks** : plus rapide, surtout pour > 1000 mailles
4. **Vérifier le zoom** : à zoom < 12, des géométries simplifiées sont utilisées (optimisation automatique)

**Vérification** :
- Ouvrir l'onglet Network dans DevTools : voir la taille et le temps de réponse de `/thematic/data`
- Vérifier les logs serveur : présence de messages `⚠️  Jenks: fallback vers quantiles`

**Optimisation future** :
- Pré-calcul des agrégations lors de l'insertion (vues matérialisées)
- WebWorkers pour la classification côté client
- Pagination/tiling des données (charger uniquement les mailles visibles)

---

## 9. Paramètres disponibles dans Atlas v1.5

Voici la liste complète des 26 paramètres géotechniques disponibles pour les cartes thématiques, organisés par catégorie.

### Densité & Couverture

| ID | Libellé | Unité | Description | Palette par défaut |
|----|---------|-------|-------------|-------------------|
| `n_sondages` | Nombre de sondages | - | Densité de sondages par maille | Blues |
| `n_essais_geo` | Nombre d'essais géotechniques | - | Nombre total d'essais géotechniques par maille | Blues |

### Granulométrie

| ID | Libellé | Unité | Description | Palette par défaut | Seuils par défaut |
|----|---------|-------|-------------|-------------------|-------------------|
| `passant_80um_avg` | % Passant 80µm (moyen) | % | Fraction argileuse + limoneuse (< 80µm) | Greens | [12, 35, 50, 70] |
| `passant_2mm_avg` | % Passant 2mm (moyen) | % | Fraction sable + fines (< 2mm) | Greens | - |
| `passant_20mm_avg` | % Passant 20mm (moyen) | % | Fraction granulats fins (< 20mm) | Greens | - |

### Limites d'Atterberg

| ID | Libellé | Unité | Description | Palette par défaut | Seuils par défaut |
|----|---------|-------|-------------|-------------------|-------------------|
| `wl_avg` | Limite de liquidité WL (moyenne) | % | Teneur en eau à la transition plastique → liquide | Blues | - |
| `wp_avg` | Limite de plasticité WP (moyenne) | % | Teneur en eau à la transition solide → plastique | Blues | - |
| `ip_avg` | Indice de plasticité IP (moyen) | % | IP = WL - WP, caractérise la plasticité du sol | RdYlGn | [12, 25, 40] |
| `ip_stddev` | Écart-type IP | % | Variabilité de l'indice de plasticité | Reds | - |
| `ip_min` | IP minimum | % | Valeur minimale d'IP observée | Blues | - |
| `ip_max` | IP maximum | % | Valeur maximale d'IP observée | Reds | - |

### Bleu de Méthylène (VBS)

| ID | Libellé | Unité | Description | Palette par défaut | Seuils par défaut |
|----|---------|-------|-------------|-------------------|-------------------|
| `vbs_avg` | Valeur de Bleu VBS (moyenne) | g/100g | Mesure de l'argilosité du sol | Blues | [0.1, 1.5, 2.5, 6, 8] |
| `vbs_stddev` | Écart-type VBS | g/100g | Variabilité de la valeur de bleu | Reds | - |
| `vbs_min` | VBS minimum | g/100g | Valeur minimale de VBS observée | Blues | - |
| `vbs_max` | VBS maximum | g/100g | Valeur maximale de VBS observée | Reds | - |

### Proctor

| ID | Libellé | Unité | Description | Palette par défaut | Seuils par défaut |
|----|---------|-------|-------------|-------------------|-------------------|
| `gamma_d_max_avg` | Densité sèche γd max (moyenne) | kN/m³ | Densité sèche maximale au Proctor | RdYlGn | [16, 18, 20, 22] |
| `gamma_d_max_stddev` | Écart-type γd max | kN/m³ | Variabilité de la densité sèche max | Reds | - |
| `w_opt_avg` | Teneur en eau optimale wopt (moyenne) | % | Teneur en eau pour densité maximale | Blues | [8, 12, 18, 25] |
| `w_opt_stddev` | Écart-type wopt | % | Variabilité de la teneur en eau optimale | Reds | - |

### Gonflement

| ID | Libellé | Unité | Description | Palette par défaut | Seuils par défaut |
|----|---------|-------|-------------|-------------------|-------------------|
| `eg_avg` | Potentiel de gonflement eg (moyen) | % | Risque de gonflement des argiles | RdYlGn | [0.5, 2, 5, 10] |
| `eg_stddev` | Écart-type eg | % | Variabilité du potentiel de gonflement | Reds | - |
| `eg_min` | eg minimum | % | Valeur minimale de gonflement observée | Greens | - |
| `eg_max` | eg maximum | % | Valeur maximale de gonflement observée (risque) | Reds | [0.5, 2, 5, 10] |

**Notes** :
- Les **seuils par défaut** sont appliqués automatiquement en mode "Personnalisé" si vous ne les modifiez pas
- Les paramètres **`_stddev`** (écarts-types) permettent d'identifier les zones avec forte variabilité géotechnique (risque accru)
- Les paramètres **`_min`** et **`_max`** permettent d'identifier les valeurs extrêmes observées dans chaque maille

---

## 10. Référentiels techniques et normatifs

Cette section liste les référentiels géotechniques utilisés pour définir les seuils personnalisés et l'interprétation des cartes.

### 10.1 Classification des sols selon l'Indice de Plasticité (IP)

**Référence** : Norme NF P94-051, Casagrande

| Plage IP (%) | Classification | Interprétation géotechnique |
|--------------|----------------|------------------------------|
| < 5 | Non plastique | Sable, grave |
| 5 - 12 | Peu plastique | Limon, sable argileux |
| 12 - 25 | Moyennement plastique | Limon argileux, argile limoneuse |
| 25 - 40 | Plastique | Argile |
| > 40 | Très plastique | Argile grasse, montmorillonite |

**Usage dans Atlas** : Seuils par défaut de `ip_avg` : `[12, 25, 40]`

### 10.2 Classification selon la Valeur de Bleu (VBS)

**Référence** : Norme NF P94-068, GTR (Guide des Terrassements Routiers)

| VBS (g/100g) | Classification | Propriétés |
|--------------|----------------|-----------|
| < 0.1 | Sol insensible à l'eau | Sable propre, grave |
| 0.1 - 1.5 | Sable limoneux | Sensibilité faible |
| 1.5 - 2.5 | Limon peu argileux | Sensibilité modérée |
| 2.5 - 6 | Sol argileux | Sensibilité à l'eau significative |
| 6 - 8 | Sol très argileux | Forte sensibilité, gonflement possible |
| > 8 | Sol extrêmement argileux | Argiles actives, précautions majeures |

**Usage dans Atlas** : Seuils par défaut de `vbs_avg` : `[0.1, 1.5, 2.5, 6, 8]`

### 10.3 Potentiel de gonflement (eg)

**Référence** : Norme NF P94-091, LCPC (Laboratoire Central des Ponts et Chaussées)

| eg (%) | Potentiel | Recommandations |
|--------|-----------|-----------------|
| < 0.5 | Négligeable | Aucune précaution particulière |
| 0.5 - 2 | Faible | Surveillance recommandée |
| 2 - 5 | Moyen | Études complémentaires, fondations adaptées |
| 5 - 10 | Fort | Précautions géotechniques obligatoires |
| > 10 | Très fort | Risque majeur, solutions spéciales requises |

**Usage dans Atlas** : Seuils par défaut de `eg_avg` et `eg_max` : `[0.5, 2, 5, 10]`

### 10.4 Densité sèche Proctor (γd max)

**Référence** : Norme NF P94-093, essai Proctor Normal

| γd max (kN/m³) | Type de sol | Compactabilité |
|----------------|-------------|----------------|
| < 16 | Sols organiques, tourbes | Très mauvaise |
| 16 - 18 | Argiles plastiques | Moyenne |
| 18 - 20 | Limons, argiles peu plastiques | Bonne |
| 20 - 22 | Sables, graves limoneuses | Très bonne |
| > 22 | Graves propres, sables compacts | Excellente |

**Usage dans Atlas** : Seuils par défaut de `gamma_d_max_avg` : `[16, 18, 20, 22]`

### 10.5 Granulométrie : % Passant 80 µm

**Référence** : Classification USCS, AASHTO

| Passant 80 µm (%) | Fraction dominante | Type de sol |
|-------------------|-------------------|-------------|
| < 12 | Graves et sables | Sol grenus propre |
| 12 - 35 | Fines en faible proportion | Sol grenus avec fines |
| 35 - 50 | Fines et grains | Sol mixte |
| 50 - 70 | Limons et argiles dominants | Sol fin limoneux |
| > 70 | Argiles dominantes | Sol fin argileux |

**Usage dans Atlas** : Seuils par défaut de `passant_80um_avg` : `[12, 35, 50, 70]`

---

## 11. Glossaire

**ADM1, ADM2, ADM3** : Niveaux de découpage administratif (Région, Préfecture, Commune).

**Bbox (Bounding Box)** : Rectangle englobant défini par `[lon_min, lat_min, lon_max, lat_max]` pour limiter l'étendue spatiale.

**Breaks** : Seuils de valeurs séparant les classes d'une classification. Exemple : `[10, 20, 30]` crée 4 classes : `< 10`, `10-20`, `20-30`, `> 30`.

**Choroplèthe** : Type de carte thématique où chaque zone (ici, maille H3) est colorée uniformément selon une valeur.

**Classification** : Processus de découpage d'une échelle continue de valeurs en classes discrètes pour assigner des couleurs.

**Essai géotechnique** : Mesure en laboratoire des propriétés mécaniques et physiques d'un échantillon de sol (Atterberg, VBS, Proctor, etc.).

**GeoJSON** : Format de fichier standard pour les données géographiques, basé sur JSON, compatible avec tous les SIG.

**GeoPackage (.gpkg)** : Format de base de données spatiale standardisé par l'OGC, alternative moderne au Shapefile.

**H3** : Système de maillage hexagonal hiérarchique développé par Uber, utilisé pour discrétiser le territoire.

**Jenks (Fisher-Jenks)** : Algorithme de classification optimisant la séparation des groupes en minimisant la variance intra-classe.

**Maille** : Cellule hexagonale H3 servant d'unité spatiale d'agrégation des sondages.

**No-data** : Maille sans valeur pour le paramètre sélectionné (absence de données).

**Opacité** : Degré de transparence d'une couche cartographique (0 = invisible, 1 = opaque).

**Outlier** : Valeur extrême s'écartant fortement de la distribution principale.

**Palette** : Ensemble de couleurs utilisées pour représenter les classes. Peut être séquentielle, divergente, ou qualitative.

**Quantiles** : Méthode de classification divisant les données en classes contenant le même nombre d'observations.

**Sondage** : Point de reconnaissance géotechnique (forage, puits, tranchée) où des échantillons sont prélevés.

**Symboles proportionnels** : Représentation cartographique où la taille des symboles (cercles) est proportionnelle à une valeur.

**TTL (Time To Live)** : Durée de vie d'une entrée en cache avant expiration (60 secondes dans Atlas).

**Vue générale** : Mode de travail principal de l'Atlas, pour gérer les sondages individuellement.

**Vue thématique** : Mode spécialisé pour générer des cartes d'analyse par paramètre.

**WGS84 (EPSG:4326)** : Système de coordonnées géographiques standard (latitude/longitude).

---

## 12. Conclusion et perspectives

### Ce que vous pouvez faire dès maintenant avec les cartes thématiques

- Visualiser 26 paramètres géotechniques agrégés par maille hexagonale
- Appliquer 4 méthodes de classification (Quantiles, Intervalles égaux, Jenks, Personnalisé)
- Filtrer par région administrative et seuil de qualité de données
- Exporter en GeoJSON pour analyse SIG avancée
- Générer des cartes choroplèthes ou en symboles proportionnels
- Identifier visuellement les zones à risques géotechniques
- Optimiser la planification de futures campagnes de reconnaissance

### Limitations de la version actuelle (v1.5)

- **Export PNG/PDF non fonctionnel** : nécessite développement supplémentaire
- **Mode comparatif non implémenté** : impossible de comparer 2 paramètres côte-à-côte dans l'interface
- **Pas de lissage spatial** : les mailles isolées avec forte variabilité créent du bruit visuel
- **Pas de composeur d'impression** : impossible de personnaliser titre, légende, crédits avant export
- **Jenks limité à 1000 valeurs** : au-delà, fallback vers quantiles (performance)

### Évolutions prévues (v2.0 et au-delà)

**Fonctionnalités cartographiques** :
- Export PNG haute résolution et PDF avec composeur graphique
- Mode comparatif (split screen, swipe, grille 2×2)
- Annotations automatiques des valeurs extrêmes (top 5/bottom 5)
- Lissage spatial (moyenne mobile sur mailles voisines)
- Cartes de chaleur (heatmap) en alternative au choroplèthe

**Analyse avancée** :
- Statistiques spatiales (autocorrélation de Moran, hotspots de Getis-Ord)
- Détection automatique d'outliers et suggestion de filtrage
- Corrélations entre paramètres (scatter plot interactif IP vs VBS)
- Séries temporelles (évolution des paramètres entre campagnes)

**Optimisations techniques** :
- Algorithme Jenks optimisé (supporte >10000 valeurs)
- Pré-calcul des agrégations lors de l'insertion (vues matérialisées rafraîchies automatiquement)
- Tiling des données (charger uniquement les mailles visibles)
- WebWorkers pour la classification côté client (interface non bloquante)

**Accessibilité et communication** :
- Palettes accessibles daltoniens par défaut
- Export en résolution adaptative (écran, impression, poster A0)
- Templates de rapport automatisés (Word, PowerPoint, LaTeX)
- API publique pour intégration dans des dashboards tiers

### Ressources complémentaires

**Documentation technique** :
- Architecture du module thématique : [TEST_CARTE_PROPRE.md](TEST_CARTE_PROPRE.md)
- Spécifications de la base de données : `db/migrations/010_thematic_maps.sql`
- API endpoints : `services/api-geo/src/thematic/routes.rs`

**Normes et référentiels** :
- NF P94-051 (Limites d'Atterberg)
- NF P94-068 (Valeur de Bleu VBS)
- NF P94-091 (Gonflement)
- NF P94-093 (Proctor)
- GTR - Guide des Terrassements Routiers

**Support utilisateur** :
- Rapporter un bug : [Dépôt GitHub Atlas]
- Demander une fonctionnalité : [Formulaire de feedback]
- Formation : [Calendrier des sessions de formation]

---

**Atlas Géotechnique du Togo - Ministère de l'Équipement et de l'Entretien Routier**
**Version du guide : 1.5 | Date : Janvier 2025**
**Auteurs : Équipe Atlas Géotechnique**
