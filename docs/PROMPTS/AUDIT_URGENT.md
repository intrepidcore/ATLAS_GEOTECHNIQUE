
**Contexte de la découverte :**

Suite à tes récentes requêtes SQL, nous avons identifié une anomalie critique de géocodage dans notre base de données (`atlas_clean`, port 5433).

- Constat : 370 sondages ont un `location_mode = NULL` (tombant dans 112 mailles via un fallback ADM aléatoire). Par conséquent, une seule maille (`TG-0672-0197-01`) concentre de façon erronée 188 sondages. Les autres modes se répartissent ainsi : 112 `adm_random_cell` (104 mailles), 89 `inferred` (58 mailles), et seulement 1 `exact`.
    
- Conséquence : Toute notre modélisation spatiale actuelle repose sur des données d'entrée géographiquement biaisées.
    

**Ta mission se divise en 3 étapes strictes. Tu ne dois passer à l'étape suivante que lorsque la précédente est terminée.**

### ÉTAPE 1 : Rédaction de l'Audit et du Cahier des Charges (Priorité Absolue)

Avant d'écrire la moindre ligne de code pour fixer la vue, tu dois rédiger un document d'audit de fin de session **extrêmement exhaustif et détaillé (minimum 1500 lignes)** dans le dossier `/session/audit/` (crée-le si nécessaire). Ce document ne contiendra aucun code source à exécuter, mais agira comme un cahier des charges architectural complet.

**Ce document d'audit doit obligatoirement détailler les points suivants :**

1. **L'Analyse de l'Anomalie :** Explique en détail le bug du trigger `trg_sondage_geocode` (problème d'index UNIQUE sur la vue matérialisée) et la répartition biaisée actuelle des sondages (les 370 `NULL`, etc.).
    
2. **Stratégie de Re-géocodage (Regex Fuzzy & UI) :**
    
    - Nous allons utiliser les clés d'importation des sondages pour extraire par regex fuzzy le niveau administratif (ADM3) auquel ils appartiennent, et imposer une règle stricte de géocodage.
        
    - **Règle métier de verrouillage :** Si un sondage est assigné à une maille via le mode `random adm` (ou `adm_random_cell`), sa position est verrouillée et ne peut plus être réassignée de manière aléatoire. La seule exception autorisée pour ajouter à cette mail est est un sondage avec des coordonnées réelles (mode = `exact`).
        
    - **Flux de travail hybride :** Le système de regex fuzzy fera un géocodage automatique. Pour les sondages dont le score de correspondance (match) n'atteint pas le plafond fixé, le géocodage se fera **manuellement par l'utilisateur** depuis l'interface `http://localhost:1420/index.html#/sondages`.
        
3. **Conséquences en Cascade (L'Effet Domino) :** Mentionne de manière explicite et détaillée que la correction de ce biais géographique annule la validité de nos résultats actuels. Il faudra impérativement :
    
    - Relancer les workers (jobs) pour les 5 modèles : L1 KED-H, L2a RK SCORPAN, L2b Fusion BLUP, L3 VfS PLS, et L4 MTGP.
        
    - Régénérer toutes les cartes `exports_300dpi` et `exports_3d_v2`.
        
    - **Mise à jour de l'article scientifique :** C'est une étape cruciale. Toutes les figures impactées par la réévaluation géospatiale (les 89 `inferred` -> 58 mailles, etc.) devront être régénérées. Le fichier `.tex` de l'article devra être mis à jour avec les nouvelles valeurs, les nouveaux tableaux de métriques (RMSE), et les nouveaux graphiques.
        

### ÉTAPE 2 : Analyse du code source et de l'environnement

Pour que ton audit soit pertinent et pour préparer les futurs fix :

- Lis le code source lié à l'importation et au géocodage.
    
- Détecte les champs lus par le code pour le système de "fuzzy regex".
    
- Vérifie que la bonne base de données (`atlas_clean`) et les bonnes tables sont branchées dans le code de l'interface et du backend.
    

### ÉTAPE 3 : Reprise du développement (Correctifs, Tests, CI/CD)

**Uniquement APRÈS avoir rédigé, sauvegardé l'audit exhaustif et analysé le code**, tu dois reprendre ton flux de travail technique initial :

1. Continue et termine de fixer les bugs d'UI identifiés dans la capture d'écran précédente (y compris le fix de la MV `v_mailles_with_location_counts` pour qu'elle reflète la réalité temporaire).
    
2. Vérifie et passe tous les tests API (tests `curl`).
    
3. Répare et valide les pipelines CI/CD.
    

_Commence dès maintenant par l'exploration du code source requise pour l'étape 2, puis rédige le document d'audit de l'étape 1. Confirme-moi la création du fichier d'audit avant de passer au code._