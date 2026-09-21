---
status: active
type: functional-spec
project: atlas / colab-studio
created: 2026-08-27
---

# Saisie des résultats géotechniques de laboratoire

## Objectif

L'onglet « Laboratoire » de chaque mission transpose la fiche `FICHE_EXTRACTION_GEOTECHNIQUE.xlsx` en une saisie progressive adaptée à un écran. Il évite une longue grille horizontale : l'utilisateur identifie d'abord l'échantillon, puis active uniquement les essais réellement réalisés.

Les résultats sont enregistrés dans `atlas.colab_lab_results` comme données de travail validables. Ils ne sont pas promus automatiquement dans les tables scientifiques canoniques : la saisie, le contrôle scientifique et la publication restent trois opérations distinctes.

## Parcours utilisateur

1. Ouvrir une mission dans Atlas Colab Studio.
2. Ouvrir l'onglet « Laboratoire ».
3. Créer une fiche et choisir le sondage lié à la mission.
4. Renseigner le code échantillon, les profondeurs, la date, le laboratoire et l'état remanié/non remanié.
5. Activer les cartes d'essais nécessaires et saisir uniquement leurs valeurs.
6. Enregistrer en brouillon ou marquer la fiche complète.

Les icônes proviennent de Lucide. Aucun pictogramme emoji n'est utilisé.

## Essais pris en charge

- limites d'Atterberg : WL, WP et IP calculé ;
- valeur au bleu de méthylène : VBS, méthode et fraction ;
- gonflement libre : EG ;
- Proctor : énergie, teneur en eau optimale, masse volumique sèche maximale et provenance ;
- CBR : valeur, compactage et provenance ;
- pénétromètre dynamique : résistance dynamique ;
- pressiomètre : module, pression limite et rapport calculé ;
- granulométrie : ouverture de tamis et pourcentage passant ;
- classification : USCS/GTR, groupe et commentaire.

Le point milieu et l'horizon de profondeur sont calculés à l'affichage. Les contrôles guident l'opérateur sur les plages de valeurs et sur les champs de provenance critiques. Le serveur réapplique les contrôles structuraux et de plage ; l'interface cliente n'est pas la source de vérité.

## Contrat API

| Méthode | Route | Usage |
|---|---|---|
| GET | `/colab/missions/:mission_id/lab-results` | lister les fiches de la mission |
| POST | `/colab/missions/:mission_id/lab-results` | créer une fiche |
| PUT | `/colab/missions/:mission_id/lab-results/:result_id` | mettre à jour une fiche |
| DELETE | `/colab/missions/:mission_id/lab-results/:result_id` | supprimer une fiche de travail |

Une fiche référence obligatoirement une mission et un sondage. L'API vérifie que ce sondage est réellement rattaché à la mission.

## Cartographie Colab Studio

« Placer sur la carte » charge la géométrie de la maille de la mission, ajuste automatiquement le cadrage à ses limites, puis superpose les points prévisionnels. Les fonds disponibles sans option expérimentale sont OpenStreetMap Standard/Humanitaire/France, Carto Positron/Voyager/Sombre, OpenTopoMap et Esri Satellite/Topographique.

Les fonds Google Routes, Satellite, Hybride et Relief sont strictement des essais de compatibilité. Ils sont visibles en développement ou avec `VITE_ENABLE_EXPERIMENTAL_GOOGLE_TILES=true`; ils restent masqués dans une construction de production par défaut jusqu'à l'obtention d'une autorisation contractuelle appropriée.
