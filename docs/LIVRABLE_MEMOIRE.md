Très bonne question — et stratégique. Dans un **mémoire scientifique Atlas (géostatistique + ML + SIG + interpolation nationale)**, la qualité des **figures, graphiques, tableaux et planches cartographiques** fait une grande partie de la valeur académique.
Je te donne ici une **liste complète structurée (niveau mémoire d’ingénieur / master / doctorat)** organisée par chapitres — avec **tout ce que tu dois produire** pour être solide scientifiquement et visuellement.

Je distingue clairement :

* 📊 **Graphiques**
* 🗺️ **Figures**
* 🧾 **Tableaux**
* 🧱 **Planches cartographiques (SIG)**

---

# 📚 LISTE DES FIGURES (SIG + pipeline + architecture)

## 1. Figures de contexte territorial

Obligatoires.

* Carte du **Togo administratif**
* Carte des **zones d’étude Atlas**
* Carte des **mailles Atlas**
* Carte des **points sondages géotechniques**
* Carte densité des sondages
* Carte couverture spatiale des données

---

## 2. Figures géologiques et pédologiques

Très importantes pour justifier ton kriging stratifié.

* Carte unités géologiques
* Carte unités pédologiques
* Carte superposition géologie + pédologie
* Carte classes de risque gonflement

---

## 3. Figures architecture Atlas

Très valorisant pour ton mémoire.

* Architecture globale Atlas
* Architecture pipeline interpolation
* Architecture ML CatBoost
* Architecture microservice ONNX
* Architecture base PostgreSQL/PostGIS
* Architecture frontend/backend

---

## 4. Figures workflow scientifique

Très attendues dans un mémoire sérieux.

* Workflow acquisition données
* Workflow préparation données
* Workflow interpolation
* Workflow regression kriging
* Workflow prédiction ML
* Workflow génération cartes thématiques

---

## 5. Figures géostatistiques

Essentielles.

* Exemple variogramme expérimental
* Exemple variogramme ajusté
* Variogramme par domaine géologique
* Variogramme directionnel (si anisotropie activée)
* Diagramme cross-validation kriging

---

## 6. Figures pipeline interpolation Atlas

Très différenciant.

* Pipeline kriging par domaine
* Pipeline regression kriging
* Pipeline ML prédictif
* Pipeline stockage résultats DB
* Pipeline UI restitution cartes

---

# 📊 LISTE DES GRAPHIQUES (statistiques + ML + validation)

## 1. Graphiques exploratoires (EDA)

Obligatoires.

* Histogramme IP
* Histogramme WL
* Histogramme WP
* Histogramme VBS
* Histogramme Eg
* Histogramme granulométrie

---

## 2. Graphiques distribution spatiale

Très importants.

* Boxplots par domaine géologique
* Boxplots par domaine pédologique
* Violin plots distributions paramètres

---

## 3. Graphiques corrélations

Indispensables.

* Matrice corrélation paramètres
* Scatter plot IP vs VBS
* Scatter plot WL vs WP
* Scatter plot Eg vs granulométrie

---

## 4. Graphiques variogrammes

Scientifiquement critiques.

* Variogramme expérimental
* Variogramme théorique ajusté
* Comparaison modèles variogrammes
* Variogrammes multi-domaines

---

## 5. Graphiques validation kriging

Très importants pour jury.

* Courbe erreur interpolation
* Leave-one-out validation
* RMSE par domaine
* RMSE par paramètre
* Comparaison kriging vs regression kriging

---

## 6. Graphiques ML

Très valorisants.

* Importance variables CatBoost
* Courbe apprentissage modèle
* Courbe convergence modèle
* Courbe erreur prédiction
* Distribution résidus ML
* Prédictions vs observations

---

## 7. Graphiques comparaison modèles

Excellent niveau mémoire.

* Kriging vs regression kriging
* Regression kriging vs ML
* ML vs données terrain
* Erreur par domaine géologique

---

# 🧾 LISTE DES TABLEAUX

## 1. Tableaux données d’entrée

Obligatoires.

* Nombre sondages par paramètre
* Nombre mailles
* Nombre domaines géologiques
* Nombre domaines pédologiques
* Nombre zones Atlas

---

## 2. Tableaux statistiques descriptives

Très importants.

Pour chaque paramètre :

* moyenne
* médiane
* variance
* écart-type
* min
* max

---

## 3. Tableaux variogrammes

Scientifiquement indispensables.

Pour chaque paramètre :

* nugget
* sill
* range
* modèle variogramme
* R² ajustement

---

## 4. Tableaux interpolation

Très importants.

Pour chaque paramètre :

* nombre mailles interpolées
* RMSE
* MAE
* variance moyenne

---

## 5. Tableaux ML

Très valorisant.

Pour chaque modèle :

* dataset size
* features utilisées
* RMSE
* MAE
* R²
* quantiles

---

## 6. Tableaux comparaison méthodes

Excellent niveau mémoire.

Comparaison :

| méthode            | RMSE | MAE | R² |
| ------------------ | ---- | --- | -- |
| kriging            |      |     |    |
| regression kriging |      |     |    |
| ML                 |      |     |    |

---

## 7. Tableaux performances système Atlas

Très original (fort impact jury).

* temps interpolation
* temps ML
* temps pipeline complet
* temps génération carte

---

# 🗺️ LISTE DES PLANCHES CARTOGRAPHIQUES (le cœur du mémoire Atlas)

Ce sont les figures les plus importantes.

## 1. Planches données terrain

Pour chaque paramètre :

* carte IP sondages
* carte WL sondages
* carte WP sondages
* carte VBS sondages
* carte Eg sondages
* carte granulométrie

---

## 2. Planches interpolation kriging

Pour chaque paramètre :

* carte kriging IP
* carte kriging WL
* carte kriging WP
* carte kriging VBS
* carte kriging Eg
* carte kriging granulométrie

---

## 3. Planches variance interpolation

Très important scientifiquement.

* variance kriging IP
* variance kriging WL
* variance kriging WP
* variance kriging VBS
* variance kriging Eg

---

## 4. Planches regression kriging

Très différenciant.

* regression kriging IP
* regression kriging WL
* regression kriging WP
* regression kriging VBS
* regression kriging Eg

---

## 5. Planches ML prédiction

Très moderne.

* carte prédiction ML IP
* carte prédiction ML WL
* carte prédiction ML WP
* carte prédiction ML VBS
* carte prédiction ML Eg

---

## 6. Planches comparaison méthodes

Très haut niveau scientifique.

Comparer :

* kriging vs regression kriging
* kriging vs ML
* regression kriging vs ML

---

## 7. Planches synthèse finale Atlas

Les plus importantes du mémoire.

Cartes nationales finales :

* carte aptitude géotechnique
* carte plasticité
* carte portance
* carte gonflement
* carte classification sols
* carte synthèse Atlas géotechnique

---

# 🧱 LISTE DES FIGURES SYSTÈME ATLAS (très différenciant mémoire informatique)

Souvent absentes dans mémoires classiques — très valorisantes.

* modèle relationnel DB
* schéma PostGIS Atlas
* pipeline interpolation
* pipeline ML
* pipeline UI
* architecture microservices

---

# 🎯 LISTE MINIMALE POUR MÉMOIRE SOLIDE

Si tu veux une version **strict minimum acceptable jury**, voici :

### Figures

≈ 20

### Graphiques

≈ 25

### Tableaux

≈ 15

### Planches SIG

≈ 30

Total :

👉 environ **90 visuels scientifiques**

Ce qui correspond exactement à un **mémoire Atlas sérieux niveau ingénieur / master avancé** 📘
