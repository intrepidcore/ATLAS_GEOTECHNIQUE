# ADR — Deux shells pour le gestionnaire de base de données

## Contexte

- **Carte principale (`index.html`)** : modal vanilla `DbManagerModalComponent.ts` (ouvert depuis le profil / raccourcis), avec onglet **Expert scientifique avancé** (catalogue `ai_parameter_catalog`, file `ai_job_queue`, cache `ai_plot_cache`).
- **Page dédiée (`/db-manager.html`)** : application React `App.tsx` (schéma, tables, staging, etc.).

## Décision

Les deux shells sont **maintenus en parallèle** : pas de dépréciation immédiate de l’un ou de l’autre. L’onglet **Expert scientifique** dans React (`App.tsx`) duplique la **lecture** des mêmes tables Atlas via l’API `/db/table/.../data`, pour que les utilisateurs qui n’ouvrent que `/db-manager.html` voient les vues expert sans passer par la carte.

## Conséquences

- Toute évolution des colonnes ou du périmètre « expert » doit rester alignée entre le modal vanilla et l’onglet React (même tables, mêmes limites par défaut).
- Une factorisation ultérieure possible : module partagé `expert-scientific-data.ts` (requêtes + types) importé par les deux UIs.

## Statut

Accepté — 2026-04-04.
