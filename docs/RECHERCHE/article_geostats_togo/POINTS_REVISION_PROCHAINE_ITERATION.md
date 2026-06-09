retirer la mention de 122 point uniquement car les sondages ne sont pas des sondages reserver avec des apparail rare et peut etre fait mais juste avec assez de financement. l'objectif c'est d'établir des model matematique, correlartion et machnine leaning avec les donnée dont nous dispo en vue de predire facilement ces parametre

# Points de révision — Prochaine itération de rédaction
## Article : Cartographie Géotechnique Nationale — Togo

> **État actuel** : version brouillon 20 pages (2026-06-01).
> **À ne pas corriger maintenant** — attendre les nouvelles données terrain
> et les recalculs scientifiques avant de rédiger la version finale.

---

## 1. Problèmes structurels majeurs (priorité haute)

### 1.1 Plan de rédaction non planifié en amont
- La structure a été construite incrémentalement pour atteindre 20 pages,
  sans plan cohérent établi avant d'écrire.
- **Action** : établir un plan section par section avec estimation de la
  taille cible (en colonnes/pages) AVANT de commencer la rédaction.
- Le plan doit suivre la logique IMRaD classique :
  Introduction → Matériel & Méthodes → Résultats → Discussion → Conclusion.

### 1.2 Conclusion à la page 8 (illogique)
- La conclusion apparaît au milieu du document (page 8), avant des sections
  de résultats et d'analyse.
- **Cause** : ajout de sections après coup, sans repositionner la conclusion.
- **Action** : la conclusion doit toujours être la dernière section avant
  les Remerciements et les Références. Réorganiser l'ordre des sections.

### 1.3 Sous-titres non organisés logiquement
- Plusieurs sous-sections s'enchaînent sans transition logique.
- Les sections "Analyse de sensibilité" et "Covariables SCORPAN" sont
  intercalées entre "Modèles" et "Résultats", cassant le fil narratif.
- **Action** : regrouper thématiquement :
  - Part I : Introduction + Contexte (données, géologie)
  - Part II : Méthodes (tous les modèles + covariables + protocole)
  - Part III : Résultats + Validation (tous les résultats ensemble)
  - Part IV : Discussion (géologie, littérature, limites)
  - Part V : Conclusion + Perspectives

---

## 2. Problèmes de mise en page (priorité haute)

### 2.1 Pages avec espaces vides excessifs
- Plusieurs pages contiennent de larges blocs blancs entre les sections.
- **Cause** : figures et flottants mal maîtrisés dans la mise en 2 colonnes.
- **Action** :
  - Revoir la taille de chaque figure (réduire si trop grande).
  - Utiliser `[htbp]` au lieu de `[!ht]` pour plus de flexibilité.
  - Ajouter `\vspace{-Xpt}` aux légendes surdimensionnées.
  - Limiter le nombre de flottants consécutifs.

### 2.2 Tableaux mal formatés
- Certains tableaux débordent de la colonne ou sont trop compressés.
- Les en-têtes ne sont pas toujours cohérents.
- **Action** :
  - Vérifier chaque tableau avec `\resizebox{\linewidth}{!}{...}` si nécessaire.
  - Uniformiser l'alignement des colonnes numériques (`r` ou `c`).
  - Supprimer les tableaux redondants avec les figures.

### 2.3 Pages mal rendues (figures coupées ou déplacées)
- Certaines figures s'affichent loin de leur référence dans le texte.
- **Action** : utiliser `\FloatBarrier` de façon stratégique (une fois par
  section principale, pas à chaque sous-section).

---

## 3. Problèmes de contenu scientifique (priorité haute)

### 3.1 Mentions de l'architecture interne de la DB (à supprimer)
Un whitepaper doit permettre à un lecteur externe de reproduire les résultats
**sans connaître l'infrastructure interne**. Les mentions suivantes doivent
être reformulées ou supprimées :

- Noms de tables PostgreSQL (`atlas.ai_interpolation_values`,
  `atlas.ai_interpolation_runs`, `atlas.ai_job_queue`, etc.)
- Noms de colonnes et d'endpoints API internes (`parameter_id`, `method`,
  `GET /thematic/data`, etc.)
- Références au système de job queue et au trigger `pg_notify`
- Nom du schéma `atlas.` et des vues internes

**Reformulation correcte** : décrire les données en termes génériques
("une base de données PostGIS stockant les prédictions", "un système
d'interpolation automatisé", "les valeurs sont mises à jour après
chaque import de terrain") sans exposer l'architecture interne.

### 3.2 Sections de performance computationnelle hors périmètre whitepaper
- La section sur les temps de calcul et l'architecture pipeline (Section 13)
  est pertinente pour un rapport technique, pas pour un whitepaper scientifique.
- **Action** : soit supprimer entièrement, soit réduire à 2-3 lignes dans
  la section Matériel & Méthodes sous "Implémentation".

### 3.3 Références à une architecture spécifique au lieu de méthodes générales
- Le lecteur doit pouvoir reproduire les méthodes avec ses propres outils
  (R, Python, MATLAB, ArcGIS).
- Les références à "PyKrige v1.7", "psycopg2", "pipeline_worker.py"
  doivent être reformulées en termes de méthodes (ex : "un krigeage
  géostatistique par la méthode des équations normales").

---

## 4. Métriques à mettre à jour avant la prochaine rédaction

### 4.1 Nouvelles données terrain en cours d'import
- L'utilisateur s'apprête à importer de nouvelles données terrain.
- **Critère de recalcul** : attendre la fin de l'import + confirmation
  que les runs sont tracés dans `ai_interpolation_runs`.
- Vérifier : `SELECT COUNT(*) FROM atlas.ai_interpolation_runs`
  après le recalcul automatique via le pipeline worker.

### 4.2 Métriques qui changeront après recalcul
- LOO-RMSE pour tous les paramètres (KED-H, RK-SCORPAN, VfS, MTGP)
- N effectif par paramètre et horizon (VBS : 95 → ?+, EG : 64 → ?+)
- Statistiques descriptives des observations (tableaux 1, 4, 5)
- Paramètres variographiques (portée, pépite, palier)
- Coefficients Ridge normalisés (tableau App. D)
- Variance moyenne de krigeage sur la grille

### 4.3 Métriques qui ne changeront probablement pas
- Architecture des modèles et formulations mathématiques
- Contexte géologique du Togo (couches, formations)
- Comparaison avec la littérature (sauf si nouveaux travaux)
- Protocole LOO-CV rigoureux

---

## 5. Plan de rédaction pour la prochaine itération

### Étape 1 — Avant de commencer à écrire
1. Lire `ai_interpolation_runs` pour confirmer que tous les runs sont tracés.
2. Extraire toutes les métriques LOO-RMSE mises à jour depuis la DB.
3. Régénérer les figures avec `generate_figures.py` (données actualisées).
4. Établir un plan de 20 pages avec estimation de taille par section.

### Étape 2 — Structure cible (à respecter strictement)

| Section | Pages cibles | Contenu |
|---------|:------------:|---------|
| Titre + Résumé | 0,3 | Titre court, résumé bilingue 150 mots chacun |
| 1. Introduction | 1,0 | Problème, état de l'art, objectifs, plan |
| 2. Zone d'étude + Données | 1,5 | Territoire, sondages (stats descriptives), couches géo |
| 3. Matériel & Méthodes | 6,0 | KED-H, RK, Fusion, VfS, MTGP — formulations complètes |
| 4. Résultats | 4,0 | LOO-RMSE, cartes, variance, VfS, MTGP |
| 5. Discussion | 2,5 | Géologie, comparaison littérature, limites |
| 6. Conclusion | 0,5 | Synthèse et perspectives en 1 page max |
| Références | 0,8 | ~18-20 références |
| Annexes | 3,4 | Notations, paramètres, coefficients, glossaire |
| **Total** | **20,0** | |

### Étape 3 — Règles de rédaction pour la prochaine fois
- Écrire la conclusion EN PREMIER (guide la rédaction).
- Rédiger section par section dans l'ordre IMRaD.
- Compiler après chaque section principale (pas après chaque ajout mineur).
- Ne jamais ajouter de contenu pour "remplir" des pages.
- Toute information doit être reproductible sans accès à l'infrastructure.

---

## 6. Directive de traçabilité pour les prochains runs

Avant le recalcul des modèles, vérifier :

```sql
-- Doit retourner > 0 après chaque run de calcul
SELECT COUNT(*) FROM atlas.ai_interpolation_runs;
SELECT COUNT(*) FROM atlas.ai_prediction_runs;

-- Vérifier la couverture par paramètre
SELECT parameter_id, method, COUNT(*) as n_runs,
       MAX(created_at) as last_run
FROM atlas.ai_interpolation_runs
GROUP BY parameter_id, method
ORDER BY parameter_id, method;
```

Le pipeline worker doit être actif pendant l'import :
```bash
# Vérifier que le worker tourne (ou le lancer manuellement)
python scripts/pipeline_worker.py --database-url ... --once
```

---

*Document créé le 2026-06-01. À consulter au début de la prochaine session de rédaction.*


Voici la restructuration stricte de votre document selon le format **IMRaD** (Introduction, Matériel & Méthodes, Résultats, Discussion).
Nouveau titre: Modélisation Prédictive Hybride par Géostatistique et Apprentissage Automatique des Paramètres Géotechniques Nationaux : Application au Togo
### **RÉSUMÉ / ABSTRACT**

### **1. INTRODUCTION**

_Cette section fusionne l'introduction générale et les fondements théoriques pour poser le cadre avant d'entrer dans la méthodologie propre au projet._

- **1.1. Contexte et problématique** _(Ancienne section 1)_
    
- **1.2. Rappels théoriques sur la géostatistique linéaire** _(Ancienne section 2)_
    
    - 1.2.1. Hypothèses de stationnarité
        
    - 1.2.2. Propriétés d’optimalité du krigeage
        
    - 1.2.3. Relation entre krigeage et régression
        
    - 1.2.4. Intervalles de prédiction vs intervalles de confiance
        

### **2. MATÉRIEL ET MÉTHODES**

_Cette section rassemble toutes les informations nécessaires pour reproduire l'étude : la zone, les données brutes, les covariables, les mathématiques des modèles et leur implémentation._

- **2.1. Zone d’étude, données et contexte géologique** _(Ancienne section 3)_
    
    - 2.1.1. Territoire togolais et contraintes spatiales
        
    - 2.1.2. Base de données géotechniques
        
    - 2.1.3. Couches géologiques et pédologiques auxiliaires
        
- **2.2. Calcul des covariables SCORPAN** _(Ancienne section 10)_
    
    - 2.2.1. Modèle numérique de terrain
        
    - 2.2.2. Covariables climatiques
        
    - 2.2.3. Covariables géologiques et pédologiques
        
    - 2.2.4. Résumé des covariables
        
- **2.3. Formulations mathématiques des modèles** _(Ancienne section 4)_
    
    - 2.3.1. L1 — Krigeage avec dérive externe hiérarchique _(Inclut : Modèle structural, Prior, Équations, Variogramme)_
        
    - 2.3.2. L2a — Régression kriging SCORPAN _(Inclut : Cadre conceptuel, Ridge, Résidus)_
        
    - 2.3.3. L2b — Fusion bayésienne par BLUP _(Inclut : Motivation, Combinaison)_
        
    - 2.3.4. L3 — Régression PLS sur indices spectraux Sentinel-2 _(Inclut : Fondements, Modèle PLS)_
        
    - 2.3.5. L4 — Processus gaussien multi-tâches _(Inclut : Coregionalisation, Co-krigeage)_
        
- **2.4. Implémentation algorithmique et architecture** _(Fusion des anciennes sections 5 et 11 expurgée des détails d'infrastructure trop spécifiques)_
    
    - 2.4.1. Infrastructure de données et pipeline hiérarchique _(Anciennes 5.1 et 5.2)_
        
    - 2.4.2. Algorithme KED-H _(Ancienne 11.1)_
        
    - 2.4.3. Validation croisée Leave-One-Out rigoureuse _(Anciennes 5.3 et 11.2)_
        
    - 2.4.4. Calibration du paramètre Ridge _(Ancienne 11.3)_
        
    - 2.4.5. Analyse des composantes PLS _(Ancienne 11.4)_
        
    - 2.4.6. Paramètres variographiques par paramètre _(Ancienne 11.5)_
        

### **3. RÉSULTATS**

_Regroupe purement les métriques, les performances, les cartes générées et les tests de robustesse, sans les interpréter en profondeur._

- **3.1. Validation et performances des modèles** _(Ancienne section 6 partiellement)_
    
    - 3.1.1. Performance LOO-CV comparative
        
    - 3.1.2. Dégradation de la précision avec la profondeur
        
    - 3.1.3. Réduction de variance par fusion bayésienne
        
    - 3.1.4. Résultats VfS-PLS
        
- **3.2. Prédictions spatiales et cartographie nationale** _(Anciennes 6.4 et 6.6)_
    
    - 3.2.1. Cartographie nationale
        
    - 3.2.2. Profil de prédiction et incertitude spatiale
        
- **3.3. Analyse de sensibilité et robustesse** _(Ancienne section 9)_
    
    - 3.3.1. Sensibilité au modèle variographique
        
    - 3.3.2. Sensibilité à la taille de l’échantillon
        
    - 3.3.3. Influence du paramètre de régularisation sur la prédiction spatiale
        
    - 3.3.4. Performance par région administrative
        

### **4. DISCUSSION**

_Analyse ce que signifient les résultats, comment ils s'intègrent dans la géologie, comment ils se comparent à la littérature, et quelles sont les prochaines étapes._

- **4.1. Analyse géologique des résultats** _(Ancienne section 12)_
    
    - 4.1.1. Distribution spatiale du VBS et contrôles géologiques
        
    - 4.1.2. Comparaison zones géologiques spéciales vs zones générales
        
    - 4.1.3. Anomalies géotechniques identifiées
        
    - 4.1.4. Relation VBS–IP : droite de régression et cohérence physique
        
    - 4.1.5. Interprétation de la matrice de coregionalisation
        
    - 4.1.6. Analyse de l’incertitude spatiale _(Ancienne 12.7)_
        
- **4.2. Synthèse et positionnement scientifique** _(Ancienne section 7)_
    
    - 4.2.1. Position dans la littérature
        
    - 4.2.2. Gain du co-krigeage MTGP
        
    - 4.2.3. Synthèse de la hiérarchie L1–L4
        
- **4.3. Implications pratiques et limites** _(Anciennes 12.6 et 7.3)_
    
    - 4.3.1. Comparaison des politiques de seuillage pour la classification géotechnique
        
    - 4.3.2. Limites épistémiques et techniques
        
- **4.4. Perspectives et développements futurs** _(Ancienne section 13)_
    
    - 4.4.1. CatBoost — conditions d’activation
        
    - 4.4.2. Krigeage transcendant et modèles non-linéaires
        
    - 4.4.3. Vers une prédiction temporelle : atlas dynamique
        
    - 4.4.4. Amélioration de la covariable VfS par SAR
        
    - 4.4.5. Enrichissement du MTGP par mesures laboratoire supplémentaires
        
    - 4.4.6. Passage à l’échelle : déploiement régional Afrique de l’Ouest
        

### **5. CONCLUSION**

- **5.1. Synthèse finale** _(Ancienne section 8 repoussée à sa place logique, juste avant les références, pour clore le document de façon cohérente)_
    

**REMERCIEMENTS**

**RÉFÉRENCES**

**ANNEXES (A à I)** _(Restent inchangées à la fin du manuscrit)_