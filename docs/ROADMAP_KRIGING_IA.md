1) Architecture microservices (proposition pragmatique)
Court terme (recommandé): garder api-geo orchestrateur + workers jobs (déjà en place) pour ne pas casser l’existant UI/API.
Moyen terme: extraire moteur IA/interpolation en services dédiés:
api-infer (training/inference),
api-opti (aide décision planification),
api-geo reste façade métier/carto/auth.
Pourquoi: isolation de charge CPU, scalabilité indépendante, résilience, cycles de release séparés.
Compatibilité: conserver les endpoints actuels et brancher en interne vers microservices (migration sans rupture).
2) Carte des zones d’étude
Forcer affichage des 3 zones publiées.
Uniformiser style “dépression orange”:
même palette orange pour Lama/Oti/Fosse,
opacité légère en fond,
légende explicite “Dépressions d’étude”.
Ajouter contrôle de visibilité pour ces couches.
3) Rendu thématique lisible
Modifier style choroplèthe:
stroke: none par défaut en mode thématique,
option secondaire: stroke = fillColor avec faible opacity.
Neutraliser les overlays de bordures non-thématiques pendant l’affichage d’une carte thématique.
4) Workflow UI source-first
Panneau: Source en premier (base | interpolation | ia).
Cascade dynamique:
base => paramètres observés uniquement,
interpolation => paramètres interpolables,
ia => paramètres prédits.
Les filtres min_sondages ne s’appliquent pas à interpolation et ia.
5) Pipeline interpolation (paramètre par paramètre)
Définir matrice catégorie/paramètre interpolables.
Lancer jobs kriging par paramètre (batch + incrémental).
Stockage structuré par source=interpolation, parameter, model_version, quality_metrics.
Recompute incrémental au nouvel arrivage de sondages validés.
6) Pipeline IA multi-cibles
Features: géologie, pédologie, hydro, risque gonflement, topographie + voisinage + densité sondages.
Cibles: vbs, ip, granulométrie, etc. (modèles séparés par cible).
Sorties stockées par maille + score de confiance + version modèle.
Trigger/queue: retrain selon seuil qualité/volume (pas à chaque insertion brute).
7) Couche “base/interpolation/ia” dans l’API thématique
Une vue unifiée “thématique par source” pour servir rapidement la carte.
Pré-agrégation/caches pour chargement rapide côté UI.
Si tu valides cette lecture, je passe en implémentation directe dans cet ordre:

symbologie zones + correction bordures thématiques,
workflow UI source-first complet,
matrice interpolation/IA + tables/runs/stockage,
ingestion ressources + features IA multi-cibles.