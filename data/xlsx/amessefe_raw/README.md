# AMESSEFE Raw Data

⚠️ **FICHIERS SOURCES ORIGINAUX - NE PAS MODIFIER**

Ce dossier contient les fichiers Excel bruts fournis par AMESSEFE.
Ces fichiers sont la **source de vérité** pour l'import des données géotechniques.

## Règle d'or

> On ne modifie JAMAIS les fichiers de ce dossier.
> On ne travaille que sur des copies si besoin de transformation.

## Fichiers

| Fichier | Contenu | Date source |
|---------|---------|-------------|
| `bleu.xlsx` | Valeurs de bleu (VBS) | 2025-10-18 |
| `limite.xlsx` | Limites d'Atterberg (WL, WP, IP) | 2025-11-18 |
| `Granulométrie.xlsx` | Granulométrie (% passant) | 2025-12-08 |
| `classification.xlsx` | Classifications sols | 2025-11-18 |
| `potentielle_de_gonflement.xlsx` | Potentiel de gonflement | 2025-11-19 |

## Utilisation

Ces fichiers sont lus par le module `scripts/utils/amessefe_excel.py` qui fournit
une API unifiée pour accéder aux données normalisées.

## Historique

- 2025-12-11 : Création du dossier raw et gel des fichiers sources
