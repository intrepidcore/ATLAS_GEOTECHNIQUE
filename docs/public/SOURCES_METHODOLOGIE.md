# Sources et Méthodologie - Atlas Géotechnique

Ce document de référence technique détaille la méthodologie scientifique, les sources de données, et l'approche algorithmique de la plateforme Atlas Géotechnique (Togo).

## 1. Origine et Collecte des Données

### 1.1 Couverture Géographique
- **Couverture de base :** L'intégralité du territoire du Togo (de Cinkassé à Lomé).
- **Profondeur moyenne d'investigation :** 0 à 50 mètres.
- **Référentiel Spatial :** EPSG:25231 (UTM Zone 31N) pour les calculs internes, et WGS84 (EPSG:4326) pour la visualisation.

### 1.2 Validation des sources primaires
L'ensemble des essais de laboratoire (Atterberg, VBS, Granulométrie, Proctor) proviennent :
- De campagnes de reconnaissances géotechniques officielles validées.
- De rapports de bureaux d'études et de forages d'infrastructures.
Toutes les données intégrées au système brut subissent un pré-traitement de nettoyage (Data Quality Check) :
1. Suppression ou flag des doublons stricts.
2. Détection d'aberrations statistiques (ex: Limite de Liquidité aberrante > 200%).
3. Contrôle de cohérence croisée (ex: VBS faible avec IP élevé).

## 2. L'Approche par Maillage (Grid Pattern)

### 2.1 Maillage National à Résolution Variable
Pour combler les vides d'information entre les forages réels, la plateforme s'appuie sur une grille vectorisée en base de données.
- **Grille Haute Résolution (2×2 km) :** Permet une analyse fine et l'identification des anomalies géotechniques localisées.
- **Grille Régionale (28×28 km) :** Conçue pour dégager les grandes tendances géologiques de macro-régions.

### 2.2 Règles de Spatialisation (Location Accuracy)
- **Exact :** Position GPS précise par levé topographique.
- **Centroid/Random :** Utilisé lorsque les données sont fournies à l'échelle d'une préfecture ou d'un canton, le système génère un point pseudo-aléatoire (via une graine déterministe) à l'intérieur de la zone ADM définie.

## 3. Méthode d'Interpolation (IDW)

Le modèle prédictif embarqué dans l'application locale (Rust/Tauri) ou l'API Cloud repose sur l' **IDW (Inverse Distance Weighting)**.

### 3.1 Pourquoi l'IDW ?
Cette méthode conserve la fidélité mathématique aux points réels tout en assumant qu'un sol similaire persiste à courte distance. L'influence d'un sondage diminue drastiquement (Inverse Distance) avec l'éloignement.

### 3.2 Formule et Implémentation
Le calcul de la pondération $w_i$ d'un point $i$ à la distance $d_i$ est effectué selon la formule standard :

$$ w_i = \frac{1}{d_i^p} $$

Dans le modèle de l'Atlas, la puissance $p=2.0$ est utilisée, avec un rayon de coupure (`search_radius`) modulaire, généralement ajusté autour de 5 000 à 10 000 mètres en zone urbaine.

## 4. Outils Informatiques et Open Source

Pour garantir une intégrité maximale, la stack technologique est volontairement dominée par l'Open Source :
- **Rust (Services backend) :** Sûreté de mémoire absolue et parallélisme naturel pour le calcul matriciel des isolignes (IDW).
- **PostgreSQL / PostGIS :** SGBD spatial le plus robuste au monde, permettant de réaliser des `ST_Intersects` ou `ST_DWithin` performants sur de grands datasets.
- **React / Leaflet :** Rendu fluide côté client (carte PWA ou Desktop).

## 5. Perspectives de Mise à Jour
L'Atlas est **évolutif**. Le système (v1.x) intègre un pipeline GitHub Actions CI/CD et une interface de *Staging*. Lorsqu'un ingénieur terrain soumet une révision d'échantillon ou un nouveau forage via **Colab Mobile**, cette donnée est vérifiée en staging avant validation dans le datastore maître. Le modèle entier se recalcule ensuite (Interpolation en cascade) pour affiner la carte nationale.
