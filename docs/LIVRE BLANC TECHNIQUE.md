══════════════════════════════════════════════════════════════════
INTREPID CORE — LIVRE BLANC TECHNIQUE
Pipeline d'Interpolation Spatiale Géotechnique — Atlas Togo
Mission : Extraction et documentation scientifique exhaustive
══════════════════════════════════════════════════════════════════

CONTEXTE STRATÉGIQUE :
  Ce livre blanc servira simultanément à deux audiences :
  1. Jury académique (mémoire Master géotechnique — Serge TABE DJATO)
  2. Prospects institutionnels ECOWAS / bailleurs internationaux
     (Banque Mondiale, AFD, BOAD)
  Le ton doit être scientifiquement rigoureux ET lisible par un
  ingénieur géotechnicien non-informaticien.
  Toute affirmation doit être ancrée dans le code réel du dépôt.
  Aucune approximation, aucune invention.

RÔLE :
  Tu es le Lead Data Scientist d'Intrepid Core.
  Tu as conçu le pipeline scientifique d'Atlas Géotechnique Togo.
  Tu dois maintenant le documenter avec la rigueur d'un article
  de revue scientifique indexée (niveau IGC, ENPC, ASCE JGGE).

PÉRIMÈTRE D'ANALYSE — LIRE CES FICHIERS EN PRIORITÉ :
  Commencer par explorer la structure du dépôt, puis lire dans
  cet ordre précis avant de répondre :

  1. scripts/           → tous les .py (kriging, ML, ETL)
  2. services/api-geo/src/thematic/  → types.rs, routes.rs
  3. services/api-geo/src/ai_stats.rs
  4. services/api-geo/src/ai_plots.rs
  5. data/xlsx/amessefe_raw/  → comprendre les données source
  6. migrations_post_v1/      → comprendre l'évolution du schéma
  7. models/                  → modèles ONNX ou CatBoost sauvegardés
  8. CONTEXT.md et README.md  → vision globale

  Pour chaque fichier lu, noter :
  - Les imports Python (bibliothèques exactes + versions si disponibles)
  - Les paramètres des modèles (nugget, sill, range, n_estimators, etc.)
  - Les variables utilisées comme features
  - Les métriques calculées et leurs valeurs observées

══════════════════════════════════════════════════════════════════
SECTION 1 — STACK ALGORITHMIQUE COMPLÈTE
══════════════════════════════════════════════════════════════════

Après lecture du code, documenter EXHAUSTIVEMENT :

1.1 BIBLIOTHÈQUES GÉOSTATISTIQUES
  Pour chaque bibliothèque identifiée, préciser :
  - Nom exact + version utilisée (chercher dans requirements.txt,
    pyproject.toml, Cargo.toml, package.json)
  - Rôle spécifique dans le pipeline Atlas
  - Pourquoi ce choix plutôt que l'alternative
    (ex: gstools vs pykrige → capacité KED, performance)
  
  Bibliothèques à investiguer (non exhaustif) :
    gstools, pykrige, scikit-learn, scipy,
    numpy, pandas, geopandas, shapely,
    pyproj, rasterio, GDAL, psycopg2, sqlalchemy

1.2 BIBLIOTHÈQUES MACHINE LEARNING
  Pour chaque bibliothèque identifiée :
  - Rôle : classification RGA ? Régression paramètre ? Résidus ?
  - Architecture du modèle : GBM ? Random Forest ? MLP ?
  - Format de sérialisation : ONNX ? pickle ? joblib ? cbm ?
  
  Bibliothèques à investiguer :
    catboost, xgboost, lightgbm, scikit-learn,
    onnxruntime, onnx, sklearn-onnx

1.3 STACK RUST / BACKEND
  - sqlx : version et dialecte PostgreSQL utilisé
  - PostGIS : fonctions spatiales appelées dans les requêtes
  - Sérialisation : serde_json, tokio, axum versions

1.4 STACK JAVASCRIPT / VISUALISATION
  - Leaflet + plugins géospatiaux utilisés
  - Bibliothèques de rendu cartographique

1.5 TABLEAU RÉCAPITULATIF À PRODUIRE :
  | Composant      | Bibliothèque  | Version | Rôle dans Atlas          |
  |----------------|---------------|---------|--------------------------|
  | Variogramme    | gstools       | X.X     | Ajustement modèle sphérique |
  | KED            | pykrige       | X.X     | Kriging avec dérive ext. |
  | ML classif.    | catboost      | X.X     | Classification RGA       |
  | Inférence prod | onnxruntime   | X.X     | Déploiement offline      |
  | ...            | ...           | ...     | ...                      |

══════════════════════════════════════════════════════════════════
SECTION 2 — MODÉLISATION SPATIALE PAR KRIGEAGE
══════════════════════════════════════════════════════════════════

2.1 TYPE DE KRIGEAGE IMPLÉMENTÉ
  Identifier dans le code quelle(s) variante(s) sont utilisées :
  
  □ Krigeage Ordinaire (KO)
    → Hypothèse : moyenne inconnue, stationnaire
    → Utilisation dans Atlas : quel paramètre ? quelle étape ?
  
  □ Krigeage Universel (KU) / avec Dérive Externe (KED)
    → Variable auxiliaire (drift) : laquelle exactement ?
    → Est-ce le DSM SRTM 30m ? Autre raster ?
    → Comment le raster est-il chargé et jointuré aux sondages ?
  
  □ Co-Krigeage
    → Variables co-régionalisées identifiées ?
  
  □ Krigeage de Régression (Regression Kriging)
    → Séquence exacte : ML sur données brutes → krigeage résidus ?
    → Ou : krigeage seul avec features ML comme drift ?

  Pour chaque type identifié, copier la portion de code
  correspondante (fonction d'appel + paramètres).

2.2 MODÈLE DE SEMI-VARIOGRAMME
  Identifier dans le code quel modèle est ajusté :
  □ Sphérique    → formule, portée caractéristique observée (km)
  □ Exponentiel  → portée pratique vs effective
  □ Gaussien     → risque écran de krigeage ?
  □ Autre        → lequel ?
  
  Pour les sols d'Afrique de l'Ouest (latérites, vertisols,
  ferralitiques), documenter :
  - La portée observée pour chaque paramètre (nugget, sill, range)
  - Les valeurs calibrées sur les données AMESSEFE
  - La justification géologique du modèle choisi
    (ex: sols argileux → continuité spatiale → sphérique adapté)
  
  Valeurs attendues à extraire du code ou des tables ai_variograms :
  | Paramètre   | Modèle      | Nugget  | Sill  | Portée (km) | LOO-RMSE |
  |-------------|-------------|---------|-------|-------------|----------|
  | VBS (h1)    | Sphérique   | X.XX    | X.XX  | XXX         | X.XX     |
  | IP (h1)     | ...         | ...     | ...   | ...         | ...      |
  | EG (h1)     | ...         | ...     | ...   | ...         | ...      |
  | WL (h1)     | ...         | ...     | ...   | ...         | ...      |
  | WP (h1)     | ...         | ...     | ...   | ...         | ...      |

2.3 ANISOTROPIE
  Le modèle est-il isotrope ou anisotrope ?
  Si anisotrope : angle et rapport d'anisotropie calibrés ?
  Justification géologique (structures géologiques directionnelles ?)

2.4 VALIDATION CROISÉE LEAVE-ONE-OUT (LOO)
  - Protocole exact implémenté dans le code
  - Nombre de sondages laissés de côté à chaque itération
  - Métriques calculées : RMSE, MAE, R², biais ?
  - Valeurs obtenues sur AMESSEFE (87 sondages)

══════════════════════════════════════════════════════════════════
SECTION 3 — FEATURES MACHINE LEARNING (COVARIABLES)
══════════════════════════════════════════════════════════════════

3.1 INVENTAIRE EXHAUSTIF DES FEATURES
  Pour chaque feature identifiée dans le code ML, documenter :
  - Nom technique exact (tel qu'il apparaît dans le code)
  - Source de données (MNT SRTM ? DB locale ? Calculée ?)
  - Résolution spatiale
  - Justification géotechnique (pourquoi cette variable
    est corrélée aux propriétés des sols ?)
  - Importance relative si disponible (feature importance score)

  Features attendues à investiguer (non exhaustif) :
  
  TOPOGRAPHIQUES (source MNT SRTM 30m) :
    □ altitude_m          → corrélé à l'épaisseur d'altération
    □ slope_deg           → corrélé au drainage, latérisation
    □ aspect_deg          → exposition solaire, humidité
    □ TWI                 → Topographic Wetness Index
    □ curvature           → profil de versant
    □ TRI / TPI           → rugosité, position topographique
  
  GÉOLOGIQUES / PÉDOLOGIQUES :
    □ geological_unit_id  → lithologie source
    □ pedological_unit_id → type de sol (vertisol, ferralitique...)
    □ geological_age      → degré d'altération attendu
  
  SPATIALES :
    □ latitude, longitude (coordonnées UTM ou WGS84 ?)
    □ distance_to_water   → proximité cours d'eau / nappe
    □ distance_to_fault   → fracturation
  
  PROFONDEUR :
    □ depth_m → H1=1.0m, H2=1.5m, H3=2.0m
    → Encodée comment ? Float ? One-hot ? Embedding ?
  
  DÉRIVÉES :
    □ Variables calculées à partir des autres ?
    □ Interactions créées manuellement ?

3.2 PREPROCESSING DES FEATURES
  - Normalisation/standardisation appliquée ?
  - Gestion des valeurs manquantes (imputation, suppression ?)
  - Encodage des variables catégorielles (géologie, pédologie)
  - Augmentation des données ?

3.3 SÉLECTION DE FEATURES
  - Méthode de sélection (importance, RFE, SHAP ?) 
  - Features finalement retenues vs rejetées
  - Corrélation entre features → multicolinéarité traitée ?

3.4 TABLEAU FEATURES FINAL :
  | Feature          | Source   | Résolution | Importance | Justification Géotech   |
  |------------------|----------|------------|------------|--------------------------|
  | altitude_m       | SRTM 30m | 30m        | XX%        | Épaisseur profil latér. |
  | pedological_id   | DB/QGIS  | vecteur    | XX%        | Type minéralogie argile |
  | depth_m          | Mesure   | —          | XX%        | Variation verticale sol |
  | ...              | ...      | ...        | ...        | ...                      |

══════════════════════════════════════════════════════════════════
SECTION 4 — ARCHITECTURE HYBRIDE KED + ML
══════════════════════════════════════════════════════════════════

4.1 SÉQUENCE ALGORITHMIQUE EXACTE
  Documenter pas-à-pas le pipeline tel qu'implémenté dans le code.
  Pour chaque étape, citer le fichier source et la fonction.

  La séquence probable à confirmer ou corriger :

  NIVEAU 1 — KRIGEAGE AVEC DÉRIVE EXTERNE (KED) :
    Entrées : sondages AMESSEFE (coordonnées + valeurs mesurées)
              + raster SRTM (dérive externe)
    Traitement : ajustement variogramme → krigeage → carte interpolée
    Sorties : valeur interpolée + variance de krigeage pour chaque maille
    Couverture : 29 407 mailles × 3 horizons × 7 paramètres

  NIVEAU 2 — MACHINE LEARNING SUPERVISÉ :
    Entrées : sondages labellisés (données terrain + label RGA)
              + features topographiques + résultats KED comme features ?
    Modèle : CatBoost ? Autre ?
    Tâche : classification RGA (Nul/Faible/Moyen/Fort/Très fort) ?
             ou régression sur les paramètres géotechniques ?
    Sorties : prédiction RGA + probabilités par classe

  NIVEAU 3 — FUSION / ARBITRAGE :
    Comment les deux niveaux sont-ils combinés ?
    □ Krigeage des résidus ML (residual kriging)
    □ ML prédit la moyenne, krigeage interpole les résidus
    □ Ensemble (vote, stacking)
    □ ML pour zones sans sondage, KED pour zones avec sondage
    □ Autre architecture
    
    Quel niveau a la priorité d'affichage dans l'UI ?
    Selon quels critères bascule-t-on d'un niveau à l'autre ?

4.2 JUSTIFICATION SCIENTIFIQUE DE L'ARCHITECTURE
  Pourquoi KED en premier niveau ?
  → Exploite la totalité des 29 407 mailles via le MNT SRTM
  → Justification : relation altitude-profondeur d'altération
    documentée en Afrique de l'Ouest (référence ?)
  → Avantage vs krigeage ordinaire sur 87 points seuls

  Pourquoi ML en second niveau ?
  → Saisit les non-linéarités que le krigeage ne peut capturer
  → Intègre des covariables hétérogènes (géologie, pédologie)
  → Limitation : 87 sondages → risque surajustement ?
    Comment est-il adressé ? Régularisation ? Cross-validation ?

4.3 SCHÉMA D'ARCHITECTURE À PRODUIRE :
  Décrire (en ASCII ou en description structurée) le flux :

  [Données terrain AMESSEFE 87 sondages]
           │
           ▼
  [KED L1] ←── [MNT SRTM 30m comme dérive]
           │
           ├── [Cartes KED 29407 mailles × 21 paramètres]
           │
           ▼
  [ML L2] ←── [Features topo + géo + résultats KED L1]
           │
           ▼
  [Fusion] → [Carte synthèse nationale géotechnique]

4.4 FLUX DE DONNÉES TECHNIQUE :
  - Format d'entrée des sondages (CSV ? DB PostgreSQL direct ?)
  - Format de sortie des cartes (GeoJSON ? PostGIS ? Raster ?)
  - Comment les 29 407 mailles 2km² sont-elles définies ?
  - Comment le MNT SRTM est-il chargé et échantillonné sur les mailles ?
  - Projection cartographique utilisée (WGS84 / UTM 31N ?)

══════════════════════════════════════════════════════════════════
SECTION 5 — MÉTRIQUES DE VALIDATION ET SEUILS DE PRODUCTION
══════════════════════════════════════════════════════════════════

5.1 MÉTRIQUES IMPLÉMENTÉES
  Pour chaque métrique identifiée dans le code :
  - Formule mathématique exacte
  - Implémentation (bibliothèque ou custom ?)
  - Application : LOO-CV ? K-fold ? Train/test split ?
  - Valeurs observées sur AMESSEFE

  Métriques attendues à documenter :

  KRIGEAGE (LOO-RMSE par paramètre) :
  | Paramètre   | LOO-RMSE  | LOO-MAE | Biais   | Unité   |
  |-------------|-----------|---------|---------|---------|
  | VBS H1      | 3.060     | ?       | ?       | g/100g  |
  | IP H1       | 10.531    | ?       | ?       | %       |
  | EG H1       | 1.667     | ?       | ?       | %       |
  | WL H1       | 13.681    | ?       | ?       | %       |
  | WP H1       | 8.384     | ?       | ?       | %       |
  | Granulo 2mm | 6.297     | ?       | ?       | %       |
  | Granulo 80µm| 16.146    | ?       | ?       | %       |

  ML CLASSIFICATION RGA :
  | Modèle      | RMSE_cv | MAE_cv  | R²_cv   | N_train |
  |-------------|---------|---------|---------|---------|
  | rga_predict.| 2.773   | ?       | -0.019  | 69      |

  Expliquer pourquoi R² = -0.019 est attendu ou problématique.
  Un R² négatif signifie que le modèle est moins bon que la moyenne
  → Documenter les limitations et les actions correctives prévues.

5.2 SEUILS DE MISE EN PRODUCTION
  Définir explicitement les critères d'acceptation technique
  qui permettent de passer d'un prototype à la production :

  KRIGEAGE (KED) :
  □ Seuil acceptable LOO-RMSE VBS : ≤ X g/100g
    Justification : amplitude totale VBS = 0-15 → RMSE < 20% plage ?
  □ Seuil acceptable LOO-RMSE IP : ≤ X %
  □ Seuil acceptable LOO-RMSE EG : ≤ X %
  □ Couverture spatiale minimale : 100% des 29 407 mailles ?

  ML CLASSIFICATION :
  □ Accuracy minimale par classe RGA : X% ?
  □ Precision/Recall pour classe "Très fort" (risque sécurité) ?
  □ N_train minimal acceptable avant mise en production ?
    Actuellement 69 sondages → insuffisant ? Plan d'augmentation ?

  SYSTÈME GLOBAL :
  □ Latence maximale de calcul d'une carte thématique
  □ Disponibilité API : % uptime cible
  □ Fraîcheur des cartes : recalcul automatique à chaque import ?

5.3 COMPARAISON DES MÉTHODES
  Produire le tableau comparatif des 3 niveaux :

  | Méthode            | RMSE moyen | Couverture | N_données | Forces         | Limites              |
  |--------------------|------------|------------|-----------|----------------|----------------------|
  | KED (L1)           | X.XX       | 100%       | 87        | Couverture nat | Linéarité drift      |
  | ML CatBoost (L2)   | X.XX       | 100%       | 69        | Non-linéaire   | R²<0, peu de données |
  | Régression Kriging | X.XX       | 100%       | 87        | Hybride        | Complexité           |

5.4 INTERPRÉTATION GÉOTECHNIQUE DES MÉTRIQUES
  Pour chaque métrique, traduire l'erreur en langage métier :
  
  Ex : "LOO-RMSE VBS = 3.06 g/100g signifie qu'en tout point
  sans sondage, l'incertitude de prédiction est de ±3 g/100g
  sur une plage physique de 0-15 g/100g, soit une incertitude
  relative de 20%. En pratique, pour la classification des sols
  selon CHASSAGNEUX 1996, cela implique que la frontière
  Moyen/Fort (seuil VBS=2.5) peut être atteinte avec une
  erreur de classification dans X% des mailles."

══════════════════════════════════════════════════════════════════
SECTION 6 — POSITIONNEMENT SCIENTIFIQUE
══════════════════════════════════════════════════════════════════

6.1 COMPARAISON AVEC L'ÉTAT DE L'ART
  Sur la base du code analysé, positionner Atlas par rapport à :
  
  □ DSM (Digital Soil Mapping) — McBratney et al. 2003
    Méthode scorpan : S, C, O, R, P, A, N comme facteurs
    Atlas implémente quels facteurs de ce cadre ?
  
  □ Spatial LASSO / Geographically Weighted Regression (GWR)
    Avantage Atlas sur GWR : variable spatiale non-stationnaire ?
  
  □ Random Forest spatial (Hengl et al. 2018)
    Atlas s'en rapproche-t-il ? Différences ?
  
  □ Krigeage Bayésien / INLA
    Pourquoi ce choix n'a pas été retenu ?

6.2 ORIGINALITÉ SCIENTIFIQUE INTREPID CORE
  Documenter ce qu'Atlas apporte de nouveau :
  □ Première cartographie nationale géotechnique du Togo
  □ Combinaison KED + ML sur sols tropicaux d'Afrique de l'Ouest
  □ Granularité 2km × 2km sur 29 407 mailles
  □ 3 horizons de profondeur simultanés
  □ Classification CHASSAGNEUX 1996 automatisée à l'échelle nationale
  □ Pipeline auto-améliorant (nouvelles données → recalcul automatique)

6.3 LIMITATIONS À DOCUMENTER HONNÊTEMENT
  □ Densité des données source (87 sondages / 56 785 km²)
    → 1 sondage pour 652 km² en moyenne
    → Zones à faible densité identifiées (Oti, Bado, Mono, Fosse Lions)
  □ R² ML négatif → plan de collecte de données supplémentaires
  □ Portées variogramme > dimension du pays pour certains paramètres
  □ Absence de données Proctor dans AMESSEFE

══════════════════════════════════════════════════════════════════
FORMAT DE SORTIE ATTENDU
══════════════════════════════════════════════════════════════════

PRODUIRE UN DOCUMENT STRUCTURÉ avec :

1. RÉSUMÉ EXÉCUTIF (1 page)
   → Pour un ingénieur géotechnicien non-informaticien
   → Ce qu'Atlas fait, comment, et ce que ça apporte

2. SECTIONS 1 À 10 détaillées
   → Avec preuves issues du code (citations de fichiers + lignes)
   → Tableaux remplis avec les vraies valeurs
   → Formules mathématiques en notation standard

3. GLOSSAIRE TECHNIQUE (annexe)
   → Définitions KED, LOO-CV, RMSE, feature importance, etc.
   → En français, avec analogies géotechniques

4. RÉFÉRENCES BIBLIOGRAPHIQUES
   → Méthodes utilisées (Matheron 1963, Cressie 1993,
     CHASSAGNEUX 1996, Goovaerts 1997, McBratney 2003,
     Hengl 2018, etc.)
   → À compléter avec les références réellement citées dans le code

CONTRAINTES QUALITÉ :
  □ Aucune affirmation sans ancrage dans le code réel
  □ Si une information est absente du code → l'indiquer explicitement
    (ex: "La version exacte de gstools n'est pas spécifiée dans
     requirements.txt — à confirmer avec l'équipe")
  □ Distinguer "implémenté" de "prévu dans la roadmap"
  □ Niveau de langue : publication scientifique francophone
  □ Longueur : document complet, pas de raccourci