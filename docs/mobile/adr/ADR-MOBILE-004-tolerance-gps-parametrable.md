# ADR-MOBILE-004 — Rayon terrain de 10 m et exception d'accessibilité

**Date initiale :** août 2026
**Révision :** 27 août 2026
**Statut :** révisé — la règle fixe de 10 m remplace la tolérance paramétrable

## Contexte

Une mission contient des points de sondage prévisionnels. La position réellement enregistrée doit pouvoir être rattachée à un de ces points et rester vérifiable. Une difficulté d'accès peut néanmoins rendre le point exact impraticable.

## Décision

- Une confirmation normale est acceptée uniquement à une distance inférieure ou égale à **10 m** du point prévu. Il s'agit d'un rayon, pas d'un diamètre.
- L'application affiche ce rayon, bloque le bouton normal au-delà de 10 m et le serveur revalide indépendamment la distance avec PostGIS `ST_Distance(...::geography)`.
- Il n'existe plus de bouton « sondage libre » permettant de contourner la règle.
- Au-delà de 10 m, l'opérateur peut utiliser l'exception « point inaccessible ». Le **nom du nouveau point** et la **cause du changement** sont obligatoires.
- L'exception est enregistrée avec le point prévu, les coordonnées prévues et réelles, la distance, le nom, la cause, l'auteur et l'heure. Le point prévu est alors lié au sondage réel comme traité.
- La carte utilise les tuiles OpenStreetMap, affiche la limite GeoJSON de la maille, les points prévisionnels, les cercles de 10 m, les sondages existants et la position GPS actuelle.

## API

- `GET /colab/mobile/missions/:id/map-context` renvoie toujours `tolerance_m: 10`, la maille et les points prévus.
- `POST /colab/mobile/missions/:id/sondage-points/:point_id/confirm` réalise la confirmation normale et refuse au-delà de 10 m.
- `POST /colab/mobile/missions/:id/sondage-points/:point_id/relocate` réalise l'exception. `point_name` et `relocation_reason` sont obligatoires et la position doit être hors du rayon normal.

## Conséquences

La colonne historique `colab_missions.sondage_tolerance_m` reste présente pour compatibilité de schéma, mais n'est plus utilisée pour la validation terrain. Toute modification future de la règle exige une nouvelle décision produit et une révision de cet ADR.

Le calcul d'itinéraire jusqu'au point est différé. La version actuelle fournit les repères cartographiques nécessaires à l'opérateur, sans promettre de guidage routier.
