# Classification RGA — Risque de Gonflement Appareil

## Référence bibliographique

CHASSAGNEUX D., MEISINA C., CREULY C., SIMONIN S. (1996).
*Cartographie de l'aléa retrait-gonflement des sols argileux à l'échelle nationale
et départementale*. Bulletin de liaison des laboratoires des Ponts et Chaussées,
202, 15-27.

## Principe physique

Les sols argileux contiennent des minéraux gonflants (smectites, montmorillonite)
qui absorbent l'eau et augmentent de volume. Ce phénomène est cyclique :
gonflement en saison des pluies, retrait en saison sèche.
L'amplitude du mouvement peut atteindre 10 cm en surface pour les Vertisols
togolais, provoquant des fissures en façades et des ruptures de chaussées.

## Paramètres d'entrée

| Paramètre | Symbole | Unité | Source Atlas |
|-----------|---------|-------|-------------|
| Indice de plasticité | IP | % | ip_derived_h2 |
| Valeur de bleu de méthylène | VBS | g/100g | vbs_ked_h2 |
| Potentiel de gonflement | EG | % | eg_ked_h2 |

L'horizon H2 (1.5m) est l'horizon de référence pour les fondations superficielles.

## Règles de classification

La classification utilise une logique OU : la classe la plus défavorable
parmi les trois critères est retenue.

| Classe | IP (%) | VBS (g/100g) | EG (%) | Recommandation |
|--------|--------|--------------|--------|----------------|
| Faible | < 15   | < 2          | < 3    | Fondations standard |
| Moyen  | 15–25  | 2–5          | 3–5    | Surveillance recommandée |
| Fort   | 25–35  | 5–8          | 5–7    | Fondations adaptées |
| Très fort | > 35 | > 8         | > 7    | Fondations spéciales |

## Application au contexte togolais

| Type de sol | Classe RGA typique | Zones concernées |
|-------------|-------------------|-----------------|
| Vertisols et Paravertisols | Très fort | Dépression de la Lama, Bado |
| Hydromorphes | Fort à moyen | Plaine du Mono, Oti |
| Ferrugineux Tropicaux | Moyen à faible | Centre et Nord Togo |
| Ferralitiques | Faible | Plateau Akposso, région forestière |

## Implémentation dans Atlas

Le calcul est réalisé par `scripts/derive_rga_from_ked_h2.py`.
Les résultats sont stockés dans `atlas.maille_geotech_infer`
avec `source_type = 'derived_rga_from_ked'`.

La logique Python implémente exactement les seuils du tableau ci-dessus
avec une règle OU — si un seul des trois paramètres atteint le seuil
d'une classe supérieure, la maille est classée dans cette classe.