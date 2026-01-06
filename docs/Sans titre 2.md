# 0. Contexte général Atlas Géotechnique

Atlas Géotechnique est une plateforme de gestion et d’analyse de données géotechniques pour le Togo, bâtie autour :

- d’une **base PostGIS** (sondages, essais labo, mailles 2 km, mailles 28 km, ADM1/2/3…),
    
- d’une **API principale** `api-geo` pour la donnée « brute » (CRUD, vues agrégées, KPI),
    
- d’une **UI web** (cartes thématiques, exports Atlas, analyses nationales).
    

Deux nouveaux services doivent compléter l’écosystème :

- `api-infer` : moteur d’**inférence géotechnique** (IDW, kriging, ML),
    
- `api-opti` : moteur d’**optimisation** (campagnes de sondages, éventuellement réseaux, scénarios).
    

---

# 1. Objectifs généraux

## 1.1. api-infer

- Produire des **cartes géotechniques complètes** (IP, VBS, Eg, classes de sols, etc.) à partir de données :
    
    - ponctuelles (sondages, essais),
        
    - agrégées par maille 2 km / 28 km.
        
- Permettre plusieurs stratégies d’inférence :
    
    - méthodes géostat classiques (**IDW**, **kriging**),
        
    - **modèles ML** supervisés (random forest, réseaux de neurones, etc.).
        
- Intégrer un mécanisme de **mise à jour dynamique** :
    
    - à chaque nouvelle donnée réelle insérée dans la base, possibilité de re-calcul (batch ou planifié).
        

## 1.2. api-opti

- Aider à **décider où aller sonder** (campagnes futures) pour :
    
    - réduire l’incertitude,
        
    - couvrir le territoire,
        
    - respecter un budget / une capacité de sondages.
        
- Proposer des **scénarios optimisés** :
    
    - liste de points (ou mailles prioritaires) à instrumenter,
        
    - éventuellement trajectoires / tournées réalistes (plus tard).
        
- S’intégrer avec les sorties d’`api-infer` (zones très incertaines ou mal couvertes).
    

---

# 2. Périmètre fonctionnel

## 2.1. Périmètre api-infer

Inclut :

- Interpolation spatiale (IDW, kriging) sur :
    
    - tout le Togo (maille 28 km ou 2 km),
        
    - ou sur une région / préfecture.
        
- Inférence ML :
    
    - prédire un indicateur géotechnique (IP, VBS, Eg, classe de sol, etc.) sur chaque maille.
        
- Production :
    
    - tables PostGIS (valeurs prédictes par maille),
        
    - rasters (GeoTIFF, PNG pour export Atlas),
        
    - métriques d’incertitude (écart-type, intervalle de confiance quand possible).
        

Hors périmètre v1 :

- gros pipeline MLOps complet (CI/CD modèles ML),
    
- deep learning très lourd (GPU, images brutes).
    

## 2.2. Périmètre api-opti

Inclut :

- Optimisation “campagnes de sondages” :
    
    - sélection de mailles/points candidats,
        
    - sous contraintes (budget, accessibilité, zones prioritaires).
        
- Stratégies d’optimisation possibles :
    
    - heuristiques simples (greedy),
        
    - algorithmes génétiques / méta-heuristiques,
        
    - éventuellement couplage avec l’incertitude fournie par `api-infer`.
        

Hors périmètre v1 :

- optimisation de réseaux d’adduction (AEP) → projet LCPI séparé,
    
- couplage complet avec coûts de logistique très détaillés (peut venir plus tard).
    

---

# 3. Architecture cible (haut niveau)

- Microservices (Rust idéalement, comme `api-geo`) :
    
    - `api-infer` : service HTTP/JSON + tâches batch.
        
    - `api-opti` : service HTTP/JSON + tâches batch.
        
- Communication :
    
    - entre API ↔ PostGIS,
        
    - API ↔ UI via HTTP (JSON),
        
    - éventuellement file de tâches (RabbitMQ / Redis) pour les jobs lourds (v2).
        
- Stockage :
    
    - résultats agrégés dans PostGIS (tables `atlas_infer_*`, `atlas_opti_*`),
        
    - fichiers rasters dans un dossier dédié (ou futur object storage).
        

---

# 4. api-infer – Cahier des charges détaillé

## 4.1. Cas d’usage principaux

1. **CU1 – Générer une carte interpolée nationale (IDW)**
    
    - Entrée :
        
        - paramètre géotechnique (ex : `ip_avg`),
            
        - échelle (2 km ou 28 km),
            
        - domaine (Togo entier / ADM1 / ADM2).
            
    - Sortie :
        
        - table PostGIS avec valeur interpolée par maille,
            
        - raster GeoTIFF optionnel,
            
        - méta : méthode, paramètres (puissance IDW, nombre de voisins, etc.).
            
2. **CU2 – Générer une carte kriging (zone bien couverte)**
    
    - Entrée :
        
        - paramètre,
            
        - domaine (ex : région Maritime),
            
        - type de kriging (ordinary / simple),
            
        - options variogramme (auto ou manuel).
            
    - Sortie :
        
        - valeur prédite + variance / écart-type par maille,
            
        - variogramme ajusté (paramètres, type : sphérique, exp…).
            
3. **CU3 – Inférence ML sur mailles 28 km**
    
    - Entrée :
        
        - paramètre cible (ex : `class_sol`, `ip_avg`),
            
        - features à utiliser (climat, pédologie, géologie, topographie…),
            
        - domaine (Togo ou ADM).
            
    - Sortie :
        
        - prédiction par maille 28 km,
            
        - importance des variables (si modèle interprétable),
            
        - score de performance (cross-validation sur données existantes).
            
4. **CU4 – Recalcul après ajout de nouvelles données**
    
    - Déclencheur :
        
        - manuel (endpoint `/retrain` ou `/recompute`),
            
        - ou automatisé (job cron).
            
    - Action :
        
        - met à jour les modèles / cartes pour un paramètre donné,
            
        - logue la version du modèle et la date.
            

## 4.2. Interfaces (exemples de endpoints)

_(juste pour le cahier des charges, tu ne codes pas encore)_

- `POST /infer/idw`
    
    - body : `{ param, adm_level, adm_code?, grid_level (2km/28km), options_idw }`
        
    - réponse : `{ job_id, estimated_cells, method: "idw" }`
        
- `POST /infer/kriging`
    
    - body : `{ param, domain_type (adm1/adm2/bbox), domain, kriging_type, variogram_mode (auto/manual), model_type }`
        
    - réponse : `{ job_id, variogram_init, method: "kriging" }`
        
- `POST /infer/ml`
    
    - body : `{ target_param, feature_set, grid_level, domain }`
        
    - réponse : `{ job_id, model_family, cv_score }`
        
- `GET /infer/result/{job_id}`
    
    - retourne : état du job + liens vers :
        
        - table PostGIS,
            
        - raster(s),
            
        - logs / métriques.
            

## 4.3. Données d’entrée

- **Observations** :
    
    - sondages + coordonnées (EPSG:4326 ou 25231),
        
    - valeurs des essais (IP, VBS, Eg, WL, etc.),
        
    - agrégations existantes : mailles 2 km, 28 km.
        
- **Variables explicatives (pour ML)** :
    
    - géologie (unité géologique),
        
    - pédologie,
        
    - altitude, pente,
        
    - climat (pluie, T° si disponible),
        
    - position (lat, lon, ADM1/2/3…).
        

## 4.4. Exigences non fonctionnelles (api-infer)

- Temps raisonnable pour un job national idw sur 2 km (quelques minutes max).
    
- Logs détaillés :
    
    - méthode, paramètres, nombre de points utilisés,
        
    - warnings si couverture trop faible (ex : < X points dans une région).
        
- Possibilité de **désactiver certaines méthodes** si la qualité n’est pas jugée suffisante (ex : kriging global sur tout le Togo).
    

---

# 5. api-opti – Cahier des charges détaillé

## 5.1. Cas d’usage principaux

1. **CU1 – Proposer une campagne de sondages “exploratoire”**
    
    - Objectif :
        
        - proposer une liste de mailles / points à sonder,
            
        - pour augmenter la couverture dans les zones vides ou fortement incertaines.
            
    - Entrée :
        
        - budget : nombre max de sondages (ex : 20, 50),
            
        - domaine : Togo / région / préfecture,
            
        - critère principal :
            
            - minimiser l’incertitude (dépend d’`api-infer`),
                
            - ou maximiser couverture spatiale (distance minimale entre points).
                
    - Sortie :
        
        - liste de points candidats :
            
            - coordonnées,
                
            - maille 28 km et 2 km associées,
                
            - priorité,
                
            - justification (zone sous-échantillonnée, fort gradient, etc.).
                
2. **CU2 – Optimisation “raffinement” dans une zone pilote**
    
    - Exemple :
        
        - région Maritime où tu as déjà pas mal de données.
            
    - Objectif :
        
        - proposer des sondages supplémentaires là où les gradients sont forts ou les valeurs critiques (IP élevé, surcharge en argile, etc.).
            
    - Entrée :
        
        - paramètre ciblé (ex : IP, classe GTR, etc.),
            
        - zone (ADM, polygone custom),
            
        - budget en sondages.
            
    - Sortie :
        
        - liste optimisée de points,
            
        - éventuellement scénarios A/B avec différents compromis (distance vs incertitude).
            
3. **CU3 – Scénarios comparatifs**
    
    - Demander :
        
        - “Que se passe-t-il si j’ai 10 sondages vs 30 ?”
            
    - Sortie :
        
        - 2 ou 3 scénarios,
            
        - pour chaque scénario : gain attendu (couverture, réduction incertitude).
            

## 5.2. Interfaces (exemples)

- `POST /opti/campaign`
    
    - body : `{ domain, param, budget_n_sondages, strategy ("coverage" | "uncertainty"), constraints? }`
        
    - réponse : `{ job_id, approx_runtime }`
        
- `GET /opti/result/{job_id}`
    
    - réponse :
        
        - liste de points (geojson),
            
        - indicateurs (gain couverture, incertitude moyenne avant / après simulée),
            
        - liens pour visualisation dans l’UI.
            

## 5.3. Données d’entrée côté optimisation

- Sorties d’`api-infer` :
    
    - cartes d’incertitude,
        
    - cartes de valeur,
        
    - densité de sondages existants par maille.
        
- Contrainte métier :
    
    - mailles difficiles d’accès (peuvent être pénalisées),
        
    - zones interdites (ex : zones protégées, militaires).
        

## 5.4. Stratégies d’optimisation envisagées

### v1 – Heuristiques simples

- **Stratégie “coverage”** :
    
    - choisir les mailles vides les plus éloignées des sondages existants,
        
    - espacer les nouveaux points (genre “poisson disk sampling contraint”).
        
- **Stratégie “uncertainty-driven”** :
    
    - sélectionner les mailles où l’écart-type (kriging / modèle ML) est maximal,
        
    - prioriser celles qui cumulent :
        
        - incertitude élevée,
            
        - importance géotechnique (zone urbaine, projets, etc.).
            

### v2 – Méta-heuristiques / GA

- utilisations d’algorithmes génétiques (aligné avec ton projet AG sur les réseaux),
    
- fonction de coût multi-critère :
    
    - f = α * incertitude_moy + β * coût_total + γ * dispersion des points.
        

---

# 6. Intégration avec Atlas (UI + exports)

- **UI thématique** :
    
    - nouveaux “Types de carte” :
        
        - “Infer – IDW”
            
        - “Infer – Kriging”
            
        - “Infer – ML”
            
        - “OpTI – Points de campagne” (couches de points recommandés).
            
- **Exports Atlas** :
    
    - pouvoir choisir comme couche :
        
        - une carte issue d’`api-infer`,
            
        - une couche de points issue d’`api-opti`.
            
- **Logs internes** :
    
    - chaque job `api-infer` / `api-opti` doit être logué avec :
        
        - paramètres d’appel,
            
        - version du modèle (pour ML),
            
        - date / durée,
            
        - statut (OK, warning, échec).
            

---

# 7. Roadmap (versions)

### V1 – Minimal viable mais utile

- `api-infer` :
    
    - IDW national,
        
    - Kriging sur 1 région pilote (Maritime),
        
    - stockage des résultats en mailles 2 km / 28 km,
        
    - endpoints de base.
        
- `api-opti` :
    
    - une stratégie simple “coverage” pour proposer des points dans les mailles vides,
        
    - intégration dans l’UI sous forme de couche de points.
        

### V2 – Avancé

- `api-infer` :
    
    - modèles ML supervisés (RF ou NN),
        
    - auto-ajustement variogramme,
        
    - gestion versions de modèles.
        
- `api-opti` :
    
    - stratégies “uncertainty-driven” basées sur l’incertitude d’`api-infer`,
        
    - méta-heuristiques (GA),
        
    - scénarios comparatifs A/B.
        

---

Si tu veux, message suivant je peux te transformer ce cahier des charges en **version “mémoire”** (avec une intro plus académique, objectifs scientifiques, contributions attendues) ou en **version “ticket de dev”** (tableau de user stories détaillées pour Cursor / GitHub).