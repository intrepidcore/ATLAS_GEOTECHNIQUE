Voici exactement comment l'organisation du panneau est prévue :

### 1. Le filtre "Source de données"

Les anciennes options génériques (_base, interpolation, ia/opti_) sont remplacées par un menu déroulant précis séparé en deux groupes, exposant clairement les modèles :

- **Données terrain :**
    
    - Base (Mesures directes issues des sondages)
        
- **Machine Learning géostatistique :**
    
    - ML L1 — KED Hiérarchique (Dérive 5 niveaux)
        
    - ML L2a — RK-SCORPAN (Regression Kriging)
        
    - ML L2b — Fusion Bayésienne BLUP
        
    - ML L3 — VfS-PLS Sentinel-2 (VBS surface uniquement)
        
    - ML L4 — MTGP/ICM (Multi-Tâches)
        

### 2. Le filtre "Catégorie"

Pour clarifier l'interface, les 7 anciens objectifs métiers ont été condensés en **familles scientifiques logiques** :

- **Couverture terrain :** Densité des sondages, nombre d'échantillons, etc.
    
- **Argilosité & plasticité :** Regroupe les paramètres VBS, IP, WL, WP et l'Indice de Gonflement (Eg).
    
- **Portance & compactage :** Regroupe les paramètres mécaniques CBR 95%, γd max et wopt.
    
- **In-situ & pressiométrique :** Regroupe les paramètres de résistance dynamique (Rd), NSPT, Cu, Em, et Pl.
    

### 3. Le filtre "Horizon"

- L'ancien libellé "Horizon KED" devient simplement **"Horizon"** (H1, H2, H3), car le modèle KED n'est plus le seul à utiliser cette dimension verticale.
    
- **Affichage dynamique :** Ce sélecteur sera automatiquement masqué si l'utilisateur choisit la source _Base_ (données brutes) ou _ML L3 VfS_ (qui ne concerne que la surface).
    
- **Avertissements intégrés :** Si l'utilisateur sélectionne le modèle _ML L2a RK_ sur l'horizon _H2_ pour certains paramètres, un message d'alerte (warning) s'affichera automatiquement pour prévenir que les métriques sont dégradées sur cette couche spécifique.
    

### 4. Le Badge de Métriques "Live"

Juste en dessous de la carte, un nouveau composant dynamique (le `modelBadge`) est prévu. À chaque fois que vous changerez de modèle ou de paramètre dans le panneau thématique, ce badge affichera en temps réel :

- Le score de validation croisée (ex: **LOO-RMSE VBS H1: 2.94 g/100g**).
    
- Le nombre de mailles couvertes (ex: **29 407 mailles**).
    
- La variance ou la réduction d'incertitude spécifique au modèle sélectionné.